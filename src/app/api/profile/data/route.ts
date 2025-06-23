import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DATABASE || 'org_sim_db';
const collectionName = 'merged_output';

export async function GET(request: NextRequest) {
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
    
    // Extract email from query parameters
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { message: 'Email parameter is required' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    // Fetch employee data with all fields
    const employeeData = await collection.findOne({ email });
    
    if (!employeeData) {
      return NextResponse.json(
        { message: 'Employee not found' },
        { status: 404 }
      );
    }
    
    // Format and return the data
    // Convert MongoDB _id to string
    const formattedData = {
      ...employeeData,
      _id: employeeData._id.toString()
    };
    
    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error('Error fetching profile data:', error);
    return NextResponse.json(
      { 
        message: 'Failed to fetch profile data',
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