import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/dbConnect';
import Employee from '@/models/Employee';
import mongoose from 'mongoose';

// GET /api/departments
export async function GET(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Aggregate departments from employee records
    const departments = await Employee.aggregate([
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
    ]);
    
    // Format departments for frontend
    const formattedDepartments = departments.map(dept => ({
      id: dept.id,
      departmentId: dept.departmentId,
      name: dept.name,
      employeeCount: dept.count,
      parentDepartmentId: dept.parentDepartmentId,
      manager: dept.managers.length > 0 ? dept.managers[0] : null
    }));
    
    return NextResponse.json(formattedDepartments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
} 