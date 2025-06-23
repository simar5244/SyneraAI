import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { verifyAuth } from '@/lib/auth';
import connectDB from '@/lib/dbConnect';
import User, { getUserModel } from '@/models/User';

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
    const companyCode = 
      request.headers.get('X-Company-Code') || 
      payload.companyCode || 
      '';
      
    console.log(`[API Profile Notifications PATCH] User ${payload.id} with company code: ${companyCode || 'none'}`);
    
    // Get update data from request
    const updateData = await request.json();
    console.log('Updating notification settings with data:', JSON.stringify(updateData));
    
    // Connect to database
    await connectDB();
    
    // Choose the appropriate user model based on company code
    const UserModel = companyCode ? getUserModel(companyCode) : User;
    
    // Connect to MongoDB for additional collections if needed
    console.log('Connecting to MongoDB for additional collections');
    client = new MongoClient(uri);
    await client.connect();
    
    // Use company-specific database if available
    const dbToUse = companyCode ? `company_${companyCode}` : dbName;
    console.log(`Using database: ${dbToUse}`);
    
    const db = client.db(dbToUse);
    
    // Try to find the user
    let userId = payload.id;
    
    // Find user using Mongoose model
    const user = await UserModel.findById(userId).select('-password -__v');
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Extract notification settings
    const profileUpdate: any = {
      updatedAt: new Date()
    };
    
    if (updateData.emailNotifications !== undefined) {
      profileUpdate.emailNotifications = updateData.emailNotifications;
    }
    
    if (updateData.projectUpdates !== undefined) {
      profileUpdate.projectUpdates = updateData.projectUpdates;
    }
    
    if (updateData.teamMessages !== undefined) {
      profileUpdate.teamMessages = updateData.teamMessages;
    }
    
    if (updateData.taskReminders !== undefined) {
      profileUpdate.taskReminders = updateData.taskReminders;
    }
    
    // Store notification preferences in the user document
    profileUpdate.notificationPreferences = {
      emailNotifications: profileUpdate.emailNotifications,
      projectUpdates: profileUpdate.projectUpdates,
      teamMessages: profileUpdate.teamMessages,
      taskReminders: profileUpdate.taskReminders
    };
    
    console.log(`Updating notification settings for user ${userId}:`, JSON.stringify(profileUpdate));
    
    // Update the user document directly
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $set: profileUpdate },
      { new: true, runValidators: true }
    ).select('-password -__v');
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found or update failed' },
        { status: 404 }
      );
    }
    
    // For backward compatibility, also try to update any legacy profile collections
    try {
      // Check if the Project3_Profiles collection exists
      const collections = await db.listCollections({ name: 'Project3_Profiles' }).toArray();
      if (collections.length > 0) {
        // Try to update existing profile or create a new one
        const result = await db.collection('Project3_Profiles').updateOne(
          { email: updatedUser.email },
          { $set: {
            emailNotifications: profileUpdate.emailNotifications,
            projectUpdates: profileUpdate.projectUpdates,
            teamMessages: profileUpdate.teamMessages,
            taskReminders: profileUpdate.taskReminders,
            updatedAt: profileUpdate.updatedAt
          }},
          { upsert: true }
        );
        console.log('Also updated Project3_Profiles collection');
      }
    } catch (e) {
      console.error('Error updating Project3_Profiles:', e);
      // Don't fail the request if legacy update fails
    }
    
    return NextResponse.json(updatedUser);
    
  } catch (error) {
    console.error('Error updating notification settings:', error);
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