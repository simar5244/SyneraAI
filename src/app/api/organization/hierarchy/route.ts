import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { cookies } from 'next/headers';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DATABASE || 'org_sim_db';
const collectionName = 'merged_output';

export async function GET(request: NextRequest) {
  noStore();
  
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
    console.error('Authentication required for organization hierarchy');
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  
  // Verify token and extract user information
  let payload;
  try {
    payload = await verifyAuth(token);
    if (!payload?.id) throw new Error('Invalid token payload');
  } catch (error) {
    console.error('Invalid authentication for organization hierarchy:', error);
    return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
  }
  
  // Extract company code from payload
  const rawCompanyCode = (payload.companyCode || payload.company_code) as string;
  if (!rawCompanyCode) {
    console.error('Company context required for organization hierarchy');
    return NextResponse.json({ error: 'Company context required' }, { status: 403 });
  }
  
  const companyCode = rawCompanyCode.toLowerCase();
  console.log(`Fetching organization hierarchy for company: ${companyCode}`);
  
  let client;
  
  try {
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    console.log(`Fetching organization hierarchy data for company: ${companyCode}...`);
    
    // First try to query the company-specific database
    let employees: any[] = [];
    
    try {
      // Connect to the company-specific database
      const companyDb = client.db(`company_${companyCode}`);
      const usersCollection = companyDb.collection('users');
      
      console.log(`Querying company_${companyCode} database, users collection...`);
      
      // Query for employees in the company-specific database
      employees = await usersCollection.find({}, {
        projection: {
          _id: 0,
          email: 1,
          firstName: 1,
          lastName: 1,
          jobTitle: 1,
          department: 1,
          avatar: 1,
          reportsTo: 1,
          attritionAssessment: 1,
          utilization_score: 1,
          utilizationAssessment: 1,
          job_intensity_analysis: 1,
          salary: 1,
          phone: 1,
          workSetting: 1,
          workMode: 1,
          officeLocation: 1,
          industry: 1,
          jobResponsibilities: 1,
          toolsProficient: 1,
          feedbackMetrics: 1,
          projects: 1,
          successorAnalysis: 1,
          totalduration: 1,
          currentroleduration: 1,
          companyCode: 1,
          company_code: 1,
          company: 1
        }
      }).toArray();
      
      console.log(`Found ${employees.length} employees in company_${companyCode} database`);
    } catch (error) {
      console.warn(`Error querying company_${companyCode} database:`, error);
      console.log('Falling back to main database with company code filter...');
      
      // If company-specific database query fails, fall back to the main database with filtering
      const mainDb = client.db(dbName);
      const collection = mainDb.collection(collectionName);
      
      // Query for employees with the needed fields, filtered by company code
      employees = await collection.find(
        { 
          $or: [
            { companyCode: { $regex: `^${companyCode}$`, $options: 'i' } },
            { company_code: { $regex: `^${companyCode}$`, $options: 'i' } },
            { company: { $regex: `^${companyCode}$`, $options: 'i' } }
          ]
        }, 
        {
          projection: {
            _id: 0,
            email: 1,
            firstName: 1,
            lastName: 1,
            jobTitle: 1,
            department: 1,
            avatar: 1,
            reportsTo: 1,
            attritionAssessment: 1,
            utilization_score: 1,
            utilizationAssessment: 1,
            job_intensity_analysis: 1,
            salary: 1,
            phone: 1,
            workSetting: 1,
            workMode: 1,
            officeLocation: 1,
            industry: 1,
            jobResponsibilities: 1,
            toolsProficient: 1,
            feedbackMetrics: 1,
            projects: 1,
            successorAnalysis: 1,
            totalduration: 1,
            currentroleduration: 1,
            companyCode: 1,
            company_code: 1,
            company: 1
          }
        }
      ).toArray();
    }
    
    console.log(`Found ${employees.length} employees for company: ${companyCode}`);
    
    // Log a sample of the data to verify fields are present
    if (employees.length > 0) {
      console.log('Sample employee data:', {
        email: employees[0].email,
        company: employees[0].companyCode || employees[0].company_code || employees[0].company,
        utilizationScore: employees[0].utilization_score,
        hasUtilizationAssessment: !!employees[0].utilizationAssessment,
        hasAttritionAssessment: !!employees[0].attritionAssessment
      });
    } else {
      console.warn(`No employees found for company code: ${companyCode}`);
    }
    
    return NextResponse.json(employees);
  } catch (error: any) {
    console.error(`Error fetching organization data for company ${companyCode}:`, error);
    return NextResponse.json({ error: `Failed to fetch organization data: ${error.message}` }, { status: 500 });
  } finally {
    if (client) {
      await client.close();
    }
  }
} 