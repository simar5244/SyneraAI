import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: "Email parameter is required" }, { status: 400 });
  }

  console.log(`Connecting to MongoDB to fetch successor data for ${email}...`);
  const { client } = await connectToDatabase();
  const adminDb = client.db();
  
  try {
    // Search user in each company_<code>.users collection
    const { databases } = await adminDb.admin().listDatabases();
    let employee: any = null;
    let companyDbName = '';
    
    for (const dbInfo of databases) {
      if (dbInfo.name.startsWith('company_')) {
        const user = await client.db(dbInfo.name).collection('users').findOne({ email });
        if (user) {
          employee = user;
          companyDbName = dbInfo.name;
          console.log(`Found employee in ${dbInfo.name}.users`);
          break;
        }
      }
    }
    
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    
    const db = client.db(companyDbName);
    console.log(`Found employee: ${employee.firstName} ${employee.lastName} (${employee.email})`);
    
    // Check if a successorAnalysis already exists in the database
    if (employee.successorAnalysis) {
      console.log(`Successor analysis exists: ${JSON.stringify(employee.successorAnalysis).substring(0, 100)}...`);
      // Return existing analysis
      return NextResponse.json({ 
        successorAnalysis: employee.successorAnalysis 
      });
    }
    
    // Check if successorCandidates field exists (new field added)
    if (employee.successorCandidates && Array.isArray(employee.successorCandidates) && employee.successorCandidates.length > 0) {
      console.log(`Found successorCandidates field with ${employee.successorCandidates.length} candidates`);
      
      // Create a successor analysis from the successorCandidates data
      const viableSuccessors = employee.successorCandidates
        .filter((candidate: any) => candidate.score >= 0.4)
        .map((candidate: any) => ({
          email: candidate.email,
          name: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email,
          score: candidate.score || 0.6,
          readinessLevel: candidate.readinessLevel || (candidate.score >= 0.7 ? 'High' : candidate.score >= 0.4 ? 'Medium' : 'Low'),
          jobTitle: candidate.jobTitle || candidate.title || 'Employee',
          factors: candidate.factors || {
            skill_match: candidate.skillMatch || 0.6,
            utilization: candidate.utilization?.score || 0.5
          },
          strengths: candidate.strengths || [],
          development_areas: candidate.development_areas || []
        }));
      
      const nonViableSuccessors = employee.successorCandidates
        .filter((candidate: any) => candidate.score < 0.4)
        .map((candidate: any) => ({
          email: candidate.email,
          name: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email,
          score: candidate.score || 0.3,
          readinessLevel: 'non_viable',
          jobTitle: candidate.jobTitle || candidate.title || 'Employee',
          factors: candidate.factors || {
            skill_match: candidate.skillMatch || 0.3,
            utilization: candidate.utilization?.score || 0.5
          },
          strengths: candidate.strengths || [],
          development_areas: candidate.development_areas || [{
            factor: 'competency',
            score: 0.3,
            description: 'Limited skill match'
          }]
        }));
      
      const successorAnalysis = {
        lastUpdated: new Date().toISOString(),
        top_successors: viableSuccessors,
        nonViableOptions: nonViableSuccessors,
        successorCandidates: [...viableSuccessors, ...nonViableSuccessors]
      };
      
      // Update the database with the new analysis in the users collection
      await db.collection('users').updateOne(
        { email },
        { $set: { successorAnalysis } }
      );
      
      console.log(`Created successor analysis from successorCandidates field`);
      return NextResponse.json({ successorAnalysis });
    }
    
    // If no existing analysis, try to find potential successors based on department
    console.log(`No existing successor analysis found, looking for potential successors...`);
    
    // Get the employee's department and skills
    const department = employee.department;
    const skills = employee.skills || [];
    
    console.log(`Looking for successors in department: ${department}`);
    
    // Find other employees in the same company
    const otherEmployees = await db.collection('users').find({ 
      email: { $ne: email },
      status: { $ne: 'inactive' } // Only active employees
    }).toArray();
    
    console.log(`Found ${otherEmployees.length} other employees to consider for succession`);
    
    // Filter employees by department if available
    let potentialSuccessors = department 
      ? otherEmployees.filter((e: any) => e.department === department)
      : otherEmployees;
      
    console.log(`Found ${potentialSuccessors.length} employees in the same department: ${department}`);
    
    // If no department match, use all employees
    if (potentialSuccessors.length === 0) {
      console.log('No department match, considering all employees');
      potentialSuccessors = otherEmployees;
    }
    
    // Rank successors by skill match
    console.log(`Ranking successors by skill match`);
    console.log(`Employee skills: ${Array.isArray(skills) ? skills.join(', ') : skills}`);
    
    potentialSuccessors = potentialSuccessors.map(successor => {
      const successorSkills = successor.skills || [];
      
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
    const nonViableOptions = otherEmployees
      .filter((e: any) => e.department !== department)
      .slice(0, 5)
      .map((successor: any) => {
        const successorSkills = successor.skills || [];
        let skillMatch = 0;
        
        // Calculate skill overlap
        if (Array.isArray(skills) && Array.isArray(successorSkills) && skills.length > 0 && successorSkills.length > 0) {
          const commonSkills = skills.filter(skill => 
            successorSkills.some((s: string) => 
              typeof s === 'string' && typeof skill === 'string' && 
              s.toLowerCase().includes(skill.toLowerCase())
            )
          );
          skillMatch = commonSkills.length / skills.length;
        }
        
        return {
          email: successor.email,
          name: `${successor.firstName || ''} ${successor.lastName || ''}`.trim() || successor.email,
          score: skillMatch,
          readinessLevel: skillMatch > 0.7 ? 'High' : skillMatch > 0.4 ? 'Medium' : 'Low',
          jobTitle: successor.jobTitle || 'Employee',
          factors: {
            skill_match: skillMatch,
            utilization: successor.utilization?.score || 0.5
          },
          strengths: [],
          development_areas: []
        };
      });
    
    console.log(`Found ${nonViableOptions.length} non-viable options from other departments`);
    
    // Combine viable and non-viable options
    const successorAnalysis = {
      viableSuccessors,
      nonViableSuccessors: nonViableOptions,
      lastUpdated: new Date().toISOString()
    };
    
    // Update the database with the new analysis in the users collection
    await db.collection('users').updateOne(
      { email },
      { $set: { successorAnalysis } }
    );
    
    return NextResponse.json({ successorAnalysis });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Error in successor analysis: ${errorMessage}`);
    return NextResponse.json({ 
      error: "Failed to generate successor analysis",
      details: errorMessage 
    }, { status: 500 });
  } finally {
    console.log(`MongoDB connection closed`);
  }
} 