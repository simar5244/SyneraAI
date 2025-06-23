import { exec } from 'child_process';
import { NextResponse } from 'next/server';
import path from 'path';

// Track initialization status
let isInitializing = false;
let lastInitTime: Date | null = null;

export async function POST() {
  // Prevent multiple initializations within 1 hour
  const now = new Date();
  if (lastInitTime && (now.getTime() - lastInitTime.getTime() < 60 * 60 * 1000)) {
    return NextResponse.json({
      status: 'skipped',
      message: 'Data processors were initialized less than 1 hour ago',
      lastInitTime
    });
  }

  // Prevent concurrent initializations
  if (isInitializing) {
    return NextResponse.json({
      status: 'in_progress',
      message: 'Data processors are already being initialized'
    });
  }

  try {
    isInitializing = true;
    
    // Get the root directory of the project
    const rootDir = process.cwd();
    const scriptPath = path.join(rootDir, 'run_data_processors.sh');
    
    console.log(`Running data processors initialization script at ${scriptPath}`);
    
    // Run the script in the background
    exec(`bash ${scriptPath} > "${rootDir}/data_init.log" 2>&1 &`);
    
    // Update status
    lastInitTime = now;
    
    // Return immediately since the script is running in the background
    return NextResponse.json({
      status: 'success',
      message: 'Data processors initialization started in background',
      timestamp: now.toISOString()
    });
  } catch (error: any) {
    console.error('Error running data processors:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to initialize data processors',
      error: error.message
    }, { status: 500 });
  } finally {
    isInitializing = false;
  }
} 