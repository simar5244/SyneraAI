import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/services/mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';
import mongoose from 'mongoose';
import { Collection, Document, WithId } from 'mongodb';

const execAsync = promisify(exec);

interface Employee extends WithId<Document> {
  email: string;
  firstName?: string;
  lastName?: string;
  jobResponsibilities?: any[];
  utilization?: {
    score: number;
  };
}

interface Duty {
  id?: string;
  hours?: number;
  intensity?: number;
  [key: string]: any;
}

interface SuccessorAssignment {
  email: string;
  name: string;
  duties: Duty[];
  totalHours: number;
  averageIntensity: number;
  dutyCount: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}));
  const { removedEmployeeEmail, selectedSuccessors } = body as {
    removedEmployeeEmail?: string;
    selectedSuccessors?: string[];
  };

  if (!removedEmployeeEmail || !Array.isArray(selectedSuccessors) || selectedSuccessors.length === 0) {
    console.error('Missing or invalid parameters in preview-redistribution call');
    return NextResponse.json(
      { error: 'Missing or invalid parameters' }, 
      { status: 400 }
    );
  }
  try {
    const { 
      removedEmployeeEmail,
      selectedSuccessors
    } = await req.json();

    if (!removedEmployeeEmail || !selectedSuccessors || !selectedSuccessors.length) {
      console.error('Missing required parameters in preview-redistribution call');
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log(`Preview redistribution request for ${removedEmployeeEmail} to ${selectedSuccessors.length} successors`);

    // Connect to MongoDB to verify employee exists
    const conn = await connectToDatabase();
    const db = conn.connection.db;
    if (!db) {
      throw new Error('Failed to connect to database');
    }
    const collection = db.collection<Employee>('merged_output');
    const employee = await collection.findOne<Employee>({ email: removedEmployeeEmail });

    if (!employee) {
      console.error(`Employee not found: ${removedEmployeeEmail}`);
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    console.log(`Found employee to remove: ${employee.firstName} ${employee.lastName} (${employee.email})`);
    console.log(`Job responsibilities: ${(employee.jobResponsibilities || []).length}`);

    // Format successors as comma-separated list
    const successorsList = selectedSuccessors.join(',');

    // Call the shell script to run the Python redistribution simulation
    try {
      console.log(`Running duty redistribution preview...`);
      const command = `./run_duty_redistribution.sh --incumbent ${removedEmployeeEmail} --successors ${successorsList}`;
      
      console.log(`Executing command: ${command}`);
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.error(`Shell script error: ${stderr}`);
      }
      
      console.log(`Script output: ${stdout.substring(0, 200)}...`);
      
      // Parse the JSON output from the script
      try {
        const outputJson = stdout.substring(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1);
        const redistributionResult = JSON.parse(outputJson);
        console.log(`Redistribution preview complete. ${redistributionResult.redistributedDuties} duties assigned.`);
        
        return NextResponse.json(redistributionResult);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error parsing script output: ${errorMessage}`);
        console.error(`Script output: ${stdout.substring(0, 500)}...`);
        
        // Fallback to manual assignment if script fails
        console.log("Falling back to manual duty assignment calculation");
        
        // Get duties from employee
        const duties = employee.jobResponsibilities || [];
        if (!duties.length) {
          return NextResponse.json({ 
            error: 'No duties found to redistribute',
            incumbentEmail: removedEmployeeEmail,
            incumbentName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
            dutyAssignments: [],
            successorAssignments: [],
            totalDuties: 0,
            redistributedDuties: 0
          });
        }
        
        // Fetch successors
        const successors = await Promise.all(
          selectedSuccessors.map(async (email: string) => {
            return await collection.findOne({ email });
          })
        );
        
        const validSuccessors = successors.filter((s): s is Employee => s !== null);
        
        // Simple distribution - round robin
        const dutyAssignments: Array<{
          dutyId: string;
          duty: Duty;
          successorEmail: string;
          successorName: string;
          score: number;
          utilizationScore: number;
          overlapScore: number;
        }> = [];
        
        const successorDutyMap: Record<string, Duty[]> = {};
        
        // Initialize empty arrays for each successor
        validSuccessors.forEach(successor => {
          successorDutyMap[successor.email] = [];
        });
        
        // Distribute duties round-robin style
        (duties as Duty[]).forEach((duty: Duty, index: number) => {
          const successorIndex = index % validSuccessors.length;
          const successor = validSuccessors[successorIndex];
          
          const dutyId = duty.id || `duty-${index}`;
          
          dutyAssignments.push({
            dutyId,
            duty,
            successorEmail: successor.email,
            successorName: `${successor.firstName || ''} ${successor.lastName || ''}`.trim(),
            score: 0.7, // Default score
            utilizationScore: successor.utilization?.score || 0.5,
            overlapScore: 0.5 // Default overlap
          });
          
          successorDutyMap[successor.email].push(duty);
        });
        
        const successorAssignments: SuccessorAssignment[] = validSuccessors.map(successor => {
          const assignedDuties = successorDutyMap[successor.email] || [];
          const totalHours = assignedDuties.reduce(
            (sum, duty) => sum + (duty.hours || (duty.intensity || 0.5) * 10 || 5), 0
          );
          
          return {
            email: successor.email,
            name: `${successor.firstName || ''} ${successor.lastName || ''}`.trim(),
            duties: assignedDuties,
            totalHours,
            averageIntensity: assignedDuties.length ? 
              assignedDuties.reduce((sum, duty) => sum + (duty.intensity || 0.5), 0) / assignedDuties.length : 
              0,
            dutyCount: assignedDuties.length
          };
        });
        
        // Create and return the result
        const result = {
          incumbentEmail: removedEmployeeEmail,
          incumbentName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
          dutyAssignments,
          successorAssignments,
          totalDuties: duties.length,
          redistributedDuties: dutyAssignments.length
        };
        
        return NextResponse.json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error running redistribution script: ${errorMessage}`);
      return NextResponse.json({ 
        error: 'Failed to run redistribution script',
        details: errorMessage
      }, { status: 500 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`API error: ${errorMessage}`);
    return NextResponse.json(
      { error: 'Server error', details: errorMessage }, 
      { status: 500 }
    );
  }
} 