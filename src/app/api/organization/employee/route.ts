import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { verifyAuth } from '@/lib/auth';
import { cookies } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const mainDbName = process.env.MONGODB_DATABASE || 'org_sim_db';
const collectionName = 'merged_output';

export async function GET(request: NextRequest) {
  noStore();
  let client;
  
  try {
    // Get authentication token from authorization header or cookie
    let token = request.headers.get('authorization')?.split(' ')[1];
    
    // If no token in authorization header, check cookies
    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);
        
        token = cookies['token'];
      }
    }
    
    if (!token) {
      console.error('Authentication required for employee data');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Verify token and extract user information
    let payload;
    try {
      payload = await verifyAuth(token);
      if (!payload?.id) throw new Error('Invalid token payload');
    } catch (error) {
      console.error('Invalid authentication for employee data:', error);
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }
    
    // Extract company code from payload
    const rawCompanyCode = (payload.companyCode || payload.company_code) as string;
    if (!rawCompanyCode) {
      console.error('Company context required for employee data');
      return NextResponse.json({ error: 'Company context required' }, { status: 403 });
    }
    
    // Get parameters from query
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    // Use the company code from the auth token, but allow override from query params if present
    const companyCode = url.searchParams.get('companyCode') || rawCompanyCode;
    
    console.log(`Fetching employee data for company: ${companyCode}, email: ${email || 'all employees'}`);
    
    if (!email && !companyCode) {
      return NextResponse.json(
        { error: 'Email or companyCode parameter is required' },
        { status: 400 }
      );
    }
    
    client = new MongoClient(uri);
    await client.connect();
    
    console.log(`Processing employee data request for company: ${companyCode}`);
    
    // Try to find employee in the company-specific database first
    let employee = null;
    let employees: any[] = [];
    
    // Connect to the company-specific database
    const companyDbName = `company_${companyCode.toLowerCase()}`;
    
    try {
      console.log(`Connecting to company database: ${companyDbName}`);
      const companyDb = client.db(companyDbName);
      const usersCollection = companyDb.collection('users');
      
      // If email is provided, find specific employee
      if (email) {
        console.log(`Looking for employee with email: ${email} in company database: ${companyDbName}`);
        
        // Try to find the employee in the users collection
        employee = await usersCollection.findOne({ 
          email: { $regex: `^${email}$`, $options: 'i' } 
        });
        
        if (employee) {
          console.log(`Found employee ${email} in company database`);
          return NextResponse.json(employee);
        } else {
          console.log(`Employee ${email} not found in company database, checking main database`);
        }
      } 
      // If no email but companyCode is provided, return all employees for the company
      else if (companyCode) {
        console.log(`Fetching all employees for company: ${companyCode}`);
        
        // Get all employees from the users collection
        employees = await usersCollection.find({}).toArray();
        
        console.log(`Found ${employees.length} employees in company database: ${companyDbName}`);
        
        if (employees.length > 0) {
          return NextResponse.json(employees);
        } else {
          console.log(`No employees found in company database, checking main database`);
        }
      }
    } catch (error) {
      console.warn(`Error accessing company database ${companyDbName}:`, error);
      console.log('Falling back to main database...');
    }
    
    // If we reach here, we need to check the main database as a fallback
    try {
      const mainDb = client.db(mainDbName);
      const collection = mainDb.collection(collectionName);
      
      // If email is provided, find specific employee
      if (email) {
        console.log(`Looking for employee with email: ${email} in main database with company filter`);
        
        employee = await collection.findOne({ 
          email: { $regex: `^${email}$`, $options: 'i' },
          $or: [
            { companyCode: { $regex: `^${companyCode}$`, $options: 'i' } },
            { company_code: { $regex: `^${companyCode}$`, $options: 'i' } },
            { company: { $regex: `^${companyCode}$`, $options: 'i' } }
          ]
        });
        
        if (employee) {
          console.log(`Found employee ${email} in main database`);
          return NextResponse.json(employee);
        } else {
          console.log(`Employee ${email} not found in any database`);
          return NextResponse.json(
            { error: 'Employee not found' },
            { status: 404 }
          );
        }
      } 
      // If no email but companyCode is provided, return all employees for the company
      else if (companyCode) {
        console.log(`Fetching all employees for company: ${companyCode} from main database`);
        
        employees = await collection.find({
          $or: [
            { companyCode: { $regex: `^${companyCode}$`, $options: 'i' } },
            { company_code: { $regex: `^${companyCode}$`, $options: 'i' } },
            { company: { $regex: `^${companyCode}$`, $options: 'i' } }
          ]
        }).toArray();
        
        console.log(`Found ${employees.length} employees in main database for company: ${companyCode}`);
        
        // Return all employees
        return NextResponse.json(employees || []);
      }
    } catch (error) {
      console.error(`Error querying main database for company ${companyCode}:`, error);
      return NextResponse.json(
        { error: 'Failed to fetch employee data' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error fetching employee data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch employee data: ' + error.message
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
}

export async function POST(request: NextRequest) {
  let client;
  
  try {
    const employeeData = await request.json();
    
    // Validate required fields
    if (!employeeData.firstName || !employeeData.lastName || !employeeData.email) {
      return NextResponse.json(
        { message: 'Missing required fields: firstName, lastName, and email' },
        { status: 400 }
      );
    }
    
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(mainDbName);
    const collection = db.collection(collectionName);
    
    // Check if employee with email already exists
    const existingEmployee = await collection.findOne({ email: employeeData.email });
    if (existingEmployee) {
      return NextResponse.json(
        { message: 'Employee with this email already exists' },
        { status: 409 }
      );
    }
    
    // Prepare data for insertion
    const newEmployee = {
      ...employeeData,
      createdAt: new Date(),
      // Initialize employee metrics
      attritionAssessment: { attrition_score: 0.2 }, // Default low attrition risk
      utilization_score: 0.5, // Default mid-range utilization
      projects: [],
      jobResponsibilities: employeeData.jobResponsibilities || [],
      toolsProficient: employeeData.toolsProficient || []
    };
    
    // Insert the new employee
    const result = await collection.insertOne(newEmployee);
    
    if (result.acknowledged) {
      // Return the new employee with its ID
      return NextResponse.json({
        message: 'Employee added successfully',
        employee: {
          ...newEmployee,
          id: result.insertedId.toString()
        }
      });
    } else {
      return NextResponse.json(
        { message: 'Failed to add employee' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error adding employee:', error);
    return NextResponse.json(
      { 
        message: 'Failed to add employee',
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