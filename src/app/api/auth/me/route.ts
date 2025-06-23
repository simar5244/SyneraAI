import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from "@/lib/auth";
import connectDB from '@/lib/dbConnect';
import User, { getUserModel } from '@/models/User';
import mongoose from 'mongoose';
import { MongoClient, ObjectId } from 'mongodb';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';

export async function GET(request: NextRequest) {
  try {
    // 1. Get token from Authorization header
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      console.log('[GET /api/auth/me] Missing authorization token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify the token
    const payload = await verifyAuth(token);
    console.log('[GET /api/auth/me] Token payload:', payload);
    if (!payload || !payload.id) {
      console.log('[GET /api/auth/me] Invalid token or payload missing ID');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Connect to the database
    await connectDB(process.env.MONGODB_URI as string);

    // 4. Check for company-specific database
    const companyCode = 
      request.headers.get('X-Company-Code') || 
      payload.companyCode || 
      '';
      
    // Create MongoDB client for direct queries
    const client = new MongoClient(uri);
    
    console.log(`[GET /api/auth/me] Looking for user ${payload.id} with company code: ${companyCode || 'none'}`);
    
    // 5. Choose the appropriate user model
    let user;
    
    try {
      await client.connect();
      
      // First, try with company code if available
      if (companyCode) {
        try {
          // Try direct MongoDB query first for all ID types
          console.log(`[GET /api/auth/me] Using direct MongoDB query for user ID: ${payload.id}`);
          const dbName = `company_${companyCode}`;
          const db = client.db(dbName);
          const usersCollection = db.collection('users');
          
          // Try to find by email or ID (multiple ways)
          const userDoc = await usersCollection.findOne({
            $or: [
              { email: payload.email },
              { id: payload.id },
              { userId: payload.id }
            ]
          }, { projection: { password: 0 } });
          
          if (userDoc) {
            console.log(`[GET /api/auth/me] Found user in company database using MongoDB: ${companyCode}`);
            user = userDoc;
          } else if (mongoose.isValidObjectId(payload.id)) {
            // If not found and ID is valid ObjectId, try with _id field
            const userByObjectId = await usersCollection.findOne({
              _id: new ObjectId(payload.id)
            }, { projection: { password: 0 } });
            
            if (userByObjectId) {
              console.log(`[GET /api/auth/me] Found user in company database by ObjectId: ${companyCode}`);
              user = userByObjectId;
            }
          }
        } catch (err) {
          console.warn(`[GET /api/auth/me] Error querying company database: ${companyCode}`, err);
          // Continue to main database if company-specific lookup fails
        }
      }
      
      // If user not found in company DB, try main database
      if (!user) {
        try {
          // Try direct MongoDB query on main database
          console.log(`[GET /api/auth/me] Using direct MongoDB query on main database`);
          const db = client.db('org_sim_db');
          const usersCollection = db.collection('users');
          
          // Try to find by email or ID (multiple ways)
          const userDoc = await usersCollection.findOne({
            $or: [
              { email: payload.email },
              { id: payload.id },
              { userId: payload.id }
            ]
          }, { projection: { password: 0 } });
          
          if (userDoc) {
            console.log(`[GET /api/auth/me] Found user in main database using MongoDB`);
            user = userDoc;
          } else if (mongoose.isValidObjectId(payload.id)) {
            // If not found and ID is valid ObjectId, try with _id field
            const userByObjectId = await usersCollection.findOne({
              _id: new ObjectId(payload.id)
            }, { projection: { password: 0 } });
            
            if (userByObjectId) {
              console.log(`[GET /api/auth/me] Found user in main database by ObjectId`);
              user = userByObjectId;
            }
          }
        } catch (err) {
          console.warn(`[GET /api/auth/me] Error querying main database:`, err);
        }
      }
    } finally {
      // Close the MongoDB client connection
      await client.close();
    }

    if (!user) {
      console.log(`[GET /api/auth/me] User not found for ID: ${payload.id}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 6. Return the user data
    console.log(`[GET /api/auth/me] Successfully fetched user: ${user.email}`);
    return NextResponse.json(user);

  } catch (error: any) {
    console.error('[GET /api/auth/me] Error fetching user data:', error);
    // Include error message in development mode for easier debugging
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Failed to fetch user data: ${error.message}`
      : 'Failed to fetch user data';
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}