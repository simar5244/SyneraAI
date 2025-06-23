import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';

/**
 * Get integration history for the authenticated user
 */
export async function GET(request: NextRequest) {
  noStore();
  let client: MongoClient | null = null;
  
  try {
    // 1. Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1] || request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const payload = await verifyAuth(token);
    if (!payload || !payload.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userEmail = payload.email;
    const companyCode = payload.companyCode;
    
    if (!companyCode) {
      return NextResponse.json({ error: 'Company code not found in user profile' }, { status: 400 });
    }
    
    console.log(`Integrations API accessed by: ${userEmail} (User ID: ${payload.id}, Company: ${companyCode})`);

    // Validate MongoDB connection string
    if (!uri || uri.trim() === '') {
      console.error('MongoDB URI is not set or empty');
      return NextResponse.json(
        { error: 'Database configuration missing' },
        { status: 500 }
      );
    }

    // Connect to MongoDB - Use company specific database
    const dbName = `company_${companyCode}`;
    console.log(`Connecting to MongoDB company database: ${dbName}`);
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const integrationsCollection = db.collection('integrations');
    
    // Get query parameters for filtering
    const type = request.nextUrl.searchParams.get('type');
    const status = request.nextUrl.searchParams.get('status');
    
    // Build query based on user email and optional filters
    const query: any = { uploader: userEmail };
    
    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }
    
    // Get integration history for this user
    const integrations = await integrationsCollection.find(
      query,
      { 
        projection: { 
          _id: 1,
          type: 1, 
          filename: 1, 
          uploadedAt: 1, 
          status: 1,
          recordCount: 1 
        }
      }
    ).sort({ uploadedAt: -1 }).toArray();
    
    return NextResponse.json({
      success: true,
      integrations
    });
    
  } catch (error: any) {
    console.error('Error fetching integration history:', error);
    let errorMessage = 'Error fetching integration history';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
} 