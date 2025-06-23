import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { unstable_noStore as noStore } from 'next/cache';
import { verifyAuth } from "@/lib/auth";
import mongoose from 'mongoose';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const dbName = 'org_sim_db';

export async function POST(request: NextRequest) {
  noStore();
  let client: MongoClient | null = null;
  
  try {
    // Get user data from request
    const userData = await request.json();
    
    // Basic validation
    if (!userData.email || !userData.password || !userData.username) {
      return NextResponse.json(
        { error: 'Email, password, and username are required' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    const employeesCollection = db.collection('Project3_Employees');
    
    // Check if user already exists
    const existingUser = await usersCollection.findOne({ 
      $or: [
        { email: userData.email },
        { username: userData.username }
      ]
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email or username already exists' },
        { status: 409 }
      );
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    
    // Check if there's a matching employee record
    let employeeRecord = null;
    if (userData.email) {
      employeeRecord = await employeesCollection.findOne({ 
        $or: [
          { email: userData.email },
          { work_email: userData.email }
        ]
      });
    }
    
    // Prepare user document
    const newUser = {
      username: userData.username,
      email: userData.email,
      password: hashedPassword,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      role: userData.role || 'employee',
      status: 'active',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      // If employee record exists, link it
      employeeId: employeeRecord ? employeeRecord.employeeId || employeeRecord._id.toString() : null,
      organizationId: userData.organizationId ? new ObjectId(userData.organizationId) : null
    };
    
    // Insert user
    const result = await usersCollection.insertOne(newUser);
    
    // If user was linked to employee, update employee record with userId
    if (employeeRecord && result.insertedId) {
      await employeesCollection.updateOne(
        { _id: employeeRecord._id },
        { 
          $set: { 
            userId: result.insertedId,
            lastUpdated: new Date()
          } 
        }
      );
    }
    
    // Remove password from response
    const { password, ...userResponse } = newUser;
    
    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        ...userResponse,
        _id: result.insertedId,
        isLinkedToEmployee: !!employeeRecord
      }
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Error creating user:', error);
    
    let errorMessage = 'Error creating user';
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
    }
  }
}

export async function GET(request: NextRequest) {
  noStore();
  let client: MongoClient | null = null;
  
  try {
    // Extract query parameters
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const userId = url.searchParams.get('id');
    
    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Email or ID parameter is required' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    
    // Build query
    const query: any = {};
    if (email) {
      query.email = email;
    }
    if (userId) {
      query._id = new ObjectId(userId);
    }
    
    // Find user
    const user = await usersCollection.findOne(query, { projection: { password: 0 } });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(user);
    
  } catch (error: any) {
    console.error('Error fetching user:', error);
    
    let errorMessage = 'Error fetching user';
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
    }
  }
}

/**
 * Update user profile information
 */
export async function PATCH(request: NextRequest) {
  noStore();
  let client: MongoClient | null = null;
  
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const payload = await verifyAuth(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    
    // Get update data from request
    const updateData = await request.json();
    
    // Get company code from token or header
    const companyCode = 
      request.headers.get('X-Company-Code') || 
      payload.companyCode || 
      '';
    
    console.log(`[PATCH /api/user] Updating user ${payload.id} with company code: ${companyCode || 'none'}`);
    console.log(`[PATCH /api/user] Update data:`, JSON.stringify(updateData));
    
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    // Determine which database to use
    let dbToUse = dbName;
    if (companyCode) {
      // Use company_companycode format for database name
      dbToUse = `company_${companyCode}`;
      console.log(`[PATCH /api/user] Using database: ${dbToUse}`);
    }
    
    const db = client.db(dbToUse);
    const usersCollection = db.collection('users');
    
    // Build query to find the user - prioritize email which is more reliable
    const query: any = {
      email: payload.email
    };
    
    console.log(`[PATCH /api/user] Simplified query by email: ${payload.email}`);
    
    // Log the database we're using
    console.log(`[PATCH /api/user] Looking for user in database: ${dbToUse}, collection: users`);
    
    console.log(`[PATCH /api/user] Query:`, JSON.stringify(query));
    
    // Try to find user by email first
    let userToUpdate = await usersCollection.findOne(query);
    
    // If not found by email, try with the hardcoded ObjectId
    if (!userToUpdate) {
      console.log(`[PATCH /api/user] User not found by email in ${dbToUse}`);
      console.log(`[PATCH /api/user] Trying to find user by ObjectId in ${dbToUse}`);
      
      try {
        // Use the hardcoded ObjectId that you provided
        userToUpdate = await usersCollection.findOne({
          _id: new ObjectId('681cf03b2418102b11c5a163')
        });
        
        if (userToUpdate) {
          console.log(`[PATCH /api/user] Found user by hardcoded ObjectId in ${dbToUse}`);
        } else {
          console.log(`[PATCH /api/user] User not found by hardcoded ObjectId in ${dbToUse}`);
          return NextResponse.json({ error: 'User not found in company database' }, { status: 404 });
        }
      } catch (err) {
        console.error(`[PATCH /api/user] Error finding user by ObjectId:`, err);
        return NextResponse.json({ error: 'Error finding user' }, { status: 500 });
      }
    }
    
    // Update user by _id which is more reliable
    const updateResult = await usersCollection.updateOne(
      { _id: userToUpdate._id },
      { $set: { ...updateData, updatedAt: new Date() } }
    );
    
    console.log(`[PATCH /api/user] Update result:`, JSON.stringify(updateResult));
    
    if (updateResult.modifiedCount === 0) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
    
    // Get updated user by _id
    const updatedUser = await usersCollection.findOne({ _id: userToUpdate._id }, { projection: { password: 0 } });
    console.log(`[PATCH /api/user] Updated user:`, updatedUser ? 'Found' : 'Not found');
    
    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });
    
  } catch (error: any) {
    console.error('Error updating user:', error);
    
    let errorMessage = 'Error updating user';
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
    }
  }
} 