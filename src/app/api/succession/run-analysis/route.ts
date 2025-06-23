import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '@/lib/auth';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cluster0.nen0dzs.mongodb.net/';
// Remove the default DB_NAME - each company has its own database
// const DB_NAME = 'org_sim_db'; // Note: Each company has its own database, org_sim_db is old
const USERS_COLLECTION = 'users'; // Primary collection for all employee data

/**
 * Trigger attrition and successor analysis
 * This API endpoint is called when the user clicks the "Refresh Data" button
 */
export async function POST(req: NextRequest) {
  // Authenticate and enforce multi-tenancy
  const authResult = await authMiddleware(req);
  if (authResult) return authResult;
  
  const user = (req as any).user;
  if (!user?.companyCode) {
    return NextResponse.json({ error: 'Company not found' }, { status: 403 });
  }
  
  // Get company code from user context
  const companyCode = user.companyCode;
  
  // Only use company-specific database
  const dbName = `company_${companyCode.toLowerCase()}`;
  
  try {
    // Path to attrition_score.py
    const scriptPath = path.resolve(process.cwd(), 'attrition_score.py');
    
    console.log(`Running attrition analysis for ${dbName}...`);
    
    // Check if Python script exists
    if (!fs.existsSync(scriptPath)) {
      console.error(`Cannot find attrition_score.py at ${scriptPath}`);
      return NextResponse.json(
        { error: 'Analysis script not found' },
        { status: 500 }
      );
    }
    
    try {
      // Run python script with database name parameter
      // Add --single-db flag to process only the specified database
      const pythonProcess = spawn('python3', [
        scriptPath,
        '--db', dbName,
        '--single-db'  // New flag to indicate we only want to process one database
      ]);
      
      // Collect stdout data
      let outputData = '';
      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
        console.log(`Attrition analysis output for ${dbName}: ${data}`);
      });
      
      // Collect stderr data
      let errorData = '';
      pythonProcess.stderr.on('data', (data) => {
        const message = data.toString();
        errorData += message;
        
        // Only log as error if it's not an INFO message
        if (message.includes('ERROR') || message.includes('CRITICAL') || message.includes('WARNING')) {
          console.error(`Attrition analysis error: ${message}`);
        } else {
          console.log(`Attrition analysis log: ${message}`);
        }
      });
      
      await new Promise((resolve) => {
        pythonProcess.on('exit', (code) => {
          console.log(`Attrition analysis process exited with code ${code}`);
          
          // If python script fails, fall back to npm run
          if (code !== 0) {
            console.log(`Python script failed, trying npm run attrition-analyze as fallback for database ${dbName}`);
            try {
              // Use npm script as fallback, also with --db parameter and --single-db flag
              const npmProcess = exec(`npm run attrition-analyze -- --db ${dbName} --single-db`);
              
              npmProcess.stdout?.on('data', (data) => {
                console.log(`Npm fallback output: ${data}`);
              });
              
              npmProcess.stderr?.on('data', (data) => {
                console.error(`Npm fallback error: ${data}`);
              });
            } catch (npmError) {
              console.error(`Npm fallback failed: ${npmError}`);
            }
          }
          
          resolve(code);
        });
      });
      
    } catch (pythonError) {
      console.error(`Error running Python script: ${pythonError}`);
      return NextResponse.json(
        { error: 'Analysis script execution error' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      status: 'success',
      message: 'Analysis completed successfully'
    });
    
  } catch (error) {
    console.error('Error in run-analysis:', error);
    return NextResponse.json(
      { error: 'Error running analysis' },
      { status: 500 }
    );
  }
} 