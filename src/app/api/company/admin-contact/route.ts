import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import connectDB from '@/lib/dbConnect';
import User from '@/models/User';

// MongoDB connection string
const uri = process.env.MONGODB_URI || '';

export async function GET(request: NextRequest) {
  let client: MongoClient | null = null;
  
  try {
    // Get company code from query params
    const url = new URL(request.url);
    const companyCode = url.searchParams.get('companyCode');
    
    if (!companyCode) {
      return NextResponse.json(
        { success: false, message: 'Company code is required' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    await connectDB();
    client = new MongoClient(uri);
    await client.connect();
    
    // First try to find admin in the company's database
    const companyDb = client.db(`company_${companyCode.toLowerCase()}`);
    const usersCollection = companyDb.collection('users');
    
    // Look for an admin in this company
    const admin = await usersCollection.findOne({
      role: { $in: ['admin', 'ADMIN', 'Admin'] },
      status: 'active'
    });
    
    if (admin && admin.email) {
      return NextResponse.json({
        success: true,
        adminEmail: admin.email
      });
    }
    
    // If no company admin found, check the main database for superadmins
    const mainDb = client.db();
    const mainUsersCollection = mainDb.collection('users');
    
    const superAdmin = await mainUsersCollection.findOne({
      role: { $in: ['superadmin', 'SUPERADMIN', 'Superadmin'] },
      status: 'active'
    });
    
    if (superAdmin && superAdmin.email) {
      return NextResponse.json({
        success: true,
        adminEmail: superAdmin.email
      });
    }
    
    // If still no admin found, return a generic message
    return NextResponse.json({
      success: false,
      message: 'No admin contact found for this company'
    });
    
  } catch (error: any) {
    console.error('Error finding admin contact:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error finding admin contact' },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
} 