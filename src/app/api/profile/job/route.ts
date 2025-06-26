import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { verifyAuth } from '@/lib/edgeAuth';
import { connectToDatabase } from '@/services/mongodb';
import User, { getUserModel } from '@/models/User';
import type { Document, Types } from 'mongoose';
import mongoose from 'mongoose';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DATABASE || '';

// Helper function to extract token from Authorization header
const extractToken = (request: NextRequest): string | null => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
};

export async function PATCH(request: NextRequest) {
  noStore();
  
  try {
    // Extract and verify token
    const token = extractToken(request) || request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }
    
    const payload = await verifyAuth(token);
    if (!payload || !payload.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }
    
    // Get company code from payload or header
    const rawCompanyCode = 
      request.headers.get('X-Company-Code') || 
      payload.companyCode || 
      '';
    const companyCode = rawCompanyCode.toLowerCase();
      
    console.log(`[API Profile Job PATCH] User ${payload.id} with company code: ${companyCode || 'none'}`);
    
    // Get update data from request
    const updateData = await request.json();
    console.log('Updating job profile with data:', JSON.stringify(updateData));
    
    // Connect to database
    const mongooseConnection = await connectToDatabase();
    
    // Choose the appropriate user model based on company code
    const UserModel = companyCode ? getUserModel(companyCode) : User;
    
    // Get native MongoDB connection for merged_output collection
    console.log('Connecting to MongoDB for merged_output collection');
    const db = mongooseConnection.connection.db;
    if (!db) {
      throw new Error('Failed to connect to database');
    }
    
    // Use company-specific database if available
    const dbToUse = companyCode ? `company_${companyCode}` : dbName;
    console.log(`Using database: ${dbToUse}`);
    
    const profilesCollection = db.collection('users'); // Use 'users' collection in company DB
    
    // Try to find the user by email from token first
    let user: Document | null = null;
    
    if (payload.email) {
      user = await (UserModel as any).findOne({ email: { $regex: `^${payload.email}$`, $options: 'i' } })
        .select('-password -__v')
        .lean()
        .exec();
    }
    
    // Fallback to find by ID if not found by email
    if (!user?._id && payload.id) {
      if (mongoose.Types.ObjectId.isValid(payload.id)) {
        user = await (UserModel as any).findById(payload.id)
          .select('-password -__v')
          .lean()
          .exec();
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Extract job profile fields
    const profileUpdate: any = {
      updatedAt: new Date()
    };
    
    if (updateData.jobTitle !== undefined) {
      profileUpdate.jobTitle = updateData.jobTitle;
    }
    
    if (updateData.jobResponsibilities !== undefined) {
      profileUpdate.jobResponsibilities = updateData.jobResponsibilities;
    }
    
    if (updateData.toolsProficient !== undefined) {
      profileUpdate.toolsProficient = updateData.toolsProficient;
    }
    
    if (updateData.salary !== undefined) {
      profileUpdate.salary = updateData.salary;
    }
    
    if (updateData.totalduration !== undefined) {
      profileUpdate.totalduration = updateData.totalduration;
    }
    
    if (updateData.currentroleduration !== undefined) {
      profileUpdate.currentroleduration = updateData.currentroleduration;
    }
    
    if (updateData.workMode !== undefined) {
      profileUpdate.workMode = updateData.workMode;
    }
    
    if (updateData.officeLocation !== undefined) {
      profileUpdate.officeLocation = updateData.officeLocation;
    }
    
    if (updateData.industry !== undefined) {
      profileUpdate.industry = updateData.industry;
    }
    
    // Update directly in the user document
    const userId = (user as { _id: Types.ObjectId })._id;
    console.log(`Updating job profile for user ${userId.toString()}:`, JSON.stringify(profileUpdate));
    
    // Update the user document directly
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }
    
    const updatedUser = await (UserModel as any).findByIdAndUpdate(
      userId,
      { $set: profileUpdate },
      { 
        new: true, 
        runValidators: true,
        select: '-password -__v',
        lean: true 
      }
    )
    .exec();
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update user profile' },
        { status: 500 }
      );
    }
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found or update failed' },
        { status: 404 }
      );
    }
    
    // Also update the merged_output collection if it exists (for compatibility)
    try {
      // Check if the collection exists
      const collections = await db.listCollections({ name: 'merged_output' }).toArray();
      if (collections.length > 0) {
        await db.collection('merged_output').updateOne(
          { email: updatedUser.email },
          { $set: {
            jobTitle: profileUpdate.jobTitle,
            jobResponsibilities: profileUpdate.jobResponsibilities,
            toolsProficient: profileUpdate.toolsProficient,
            salary: profileUpdate.salary,
            totalduration: profileUpdate.totalduration,
            currentroleduration: profileUpdate.currentroleduration,
            workMode: profileUpdate.workMode,
            officeLocation: profileUpdate.officeLocation,
            industry: profileUpdate.industry,
            updatedAt: profileUpdate.updatedAt
          }}
        );
        console.log('Also updated merged_output collection');
      }
    } catch (e) {
      console.error('Error updating merged_output:', e);
      // Don't fail the request if merged_output update fails
    }
    
    return NextResponse.json(updatedUser);
    
  } catch (error) {
    console.error('Error updating job profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    // No need to close the connection as it's managed by the connection pool
  }
} 