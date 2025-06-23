import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { 
      removedEmployeeEmail, 
      selectedSuccessors, 
      dutyAssignments,
      duties
    } = await req.json();
    
    if (!removedEmployeeEmail || !selectedSuccessors || !selectedSuccessors.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    console.log(`Redistributing duties for ${removedEmployeeEmail} to ${selectedSuccessors.length} successors`);
    console.log(`Selected successors: ${selectedSuccessors.join(', ')}`);
    
    const { db } = await connectToDatabase();
    
    // 1. Find the employee to be removed
    const removedEmployee = await db.collection('merged_output').findOne({ email: removedEmployeeEmail });
    
    if (!removedEmployee) {
      console.error(`Employee not found: ${removedEmployeeEmail}`);
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    
    console.log(`Found employee: ${removedEmployee.firstName} ${removedEmployee.lastName}`);
    console.log(`Job responsibilities: ${(removedEmployee.jobResponsibilities || []).length}`);
    
    // 2. Process duty assignments
    const successorUpdates: { [key: string]: any[] } = {};
    
    // If we have explicit duty assignments, use those
    if (dutyAssignments && dutyAssignments.length > 0) {
      console.log(`Using explicit duty assignments: ${dutyAssignments.length}`);
      // Group duties by successor
      dutyAssignments.forEach((assignment: any) => {
        if (!successorUpdates[assignment.employeeEmail]) {
          successorUpdates[assignment.employeeEmail] = [];
        }
        
        // Add duty to successor's list
        successorUpdates[assignment.employeeEmail].push(assignment.duty);
      });
    } 
    // Otherwise, distribute duties evenly among successors
    else if (duties && duties.length > 0) {
      console.log(`Distributing duties evenly: ${duties.length} duties among ${selectedSuccessors.length} successors`);
      const dutiesPerSuccessor = Math.ceil(duties.length / selectedSuccessors.length);
      
      selectedSuccessors.forEach((successorEmail: string, index: number) => {
        const startIdx = index * dutiesPerSuccessor;
        const endIdx = Math.min(startIdx + dutiesPerSuccessor, duties.length);
        const assignedDuties = duties.slice(startIdx, endIdx);
        
        if (assignedDuties.length > 0) {
          successorUpdates[successorEmail] = assignedDuties;
        }
      });
    } else {
      // Fallback to using the employee's existing job responsibilities
      console.log(`Using employee's existing job responsibilities`);
      const employeeDuties = removedEmployee.jobResponsibilities || [];
      
      if (employeeDuties.length === 0) {
        console.log(`No duties found for employee ${removedEmployeeEmail}`);
        return NextResponse.json({ 
          error: 'No duties found to redistribute',
          removedEmployee: {
            name: `${removedEmployee.firstName || ''} ${removedEmployee.lastName || ''}`.trim(),
            email: removedEmployeeEmail
          }
        }, { status: 400 });
      }
      
      const dutiesPerSuccessor = Math.ceil(employeeDuties.length / selectedSuccessors.length);
      
      selectedSuccessors.forEach((successorEmail: string, index: number) => {
        const startIdx = index * dutiesPerSuccessor;
        const endIdx = Math.min(startIdx + dutiesPerSuccessor, employeeDuties.length);
        const assignedDuties = employeeDuties.slice(startIdx, endIdx);
        
        if (assignedDuties.length > 0) {
          successorUpdates[successorEmail] = assignedDuties;
        }
      });
    }
    
    console.log(`Duty assignments prepared for ${Object.keys(successorUpdates).length} successors`);
    
    // 3. Update each successor with their new duties
    const updateOperations = Object.entries(successorUpdates).map(([email, duties]) => {
      // Tag duties with info about their origin
      const taggedDuties = duties.map(duty => ({
        ...duty,
        redistributed: true,
        originalOwner: removedEmployeeEmail,
        dateReassigned: new Date().toISOString()
      }));
      
      return db.collection('merged_output').updateOne(
        { email },
        { 
          $push: { 
            jobResponsibilities: { $each: taggedDuties } 
          },
          $set: {
            lastUpdated: new Date()
          }
        }
      );
    });
    
    // 4. Mark the removed employee as inactive
    updateOperations.push(
      db.collection('merged_output').updateOne(
        { email: removedEmployeeEmail },
        {
          $set: {
            isActive: false,
            status: 'inactive',
            lastUpdated: new Date()
          }
        }
      )
    );
    
    // 5. Execute all update operations
    console.log(`Executing ${updateOperations.length} database updates`);
    const results = await Promise.all(updateOperations);
    console.log(`Database updates completed`);
    
    // 6. Create a record of the redistribution in history collection
    await db.collection('redistribution_history').insertOne({
      removedEmployeeEmail,
      removedEmployee: {
        name: removedEmployee.firstName + ' ' + removedEmployee.lastName,
        jobTitle: removedEmployee.jobTitle,
        email: removedEmployee.email,
      },
      successors: selectedSuccessors,
      dutyAssignments: dutyAssignments || Object.entries(successorUpdates).map(([email, duties]) => ({
        employeeEmail: email,
        duties
      })),
      timestamp: new Date(),
      totalDutiesRedistributed: Object.values(successorUpdates).reduce(
        (total, duties) => total + duties.length, 0
      )
    });
    
    // 7. Run utilization analyzer for each successor to update their scores
    console.log(`Running utilization analyzer for each successor`);
    const updatedSuccessors = [];
    
    for (const successorEmail of selectedSuccessors) {
      try {
        console.log(`Analyzing utilization for ${successorEmail}`);
        
        // Fetch the updated successor data
        const successor = await db.collection('merged_output').findOne({ email: successorEmail });
        
        if (!successor) {
          console.warn(`Successor not found: ${successorEmail}`);
          continue;
        }
        
        // Run the utilization analyzer script
        console.log(`Running utilization analyzer for ${successorEmail}`);
        const command = `python3 update_employee_utilization.py --email "${successorEmail}"`;
        
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr && !stderr.includes('INFO') && !stderr.includes('WARNING')) {
          console.error(`Error analyzing ${successorEmail}: ${stderr}`);
        }
        
        console.log(`Analyzer output: ${stdout.substring(0, 200)}`);
        
        // Fetch the updated successor with new utilization score
        const updatedSuccessor = await db.collection('merged_output').findOne({ email: successorEmail });
        
        if (!updatedSuccessor) {
          console.warn(`Updated successor not found: ${successorEmail}`);
          continue;
        }
        
        const utilizationScore = 
          updatedSuccessor.utilization?.score || 
          updatedSuccessor.utilizationAssessment?.utilization_score || 
          successor.utilization?.score || 
          0.5;
        
        console.log(`Updated utilization score for ${successorEmail}: ${utilizationScore}`);
        
        updatedSuccessors.push({
          email: successorEmail,
          name: `${updatedSuccessor.firstName || ''} ${updatedSuccessor.lastName || ''}`.trim(),
          utilization: {
            score: utilizationScore,
            category: getUtilizationCategory(utilizationScore)
          },
          duties: successorUpdates[successorEmail].length,
          jobTitle: updatedSuccessor.jobTitle
        });
      } catch (analyzerError) {
        console.error(`Error running analyzer for ${successorEmail}:`, analyzerError);
      }
    }
    
    console.log(`Successfully redistributed duties to ${selectedSuccessors.length} employees`);
    
    return NextResponse.json({ 
      success: true,
      message: `Successfully redistributed duties to ${selectedSuccessors.length} employees`,
      redistributedDuties: Object.values(successorUpdates).reduce(
        (total, duties) => total + duties.length, 0
      ),
      updatedSuccessors
    });
    
  } catch (error) {
    console.error('Error redistributing duties:', error);
    return NextResponse.json({ error: 'Failed to redistribute duties' }, { status: 500 });
  }
}

// Utility function to categorize utilization levels
function getUtilizationCategory(score: number): string {
  if (score > 1.3) return "critical";
  if (score > 1.2) return "very-high";
  if (score > 1.1) return "high";
  if (score > 1.0) return "above-optimal";
  if (score > 0.9) return "optimal";
  if (score > 0.7) return "moderate";
  if (score > 0.5) return "low";
  if (score > 0.3) return "very-low";
  return "minimal";
} 