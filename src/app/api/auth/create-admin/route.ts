import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { username, email, password } = await req.json();

    // Validate input
    if (!username || !email || !password) {
      return NextResponse.json(
        { success: false, message: 'Username, email, and password are required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const client = new MongoClient(process.env.MONGODB_URI || '');
    await client.connect();
    console.log('Connected to main database');
    
    try {
      const db = client.db('org_sim_db');
      const usersCollection = db.collection('users');

      // Check if user already exists
      const existingUser = await usersCollection.findOne({
        $or: [
          { email: email.toLowerCase() },
          { username: username }
        ]
      });

      if (existingUser) {
        return NextResponse.json(
          { success: false, message: 'User with this email or username already exists' },
          { status: 400 }
        );
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new admin user
      const newUser = {
        _id: new ObjectId(),
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'admin',
        status: 'active',
        company: 'Admin',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert user to database
      const result = await usersCollection.insertOne(newUser);
      console.log('Admin user created:', email);

      return NextResponse.json({
        success: true,
        message: 'Admin user created successfully',
        user: {
          id: result.insertedId,
          username: newUser.username,
          email: newUser.email,
          role: 'admin'
        }
      });
    } catch (error: any) {
      console.error('Create admin error:', error);
      return NextResponse.json(
        { success: false, message: error.message || 'An error occurred during admin creation' },
        { status: 500 }
      );
    } finally {
      await client.close();
    }
  } catch (error: any) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to connect to database' },
      { status: 500 }
    );
  }
} 