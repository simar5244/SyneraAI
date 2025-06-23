import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

// Path to Python script
const SCRIPT_PATH = path.join(process.cwd(), 'src', 'python', 'project_manager.py');

/**
 * Execute the Python script with the specified action and parameters
 */
async function runPythonScript(action: string, params: Record<string, any> = {}): Promise<any> {
  try {
    // Ensure the script exists
    if (!fs.existsSync(SCRIPT_PATH)) {
      throw new Error(`Python script not found at: ${SCRIPT_PATH}`);
    }

    // Create command with appropriate arguments
    let cmd = `python ${SCRIPT_PATH} ${action}`;
    
    // Add data as a temporary JSON file if needed
    let tempFilePath = '';
    if (params.data) {
      tempFilePath = path.join(process.cwd(), 'temp_data.json');
      fs.writeFileSync(tempFilePath, JSON.stringify(params.data));
      cmd += ` --data ${tempFilePath}`;
    }
    
    // Add other params
    if (params.user_id) {
      cmd += ` --user_id ${params.user_id}`;
    }
    
    if (params.project_id) {
      cmd += ` --project_id ${params.project_id}`;
    }
    
    // Temporary output file
    const outputFile = path.join(process.cwd(), `output_${Date.now()}.json`);
    cmd += ` --output ${outputFile}`;
    
    // Execute Python script
    console.log(`Executing Python command: ${cmd}`);
    await execPromise(cmd);
    
    // Read the output
    const output = fs.readFileSync(outputFile, 'utf8');
    const result = JSON.parse(output);
    
    // Clean up temporary files
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }
    
    return result;
  } catch (error) {
    console.error('Error executing Python script:', error);
    throw error;
  }
}

// GET /api/projects/python?action=get_projects&userId=xxxx
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const projectId = searchParams.get('projectId');
    
    if (!action) {
      return NextResponse.json({ error: 'Action parameter is required' }, { status: 400 });
    }
    
    // Map the action to the appropriate Python script function
    switch (action) {
      case 'get_projects':
        if (!userId) {
          return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 });
        }
        
        const projectsResult = await runPythonScript('get_projects', { user_id: userId });
        return NextResponse.json(projectsResult);
        
      case 'get_insights':
        if (!userId) {
          return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 });
        }
        
        const insightsResult = await runPythonScript('get_insights', { user_id: userId });
        return NextResponse.json(insightsResult);
        
      case 'analyze_project':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId parameter is required' }, { status: 400 });
        }
        
        const analysisResult = await runPythonScript('analyze_project', { project_id: projectId });
        return NextResponse.json(analysisResult);
        
      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in Python API route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/python
export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { action, data } = requestData;
    
    if (!action) {
      return NextResponse.json({ error: 'Action parameter is required' }, { status: 400 });
    }
    
    if (action === 'create_project') {
      if (!data) {
        return NextResponse.json({ error: 'Project data is required' }, { status: 400 });
      }
      
      const result = await runPythonScript('create_project', { data });
      return NextResponse.json(result);
    }
    
    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
  } catch (error) {
    console.error('Error in Python API route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 