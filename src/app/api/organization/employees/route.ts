import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';

export async function GET(request: NextRequest) {
  let client;
  
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Authorization header is required' },
        { status: 401 }
      );
    }
    
    // Extract token
    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = await verifyAuth(token);
    if (!decoded) {
      return NextResponse.json(
        { message: 'Invalid token' },
        { status: 401 }
      );
    }
    
    // Get company code from query parameters or from token
    const url = new URL(request.url);
    const companyCode = url.searchParams.get('companyCode') || decoded.companyCode;
    
    if (!companyCode) {
      return NextResponse.json(
        { message: 'Company code is required' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    // Determine which database to use based on multi-tenancy
    const dbName = `company_${companyCode.toLowerCase()}`;
    const db = client.db(dbName);
    
    // Try to find employees in the employees collection
    let employees: any[] = [];
    try {
      const employeesCollection = db.collection('employees');
      employees = await employeesCollection.find({}).toArray();
    } catch (err) {
      console.warn(`No employees collection found in ${dbName}, trying users collection`);
    }
    
    // If no employees found, try the users collection
    if (employees.length === 0) {
      try {
        const usersCollection = db.collection('users');
        employees = await usersCollection.find({}).toArray();
      } catch (err) {
        console.warn(`No users collection found in ${dbName}, trying merged_output collection`);
      }
    }
    
    // If still no employees found, try the merged_output collection in the main database
    if (employees.length === 0) {
      try {
        const mainDb = client.db('org_sim_db');
        const mergedCollection = mainDb.collection('merged_output');
        
        // Filter by company code if available in the collection
        employees = await mergedCollection.find({
          $or: [
            { companyCode: companyCode },
            { company_code: companyCode }
          ]
        }).toArray();
      } catch (err) {
        console.error('Error querying merged_output collection:', err);
      }
    }
    
    // Return the employees data
    return NextResponse.json(employees || []);
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { 
        message: 'Failed to fetch employees data',
        error: error.message
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
}
