import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DATABASE || 'org_sim_db';
const collectionName = 'merged_output';

export async function POST(request: NextRequest) {
  let client;
  
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const payload = await verifyAuth(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Get request data
    const { email, duties } = await request.json();
    
    if (!email || !Array.isArray(duties)) {
      return NextResponse.json(
        { message: 'Email and duties array are required' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    // Update employee job responsibilities
    const result = await collection.updateOne(
      { email: email },
      { 
        $set: { 
          jobResponsibilities: duties,
          updatedAt: new Date()
        } 
      }
    );
    
    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { message: 'No employee found with the provided email or no changes made' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'Job duties updated successfully',
      email: email,
      dutiesCount: duties.length
    });
  } catch (error: any) {
    console.error('Error updating job duties:', error);
    return NextResponse.json(
      { 
        message: 'Failed to update job duties',
        error: error.message
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
} 