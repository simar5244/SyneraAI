import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import connectDB from '@/lib/dbConnect';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection string
const uri = process.env.MONGODB_URI || '';

export async function GET(req: NextRequest) {
  let client: MongoClient | null = null;
  
  try {
    // Get token from request
    const token = req.cookies.get('token')?.value || 
                  req.headers.get('authorization')?.split(' ')[1] || 
                  '';
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Verify token and get payload
    const payload = await verifyAuth(token);
    
    if (!payload) {
      return NextResponse.json(
        { success: false, message: 'Invalid authentication token' },
        { status: 401 }
      );
    }
    
    // Get user ID and company code from token
    const userId = payload.id;
    const companyCode = payload.companyCode;
    
    if (!userId || !companyCode) {
      return NextResponse.json(
        { success: false, message: 'User ID or company code not found in token' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB and query company-specific users collection directly
    client = new MongoClient(uri);
    await client.connect();
    const dbName = `company_${companyCode}`;
    const db = client.db(dbName);
    const usersColl = db.collection('users');
    const objId = new (require('mongodb').ObjectId)(userId);
    const user = await usersColl.findOne(
      { _id: objId }, 
      { projection: { password: 0, passwordHash: 0 } }
    );
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    
    // Add debug logging
    console.log(`User status check for ${userId}, status: ${user?.status}`);
    
    // Return user status and complete user object
    const userToReturn = {
      ...user,
      id: userId,                // Ensure ID is included
      _id: userId.toString(),    // Include the ID as a string too
      companyCode: companyCode,  // Include company code
    };
    
    console.log(`Returning status ${user.status} for user ${user.email}`);
    
    return NextResponse.json({
      success: true,
      status: user.status,
      user: userToReturn
    });
    
  } catch (error) {
    console.error('Error checking user status:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to check user status' },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
} 