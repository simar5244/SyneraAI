import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || '';

// GET /api/departments
export async function GET(request: NextRequest) {
  let client: MongoClient | null = null;
  
  try {
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('org_sim_db');
    const employeesCollection = db.collection('employees');
    
    // Aggregate departments from employee records
    const departments = await employeesCollection.aggregate([
      // Group by department
      {
        $group: {
          _id: "$department",
          name: { $first: "$department" },
          count: { $sum: 1 },
          // Get manager info - assuming department head is first manager in department
          managers: {
            $push: {
              $cond: [
                { $eq: ["$orgLevel", "Manager"] },
                {
                  id: "$_id",
                  name: { $concat: ["$firstName", " ", "$lastName"] },
                  title: "$jobTitle"
                },
                "$$REMOVE"
              ]
            }
          }
        }
      },
      // Add departmentId
      {
        $addFields: {
          id: "$_id",
          departmentId: "$_id",
          parentDepartmentId: null // We don't have hierarchy in this simplified version
        }
      },
      // Sort by department name
      { $sort: { name: 1 } }
    ]).toArray();
    
    // Format departments for frontend
    const formattedDepartments = departments.map((dept: any) => ({
      id: dept.id,
      departmentId: dept.departmentId,
      name: dept.name,
      employeeCount: dept.count,
      parentDepartmentId: dept.parentDepartmentId,
      manager: dept.managers && dept.managers.length > 0 ? dept.managers[0] : null
    }));
    
    return NextResponse.json(formattedDepartments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
} 