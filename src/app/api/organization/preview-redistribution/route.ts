import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: Request) {
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
    const { db } = await connectToDatabase();
    const employee = await db.collection('merged_output').findOne({ email: removedEmployeeEmail });

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
      } catch (parseError) {
        console.error(`Error parsing script output: ${parseError.message}`);
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
            return await db.collection('merged_output').findOne({ email });
          })
        );
        
        const validSuccessors = successors.filter(Boolean);
        
        // Simple distribution - round robin
        const dutyAssignments = [];
        const successorDutyMap: Record<string, any[]> = {};
        
        // Initialize empty arrays for each successor
        validSuccessors.forEach(successor => {
          successorDutyMap[successor.email] = [];
        });
        
        // Distribute duties round-robin style
        duties.forEach((duty, index) => {
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
        
        const successorAssignments = validSuccessors.map(successor => {
          const assignedDuties = successorDutyMap[successor.email] || [];
          const totalHours = assignedDuties.reduce(
            (sum, duty) => sum + (duty.hours || duty.intensity * 10 || 5), 0
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
    } catch (scriptError) {
      console.error(`Error running redistribution script: ${scriptError.message}`);
      return NextResponse.json({ 
        error: 'Failed to run redistribution script',
        details: scriptError.message
      }, { status: 500 });
    }
  } catch (error) {
    console.error(`API error: ${error}`);
    return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
  }
} 