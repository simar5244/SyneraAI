import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from "@/lib/auth";
import connectDB from '@/lib/dbConnect';
import User, { getUserModel } from '@/models/User';
import { unstable_noStore as noStore } from 'next/cache';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';

/**
 * Get current user information with complete profile data
 */
export async function GET(request: NextRequest) {
  noStore();
  
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
    
    // Connect to database
    await connectDB();
    
    // Get company code from token or header
    const companyCode = 
      request.headers.get('X-Company-Code') || 
      payload.companyCode || 
      '';
    
    console.log(`[GET /api/user/me] Looking for user ${payload.id} with company code: ${companyCode || 'none'}`);
    
    // Find user in database
    let user = null;
    
    // First try with company code if available
    if (companyCode) {
      try {
        // Check if ID is a valid ObjectId
        if (mongoose.isValidObjectId(payload.id)) {
          console.log(`[GET /api/user/me] Using Mongoose findById with valid ObjectId`);
          const CompanyUser = getUserModel(companyCode);
          user = await CompanyUser.findById(payload.id).select('-password -__v');
          if (user) {
            console.log(`[GET /api/user/me] Found user in company database using Mongoose: ${companyCode}`);
          }
        } else {
          // For non-ObjectId IDs, use direct MongoDB query
          console.log(`[GET /api/user/me] Using direct MongoDB query for non-ObjectId ID: ${payload.id}`);
          const client = new MongoClient(uri);
          await client.connect();
          const dbName = `company_${companyCode}`;
          const db = client.db(dbName);
          const usersCollection = db.collection('users');
          
          // Try to find by email or string ID
          const userDoc = await usersCollection.findOne({
            $or: [
              { email: payload.email },
              { id: payload.id },
              { userId: payload.id }
            ]
          }, { projection: { password: 0 } });
          
          if (userDoc) {
            console.log(`[GET /api/user/me] Found user in company database using MongoDB: ${companyCode}`);
            user = userDoc;
          }
          
          await client.close();
        }
      } catch (err) {
        console.warn(`[GET /api/user/me] Error querying company database: ${companyCode}`, err);
        // Continue to main database if company-specific lookup fails
      }
    }
    
    // If user not found in company DB, try main database
    if (!user) {
      try {
        if (mongoose.isValidObjectId(payload.id)) {
          console.log(`[GET /api/user/me] Trying main database with valid ObjectId`);
          user = await User.findById(payload.id).select('-password -__v');
          if (user) {
            console.log(`[GET /api/user/me] Found user in main database: ${user.email}`);
          }
        } else {
          // For non-ObjectId IDs, use direct MongoDB query on main database
          console.log(`[GET /api/user/me] Using direct MongoDB query on main database`);
          const client = new MongoClient(uri);
          await client.connect();
          const db = client.db('org_sim_db');
          const usersCollection = db.collection('users');
          
          // Try to find by email or string ID
          const userDoc = await usersCollection.findOne({
            $or: [
              { email: payload.email },
              { id: payload.id },
              { userId: payload.id }
            ]
          }, { projection: { password: 0 } });
          
          if (userDoc) {
            console.log(`[GET /api/user/me] Found user in main database using MongoDB`);
            user = userDoc;
          }
          
          await client.close();
        }
      } catch (err) {
        console.warn(`[GET /api/user/me] Error querying main database:`, err);
      }
    }
    
    // If user still not found, return basic info from token
    if (!user) {
      console.log(`[GET /api/user/me] User not found in any database, returning token data`);
      return NextResponse.json({
        success: true,
        user: {
          id: payload.id,
          email: payload.email,
          role: payload.role,
          company: payload.company,
          companyCode: payload.companyCode,
        }
      });
    }
    
    // Return complete user data
    console.log(`[GET /api/user/me] Successfully fetched complete user profile`);
    return NextResponse.json({
      success: true,
      user: user
    });
    
  } catch (error: any) {
    console.error('Error fetching user data:', error);
    
    return NextResponse.json(
      { error: error.message || 'Error fetching user data' },
      { status: 500 }
    );
  }
} 