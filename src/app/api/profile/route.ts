import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { MongoClient, ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import authService from '@/services/authService';
import { verifyAuth } from "@/lib/auth";
import connectDB from '@/lib/dbConnect';
import User, { getUserModel, IUser } from '@/models/User';

// Define TS interfaces for collections
interface UserDoc {
  _id: ObjectId;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  company?: string;
  createdAt: string;
  workMode?: string;
  officeLocation?: string;
  industry?: string;
  [key: string]: any;
}
interface ProfileDoc {
  _id: ObjectId;
  userId: string;
  jobTitle?: string;
  jobResponsibilities?: { duty: string; hours: number }[];
  phone?: string;
  emailNotifications?: boolean;
  projectUpdates?: boolean;
  teamMessages?: boolean;
  taskReminders?: boolean;
  salary?: string;
  totalduration?: string;
  currentroleduration?: string;
  workMode?: string;
  officeLocation?: string;
  industry?: string;
  [key: string]: any;
}

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

// Helper to normalize company code (always lowercase)
const normalizeCompanyCode = (code: string | null | undefined): string => {
  return code ? code.toLowerCase() : '';
};

// Helper to parse durations like "3 year 4 months" to total months
function parseDuration(str: string): number {
  let years = 0, months = 0;
  const yMatch = str.match(/(\d+)\s*year/);
  if (yMatch) years = parseInt(yMatch[1], 10);
  const mMatch = str.match(/(\d+)\s*month/);
  if (mMatch) months = parseInt(mMatch[1], 10);
  return years * 12 + months;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    
    if (!token) {
      console.log('[GET /api/profile] No token provided');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[GET /api/profile] Verifying token');
    const payload = await verifyAuth(token);
    
    if (!payload) {
      console.log('[GET /api/profile] Invalid token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Connect to database to get the freshest user data
    await connectDB();

    // Get company code from payload or header and normalize to lowercase
    const companyCode = normalizeCompanyCode(
      request.headers.get('X-Company-Code') || 
      payload.companyCode
    );

    console.log(`[GET /api/profile] Looking for user ${payload.id} with company code: ${companyCode || 'none'}`);
    console.log('[GET /api/profile] Full payload:', JSON.stringify(payload));

    // Choose the appropriate user model based on normalized company code
    const UserModel = companyCode ? getUserModel(companyCode) : User;

    // Always fetch the user from the database to get current role, company, etc.
    let user = null;
    
    // First try by email if available (most reliable in multi-company setup)
    if (payload.email) {
      console.log('[GET /api/profile] Looking up user by email:', payload.email);
      try {
        // Use as Model<IUser> to fix TypeScript issues
        user = await (UserModel as mongoose.Model<IUser>).findOne({ email: payload.email }).select('-password -__v');
        console.log('[GET /api/profile] User found by email:', user ? 'Yes' : 'No');
      } catch (err) {
        console.warn('[GET /api/profile] Error looking up by email:', err);
      }
    }
    
    // If not found by email, try by ID if it's a valid ObjectId format
    if (!user && mongoose.Types.ObjectId.isValid(payload.id)) {
      console.log('[GET /api/profile] Looking up user by ID:', payload.id);
      user = await (UserModel as mongoose.Model<IUser>).findById(payload.id).select('-password -__v');
      console.log('[GET /api/profile] User found by ID:', user ? 'Yes' : 'No');
    }
    
    // If still not found, try case insensitive lookup
    if (!user && payload.email) {
      console.log('[GET /api/profile] Trying case-insensitive email lookup');
      user = await (UserModel as mongoose.Model<IUser>).findOne({ 
        email: { $regex: `^${payload.email}$`, $options: 'i' } 
      }).select('-password -__v');
      console.log('[GET /api/profile] User found by case-insensitive email:', user ? 'Yes' : 'No');
    }
    
    // If still not found and companyCode provided, try direct MongoDB query
    if (!user && companyCode) {
      try {
        const client = new MongoClient(uri);
        await client.connect();
        const db = client.db(`company_${companyCode}`);
        const usersCollection = db.collection('users');
        
        // Try to find by the string ID or email
        const userDoc = await usersCollection.findOne({
          $or: [
            { id: payload.id },
            { userId: payload.id },
            { email: payload.email }
          ]
        });
        
        if (userDoc) {
          console.log('[GET /api/profile] Found user by direct MongoDB query');
          user = userDoc;
        }
        
        await client.close();
      } catch (mongoErr) {
        console.error('[GET /api/profile] Error with direct MongoDB query:', mongoErr);
      }
    }
    
    // As a last resort, if companyCode is available but user not found, try main User model
    if (!user && companyCode) {
      console.log('[GET /api/profile] Trying main User model as fallback');
      if (mongoose.Types.ObjectId.isValid(payload.id)) {
        user = await User.findById(payload.id).select('-password -__v');
      } else if (payload.email) {
        user = await User.findOne({ email: payload.email }).select('-password -__v');
      }
    }
      
    if (!user) {
      console.error('User not found with payload:', { id: payload.id, email: payload.email });
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return user data with current role and company from database
    return NextResponse.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      company: user.company,
      companyCode: user.companyCode,
      status: user.status,
      jobTitle: (user as any).jobTitle,
      jobResponsibilities: (user as any).jobResponsibilities || [],
      toolsProficient: (user as any).toolsProficient || "",
      salary: (user as any).salary || "",
      totalduration: (user as any).totalduration || "",
      currentroleduration: (user as any).currentroleduration || "",
      workMode: (user as any).workMode || "",
      officeLocation: (user as any).officeLocation || "",
      industry: (user as any).industry || ""
    });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  noStore(); // Ensure dynamic handling
  
  try {
    // 1. Verify Authentication
    const token = extractToken(request) || request.cookies.get('token')?.value;
    if (!token) {
      console.log('[API Profile PATCH] No token provided');
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
    }
    
    // Use verifyAuth for consistency and Edge compatibility
    console.log('[API Profile PATCH] Verifying token');
    const payload = await verifyAuth(token);
    if (!payload || !payload.id) {
      console.log('[API Profile PATCH] Invalid token or missing ID');
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // Get company code from payload or header and normalize to lowercase
    const companyCode = normalizeCompanyCode(
      request.headers.get('X-Company-Code') || 
      payload.companyCode
    );

    console.log(`[API Profile PATCH] User ${payload.id} with company code: ${companyCode || 'none'}`);
    console.log('[API Profile PATCH] Full payload:', JSON.stringify(payload));

    // 2. Get User ID and Update Data
    const userId = payload.id; // Use the ID from the verified token payload
    const updateData = await request.json();
    console.log('[API Profile PATCH] Incoming updateData:', updateData);

    // Convert duration strings to numeric months
    if (typeof updateData.totalduration === 'string') {
      updateData.totalduration = parseDuration(updateData.totalduration).toString();
    }
    if (typeof updateData.currentroleduration === 'string') {
      updateData.currentroleduration = parseDuration(updateData.currentroleduration).toString();
    }

    console.log(`[API Profile PATCH] User ${userId} updating profile with:`, JSON.stringify(updateData));

    // 3. Connect to DB
    await connectDB();

    // Choose the appropriate user model based on normalized company code
    const UserModel = companyCode ? getUserModel(companyCode) : User;

    // 4. Prepare User Update Object (Only fields relevant to User model)
    console.log('[API Profile PATCH] Fields to consider for update:', updateData);
    const userUpdate: any = {};
    const allowedFields = ['username', 'email', 'firstName', 'lastName', 'company', 'phone']; 
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        userUpdate[field] = updateData[field];
      }
    }
    
    // Handle profile fields
    if (updateData.jobTitle !== undefined) userUpdate.jobTitle = updateData.jobTitle;
    if (updateData.jobResponsibilities !== undefined) userUpdate.jobResponsibilities = updateData.jobResponsibilities;
    if (updateData.toolsProficient !== undefined) userUpdate.toolsProficient = updateData.toolsProficient;
    if (updateData.salary !== undefined) userUpdate.salary = updateData.salary;
    if (updateData.totalduration !== undefined) userUpdate.totalduration = updateData.totalduration;
    if (updateData.currentroleduration !== undefined) userUpdate.currentroleduration = updateData.currentroleduration;
    if (updateData.workMode !== undefined) userUpdate.workMode = updateData.workMode;
    if (updateData.officeLocation !== undefined) userUpdate.officeLocation = updateData.officeLocation;
    if (updateData.industry !== undefined) userUpdate.industry = updateData.industry;
    
    console.log('[API Profile PATCH] Computed userUpdate object:', userUpdate);

    // Handle password separately if provided
    if (updateData.password && updateData.currentPassword) {
       const currentUser = await (UserModel as mongoose.Model<IUser>).findById(userId).select('+password');
       if (!currentUser) {
          return NextResponse.json({ error: 'User not found for password update' }, { status: 404 });
       }
       const isMatch = await bcrypt.compare(updateData.currentPassword, currentUser.password);
       if (!isMatch) {
         return NextResponse.json({ error: 'Unauthorized - Incorrect current password' }, { status: 401 });
       }
       const salt = await bcrypt.genSalt(10);
       userUpdate.password = await bcrypt.hash(updateData.password, salt);
    } else if (updateData.password && !updateData.currentPassword) {
        return NextResponse.json({ error: 'Current password required to set new password' }, { status: 400 });
    }

    // Add timestamp
    userUpdate.updatedAt = new Date();

    // 5. Perform Update on User Model
    if (Object.keys(userUpdate).length > 1) { // Check if there's more than just updatedAt
      console.log(`[API Profile PATCH] Applying update to User ${userId} in company ${companyCode}`);
      
      try {
        let updatedUser = null;
        
        // Always try the mongoose update first with proper company-specific model
        if (mongoose.Types.ObjectId.isValid(userId)) {
          console.log('[API Profile PATCH] Using Mongoose findByIdAndUpdate with valid ObjectId');
          updatedUser = await (UserModel as mongoose.Model<IUser>).findByIdAndUpdate(
            userId,
            { $set: userUpdate },
            { new: true, runValidators: true }
          ).select('-password -__v');
        }
        
        // If mongoose update didn't find the user, fall back to direct MongoDB query
        if (!updatedUser && companyCode) {
          console.log('[API Profile PATCH] Using direct MongoDB query as fallback');
          try {
            const client = new MongoClient(uri);
            await client.connect();
            const db = client.db(`company_${companyCode}`);
            const usersCollection = db.collection('users');
            
            const result = await usersCollection.findOneAndUpdate(
              { $or: [
                { email: payload.email },
                { id: userId },
                { userId: userId }
              ]},
              { $set: userUpdate },
              { returnDocument: 'after' }
            );
            
            if (result && result.value) {
              updatedUser = result.value;
            }
            
            await client.close();
          } catch (mongoErr) {
            console.error('[API Profile PATCH] Error with direct MongoDB query:', mongoErr);
            throw mongoErr;
          }
        }
        
        if (!updatedUser) {
          console.log(`[API Profile PATCH] Failed to find and update user ${userId}`);
          return NextResponse.json({ error: 'User not found or update failed' }, { status: 404 });
        }
        
        console.log(`[API Profile PATCH] Successfully updated user ${userId}`);
        // 6. Return Updated User Data
        return NextResponse.json(updatedUser);
      } catch (dbError: any) {
        console.error('[API Profile PATCH] Database error:', dbError);
        return NextResponse.json({ 
          error: 'Database update failed', 
          details: dbError.message 
        }, { status: 500 });
      }
    } else {
       // If only timestamp is present, no actual update needed, return current user data
       const currentUser = await (UserModel as mongoose.Model<IUser>).findById(userId).select('-password -__v');
       if (!currentUser) {
           return NextResponse.json({ error: 'User not found' }, { status: 404 });
       }
        console.log(`[API Profile PATCH] No fields to update for user ${userId}, returning current data.`);
       return NextResponse.json(currentUser); 
    }

  } catch (error: any) {
    console.error('[API Profile PATCH] Error:', error);
    // Handle potential validation errors specifically
    if (error.name === 'ValidationError') {
        return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 500 });
  } 
}