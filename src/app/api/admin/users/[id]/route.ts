import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from "@/lib/auth";
import connectDB from '@/lib/dbConnect';
import User, { getUserModel } from '@/models/User';
import { MongoClient, ObjectId } from 'mongodb';
import { getDBConnection } from '@/lib/companyDBConnect';

// GET handler to retrieve a user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    await connectDB();
    
    const userId = params.id;
    
    // Try to find the user first in the company-specific database if companyCode is available
    if (payload.companyCode) {
      try {
        const client = new MongoClient(process.env.MONGODB_URI || '');
        await client.connect();
        
        try {
          // Try looking in the "users" collection first
          const companyDb = client.db(`company_${payload.companyCode.toLowerCase()}`);
          const usersCollection = companyDb.collection('users');
          
          let objId;
          try {
            // Try to convert to ObjectId
            objId = new ObjectId(userId);
          } catch (error) {
            console.error('Invalid ObjectId:', userId);
          }
          
          if (objId) {
            // Find user by ID in users collection
            const directUser = await usersCollection.findOne({ _id: objId });
            
            if (directUser) {
              console.log('Found user in users collection:', directUser.username);
              
              // Admin can only view users from their company
              if (payload.role === 'admin') {
                // Ensure admin's company is in payload
                let adminCompany = payload.company?.toLowerCase();
                
                if (!adminCompany || directUser.company.toLowerCase() !== adminCompany) {
                  return NextResponse.json({ error: 'Access denied' }, { status: 403 });
                }
              }
              
              // Don't expose password
              delete directUser.password;
              return NextResponse.json(directUser);
            }
          }
        } finally {
          await client.close();
        }
      } catch (error) {
        console.error('Error accessing company database:', error);
      }
    }
    
    // Fallback to standard User model if not found in company
    const user = await User.findById(userId).select('-password -__v');
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Admin can only view users from their company
    if (payload.role === 'admin') {
      // Ensure admin's company is in payload
      let adminCompany = payload.company;
      if (!adminCompany) {
        // If admin doesn't have company in token, look it up
        const adminUser = await User.findById(payload.id);
        adminCompany = adminUser?.company;
      }
      
      if (!adminCompany || user.company.toLowerCase() !== adminCompany.toLowerCase()) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch user' }, { status: 500 });
  }
}

// PUT handler to update a user
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    await connectDB();
    
    const userId = params.id;
    const { username, email, firstName, lastName, role, company, status, password } = await request.json();

    // Try to find the user using direct MongoDB access if we have companyCode
    if (payload.companyCode) {
      try {
        const client = new MongoClient(process.env.MONGODB_URI || '');
        await client.connect();
      
        try {
          const companyDb = client.db(`company_${payload.companyCode.toLowerCase()}`);
          const usersCollection = companyDb.collection('users');
          
          // Try to find user by ObjectID in the users collection
          const objId = new ObjectId(userId);
          const directUser = await usersCollection.findOne({ _id: objId });
          
          if (directUser) {
            console.log('Found user in users collection:', directUser.username);
            
            // Admin can only update users from their company
            if (payload.role === 'admin') {
              // Ensure admin's company is in payload
              let adminCompany = payload.company?.toLowerCase();
              
              if (!adminCompany || directUser.company.toLowerCase() !== adminCompany) {
                return NextResponse.json({ error: 'Access denied' }, { status: 403 });
              }
              
              // Admin cannot change user to a different company
              if (company && company.toLowerCase() !== adminCompany) {
                return NextResponse.json({ error: 'You cannot change a user to a different company' }, { status: 403 });
              }
            }

            // Check if requested changes are allowed based on admin permissions
            if (payload.role === 'admin' && role === 'superadmin') {
              return NextResponse.json({ error: 'You cannot promote users to superadmin' }, { status: 403 });
            }
            
            // Check for duplicate email or username
            if (username !== directUser.username || email !== directUser.email) {
              const duplicateQuery = {
                _id: { $ne: objId },
                $or: [
                  { username: username || '' },
                  { email: (email || '').toLowerCase() }
                ]
              };
              
              const existingUser = await usersCollection.findOne(duplicateQuery);
              
              if (existingUser) {
                if (username && existingUser.username === username) {
                  return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
                }
                if (email && existingUser.email === email.toLowerCase()) {
                  return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
                }
              }
            }
            
            // Prepare update data
            const updateData = {
              updatedAt: new Date()
            };
            
            if (username) updateData.username = username;
            if (email) updateData.email = email.toLowerCase();
            if (firstName !== undefined) updateData.firstName = firstName;
            if (lastName !== undefined) updateData.lastName = lastName;
            if (role) updateData.role = role;
            if (status) updateData.status = status;
            
            // Only update company if provided and authorized
            if (company && (payload.role === 'superadmin' || company.toLowerCase() === payload.company?.toLowerCase())) {
              updateData.company = company;
            }
            
            // Handle password separately if provided
            if (password) {
              const bcrypt = require('bcryptjs');
              const salt = await bcrypt.genSalt(10);
              const hashedPassword = await bcrypt.hash(password, salt);
              updateData.password = hashedPassword;
            }
            
            // Update the user
            await usersCollection.updateOne(
              { _id: objId },
              { $set: updateData }
            );
            
            // Get updated user
            const updatedUser = await usersCollection.findOne(
              { _id: objId },
              { projection: { password: 0 } }
            );
            
            return NextResponse.json(updatedUser);
          }
        } finally {
          await client.close();
        }
      } catch (error) {
        console.error('Error accessing company database:', error);
      }
    }
    
    // Fallback to standard User model if not found in company
    const user = await User.findById(userId);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Admin can only update users from their company
    if (payload.role === 'admin') {
      // Ensure admin's company is in payload
      let adminCompany = payload.company;
      if (!adminCompany) {
        // If admin doesn't have company in token, look it up
        const adminUser = await User.findById(payload.id);
        adminCompany = adminUser?.company;
      }
      
      if (!adminCompany || user.company.toLowerCase() !== adminCompany.toLowerCase()) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      
      // Admin cannot change user to a different company
      if (company && company.toLowerCase() !== adminCompany.toLowerCase()) {
        return NextResponse.json({ error: 'You cannot change a user to a different company' }, { status: 403 });
      }
    }

    // Check if requested changes are allowed based on admin permissions
    if (payload.role === 'admin') {
      // Admin cannot promote to superadmin
      if (role === 'superadmin') {
        return NextResponse.json({ error: 'You cannot promote users to superadmin' }, { status: 403 });
      }
    }

    // Check if changing to an existing username or email
    if (username !== user.username || email !== user.email) {
      const existingUser = await User.findOne({
        _id: { $ne: userId },
        $or: [
          { username: username || '' },
          { email: email?.toLowerCase() || '' }
        ]
      });

      if (existingUser) {
        if (username && existingUser.username === username) {
          return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
        }
        if (email && existingUser.email === email.toLowerCase()) {
          return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
        }
      }
    }

    // Update user
    if (username) user.username = username;
    if (email) user.email = email.toLowerCase();
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (role) user.role = role;
    if (status) user.status = status;
    
    // Only update company if provided and authorized
    if (company && (payload.role === 'superadmin' || company.toLowerCase() === payload.company?.toLowerCase())) {
      user.company = company;
    }
    
    // Update password if provided
    if (password) {
      user.password = password; // Model will hash this
    }

    await user.save();

    // Return updated user without sensitive information
    const updatedUser = await User.findById(userId).select('-password -__v');
    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
  }
}

// DELETE handler to remove a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    await connectDB();
    
    const userId = params.id;
    
    // Try to delete the user using direct MongoDB access if we have companyCode
    if (payload.companyCode) {
      try {
        const client = new MongoClient(process.env.MONGODB_URI || '');
        await client.connect();
      
        try {
          console.log(`Attempting to delete user ${userId} from company_${payload.companyCode.toLowerCase()}`);
          
          const companyDb = client.db(`company_${payload.companyCode.toLowerCase()}`);
          const usersCollection = companyDb.collection('users');
          
          // Try to convert to ObjectId for deletion
          let objId;
          try {
            objId = new ObjectId(userId);
          } catch (error) {
            console.error('Invalid ObjectId:', userId);
            return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
          }
          
          // Admin can only delete users from their company
          if (payload.role === 'admin') {
            // Find the user first to check company
            const user = await usersCollection.findOne({ _id: objId });
            
            if (!user) {
              return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }
            
            // Ensure admin's company is in payload
            let adminCompany = payload.company?.toLowerCase();
            
            if (!adminCompany || user.company.toLowerCase() !== adminCompany) {
              return NextResponse.json({ error: 'Access denied' }, { status: 403 });
            }
          }
          
          // Delete the user
          const result = await usersCollection.deleteOne({ _id: objId });
          
          if (result.deletedCount === 0) {
            console.log('No document was deleted');
            return NextResponse.json({ error: 'User not found or could not be deleted' }, { status: 404 });
          }
          
          console.log(`Successfully deleted user with ID ${userId}`);
          return NextResponse.json({ message: 'User deleted successfully' });
        } finally {
          await client.close();
        }
      } catch (error) {
        console.error('Error accessing company database:', error);
      }
    }
    
    // Fallback to standard User model if direct MongoDB access failed
    const user = await User.findById(userId);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Admin can only delete users from their company
    if (payload.role === 'admin') {
      // Ensure admin's company is in payload
      let adminCompany = payload.company;
      if (!adminCompany) {
        // If admin doesn't have company in token, look it up
        const adminUser = await User.findById(payload.id);
        adminCompany = adminUser?.company;
      }
      
      if (!adminCompany || user.company !== adminCompany) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Don't allow deleting yourself
    if (user._id.toString() === payload.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    // Don't allow admin to delete superadmin
    if (payload.role === 'admin' && user.role === 'superadmin') {
      return NextResponse.json({ error: 'You cannot delete a superadmin account' }, { status: 403 });
    }

    await User.findByIdAndDelete(userId);
    
    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 500 });
  }
} 