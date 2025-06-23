import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { MongoClient } from 'mongodb';
import { unstable_noStore as noStore } from 'next/cache';

// In-memory fallback for development/demo
const memoryStore: Record<string, any> = {};

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';

/**
 * Check if user has any ERP connections or integrations
 */
export async function GET(request: NextRequest) {
  noStore();
  let client: MongoClient | null = null;
  
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1] || request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const payload = await verifyAuth(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    
    const userEmail = payload.email;
    const userId = payload.id;
    const companyCode = payload.companyCode?.toLowerCase(); // Force lowercase for consistency
    
    // For users without a company code, assume no ERP connections
    if (!companyCode) {
      return NextResponse.json({
        hasConnection: false,
        message: 'No company code found'
      });
    }
    
    // Validate MongoDB connection string
    if (!uri || uri.trim() === '') {
      console.error('MongoDB URI is not set or empty');
      return NextResponse.json(
        { hasConnection: false, error: 'Database configuration missing' },
        { status: 500 }
      );
    }

    try {
      // Connect to MongoDB - Use company specific database
      const companyDbName = `company_${companyCode}`;
      client = new MongoClient(uri);
      await client.connect();
      
      const db = client.db(companyDbName);
      
      // Check for both integrations and integration_history
      const integrationsExists = (await db.listCollections({ name: 'integrations' }).toArray()).length > 0;
      const historyExists = (await db.listCollections({ name: 'integration_history' }).toArray()).length > 0;
      
      if (!integrationsExists && !historyExists) {
        // No collections exist yet, so no integrations
        return NextResponse.json({
          hasConnection: false,
          message: 'No integrations found'
        });
      }
      
      let hasIntegrations = false;
      let integrationCount = 0;
      let historyCount = 0;
      
      // Check for data in integrations collection
      if (integrationsExists) {
        const integrationsCollection = db.collection('integrations');
        integrationCount = await integrationsCollection.countDocuments({ _importedBy: userEmail });
        hasIntegrations = integrationCount > 0;
      }
      
      // Check for history records by this user
      if (historyExists) {
        const historyCollection = db.collection('integration_history');
        historyCount = await historyCollection.countDocuments({ userId: userId });
        hasIntegrations = hasIntegrations || historyCount > 0;
      }
      
      return NextResponse.json({
        hasConnection: hasIntegrations,
        integrationCount,
        historyCount,
        message: hasIntegrations ? 'Integrations found' : 'No integrations found'
      });
    } catch (dbError: any) {
      console.error('Database error in ERP status check:', dbError);
      // Return a response that doesn't fail the frontend
      return NextResponse.json({
        hasConnection: false,
        error: 'Database connection error',
        message: dbError.message
      });
    }
    
  } catch (error: any) {
    console.error('Error checking ERP connections:', error);
    
    // Return a response that doesn't fail the frontend
    return NextResponse.json({
      hasConnection: false,
      error: 'Error checking connections'
    });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Error closing MongoDB connection:', closeError);
      }
    }
  }
} 