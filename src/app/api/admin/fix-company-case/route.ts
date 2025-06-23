import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import connectDB from '@/lib/dbConnect';
import { getDBConnection } from '@/lib/companyDBConnect';
import { getUserModel } from '@/models/User';
import { MongoClient } from 'mongodb';

// MongoDB connection string
const uri = process.env.MONGODB_URI || '';

export async function POST(req: NextRequest) {
  let client: MongoClient | null = null;
  
  try {
    // Get and verify token
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAuth(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Only admin and superadmin can run this fix
    if (payload.role !== 'admin' && payload.role !== 'superadmin') {
      return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    // Get company code from payload or request
    const { companyCode } = await req.json();
    const targetCompanyCode = companyCode || payload.companyCode;
    
    if (!targetCompanyCode) {
      return NextResponse.json(
        { success: false, message: 'Company code is required' },
        { status: 400 }
      );
    }

    // Connect to the database
    const dbConnection = await getDBConnection(targetCompanyCode);
    const User = getUserModel(targetCompanyCode);

    // Find all users where company name is not lowercase
    const usersToFix = await User.find({
      $expr: { $ne: [{ $toLower: "$company" }, "$company"] }
    });

    // For each user, update their company name to lowercase
    const updatePromises = usersToFix.map(user => {
      return User.findByIdAndUpdate(user._id, {
        $set: { company: user.company.toLowerCase() }
      });
    });

    // Wait for all updates to complete
    await Promise.all(updatePromises);

    // Connect to main database to fix organization records if needed
    client = new MongoClient(uri);
    await client.connect();
    const mainDb = client.db('org_sim_db');
    const organizationsCollection = mainDb.collection('organizations');

    // Find organizations where name is not lowercase
    const orgCursor = organizationsCollection.find({
      $expr: { $ne: [{ $toLower: "$name" }, "$name"] }
    });

    const orgsToFix = await orgCursor.toArray();
    
    // Update organization names to lowercase
    const orgUpdatePromises = orgsToFix.map(org => {
      return organizationsCollection.updateOne(
        { _id: org._id },
        { $set: { name: org.name.toLowerCase() } }
      );
    });

    // Wait for all organization updates to complete
    await Promise.all(orgUpdatePromises);

    return NextResponse.json({
      success: true,
      message: 'Company name case fix completed',
      stats: {
        usersFixed: usersToFix.length,
        orgsFixed: orgsToFix.length
      }
    });
  } catch (error: any) {
    console.error('Error fixing company case:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'An error occurred while fixing company case' },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
} 