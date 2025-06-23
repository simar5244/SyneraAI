import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/dbConnect';
import { getDBConnection } from '@/lib/companyDBConnect';
import { verifyAuth } from '@/lib/auth';
import { getUserModel } from '@/models/User';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

// MongoDB connection string
const uri = process.env.MONGODB_URI || '';

// GET handler to fetch users with pagination, filtering and search
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  let client = null;
  let authClient = null;
  
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      console.log('Missing authorization token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAuth(token);
    if (!payload) {
      console.log('Invalid token or verification failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('User attempting to access admin route:', {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      company: payload.company,
      companyCode: payload.companyCode
    });

    // STRICT role checking - allow admin, superadmin, and employee tiers
    const allowedRoles = ['admin', 'superadmin', 'employee_tier_1', 'employee_tier_2', 'employee_tier_3'];
    if (!allowedRoles.includes(payload.role)) {
      console.log(`Access denied: User role "${payload.role}" is not authorized for admin access`);
      return NextResponse.json({ 
        error: 'Access denied', 
        message: 'Only admin, superadmin, and employee tier roles can access this endpoint',
        userRole: payload.role
      }, { status: 403 });
    }

    // Get query parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const role = url.searchParams.get('role') || '';
    const search = url.searchParams.get('search') || '';
    const filterCompany = url.searchParams.get('company') || '';
    const filterCompanyCode = url.searchParams.get('companyCode') || '';
    const status = url.searchParams.get('status') || '';

    // Build query
    const query: any = {};
    
    // Status filter
    if (status) {
      query.status = status;
    }

    // Company filter - admin can only see users in their company, superadmin can see all or filter by company
    if (payload.role === 'admin' && payload.companyCode) {
      // Always use admin's company code for filtering
      query.companyCode = payload.companyCode.toLowerCase();
    } else if (payload.role === 'superadmin' && filterCompanyCode) {
      // For superadmin filtering, apply company code filtering
      query.companyCode = filterCompanyCode.toLowerCase();
    }
    
    // Role filter
    if (role) {
      query.role = role;
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    console.log('User query:', JSON.stringify(query));

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Connect to MongoDB directly for more flexibility
    client = new MongoClient(uri);
    await client.connect();
    
    // Connect to auth database for centralized user data
    const authDbURI = uri.replace(/\/[^/]+(\?|$)/, '/auth_db$1');
    authClient = new MongoClient(authDbURI);
    await authClient.connect();
    
    let users = [];
    let totalUsers = 0;
    
    // If we're looking up a specific user by ID
    if (id) {
      // First check in auth database
      const authDb = authClient.db('auth_db');
      const authUsersCollection = authDb.collection('authUsers');
      
      // Try to find the user by ID
      let user = await authUsersCollection.findOne({ userId: id });
      
      // If not found in auth DB, try company database
      if (!user && payload.companyCode) {
        const companyDb = client.db(`company_${payload.companyCode.toLowerCase()}`);
        const usersCollection = companyDb.collection('users');
        
        try {
          const { ObjectId } = require('mongodb');
          user = await usersCollection.findOne({ _id: new ObjectId(id) });
        } catch (err) {
          // If not a valid ObjectId, do nothing
        }
      }
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Remove sensitive fields
      if (user.password) delete user.password;
      
      return NextResponse.json(user, { status: 200 });
    }
    
    // Determine which database to query based on role and filters
    if (payload.role === 'admin' && payload.companyCode) {
      // Admin users should query their company database first
      const companyCode = payload.companyCode.toLowerCase();
      const companyDb = client.db(`company_${companyCode}`);
      const usersCollection = companyDb.collection('users');
      
      // Convert query for MongoDB native client
      const mongoQuery = { ...query };
      if (mongoQuery.companyCode) delete mongoQuery.companyCode; // Not needed for company DB
      
      console.log('Company DB query:', JSON.stringify(mongoQuery));
      
      // Get users from company database
      users = await usersCollection.find(mongoQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      totalUsers = await usersCollection.countDocuments(mongoQuery);
      
      console.log(`Found ${users.length} users in company database, total: ${totalUsers}`);
      
      // Map to format users and remove sensitive data
      users = users.map(user => ({
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role,
        status: user.status,
        company: payload.company,
        companyCode: companyCode,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));
    } else if (payload.role === 'superadmin') {
      // Superadmin can query the central auth database or specific company database
      if (filterCompanyCode) {
        // Query specific company database
        const companyCode = filterCompanyCode.toLowerCase();
        const companyDb = client.db(`company_${companyCode}`);
        const usersCollection = companyDb.collection('users');
        
        // Convert query for MongoDB native client
        const mongoQuery = { ...query };
        if (mongoQuery.companyCode) delete mongoQuery.companyCode; // Not needed for company DB
        
        console.log('Company DB query (superadmin):', JSON.stringify(mongoQuery));
        
        // Get users from company database
        users = await usersCollection.find(mongoQuery)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();
        
        totalUsers = await usersCollection.countDocuments(mongoQuery);
        
        console.log(`Found ${users.length} users in company database, total: ${totalUsers}`);
        
        // Get company name
        const mainDb = client.db('org_sim_db');
        const org = await mainDb.collection('organizations').findOne({ companyCode });
        const companyName = org ? org.name : '';
        
        // Map to format users and remove sensitive data
        users = users.map(user => ({
          _id: user._id.toString(),
          username: user.username,
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          role: user.role,
          status: user.status,
          company: companyName,
          companyCode: companyCode,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }));
      } else {
        // Query auth database for all users
        const authDb = authClient.db('auth_db');
        const authUsersCollection = authDb.collection('authUsers');
        
        // Convert query for MongoDB native client
        const mongoQuery = { ...query };
        
        console.log('Auth DB query (superadmin):', JSON.stringify(mongoQuery));
        
        // Get users from auth database
        users = await authUsersCollection.find(mongoQuery)
          .sort({ lastSynced: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();
        
        totalUsers = await authUsersCollection.countDocuments(mongoQuery);
        
        console.log(`Found ${users.length} users in auth database, total: ${totalUsers}`);
        
        // Map to format users and remove sensitive data
        users = users.map(user => ({
          _id: user.userId || user._id.toString(),
          username: user.username,
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          role: user.role,
          status: user.status,
          company: user.companyName || '',
          companyCode: user.companyCode,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt || user.lastSynced
        }));
      }
    }
    
    const totalPages = Math.ceil(totalUsers / limit);

    return NextResponse.json({
      users,
      totalUsers,
      totalPages,
      currentPage: page
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch users' }, { status: 500 });
  } finally {
    if (client) await client.close();
    if (authClient) await authClient.close();
  }
}

// POST handler to create a new user
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1]; 
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyAuth(token); 
    if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    const { username, email, firstName, lastName, role: userRole, company: bodyCompany, companyCode: bodyCompanyCode, password, status } = await request.json();

    // Validate required fields
    if (!username || !email || !password || !userRole) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Determine company - use admin's company if not provided for admin users
    // Always convert company to lowercase
    let userCompany = bodyCompany ? bodyCompany.toLowerCase() : undefined;
    let userCompanyCode = bodyCompanyCode;

    if (payload.role === 'admin') {
      if (!payload.company) {
        return NextResponse.json({ error: 'Admin user must have a company associated' }, { status: 400 });
      }
      
      // Admin can only create users in their own company - compare lowercase
      if (bodyCompany && bodyCompany.toLowerCase() !== payload.company.toLowerCase()) {
        return NextResponse.json({ error: 'You can only create users in your own company' }, { status: 403 });
      }
      
      userCompany = payload.company.toLowerCase();
      userCompanyCode = payload.companyCode;
      
      // Admin cannot create superadmin users
      if (userRole === 'superadmin') {
        return NextResponse.json({ error: 'You cannot create superadmin users' }, { status: 403 });
      }
    }

    // Check if we should use the 'users' collection directly
    const useCollectionHeader = request.headers.get('X-Use-Collection');
    const useUsersCollection = useCollectionHeader === 'users';
    
    // Prepare user data
    const userData = {
      username,
      email: email.toLowerCase(),
      firstName: firstName || '',
      lastName: lastName || '',
      role: userRole,
      company: userCompany || '',
      companyCode: userCompanyCode || '',
      password, // Will be hashed before saving
      status: status || 'active',
    };

    let createdUser;
    
    if (useUsersCollection && userCompanyCode) {
      // Use the 'users' collection directly in the company database
      console.log(`Creating user directly in users collection of company_${userCompanyCode.toLowerCase()}`);
      
      // Connect to MongoDB
      const client = new MongoClient(process.env.MONGODB_URI || '');
      await client.connect();
      
      try {
        // Get company database and users collection
        const companyDb = client.db(`company_${userCompanyCode.toLowerCase()}`);
        const usersCollection = companyDb.collection('users');
        
        // Check if user already exists
        const existingUser = await usersCollection.findOne({
          $or: [
            { email: email.toLowerCase() },
            { username }
          ]
        });
        
        if (existingUser) {
          return NextResponse.json({ error: 'User with this email or username already exists' }, { status: 400 });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create user
        const result = await usersCollection.insertOne({
          ...userData,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // Get created user
        createdUser = await usersCollection.findOne({ _id: result.insertedId });
        delete createdUser.password;
      } finally {
        await client.close();
      }
    } else {
      // Use the Mongoose model as before
      let userModel;
      
      // Determine which database to use
      if (userCompanyCode) {
        // Connect to company-specific database
        const companyConn = await getDBConnection(userCompanyCode);
        userModel = getUserModel(userCompanyCode);
        
        // Check if user already exists in this company's database
        const existingUser = await userModel.findOne({
          $or: [
            { email: email.toLowerCase() },
            { username }
          ]
        });

        if (existingUser) {
          return NextResponse.json({ error: 'User with this email or username already exists' }, { status: 400 });
        }
      } else if (payload.role === 'superadmin') {
        // Superadmin creating user in main database (global user)
        await connectDB();
        userModel = mongoose.models.User || getUserModel('');
        
        // Check if user already exists in the main database
        const existingUser = await userModel.findOne({
          $or: [
            { email: email.toLowerCase() },
            { username }
          ]
        });

        if (existingUser) {
          return NextResponse.json({ error: 'User with this email or username already exists' }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: 'Company code is required for creating users' }, { status: 400 });
      }

      // Create the user in the appropriate database
      const user = new userModel(userData);
      await user.save();
      
      // Get the created user without sensitive info
      createdUser = await userModel.findById(user._id).select('-password -__v');
    }

    return NextResponse.json(createdUser, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
  }
}

// PATCH handler to update a user
export async function PATCH(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'User id is required' }, { status: 400 });
  
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyAuth(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    const updateData = await request.json();
    
    // Ensure company is always lowercase
    if (updateData.company) {
      updateData.company = updateData.company.toLowerCase();
    }
    
    let userModel;
    
    // Determine which database to use
    if (payload.role === 'admin' && payload.companyCode) {
      // Connect to company-specific database for admin users
      const companyConn = await getDBConnection(payload.companyCode);
      userModel = getUserModel(payload.companyCode);
    } else if (payload.role === 'superadmin' && updateData.companyCode) {
      // Superadmin updating user in a specific company
      const companyConn = await getDBConnection(updateData.companyCode);
      userModel = getUserModel(updateData.companyCode);
    } else {
      // Connect to main database as fallback
      await connectDB();
      userModel = mongoose.models.User || getUserModel('');
    }
    
    // Find the user first to check if they exist and to get their current data
    const existingUser = await userModel.findById(id).select('-password');
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Admin can only update users in their own company (case-insensitive comparison)
    if (payload.role === 'admin' && existingUser.company.toLowerCase() !== payload.company.toLowerCase()) {
      return NextResponse.json({ error: 'You can only update users in your own company' }, { status: 403 });
    }
    
    // Never allow changing email directly (should be a separate process)
    if (updateData.email && updateData.email !== existingUser.email) {
      // If changing email, check if the new email is already in use
      const existingEmail = await userModel.findOne({ 
        email: updateData.email.toLowerCase(),
        _id: { $ne: id } // Exclude current user
      });
      
      if (existingEmail) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      }
      
      // Ensure email is lowercase
      updateData.email = updateData.email.toLowerCase();
    }
    
    // Prevent updating username to one that already exists
    if (updateData.username && updateData.username !== existingUser.username) {
      const existingUsername = await userModel.findOne({
        username: updateData.username,
        _id: { $ne: id } // Exclude current user
      });
      
      if (existingUsername) {
        return NextResponse.json({ error: 'Username already in use' }, { status: 400 });
      }
    }
    
    // Update the user document
    const updatedUser = await userModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -__v');

    // If role changed, propagate to auth_db and tenant DB (non-blocking)
    if (updateData.role) {
      // Propagate to central auth database
      (async () => {
        try {
          const authClient = new MongoClient(uri);
          await authClient.connect();
          const authDb = authClient.db('auth_db');
          await authDb.collection('authUsers').updateOne(
            { userId: id },
            { $set: { role: updateData.role } }
          );
          await authClient.close();
        } catch (err) {
          console.error('Error propagating role to auth_db:', err);
        }
      })();
      // Propagate to tenant-specific users collection
      (async () => {
        try {
          const tenantCode = (updateData.companyCode || existingUser.companyCode || '').toLowerCase();
          if (!tenantCode) return;
          const tenantClient = new MongoClient(uri);
          await tenantClient.connect();
          const tenantDb = tenantClient.db(`company_${tenantCode}`);
          const { ObjectId } = require('mongodb');
          await tenantDb.collection('users').updateOne(
            { _id: new ObjectId(id) },
            { $set: { role: updateData.role } }
          );
          await tenantClient.close();
        } catch (err) {
          console.error('Error propagating role to tenant DB:', err);
        }
      })();
      // Propagate to global users collection in org_sim_db
      (async () => {
        try {
          const mainClient = new MongoClient(uri);
          await mainClient.connect();
          const mainDb = mainClient.db('org_sim_db');
          const { ObjectId } = require('mongodb');
          await mainDb.collection('users').updateOne(
            { _id: new ObjectId(id) },
            { $set: { role: updateData.role } }
          );
          await mainClient.close();
        } catch (err) {
          console.error('Error propagating role to global DB:', err);
        }
      })();
    }

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
    
    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
  }
}

// DELETE handler to remove multiple users
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAuth(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admin or superadmin to access this route
    if (payload.role !== 'admin' && payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { userIds } = await request.json();
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'User IDs array is required' }, { status: 400 });
    }

    let userModel;
    
    // Determine which database to use
    if (payload.role === 'admin' && payload.companyCode) {
      // Connect to company-specific database for admin users
      const companyConn = await getDBConnection(payload.companyCode);
      userModel = getUserModel(payload.companyCode);
    } else {
      // Connect to main database for superadmin or fallback
      await connectDB();
      userModel = mongoose.models.User || getUserModel('');
    }
    
    // Get all users to be deleted for verification
    const usersToDelete = await userModel.find({ _id: { $in: userIds } });
    
    // Admin can only delete users in their own company
    if (payload.role === 'admin') {
      // Use lowercase comparison for company names
      const adminCompany = payload.company.toLowerCase();
      const nonCompanyUsers = usersToDelete.filter(user => user.company.toLowerCase() !== adminCompany);
      
      if (nonCompanyUsers.length > 0) {
        return NextResponse.json({ 
          error: 'You can only delete users in your own company',
          invalidUsers: nonCompanyUsers.map(u => u.username)
        }, { status: 403 });
      }
      
      // Admin cannot delete another admin
      const otherAdmins = usersToDelete.filter(user => user.role === 'admin' && user._id.toString() !== payload.id);
      if (otherAdmins.length > 0) {
        return NextResponse.json({ 
          error: 'You cannot delete other admin users',
          adminUsers: otherAdmins.map(u => u.username)
        }, { status: 403 });
      }
    }
    
    // Delete the users
    const result = await userModel.deleteMany({ _id: { $in: userIds } });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'No users were deleted' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} user(s)`
    });
  } catch (error: any) {
    console.error('Error deleting users:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete users' }, { status: 500 });
  }
} 