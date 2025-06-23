import { NextRequest } from 'next/server';
import { MongoClient } from 'mongodb';
import { verifyAuth } from '@/lib/auth';
import { getCompanyDbName } from '@/lib/companyDb';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const mainDbName = 'org_sim_db';

/**
 * Get the user's company database connection from a request
 * Use ONLY in API route handlers, not in middleware or Edge functions
 * 
 * @param req The Next.js request object
 * @returns Object with the client, main database, company database, and company code
 */
export async function getCompanyDbFromRequest(req: NextRequest) {
  let client: MongoClient | null = null;
  
  try {
    // Check if running in edge runtime
    if (typeof process === 'undefined' || process.env.NEXT_RUNTIME === 'edge') {
      throw new Error('getCompanyDbFromRequest cannot be used in Edge Runtime');
    }
    
    // Get token from request
    const token = req.cookies.get('token')?.value || 
                 req.headers.get('authorization')?.split(' ')[1] || 
                 '';
    
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    // Verify token and get payload
    const payload = await verifyAuth(token);
    
    if (!payload) {
      throw new Error('Invalid authentication token');
    }
    
    // Get company code from token payload or header
    const companyCode = payload.companyCode || req.headers.get('x-company-code');
    
    if (!companyCode) {
      throw new Error('No company code found');
    }
    
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    // Get main database
    const mainDb = client.db(mainDbName);
    
    // Get company database
    const companyDbName = getCompanyDbName(companyCode);
    const companyDb = client.db(companyDbName);
    
    return {
      client,
      mainDb,
      companyDb,
      companyCode
    };
  } catch (error) {
    if (client) {
      await client.close();
    }
    throw error;
  }
}

/**
 * Close a MongoDB client connection
 * @param client The MongoDB client to close
 */
export async function closeDbConnection(client: MongoClient | null) {
  if (client) {
    await client.close();
  }
} 