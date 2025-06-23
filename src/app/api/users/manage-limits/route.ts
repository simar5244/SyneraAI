import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { getUserModel } from '@/models/User';

// MongoDB connection string
const uri = process.env.MONGODB_URI || '';

export async function GET(req: NextRequest) {
  let client: MongoClient | null = null;
  
  try {
    // Extract company code from headers or query params
    const companyCode = req.headers.get('x-company-code') || req.nextUrl.searchParams.get('companyCode');
    
    if (!companyCode) {
      return NextResponse.json({ error: 'Company code is required' }, { status: 400 });
    }
    
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    // Get the company database
    const companyDb = client.db(`company_${companyCode.toLowerCase()}`);
    
    // Get the subscription details for the company from subscriptions collection
    const mainDb = client.db();
    const subscriptionsCollection = mainDb.collection('subscriptions');
    const subscription = await subscriptionsCollection.findOne({ companyCode });
    
    // Get user count
    const usersCollection = companyDb.collection('users');
    const activeUserCount = await usersCollection.countDocuments({ status: 'active' });
    const totalUserCount = await usersCollection.countDocuments();
    
    // Get the user limit from the subscription or use default values
    const userLimit = subscription?.userLimit || 0;
    const planType = subscription?.planType || 'unknown';
    
    // Calculate remaining slots
    const remainingSlots = Math.max(0, userLimit - activeUserCount);
    
    // Check if limit is reached
    const limitReached = userLimit > 0 && activeUserCount >= userLimit;
    
    return NextResponse.json({
      success: true,
      userLimit,
      activeUserCount,
      totalUserCount,
      remainingSlots,
      limitReached,
      planType,
      subscription: subscription ? {
        id: subscription._id,
        status: subscription.status,
        planType: subscription.planType,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd
      } : null
    });
  } catch (error) {
    console.error('Error managing user limits:', error);
    return NextResponse.json({ error: 'Error managing user limits' }, { status: 500 });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

export async function POST(req: NextRequest) {
  let client: MongoClient | null = null;
  
  try {
    // Extract company code from headers
    const companyCode = req.headers.get('x-company-code');
    
    if (!companyCode) {
      return NextResponse.json({ error: 'Company code is required' }, { status: 400 });
    }
    
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    // Get the subscription details for the company
    const mainDb = client.db();
    const subscriptionsCollection = mainDb.collection('subscriptions');
    const subscription = await subscriptionsCollection.findOne({ companyCode });
    
    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found for this company' }, { status: 404 });
    }
    
    // Get the user model for this company
    const UserModel = getUserModel(companyCode);
    
    // Count active users
    const activeUserCount = await UserModel.countDocuments({ status: 'active' });
    
    // Get the user limit from the subscription
    const userLimit = subscription.userLimit || 0;
    
    console.log(`Company ${companyCode} has ${activeUserCount} active users with a limit of ${userLimit}`);
    
    // If user count exceeds limit, mark the most recently added users as unpaid
    if (activeUserCount > userLimit && userLimit > 0) {
      // Find the excess users (most recently created)
      const excessCount = activeUserCount - userLimit;
      
      console.log(`Company ${companyCode} exceeds user limit by ${excessCount} users`);
      
      // Find the most recent users, excluding admins
      const recentUsers = await UserModel.find({
        status: 'active',
        role: { $nin: ['admin', 'ADMIN', 'superadmin', 'SUPERADMIN'] }
      })
      .sort({ createdAt: -1 })
      .limit(excessCount);
      
      if (recentUsers.length > 0) {
        // Get IDs of users to mark as unpaid
        const userIds = recentUsers.map(user => user._id);
        
        // Mark these users as unpaid
        await UserModel.updateMany(
          { _id: { $in: userIds } },
          { $set: { paid: false } }
        );
        
        console.log(`Marked ${userIds.length} users as unpaid due to exceeding user limit`);
        
        return NextResponse.json({
          success: true,
          message: `Marked ${userIds.length} users as unpaid due to exceeding user limit`,
          affectedUsers: userIds,
          userLimit,
          activeUserCount,
          excessCount
        });
      } else {
        console.log('No non-admin users found to mark as unpaid');
        
        return NextResponse.json({
          success: false,
          message: 'No non-admin users found to mark as unpaid',
          userLimit,
          activeUserCount,
          excessCount
        });
      }
    }
    
    // If within limits, return success
    return NextResponse.json({
      success: true,
      message: 'User count is within subscription limits',
      userLimit,
      activeUserCount,
      remainingSlots: Math.max(0, userLimit - activeUserCount)
    });
  } catch (error) {
    console.error('Error managing user limits:', error);
    return NextResponse.json({ error: 'Error managing user limits' }, { status: 500 });
  } finally {
    if (client) {
      await client.close();
    }
  }
} 