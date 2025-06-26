import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || '';

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
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    try {
      // First try to find admin in the company's database
      const companyDb = client.db(`company_${companyCode.toLowerCase()}`);
      const usersCollection = companyDb.collection('users');
      
      // Look for an admin in this company (case-insensitive role match)
      const admin = await usersCollection.findOne({
        $or: [
          { role: { $regex: '^admin$', $options: 'i' } },
          { role: 'admin' }  // Keep explicit check for backward compatibility
        ],
        status: 'active',
        email: { $exists: true, $ne: null }
      }, {
        projection: { email: 1, _id: 0 }
      });
      
      if (admin?.email) {
        return NextResponse.json({
          success: true,
          adminEmail: admin.email
        });
      }
      
      // If no company admin found, check the main database for superadmins
      const mainDb = client.db('org_sim_db');
      const mainUsersCollection = mainDb.collection('users');
      
      const superAdmin = await mainUsersCollection.findOne({
        $or: [
          { role: { $regex: '^superadmin$', $options: 'i' } },
          { role: 'superadmin' }  // Keep explicit check for backward compatibility
        ],
        status: 'active',
        email: { $exists: true, $ne: null }
      }, {
        projection: { email: 1, _id: 0 }
      });
      
      if (superAdmin?.email) {
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
    } finally {
      await client.close();
    }
    
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