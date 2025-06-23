import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// Get MongoDB connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB_NAME || "org_sim_db";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const requestData = await request.json();
    
    // Validate required fields
    const { employeeToRemove, successorUpdates } = requestData;
    
    if (!employeeToRemove?.email || !Array.isArray(successorUpdates) || successorUpdates.length === 0) {
      return NextResponse.json(
        { error: 'Required fields missing: employeeToRemove and successorUpdates array' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB for duty redistribution');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('merged_output');
    
    // Find removed employee
    const removedEmployee = await collection.findOne({ email: employeeToRemove.email });
    if (!removedEmployee) {
      await client.close();
      return NextResponse.json(
        { error: 'Employee to remove not found' },
        { status: 404 }
      );
    }
    
    // Mark removed employee as inactive without changing their data structure
    await collection.updateOne(
      { email: employeeToRemove.email },
      { 
        $set: { 
          user_status: 'inactive',
          isActive: false,
          statusReason: 'Removed via redistribution',
          redistributionTimestamp: new Date().toISOString()
        }
      }
    );
    
    console.log(`Marked employee ${employeeToRemove.email} as inactive`);
    
    // Process each successor
    const successorResults = await Promise.all(
      successorUpdates.map(async (successorUpdate: any) => {
        const { email, newDuties, previousUtilization, newUtilization } = successorUpdate;
        
        // Skip if no duties to add
        if (!Array.isArray(newDuties) || newDuties.length === 0) {
          return { 
            email, 
            result: 'skipped',
            message: 'No duties to add'
          };
        }
        
        // Find successor in database
        const successor = await collection.findOne({ email });
        if (!successor) {
          return { 
            email, 
            result: 'error',
            message: 'Successor not found'
          };
        }
        
        // Add metadata to each duty
        const taggedDuties = newDuties.map((duty: any) => ({
          ...duty,
          redistributedFrom: employeeToRemove.email,
          redistributedDate: new Date().toISOString(),
          previousOwner: {
            email: employeeToRemove.email,
            name: employeeToRemove.name || `${employeeToRemove.firstName || ''} ${employeeToRemove.lastName || ''}`.trim()
          }
        }));
        
        // Combine with existing duties
        // First, determine where to add the duties (jobDuties or jobResponsibilities)
        let updateField = '';
        let existingDuties: any[] = [];
        
        if (Array.isArray(successor.jobDuties) && successor.jobDuties.length > 0) {
          updateField = 'jobDuties';
          existingDuties = successor.jobDuties;
        } else if (Array.isArray(successor.jobResponsibilities) && successor.jobResponsibilities.length > 0) {
          updateField = 'jobResponsibilities';
          existingDuties = successor.jobResponsibilities;
        } else {
          // If neither exists, default to jobDuties (more modern field)
          updateField = 'jobDuties';
          existingDuties = [];
        }
        
        // Update the successor
        await collection.updateOne(
          { email },
          { 
            $set: {
              [updateField]: [...existingDuties, ...taggedDuties],
              utilization_score: newUtilization || previousUtilization || successor.utilization_score || 0.5
            }
          }
        );
        
        console.log(`Updated ${email} with ${taggedDuties.length} duties in ${updateField}`);
        
        return { 
          email, 
          result: 'success',
          dutiesAdded: taggedDuties.length,
          field: updateField
        };
      })
    );
    
    // Close MongoDB connection
    await client.close();
    
    return NextResponse.json({
      success: true,
      message: `Duties successfully redistributed to ${successorUpdates.length} employees`,
      details: successorResults
    });
    
  } catch (error) {
    console.error('Error in redistribute-duties:', error);
    return NextResponse.json(
      { error: 'Failed to redistribute duties' },
      { status: 500 }
    );
  }
} 