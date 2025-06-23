import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { generateToken } from '@/lib/auth';
import connectDB from '@/lib/dbConnect';
import User from '@/models/User';
import { getAuthUserModel } from '@/models/AuthUser';
import { MongoClient, ObjectId } from 'mongodb';
import mongoose from 'mongoose';

// MongoDB connection string
const uri = process.env.MONGODB_URI || '';

export async function POST(req: NextRequest) {
  let client: MongoClient | null = null;
  let authClient: MongoClient | null = null;
  
  console.log('Using MongoDB connection:', uri.replace(/(?<=:\/\/[^:]+:)[^@]+(?=@)/, '***'));

  try {
    // Parse request body
    const { email, password } = await req.json();

    console.log('Login attempt for:', email);

    // Validate input: email and password are required
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB with default company code
    await connectDB('default'); // Ensures main DB connection is available
    console.log('Connected to main database');
    
    // Connect to both DBs for direct access
    client = new MongoClient(uri);
    await client.connect();
    console.log('MongoDB client connected');
    
    // Connect to auth database
    const authDbURI = uri.replace(/\/[^/]+(\?|$)/, '/auth_db$1');
    authClient = new MongoClient(authDbURI);
    await authClient.connect();
    console.log('Auth DB client connected');
    
    const mainDb = client.db('org_sim_db'); // Reference to main DB
    console.log('Got reference to both databases');

    // Get Mongoose model for central auth users
    const AuthUserModel = await getAuthUserModel();

    // First try to authenticate using the central auth database
    console.log('Attempting login using central auth database');
    
    // Find user by email (case insensitive) via Mongoose model
    const authUser = await AuthUserModel.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!authUser) {
      console.log('User not found in central auth database, checking company auth databases...');
      // Fallback: search company-specific auth collections
      const adminDb = client.db('admin');
      const dbList = await adminDb.admin().listDatabases();
      const companyDbs = dbList.databases.map(d => d.name).filter(n => n.startsWith('company_'));
      for (const dbName of companyDbs) {
        try {
          const compAuthColl = client.db(dbName).collection('auth');
          const compUser = await compAuthColl.findOne({ email: email.toLowerCase() });
          if (compUser && compUser.password) {
            // Verify password
            const match = await bcrypt.compare(password, compUser.password) || compUser.password === password;
            if (match) {
              console.log(`Company login successful for ${dbName}`);
              const token = generateToken({ id: compUser.userId, email: compUser.email, role: String(compUser.role).toLowerCase(), companyCode: compUser.companyCode, company: compUser.companyName, status: compUser.status });
              const responseUser = { id: compUser.userId, username: compUser.username, email: compUser.email, firstName: compUser.firstName, lastName: compUser.lastName, role: String(compUser.role).toLowerCase(), companyCode: compUser.companyCode, company: compUser.companyName, status: compUser.status };
              return NextResponse.json({ success: true, token, user: responseUser });
            }
          }
        } catch {};
      }
      console.log('Fallback to company auth DBs failed; falling back to legacy main DB');
      // Try direct access to users collection in main database
      const usersCollection = mainDb.collection('users');
      const mainUser = await usersCollection.findOne({ 
        email: email.toLowerCase(),
        $or: [
          { role: 'superadmin' },
          { role: 'SUPERADMIN' },
          { role: 'admin' },
          { role: 'ADMIN' },
          { role: 'user' },
          { role: 'USER' }
        ]
      });
      
      if (mainUser && mainUser.password) {
        const isMatch = await bcrypt.compare(password, mainUser.password);
        if (isMatch) {
          // For pending status, redirect to pending approval
          if (mainUser.status === 'pending') {
            return NextResponse.json(
              {
                success: false,
                message: 'Your account is pending approval',
                redirectTo: '/pending-approval',
                status: 'pending',
                username: mainUser.username,
                company: mainUser.company,
              },
              { status: 403 }
            );
          }
          // Otherwise generate token
          const tokenPayload = { id: String(mainUser._id), email: mainUser.email, role: String(mainUser.role).toLowerCase(), companyCode: mainUser.companyCode, company: mainUser.company || 'Admin', status: mainUser.status || 'active' };
          const token = generateToken(tokenPayload);
          const responseUser = { id: mainUser._id, username: mainUser.username, email: mainUser.email, firstName: mainUser.firstName, lastName: mainUser.lastName, role: String(mainUser.role).toLowerCase(), company: mainUser.company || 'Admin', companyCode: mainUser.companyCode, status: mainUser.status || 'active' };
          return NextResponse.json({ success: true, token, user: responseUser });
        }
      }
      
      // If we get here, no user was found or password was wrong
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    console.log('User found in auth database:', authUser.email);
    console.log('AuthUser password hash:', authUser.password);
    console.log('Provided password:', password);
    
    // Verify password
    let isMatch = await bcrypt.compare(password, authUser.password);
    // Fallback if auth DB stored plaintext
    if (!isMatch && authUser.password === password) {
      console.log('Auth DB password stored in plaintext, matching directly');
      isMatch = true;
    }
    if (!isMatch) {
      console.log('Password mismatch for user in auth database, falling back to legacy login');
      // Legacy main DB login
      const usersCollection = mainDb.collection('users');
      const mainUser = await usersCollection.findOne({
        email: email.toLowerCase(),
        $or: [
          { role: 'superadmin' }, { role: 'SUPERADMIN' },
          { role: 'admin' }, { role: 'ADMIN' },
          { role: 'user' }, { role: 'USER' }
        ]
      });
      if (mainUser && mainUser.password) {
        const legacyMatch = await bcrypt.compare(password, mainUser.password);
        if (legacyMatch) {
          const tokenPayload = { id: String(mainUser._id), email: mainUser.email, role: String(mainUser.role).toLowerCase(), companyCode: mainUser.companyCode, company: mainUser.company || 'Admin', status: mainUser.status || 'active' };
          const token = generateToken(tokenPayload);
          const responseUser = { id: mainUser._id, username: mainUser.username, email: mainUser.email, firstName: mainUser.firstName, lastName: mainUser.lastName, role: String(mainUser.role).toLowerCase(), company: mainUser.company || 'Admin', companyCode: mainUser.companyCode, status: mainUser.status || 'active' };
          console.log('Legacy login successful on fallback');
          return NextResponse.json({ success: true, token, user: responseUser });
        }
      }
      // If still no match
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }
    
    // Check company-specific database for latest status first
    let userStatus = authUser.status;
    
    // If user has a company code and status is not active, check company db for updated status
    if (authUser.companyCode && authUser.status !== 'active') {
      try {
        console.log(`Checking company database for latest status for user ${authUser.userId} in company ${authUser.companyCode}`);
        const companyDb = client.db(`company_${authUser.companyCode.toLowerCase()}`);
        const companyUsersCollection = companyDb.collection('users');
        
        // Try to find user by ID in company database
        const companyUser = await companyUsersCollection.findOne({ _id: new ObjectId(authUser.userId) });
        
        if (companyUser) {
          console.log(`Found user in company database with status: ${companyUser.status}, central DB status: ${authUser.status}`);
          // Use company database status as source of truth
          userStatus = companyUser.status;
          
          // Update central auth database if company DB status is different
          if (companyUser.status !== authUser.status) {
            console.log(`Updating central auth database with latest status: ${companyUser.status}`);
            await AuthUserModel.updateOne(
              { userId: authUser.userId },
              { $set: { status: companyUser.status } }
            );
            // Update local authUser object for token generation
            authUser.status = companyUser.status;
          }
          
          // ---------- ROLE SYNC ----------
          if (companyUser.role && companyUser.role !== authUser.role) {
            console.log(`Role mismatch detected. Central role: ${authUser.role}, Company role: ${companyUser.role}. Updating.`);
            await AuthUserModel.updateOne(
              { userId: authUser.userId },
              { $set: { role: companyUser.role } }
            );
            authUser.role = companyUser.role;
          }
        }
      } catch (err) {
        console.error('Error checking company database for status:', err);
        // Continue with central auth status if there's an error
      }
    }
    
    // Handle different user statuses using the latest status
    if (userStatus === 'pending') {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Your account is pending approval', 
          redirectTo: '/pending-approval', 
          status: 'pending', 
          username: authUser.username, 
          company: authUser.companyName 
        },
        { status: 403 }
      );
    }
    
    if (userStatus === 'rejected') {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Your account has been rejected.', 
          redirectTo: '/rejected-account', 
          status: 'rejected',
          username: authUser.username,
          company: authUser.companyName
        },
        { status: 403 }
      );
    }
    
    if (userStatus === 'inactive') {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Your account is inactive.', 
          redirectTo: '/inactive-account', 
          status: 'inactive',
          username: authUser.username,
          company: authUser.companyName
        },
        { status: 403 }
      );
    }
    
    // Handle MFA if enabled
    if (authUser.twoFactorEnabled) {
      console.log('MFA check for user:', authUser.email);
      const mfaSessionToken = generateToken({
        id: authUser.userId,
        email: authUser.email,
        isMfaSession: true,
        companyCode: authUser.companyCode,
        exp: Math.floor(Date.now() / 1000) + 10 * 60 // 10 minutes
      });
      
      return NextResponse.json({
        success: true,
        requireMFA: true,
        mfaSession: mfaSessionToken,
      });
    }
    
    // Update last login in auth database
    await AuthUserModel.updateOne(
      { userId: authUser.userId },
      { $set: { lastLogin: new Date() } }
    );
    
    // If user has a company code, also update the company's auth collection
    if (authUser.companyCode) {
      try {
        const companyDb = client.db(`company_${authUser.companyCode.toLowerCase()}`);
        const companyAuthCollection = companyDb.collection('auth');
        
        await companyAuthCollection.updateOne(
          { userId: authUser.userId },
          { $set: { lastLogin: new Date() } }
        );
      } catch (err) {
        console.error('Error updating company auth collection:', err);
        // Continue with login even if this fails
      }
    }
    
    // Generate JWT token with user info
    // Ensure admin role is properly set from authUser or company user
    let userRole = authUser.role ? String(authUser.role).toLowerCase() : 'user';
    
    // If this is a company admin, ensure role is set to admin
    if (authUser.companyCode && (userRole === 'admin' || userRole === 'superadmin')) {
      console.log('User has admin role in auth database:', userRole);
    } else if (authUser.companyCode) {
      // Double-check role in company database for admins
      try {
        const companyDb = client.db(`company_${authUser.companyCode.toLowerCase()}`);
        const companyUsersCollection = companyDb.collection('users');
        const companyUser = await companyUsersCollection.findOne({ _id: new ObjectId(authUser.userId) });
        
        if (companyUser && (companyUser.role === 'admin' || companyUser.role === 'superadmin')) {
          console.log('Upgrading user role from company database:', companyUser.role);
          userRole = companyUser.role.toLowerCase();
          // Update auth user record with correct role
          await AuthUserModel.updateOne(
            { userId: authUser.userId },
            { $set: { role: userRole } }
          );
        }
      } catch (err) {
        console.error('Error verifying admin role in company database:', err);
      }
    }

    const tokenPayload = {
      id: String(authUser.userId), // Convert authUser.userId to a string
      email: authUser.email,
      role: userRole, // Use the verified role
      companyCode: authUser.companyCode,
      company: authUser.companyName,
      status: userStatus, // Use the updated status from company DB if available
    };
    
    console.log('Generated token with payload:', JSON.stringify(tokenPayload, null, 2));
    
    const token = generateToken(tokenPayload);
    
    // Prepare response user object
    const responseUser = {
      id: authUser.userId,
      username: authUser.username,
      email: authUser.email,
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      role: authUser.role ? String(authUser.role).toLowerCase() : 'user',
      company: authUser.companyName,
      companyCode: authUser.companyCode,
      status: userStatus, // Use the updated status from company DB if available
    };
    
    return NextResponse.json({
      success: true,
      token,
      user: responseUser,
    });

  } catch (error) {
    console.error('Login error:', error);
    // Provide more specific error messages based on error type
    let message = 'An error occurred during login.';
    let status = 500;

    if (error instanceof Error) {
      console.error('Login Error Details:', error.message, error.stack);
      
      // Check for MongoDB connection errors
      if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
        message = 'Database connection failed. Please try again later.';
      } 
      // Check for model/schema errors
      else if (error.message.includes('model') || error.message.includes('schema')) {
        message = 'Error accessing user data. Please contact support.';
      }
      // Invalid credentials already handled in specific sections
    }

    return NextResponse.json(
      { success: false, message },
      { status }
    );
  } finally {
    if (client) {
      try {
        await client.close();
        console.log('MongoDB client closed');
      } catch (closeError) {
        console.error('Error closing MongoDB client:', closeError);
      }
    }
    if (authClient) {
      try {
        await authClient.close();
        console.log('Auth DB client closed');
      } catch (closeError) {
        console.error('Error closing Auth DB client:', closeError);
      }
    }
  }
} 