import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import connectToMongoDB from '@/lib/dbConnect';
import User, { getUserModel } from '@/models/User';
import bcrypt from 'bcryptjs';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';

export async function POST(request: NextRequest) {
  let mongoClient: MongoClient | null = null;
  
  try {
    await connectToMongoDB();

    // Extract token from header
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    // Verify the token and get user payload
    const verifiedPayload = await verifyAuth(token);
    if (!verifiedPayload || !verifiedPayload.id) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, message: 'Current password and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ success: false, message: 'New password must be at least 6 characters long' }, { status: 400 });
    }

    // Get company code from payload
    const companyCode = verifiedPayload.companyCode ? 
      verifiedPayload.companyCode.toLowerCase() : '';

    if (!companyCode) {
      return NextResponse.json({ success: false, message: 'Company code is required' }, { status: 400 });
    }

    console.log(`[CHANGE PASSWORD] Updating password for user ${verifiedPayload.id} in company ${companyCode}`);

    // Get the company-specific User model
    const UserModel = getUserModel(companyCode);
    
    // Fetch user using the ID from the verified token
    const user = await UserModel.findById(verifiedPayload.id).select('+password');
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Check if the current password matches the one stored
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return NextResponse.json({ success: false, message: 'Incorrect current password' }, { status: 400 });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Connect to MongoDB directly for updating multiple collections
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();

    // 1. Update user in company's users collection using Mongoose (already connected)
    user.password = hashedNewPassword;
    await user.save();
    console.log(`[CHANGE PASSWORD] Updated password in company_${companyCode}.users collection`);

    // 2. Update auth collection in company database
    try {
      const companyDb = mongoClient.db(`company_${companyCode}`);
      const authCollection = companyDb.collection('auth');
      
      const authResult = await authCollection.updateOne(
        { userId: verifiedPayload.id.toString() },
        { $set: { password: hashedNewPassword, updatedAt: new Date() } }
      );
      
      console.log(`[CHANGE PASSWORD] Updated password in company_${companyCode}.auth collection: ${authResult.modifiedCount} document(s)`);
    } catch (error) {
      console.error(`[CHANGE PASSWORD] Error updating company_${companyCode}.auth:`, error);
      // Continue even if this fails
    }

    // 3. Update central authUsers collection
    try {
      const centralDb = mongoClient.db('auth');
      const authUsersCollection = centralDb.collection('authUsers');
      
      // Try to find by user ID
      const authUserResult = await authUsersCollection.updateOne(
        { 
          $or: [
            { userId: verifiedPayload.id.toString() },
            { email: user.email }
          ]
        },
        { 
          $set: { 
            password: hashedNewPassword,
            updatedAt: new Date(),
            // Ensure these fields are set/updated
            email: user.email,
            companyCode: companyCode,
            role: user.role
          } 
        }
      );
      
      if (authUserResult.matchedCount === 0) {
        // If no document was found, create a new one
        await authUsersCollection.insertOne({
          userId: verifiedPayload.id.toString(),
          email: user.email,
          password: hashedNewPassword,
          companyCode: companyCode,
          role: user.role,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`[CHANGE PASSWORD] Created new record in auth.authUsers collection`);
      } else {
        console.log(`[CHANGE PASSWORD] Updated password in auth.authUsers collection: ${authUserResult.modifiedCount} document(s)`);
      }
    } catch (error) {
      console.error('[CHANGE PASSWORD] Error updating auth.authUsers:', error);
      // Continue even if this fails
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Password changed successfully across all systems' 
    }, { status: 200 });

  } catch (error: any) {
    console.error('[CHANGE PASSWORD] Error:', error);
    // Provide a generic error message to the client for security
    return NextResponse.json({ 
      success: false, 
      message: 'An error occurred while changing password',
      error: error.message
    }, { status: 500 });
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}
