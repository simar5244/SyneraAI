import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DATABASE || 'org_sim_db';
const collectionName = 'merged_output';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { email: string } }
) {
  let client;
  
  try {
    const { email } = params;
    
    if (!email) {
      return NextResponse.json(
        { message: 'Email parameter is required' },
        { status: 400 }
      );
    }
    
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    // Find the employee first to check if they exist
    const employee = await collection.findOne({ email });
    
    if (!employee) {
      return NextResponse.json(
        { message: 'Employee not found' },
        { status: 404 }
      );
    }
    
    // Find all employees reporting to this person
    const reportingEmployees = await collection.find({ 'reportsTo.email': email }).toArray();
    
    // Update the hierarchy structure to reassign employees
    if (reportingEmployees.length > 0) {
      // For employees reporting to the removed employee, set their manager to null
      await collection.updateMany(
        { 'reportsTo.email': email },
        { $set: { reportsTo: null } }
      );
    }
    
    // Delete the employee
    const result = await collection.deleteOne({ email });
    
    if (result.deletedCount === 1) {
      return NextResponse.json({
        message: 'Employee removed successfully',
        reassignedEmployees: reportingEmployees.length
      });
    } else {
      return NextResponse.json(
        { message: 'Failed to remove employee' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error removing employee:', error);
    return NextResponse.json(
      { 
        message: 'Failed to remove employee',
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