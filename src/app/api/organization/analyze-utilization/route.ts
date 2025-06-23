import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { employee, simulationOnly = false } = await req.json();
    
    if (!employee || !employee.email) {
      return NextResponse.json({ error: 'Missing employee data or email' }, { status: 400 });
    }
    
    console.log(`Running utilization analysis for ${employee.email}`);
    
    // Run the Python script specifically for this employee
    const command = `python3 employee_utilization_analyzer.py --email "${employee.email}" --single`;
    console.log(`Executing command: ${command}`);
    
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('INFO') && !stderr.includes('WARNING')) {
      console.error(`Error in Python script: ${stderr}`);
    }
    
    console.log(`Python script output: ${stdout.substring(0, 200)}...`);
    
    // Connect to the database to get the updated employee info
    const { db } = await connectToDatabase();
    const updatedEmployee = await db.collection('merged_output').findOne({ email: employee.email });
    
    if (!updatedEmployee) {
      return NextResponse.json({ error: 'Employee not found after analysis' }, { status: 404 });
    }
    
    // Extract the utilization score
    const utilizationScore = 
      updatedEmployee.utilization?.score || 
      updatedEmployee.utilizationAssessment?.utilization_score || 
      0.5;
    
    console.log(`Updated utilization score for ${employee.email}: ${utilizationScore}`);
    
    return NextResponse.json({
      email: employee.email,
      utilization_score: utilizationScore,
      utilization_category: getUtilizationCategory(utilizationScore),
      success: true
    });
    
  } catch (error) {
    console.error('Error analyzing utilization:', error);
    return NextResponse.json({ error: 'Failed to analyze utilization' }, { status: 500 });
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