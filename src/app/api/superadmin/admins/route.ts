import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { extractToken, verifyToken } from '@/services/authService';
import { noStore } from 'next/cache';
import bcrypt from 'bcryptjs';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'organizationgalaxy';

export async function GET(request: NextRequest) {
  noStore();
  let client: MongoClient | null = null;
  
  try {
    // Extract and verify token
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }
    
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    
    // Get the user making the request
    let userId: string | ObjectId = decoded.userId;
    try {
      userId = new ObjectId(decoded.userId);
    } catch (error) {
      // userId might not be an ObjectId, continue with string value
    }
    
    const user = await usersCollection.findOne(
      { $or: [{ _id: userId }, { id: decoded.userId }] }
    );
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Check if user is a superadmin
    if (user.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized - Super Admin access required' },
        { status: 403 }
      );
    }
    
    // Get all admin users
    const admins = await usersCollection
      .find({
        role: { $in: ['admin', 'superadmin'] }
      })
      .project({ password: 0 })
      .sort({ company: 1, email: 1 })
      .toArray();
    
    return NextResponse.json(admins);
  } catch (error) {
    console.error('Error fetching admin users:', error);
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

export async function POST(request: NextRequest) {
  noStore();
  let client: MongoClient | null = null;
  
  try {
    // Extract and verify token
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }
    
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    
    // Get the user making the request
    let userId: string | ObjectId = decoded.userId;
    try {
      userId = new ObjectId(decoded.userId);
    } catch (error) {
      // userId might not be an ObjectId, continue with string value
    }
    
    const user = await usersCollection.findOne(
      { $or: [{ _id: userId }, { id: decoded.userId }] }
    );
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Check if user is a superadmin
    if (user.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized - Super Admin access required' },
        { status: 403 }
      );
    }
    
    // Get admin data from request
    const adminData = await request.json();
    
    // Validate required fields
    if (!adminData.email || !adminData.username || !adminData.password || !adminData.company) {
      return NextResponse.json(
        { error: 'Missing required fields: email, username, password, and company are required' },
        { status: 400 }
      );
    }
    
    // Check if a user with this email or username already exists
    const existingUser = await usersCollection.findOne({
      $or: [
        { email: adminData.email.toLowerCase() },
        { username: adminData.username }
      ]
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email or username already exists' },
        { status: 409 }
      );
    }
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminData.password, salt);
    
    // Create new admin user
    const newAdminUser = {
      username: adminData.username,
      email: adminData.email.toLowerCase(),
      password: hashedPassword,
      firstName: adminData.firstName || '',
      lastName: adminData.lastName || '',
      role: adminData.role || 'admin',
      company: adminData.company,
      emailVerified: true,
      twoFactorEnabled: false,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      invitedBy: userId
    };
    
    // Insert the new admin user
    const result = await usersCollection.insertOne(newAdminUser);
    
    if (!result.acknowledged) {
      throw new Error('Failed to create admin user');
    }
    
    // Return the new admin user without the password
    const { password, ...adminWithoutPassword } = newAdminUser;
    
    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        ...adminWithoutPassword,
        _id: result.insertedId
      }
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
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