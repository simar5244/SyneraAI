import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { verifyAuth } from '@/lib/auth';
import connectDB from '@/lib/dbConnect';
import User, { getUserModel } from '@/models/User';
import mongoose from 'mongoose';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const dbName = 'org_sim_db';

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
  let client: MongoClient | null = null;
  
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
    await connectDB();
    
    // Choose the appropriate user model based on company code
    const UserModel = companyCode ? getUserModel(companyCode) : User;
    
    // Connect to MongoDB for merged_output collection
    console.log('Connecting to MongoDB for merged_output collection');
    client = new MongoClient(uri);
    await client.connect();
    
    // Use company-specific database if available
    const dbToUse = companyCode ? `company_${companyCode}` : dbName;
    console.log(`Using database: ${dbToUse}`);
    
    const db = client.db(dbToUse);
    const profilesCollection = db.collection('users'); // Use 'users' collection in company DB
    
    // Try to find the user
    let userId = payload.id;
    
    let user: any = null;

    // 1) Try to find by valid ObjectId
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await UserModel.findById(userId).select('-password -__v');
    }

    // 2) Fallback: try to find by email from token
    if (!user && payload.email) {
      user = await UserModel.findOne({ email: { $regex: `^${payload.email}$`, $options: 'i' } }).select('-password -__v');
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
    console.log(`Updating job profile for user ${user._id.toString()}:`, JSON.stringify(profileUpdate));
    
    // Update the user document directly
    const updatedUser = await UserModel.findByIdAndUpdate(
      user._id,
      { $set: profileUpdate },
      { new: true, runValidators: true }
    ).select('-password -__v');
    
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
    if (client) {
      await client.close();
    }
  }
} 