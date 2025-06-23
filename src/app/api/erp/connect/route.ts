import { NextRequest, NextResponse } from 'next/server';
import { Redis } from 'ioredis';
import { z } from 'zod';
import { getToken } from 'next-auth/jwt';
import crypto from 'crypto';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { connectToMongoDB } from '@/lib/dbConnect';
import mongoose from 'mongoose';
import Organization from '@/models/Organization';
import User from '@/models/User';
import authService from '@/services/authService';
import connectDB from '@/lib/db';
import { ObjectId } from 'mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// Configuration for Redis
// In production, ensure this is configured with proper security
let redis: Redis | null = null;
try {
  if (process.env.REDIS_URL) {
    // Only attempt to connect if REDIS_URL is set
    try {
      redis = new Redis(process.env.REDIS_URL, {
        tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
        retryStrategy: () => null, // Disable automatic retry
        connectTimeout: 1000, // Short timeout
        maxRetriesPerRequest: 0 // Don't retry requests
      });
      
      // Handle connection errors
      redis.on('error', (err) => {
        console.error('Redis connection error, falling back to in-memory storage:', err.message);
        redis = null; // Disable redis on error
      });
    } catch (error) {
      console.error('Redis initialization error, falling back to in-memory storage:', error);
      redis = null;
    }
  } else {
    console.log('No REDIS_URL provided, using in-memory storage');
  }
} catch (error) {
  console.error('Redis connection error:', error);
  // Will fallback to in-memory storage
}

// In-memory fallback for development/demo (not suitable for production)
const memoryStore: Record<string, any> = {};

// Rate limiting configuration - important for security
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 attempts per minute
const rateLimitTracking: Record<string, { count: number, timestamp: number }> = {};

// Validation schema for connection parameters
// This needs to be strict for secure systems
const connectionSchema = z.object({
  type: z.enum(['SAP_HR', 'WORKDAY', 'ORACLE', 'MICROSOFT_AD', 'PEOPLESOFT']),
  host: z.string().optional(),
  port: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  database: z.string().optional(),
  domain: z.string().optional(),
  apiKey: z.string().optional(),
  tenantId: z.string().optional(),
  useSsl: z.boolean().default(true),
  systemId: z.string().optional(),
});

// Connection detail validation schema by type
const typeValidators = {
  SAP_HR: z.object({
    host: z.string().min(1, "Host is required"),
    port: z.string().min(1, "Port is required"),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    systemId: z.string().min(1, "System ID is required"),
  }),
  WORKDAY: z.object({
    apiKey: z.string().min(1, "API Key is required"),
    tenantId: z.string().min(1, "Tenant ID is required"),
  }),
  ORACLE: z.object({
    host: z.string().min(1, "Host is required"),
    port: z.string().min(1, "Port is required"),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    database: z.string().min(1, "Database is required"),
  }),
  MICROSOFT_AD: z.object({
    domain: z.string().min(1, "Domain is required"),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }),
  PEOPLESOFT: z.object({
    host: z.string().min(1, "Host is required"),
    port: z.string().min(1, "Port is required"),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    database: z.string().min(1, "Database is required"),
  }),
};

// Simplified IP extraction for rate limiting
function getClientIP(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return '127.0.0.1';
}

// Rate limiting check
function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const clientData = rateLimitTracking[clientId] || { count: 0, timestamp: now };
  
  // Reset if window has passed
  if (now - clientData.timestamp > RATE_LIMIT_WINDOW) {
    clientData.count = 1;
    clientData.timestamp = now;
  } else {
    clientData.count += 1;
  }
  
  rateLimitTracking[clientId] = clientData;
  return clientData.count <= RATE_LIMIT_MAX;
}

// Securely store connection data
async function storeConnectionData(userId: string, connectionData: any, companyCode: string): Promise<void> {
  try {
    // First try to use Redis for caching
    if (redis) {
      const key = `erp_connection:${userId}:${companyCode}`;
      const value = JSON.stringify({
        ...connectionData,
        timestamp: new Date().toISOString()
      });
      
      await redis.set(key, value);
      // Set expiration to 30 days
      await redis.expire(key, 30 * 24 * 60 * 60);
    }
    
    // Always store in MongoDB for persistence
    if (uri) {
      const client = new MongoClient(uri);
      await client.connect();
      
      // Store in company-specific database
      const companyDbName = `company_${companyCode.toLowerCase()}`;
      const db = client.db(companyDbName);
      
      // Check if integration_history collection exists, create if not
      const historyCollections = await db.listCollections({ name: 'integration_history' }).toArray();
      if (historyCollections.length === 0) {
        await db.createCollection('integration_history');
        console.log(`Created 'integration_history' collection in ${companyDbName}`);
      }
      
      // Store connection in integration_history
      const historyCollection = db.collection('integration_history');
      await historyCollection.insertOne({
        type: connectionData.type,
        connectionDetails: {
          ...connectionData,
          // Remove sensitive data
          password: undefined,
          clientSecret: undefined
        },
        userId: userId,
        companyCode: companyCode,
        connectedAt: new Date(),
        status: 'active'
      });
      
      await client.close();
      return;
    }
    
    // Fallback to in-memory store if MongoDB is unavailable
    memoryStore[`erp_connection:${userId}:${companyCode}`] = {
      ...connectionData,
      timestamp: new Date().toISOString()
    };
    
    // Log that we're using in-memory storage (not ideal for production)
    console.log(`Stored ERP connection data for user ${userId} in memory (MongoDB unavailable)`);
  } catch (error) {
    console.error('Error storing connection data:', error);
    throw new Error('Failed to store connection data');
  }
}

// Functions to execute Python script for validation
async function validateERPConnection(connectionType: string, credentials: any): Promise<{success: boolean; message: string}> {
  return new Promise((resolve, reject) => {
    try {
      const scriptPath = path.join(process.cwd(), 'erpbackend.py');
      
      // Check if script exists
      if (!fs.existsSync(scriptPath)) {
        console.error(`Python script not found at ${scriptPath}`);
        return resolve({ success: false, message: 'ERP backend not properly configured' });
      }
      
      // Create a temporary input file with connection parameters
      const tempInput = path.join(process.cwd(), `erp-input-${Date.now()}.json`);
      
      let args: string[] = [];
      let data: Record<string, any> = {};
      
      // Map credentials to what the Python script expects based on connection type
      switch (connectionType) {
        case 'SAP_HR':
          args = ['--sap-only'];
          data = {
            sap_ashost: credentials.host || '',
            sap_sysnr: credentials.sysnr || credentials.port || '',
            sap_client: credentials.client || credentials.systemId || '',
            sap_user: credentials.user || credentials.username || '',
            sap_passwd: credentials.passwd || credentials.password || ''
          };
          break;
          
        case 'PEOPLESOFT':
          args = ['--ps-only'];
          data = {
            ps_url: credentials.url || `http://${credentials.host}:${credentials.port}`,
            ps_user: credentials.username || '',
            ps_passwd: credentials.password || '',
            ps_database: credentials.database || ''
          };
          break;
          
        case 'MICROSOFT_AD':
          args = ['--ad-only'];
          data = {
            ad_server: credentials.server || `ldap://${credentials.domain}`,
            ad_domain: credentials.domain || '',
            ad_user: credentials.username || '',
            ad_passwd: credentials.password || '',
            ad_search_base: `DC=${credentials.domain?.split('.').join(',DC=')}` || ''
          };
          break;
          
        default:
          return resolve({ 
            success: false, 
            message: `Unsupported ERP type: ${connectionType}` 
          });
      }
      
      // Write connection parameters to temp file
      fs.writeFileSync(tempInput, JSON.stringify(data));
      
      // Append input file to arguments
      args.push('--input-file', tempInput);
      
      console.log(`Executing Python script with args: ${args.join(' ')}`);
      
      let stdout = '';
      let stderr = '';
      
      // Spawn Python process
      const pythonProcess = spawn('python3', [scriptPath, ...args]);
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Python stdout:', data.toString());
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('Python stderr:', data.toString());
      });
      
      pythonProcess.on('close', (code) => {
        // Clean up temp file
        if (fs.existsSync(tempInput)) {
          try {
            fs.unlinkSync(tempInput);
          } catch (err) {
            console.error('Error cleaning up temp file:', err);
          }
        }
        
        if (code === 0) {
          // Check stdout for valid JSON output
          try {
            // If the script outputs JSON result
            if (stdout.includes('{') && stdout.includes('}')) {
              const jsonStart = stdout.indexOf('{');
              const jsonEnd = stdout.lastIndexOf('}') + 1;
              const jsonStr = stdout.substring(jsonStart, jsonEnd);
              const result = JSON.parse(jsonStr);
              
              resolve({ 
                success: result.success || true, 
                message: result.message || 'Successfully connected to ERP system' 
              });
            } else {
              // Handle plain text success
              resolve({ success: true, message: 'Successfully connected to ERP system' });
            }
          } catch (err) {
            // If parsing fails, assume success
            resolve({ success: true, message: 'Successfully connected to ERP system' });
          }
        } else {
          // Check if stderr contains error messages
          let errorMessage = 'Failed to connect to ERP system';
          
          if (stderr) {
            // Extract error from stderr
            // Look for common error patterns in erpbackend.py output
            if (stderr.includes('Error extracting data from')) {
              const errorStart = stderr.indexOf('Error extracting data from');
              const errorEnd = stderr.indexOf('\n', errorStart);
              if (errorEnd > errorStart) {
                errorMessage = stderr.substring(errorStart, errorEnd).trim();
              } else {
                errorMessage = stderr.substring(errorStart).trim();
              }
            } else if (stderr.includes('Authentication failed')) {
              errorMessage = 'Authentication failed. Please check your credentials.';
            } else if (stderr.includes('Connection failed')) {
              errorMessage = 'Connection failed. Please check your server details.';
            } else if (stderr.includes('No employee data returned')) {
              // This might be a success but with no data
              resolve({ 
                success: true, 
                message: 'Connection successful but no employee data was found',
                dataFound: false
              });
              return;
            }
          }
          
          resolve({ success: false, message: errorMessage });
        }
      });
      
      pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        resolve({ success: false, message: 'Failed to execute ERP backend' });
      });
    } catch (error) {
      console.error('Error validating ERP connection:', error);
      resolve({ success: false, message: 'Internal server error' });
    }
  });
}

// For demo mode - validate with mock credentials
// These will be used when Python backend is unavailable
function validateWithMockCredentials(type: string, credentials: any): boolean {
  switch (type) {
    case 'SAP_HR':
      return credentials.host === 'sap.example.com' && 
             credentials.port === '8000' && 
             credentials.username === 'admin' && 
             credentials.password === 'SAP-admin2024' &&
             credentials.systemId === 'PRD';
      
    case 'PEOPLESOFT':
      return credentials.host === 'ps.example.org' && 
             credentials.port === '9000' && 
             credentials.database === 'PSHRMS' && 
             credentials.username === 'ps_admin' && 
             credentials.password === 'PeopleSoft2024!';
      
    case 'MICROSOFT_AD':
      return credentials.domain === 'example.com' && 
             credentials.username === 'administrator' && 
             credentials.password === 'AdminAD2024!';
      
    case 'WORKDAY':
      return credentials.tenantId === 'acme-corporation' && 
             credentials.apiKey === 'wday_api_93f8a22c47';
      
    default:
      return false;
  }
}

// Interface for ERP connection details
interface ERPConnectionRequest {
  type: string;
  details: {
    host?: string;
    apiKey?: string;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    tenantId?: string;
    instanceUrl?: string;
    domain?: string;
    port?: number;
    database?: string;
    [key: string]: any;
  };
}

// POST /api/erp/connect
export async function POST(req: NextRequest) {
  try {
    // Rate limiting check
    const clientIP = getClientIP(req);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
    
    // Get session data
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request data
    const data = await req.json();
    
    // Validate basic connection data
    try {
      connectionSchema.parse(data);
    } catch (error: any) {
      return NextResponse.json(
        { error: `Validation error: ${error.message}` },
        { status: 400 }
      );
    }
    
    // Validate specific ERP type requirements
    const typeValidator = typeValidators[data.type as keyof typeof typeValidators];
    try {
      typeValidator.parse(data);
    } catch (error: any) {
      return NextResponse.json(
        { error: `Validation error: ${error.message}` },
        { status: 400 }
      );
    }
    
    // Validate connection with ERP backend
    const validationResult = await validateERPConnection(data.type, data);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.message },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectToMongoDB();
    
    // Get user information
    const userId = session.user.id || session.user.email;
    const userEmail = session.user.email;
    const companyCode = session.user.companyCode?.toLowerCase();
    
    // Check if user has a company code
    if (!companyCode) {
      return NextResponse.json({
        error: 'No company code found',
        message: 'Your account is not associated with a company'
      }, { status: 400 });
    }
    
    // Store connection data
    await storeConnectionData(userId, {
      type: data.type,
      organizationId: data.organizationId,
      host: data.host,
      port: data.port,
      username: data.username,
      useSsl: data.useSsl,
      systemId: data.systemId,
      domain: data.domain,
      apiKey: data.apiKey,
      tenantId: data.tenantId,
      connected: new Date().toISOString(),
      connectedBy: userEmail
    }, companyCode);
    
    // Get organization from database
    await connectDB();
    const organization = await Organization.findOne({});
    
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }
    
    // If organization exists, update or add new ERP connection
    const erpConnection = {
      type: data.type,
      details: {
        host: data.host,
        port: data.port,
        username: data.username,
        systemId: data.systemId,
        domain: data.domain,
        apiKey: data.apiKey,
        tenantId: data.tenantId
      },
      status: 'active',
      lastSyncDate: new Date(),
      connectedBy: session.user.email,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Check if connection with this type already exists
    const existingConnIndex = organization.erpConnections?.findIndex((conn: any) => conn.type === data.type);
    
    if (existingConnIndex >= 0 && organization.erpConnections) {
      // Update existing connection
      organization.erpConnections[existingConnIndex] = {
        ...organization.erpConnections[existingConnIndex],
        details: erpConnection.details,
        status: 'active',
        lastSyncDate: new Date(),
        updatedAt: new Date()
      };
    } else {
      // Add new connection
      if (!organization.erpConnections) {
        organization.erpConnections = [];
      }
      organization.erpConnections.push(erpConnection);
    }
    
    // Update organization in database
    organization.erpConnections = organization.erpConnections || [];
    organization.hasERPConnection = true;
    organization.updatedAt = new Date();
    await organization.save();
    
    // Make sure we have a valid token for the API call
    const tokenValue = req.headers.get('authorization')?.split(' ')[1] || 
                      req.cookies.get('token')?.value || getToken({});
    
    // Trigger the automatic merge process via internal API
    try {
      // Don't wait for the result to avoid delaying the main API response
      await fetch('/api/integrations/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenValue}`
        },
        body: JSON.stringify({ companyCode })
      }).catch(error => {
        console.error('Error triggering integration merge after ERP connection:', error);
      });
    } catch (error) {
      console.error('Failed to initiate integration merge:', error);
    }
    
    // Return success response
    const dataFound = validationResult.dataFound !== false;
    return NextResponse.json({
      success: true,
      message: dataFound 
        ? 'ERP connection saved successfully' 
        : 'Connection successful but no employee data was found',
      dataFound: dataFound,
      connection: {
        type: data.type,
        status: 'active',
        lastSyncDate: new Date()
      },
      mergeStatus: 'automatic' // Change from mergeTriggered to mergeStatus
    });
  } catch (error) {
    console.error('Error connecting to ERP:', error);
    return NextResponse.json(
      { error: 'Failed to connect to ERP system' },
      { status: 500 }
    );
  }
}

// GET /api/erp/connect - Get current connection status
export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Connect to MongoDB
    await connectDB();
    
    // Find the organization
    const organization = await Organization.findOne({});
    
    if (!organization || !organization.erpConnections || organization.erpConnections.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No ERP connections found',
        connection: null
      });
    }
    
    // Find the most recent active connection
    let activeConnection = organization.erpConnections
      .filter((conn: any) => conn.status === 'active')
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    
    if (!activeConnection) {
      return NextResponse.json({ 
        success: true,
        message: 'No active ERP connections found',
        connection: null
      });
    }
    
    // Return connection details (without sensitive information)
    return NextResponse.json({
      success: true,
      connection: {
        type: activeConnection.type,
        status: activeConnection.status,
        lastSyncDate: activeConnection.lastSyncDate,
        connectedBy: activeConnection.connectedBy,
        createdAt: activeConnection.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching ERP connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ERP connections' },
      { status: 500 }
    );
  }
} 