import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      removedEmployeeEmail,
      selectedSuccessors
    } = req.body;

    if (!removedEmployeeEmail || !selectedSuccessors || !selectedSuccessors.length) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log(`Preview redistribution request for ${removedEmployeeEmail} to ${selectedSuccessors.length} successors`);

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
      
      // Parse the JSON output from the script
      try {
        const outputJson = stdout.substring(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1);
        const redistributionResult = JSON.parse(outputJson);
        console.log(`Redistribution preview complete. ${redistributionResult.redistributedDuties} duties assigned.`);
        
        return res.status(200).json(redistributionResult);
      } catch (parseError) {
        console.error(`Error parsing script output: ${parseError.message}`);
        console.error(`Script output: ${stdout.substring(0, 500)}...`);
        return res.status(500).json({ 
          error: 'Failed to parse redistribution results',
          details: parseError.message,
          output: stdout.substring(0, 1000)
        });
      }
    } catch (scriptError) {
      console.error(`Error running script: ${scriptError.message}`);
      return res.status(500).json({ 
        error: 'Failed to run redistribution script',
        details: scriptError.message
      });
    }
  } catch (error) {
    console.error(`API error: ${error.message}`);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
} 