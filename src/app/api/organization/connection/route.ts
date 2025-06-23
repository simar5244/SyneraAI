import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DATABASE || 'org_sim_db';
const collectionName = 'merged_output';

export async function POST(request: NextRequest) {
  let client;
  
  try {
    const { sourceId, targetId, connectionType = 'reportsTo' } = await request.json();
    
    if (!sourceId || !targetId) {
      return NextResponse.json(
        { message: 'Source and target IDs are required' },
        { status: 400 }
      );
    }
    
    // Prevent self-connection
    if (sourceId === targetId) {
      return NextResponse.json(
        { message: 'Cannot connect an employee to themselves' },
        { status: 400 }
      );
    }
    
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    // Get source and target employees
    const sourceEmployee = await collection.findOne({ email: sourceId });
    const targetEmployee = await collection.findOne({ email: targetId });
    
    if (!sourceEmployee || !targetEmployee) {
      return NextResponse.json(
        { message: 'One or both employees not found' },
        { status: 404 }
      );
    }
    
    // Create the connection based on type
    if (connectionType === 'reportsTo') {
      // Create a manager reference
      const managerInfo = {
        email: targetId,
        name: `${targetEmployee.firstName || ''} ${targetEmployee.lastName || ''}`.trim()
      };
      
      // Update the reporting relationship
      await collection.updateOne(
        { email: sourceId },
        { $set: { reportsTo: managerInfo } }
      );
      
      // Return the updated connection
      return NextResponse.json({
        message: 'Reporting connection created successfully',
        connection: {
          sourceId,
          targetId,
          type: connectionType
        }
      });
    } else {
      // Handle other connection types if needed in the future
      return NextResponse.json(
        { message: `Connection type '${connectionType}' not supported` },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error creating connection:', error);
    return NextResponse.json(
      { 
        message: 'Failed to create connection',
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

export async function DELETE(request: NextRequest) {
  let client;
  
  try {
    const { sourceId, connectionType = 'reportsTo' } = await request.json();
    
    if (!sourceId) {
      return NextResponse.json(
        { message: 'Source ID is required' },
        { status: 400 }
      );
    }
    
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    // Get source employee
    const sourceEmployee = await collection.findOne({ email: sourceId });
    
    if (!sourceEmployee) {
      return NextResponse.json(
        { message: 'Employee not found' },
        { status: 404 }
      );
    }
    
    // Remove the connection based on type
    if (connectionType === 'reportsTo') {
      // Remove the reporting relationship
      await collection.updateOne(
        { email: sourceId },
        { $set: { reportsTo: null } }
      );
      
      // Return success
      return NextResponse.json({
        message: 'Reporting connection removed successfully'
      });
    } else {
      // Handle other connection types if needed in the future
      return NextResponse.json(
        { message: `Connection type '${connectionType}' not supported` },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error removing connection:', error);
    return NextResponse.json(
      { 
        message: 'Failed to remove connection',
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