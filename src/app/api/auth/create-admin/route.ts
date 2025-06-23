import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/dbConnect';
import User from '@/models/User';

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
    await connectDB();
    console.log('Connected to main database');

    // Check if user already exists
    const existingUser = await User.findOne({
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
    const newUser = new User({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      company: 'Admin',
      emailVerified: true
    });

    // Save user to database
    await newUser.save();
    console.log('Admin user created:', email);

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: newUser._id,
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
  }
} 