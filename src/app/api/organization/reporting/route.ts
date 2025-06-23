import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DATABASE || 'org_sim_db';
const collectionName = 'merged_output';

export async function PUT(request: NextRequest) {
  let client;
  
  try {
    const body = await request.json();
    const { employeeEmail, managerEmail } = body;
    
    if (!employeeEmail) {
      return NextResponse.json(
        { message: 'Employee email is required' },
        { status: 400 }
      );
    }
    
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    // Find the manager to get their name
    let managerInfo = null;
    if (managerEmail) {
      const manager = await collection.findOne(
        { email: managerEmail },
        { projection: { _id: 0, firstName: 1, lastName: 1 } }
      );
      
      if (manager) {
        managerInfo = {
          email: managerEmail,
          name: `${manager.firstName || ''} ${manager.lastName || ''}`.trim()
        };
      }
    }
    
    // Update the employee's reportsTo field
    await collection.updateOne(
      { email: employeeEmail },
      { $set: { reportsTo: managerInfo } }
    );
    
    return NextResponse.json({ 
      message: 'Reporting structure updated successfully',
      employee: employeeEmail,
      manager: managerInfo
    });
  } catch (error: any) {
    console.error('Error updating reporting structure:', error);
    return NextResponse.json(
      { 
        message: 'Failed to update reporting structure',
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