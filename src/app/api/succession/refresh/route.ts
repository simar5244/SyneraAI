import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { spawn } from 'child_process';
import path from 'path';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DATABASE || 'org_sim_db';

/**
 * Refresh successor analysis for a specific employee
 * This API endpoint is called when the user clicks the "Refresh Analysis" button
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('merged_output');

    // Find the employee
    const employee = await collection.findOne({ email });
    if (!employee) {
      await client.close();
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Run the Python script directly for immediate refresh
    // This is more efficient than going through the JS implementation
    const scriptPath = path.join(process.cwd(), 'successor_identification.py');
    
    // Create a promise to handle the async process
    const refreshPromise = new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [
        scriptPath,
        '--find-successors',
        email
      ]);
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ output });
        } else {
          reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        }
      });
    });

    // Wait for the Python script to finish with a timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Refresh operation timed out')), 30000);
    });

    try {
      await Promise.race([refreshPromise, timeoutPromise]);
      
      // Fetch the updated employee data
      const updatedEmployee = await collection.findOne({ email });
      
      await client.close();
      
      return NextResponse.json({
        success: true,
        message: 'Successor analysis refreshed successfully',
        successorAnalysis: updatedEmployee?.successorAnalysis || null
      });
    } catch (error: any) {
      await client.close();
      console.error('Error during refresh operation:', error);
      
      return NextResponse.json(
        { 
          error: 'Failed to refresh successor analysis',
          details: error.message 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
