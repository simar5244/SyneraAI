import { connectToDatabase } from '@/lib/mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: "Email parameter is required" });
  }

  console.log(`Connecting to MongoDB to fetch successor data...`);
  const { db } = await connectToDatabase();
  console.log(`Successfully connected to MongoDB`);

  try {
    console.log(`Fetching successor data for ${email}...`);
    
    // First, check if the employee exists
    const employee = await db.collection('merged_output').findOne({ email });
    
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    
    console.log(`Found employee: ${employee.firstName} ${employee.lastName} (${employee.email})`);
    console.log(`Department: ${employee.department}, Job title: ${employee.jobTitle}`);
    
    // Check if a successorAnalysis already exists in the database
    if (employee.successorAnalysis) {
      console.log(`Successor analysis exists: ${JSON.stringify(employee.successorAnalysis).substring(0, 100)}...`);
      
      // Return existing analysis
      return res.status(200).json({ 
        successorAnalysis: employee.successorAnalysis 
      });
    }
    
    // If no existing analysis, run the Python script to generate one
    console.log(`No existing successor analysis found, running Python scripts...`);
    try {
      const { stdout, stderr } = await execAsync(`python3 successor_identification.py --email ${email}`);
      
      if (stderr) {
        console.error(`Python script error: ${stderr}`);
      }
      
      console.log(`Python script output: ${stdout.substring(0, 200)}...`);
      
      // After the script runs, fetch the updated employee data with the successor analysis
      const updatedEmployee = await db.collection('merged_output').findOne({ email });
      
      if (updatedEmployee && updatedEmployee.successorAnalysis) {
        return res.status(200).json({ 
          successorAnalysis: updatedEmployee.successorAnalysis 
        });
      }
      
      // Fall back to manual successor identification if script didn't update the database
      console.log(`Python script didn't update database, falling back to manual calculation...`);
      
      // Find all other employees
      const otherEmployees = await db.collection('merged_output').find({ 
        email: { $ne: email } 
      }).toArray();
      
      console.log(`Found ${otherEmployees.length} other employees to consider for succession`);
      
      // Simple successor identification based on department match and skills
      const department = employee.department;
      const skills = employee.toolsProficient || [];
      
      // Filter employees by department if possible
      let potentialSuccessors = department 
        ? otherEmployees.filter(e => e.department === department)
        : otherEmployees;
        
      console.log(`No successors found for ${email}, creating based on department match`);
      console.log(`Found ${potentialSuccessors.length} employees in the same department: ${department}`);
      
      // Rank successors by skill match
      console.log(`Ranking successors by skill match`);
      console.log(`Employee skills: ${Array.isArray(skills) ? skills.join(', ') : skills}`);
      
      potentialSuccessors = potentialSuccessors.map(successor => {
        const successorSkills = successor.toolsProficient || [];
        
        // Calculate skill overlap
        let skillMatch = 0;
        if (Array.isArray(skills) && Array.isArray(successorSkills) && skills.length > 0 && successorSkills.length > 0) {
          const commonSkills = skills.filter(skill => 
            successorSkills.some(s => 
              typeof s === 'string' && typeof skill === 'string' && 
              s.toLowerCase().includes(skill.toLowerCase())
            )
          );
          skillMatch = commonSkills.length / skills.length;
        }
        
        return {
          ...successor,
          skillMatch,
          score: skillMatch,
          readinessLevel: skillMatch > 0.7 ? 'High' : skillMatch > 0.4 ? 'Medium' : 'Low'
        };
      });
      
      // Sort by skill match
      potentialSuccessors.sort((a, b) => b.skillMatch - a.skillMatch);
      
      // Take top 3 as viable successors
      const viableSuccessors = potentialSuccessors.slice(0, 3).map(successor => ({
        email: successor.email,
        name: `${successor.firstName || ''} ${successor.lastName || ''}`.trim(),
        score: successor.skillMatch,
        readinessLevel: successor.readinessLevel,
        jobTitle: successor.jobTitle || 'Employee',
        factors: {
          skill_match: successor.skillMatch,
          utilization: successor.utilization?.score || 0.5
        },
        strengths: [],
        development_areas: []
      }));
      
      console.log(`Generated ${viableSuccessors.length} potential successors based on department and skills`);
      
      // Find some non-viable alternatives from other departments
      let nonViableOptions = otherEmployees
        .filter(e => e.department !== department)
        .slice(0, 5)
        .map(successor => ({
          email: successor.email,
          name: `${successor.firstName || ''} ${successor.lastName || ''}`.trim(),
          score: 0.3,
          readinessLevel: 'non_viable',
          jobTitle: successor.jobTitle || 'Employee',
          factors: {
            skill_match: 0.2,
            utilization: successor.utilization?.score || 0.5
          },
          strengths: [],
          development_areas: [{
            factor: 'competency',
            score: 0.2,
            description: 'Limited skill overlap'
          }]
        }));
        
      console.log(`Finding non-viable alternatives from other departments`);
      console.log(`Found ${nonViableOptions.length} non-viable alternatives`);
      
      // Create the successor analysis object
      const successorAnalysis = {
        lastUpdated: new Date().toISOString(),
        top_successors: viableSuccessors,
        nonViableOptions: nonViableOptions,
        successorCandidates: [...viableSuccessors, ...nonViableOptions]
      };
      
      // Update the database with the new analysis
      await db.collection('merged_output').updateOne(
        { email },
        { $set: { successorAnalysis } }
      );
      
      console.log(`Sending successor analysis response`);
      return res.status(200).json({ successorAnalysis });
      
    } catch (pythonError) {
      console.error(`Error running Python script: ${pythonError}`);
      return res.status(500).json({ 
        error: "Error generating successor analysis using Python script",
        details: pythonError.message 
      });
    }
    
  } catch (error) {
    console.error(`Error fetching successor data: ${error}`);
    return res.status(500).json({ error: "Failed to fetch successor data" });
  } finally {
    console.log(`MongoDB connection closed`);
  }
} 