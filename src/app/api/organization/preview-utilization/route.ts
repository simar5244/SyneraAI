import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

// Promisify exec for async/await
const execAsync = promisify(exec);

// Get MongoDB connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB_NAME || "org_sim_db";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const requestData = await request.json();
    
    // Extract successors and their new duties
    const { successors } = requestData;
    
    if (!Array.isArray(successors) || successors.length === 0) {
      return NextResponse.json(
        { error: 'Required fields missing: successors array with email and newDuties' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB for utilization preview');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('merged_output');
    
    // Process each successor
    const utilizationUpdates = await Promise.all(
      successors.map(async (successor: any) => {
        const { email, newDuties } = successor;
        
        // Find successor in database
        const employeeData = await collection.findOne({ email });
        if (!employeeData) {
          return {
            email,
            previousUtilization: successor.originalUtilization || 0.5,
            newUtilization: successor.originalUtilization || 0.5,
            error: 'Employee not found'
          };
        }
        
        // Get current utilization score
        const currentScore = employeeData.utilizationAssessment?.utilization_score || 
                            employeeData.utilization_score || 0.5;
        
        // If no new duties, return current score
        if (!Array.isArray(newDuties) || newDuties.length === 0) {
          return {
            email,
            previousUtilization: currentScore,
            newUtilization: currentScore,
            change: 0
          };
        }
        
        try {
          // Create a temporary copy of the employee data with new duties
          const tempEmployeeData = {
            ...employeeData,
            jobDuties: [...(employeeData.jobDuties || []), ...newDuties]
          };
          
          // Save to temporary file
          const tempFilePath = path.join(process.cwd(), 'temp_employee_data.json');
          fs.writeFileSync(tempFilePath, JSON.stringify(tempEmployeeData));
          
          // Call employee_utilization_analyzer.py on the temp file
          const pythonCommand = `python employee_utilization_analyzer.py --analyze-file ${tempFilePath}`;
          console.log(`Running command: ${pythonCommand}`);
          
          const { stdout, stderr } = await execAsync(pythonCommand);
          if (stderr) {
            console.warn('Python script warnings:', stderr);
          }
          
          // Parse the results
          const resultPath = path.join(process.cwd(), 'temp_employee_analysis.json');
          
          // Check if file exists
          if (!fs.existsSync(resultPath)) {
            throw new Error('Analysis result file not found');
          }
          
          const analysisResult = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
          
          // Clean up temporary files
          fs.unlinkSync(tempFilePath);
          fs.unlinkSync(resultPath);
          
          // Extract new utilization score
          const newScore = analysisResult.utilization_score || analysisResult.utilizationAssessment?.utilization_score;
          
          return {
            email,
            previousUtilization: currentScore,
            newUtilization: newScore || currentScore,
            change: (newScore || currentScore) - currentScore
          };
        } catch (error) {
          console.error(`Error analyzing utilization for ${email}:`, error);
          
          // Fall back to estimation if script execution fails
          const dutyIntensitySum = newDuties.reduce((sum: number, duty: any) => 
            sum + (duty.intensity || 0.5), 0);
          
          // Simple estimation formula - more duties with higher intensity = higher score
          const intensityFactor = dutyIntensitySum * 0.05;
          const estimatedScore = Math.min(1.0, currentScore + intensityFactor);
          
          return {
            email,
            previousUtilization: currentScore,
            newUtilization: estimatedScore,
            change: estimatedScore - currentScore,
            estimated: true
          };
        }
      })
    );
    
    // Close MongoDB connection
    await client.close();
    
    return NextResponse.json(utilizationUpdates);
    
  } catch (error) {
    console.error('Error in preview-utilization:', error);
    return NextResponse.json(
      { error: 'Failed to preview utilization changes' },
      { status: 500 }
    );
  }
} 