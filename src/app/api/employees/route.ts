import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { unstable_noStore as noStore } from 'next/cache';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const dbName = 'org_sim_db';
const collectionName = 'Project3_Employees';

// GET handler to retrieve employees
export async function GET(request: NextRequest) {
  noStore();
  
  let client;
  
  try {
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    // Extract query parameters
    const url = new URL(request.url);
    const department = url.searchParams.get('department');
    const role = url.searchParams.get('role');
    const searchTerm = url.searchParams.get('search');
    
    // Build query
    const query: any = {};
    
    if (department) {
      query.department = department;
    }
    
    if (role) {
      query.position = role;
    }
    
    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { skills: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    // Fetch employees
    const employees = await collection.find(query).toArray();
    
    // Format employees for the frontend
    const formattedEmployees = employees.map(employee => ({
      id: employee._id.toString(),
      name: employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
      email: employee.email || 'N/A',
      position: employee.position || employee.job_title || 'N/A',
      department: employee.department || 'N/A',
      managerId: employee.manager_id || 'N/A',
      skills: employee.skills || 'N/A'
    }));
    
    return NextResponse.json(formattedEmployees);
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    
    
  } finally {
    if (client) {
      await client.close();
    }
  }
} 