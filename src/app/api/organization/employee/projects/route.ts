import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: "Email parameter is required" }, { status: 400 });
  }

  try {
    console.log(`Connecting to MongoDB to fetch projects for ${email}...`);
    const { client } = await connectToDatabase();
    const adminDb = client.db();
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
    const companyDb = client.db(companyDbName);
      // Use companyDb as default db for further operations
      const db = companyDb;
    
    console.log(`Found employee: ${employee.firstName} ${employee.lastName}`);
    // Initialize projects array
    let projects: any[] = [];
    // Fetch from company-specific projects collection using employeeContributions only
    const rawCompanyCode = employee.companyCode || employee.company_code || employee.company;
    if (rawCompanyCode) {
      const companyCode = rawCompanyCode.toLowerCase();
      console.log(`Connecting to company_${companyCode}.projects collection`);
      const companyDb = client.db(`company_${companyCode}`);
      const companyProjectsRaw = await companyDb.collection('projects').find({}).toArray();
      if (companyProjectsRaw.length > 0) {
        console.log('Sample project schema:', JSON.stringify(companyProjectsRaw[0], null, 2));
      }
      const username = email.split('@')[0];
      const memberProjects = companyProjectsRaw.filter((project: any) =>
        Array.isArray(project.employeeContributions) &&
        project.employeeContributions.some((ec: any) => ec.employee_id === username)
      );
      console.log(`Filtered ${memberProjects.length} projects for username ${username}`);
      if (memberProjects.length > 0) {
        projects = memberProjects.map((project: any) => {
          const ec = project.employeeContributions.find((ec: any) => ec.employee_id === username);
          return {
            project_id: project._id.toString(),
            project_title: project.name || project.title || project.project_title || 'Unnamed Project',
            project_description: project.description || project.project_description || '',
            project_status: project.status || project.project_status || 'Active',
            hours_per_week: ec?.hours_per_week || ec?.hours || null,
          };
        });
      }
    }
    
    // Get projects from the employee data if available
    
    // Check different possible project structures
    if (Array.isArray(employee.projects)) {
      projects = employee.projects;
      console.log(`Found ${projects.length} projects in employee.projects array`);
    } else if (Array.isArray(employee.project_contributions)) {
      projects = employee.project_contributions;
      console.log(`Found ${projects.length} projects in employee.project_contributions array`);
    }
    
    // Check project3_collaborations collection for projects by email match
    console.log(`Checking project3_collaborations collection for projects by email match...`);
    
    // Check if the project3_collaborations collection exists
    const hasProjectCollabs = await db.listCollections({ name: 'project3_collaborations' }).toArray();
    
    if (hasProjectCollabs.length > 0) {
      const projectCollabs = await db.collection('project3_collaborations').find({
        "collaborators.email": email
      }).toArray();
      
      console.log(`Found ${projectCollabs.length} projects in project3_collaborations where email matches`);
      
      if (projectCollabs.length > 0) {
        const projectsFromCollabs = projectCollabs.map((project: any) => {
          // Find the specific collaboration data for this employee
          const userCollaboration = project.collaborators.find((c: any) => 
            c.email === email
          );
          
          return {
            project_id: project._id.toString(),
            project_title: project.name || project.title || 'Unnamed Project',
            project_description: project.description || '',
            project_status: project.status || 'Active',
            hours_per_week: userCollaboration?.hours_per_week || userCollaboration?.hours || null,
            user_contribution: userCollaboration || null
          };
        });
        
        // Add projects from collaborations to the projects array
        projects = [...projects, ...projectsFromCollabs];
        console.log(`Added ${projectsFromCollabs.length} projects from collaborations`);
      }
    }
    
    // If still no projects found, try to find from projects collection
    if (projects.length === 0) {
      console.log(`No projects found, checking projects collection...`);
      
      // Check if projects collection exists
      const collections = await db.listCollections({ name: 'projects' }).toArray();
      
      if (collections.length > 0) {
        // Find all projects where this employee is a contributor
        const projectsFromCollection = await db.collection('projects')
          .find({ 
            $or: [
              { "contributors.email": email },
              { "contributors": { $elemMatch: { email: email } } },
              { "employee_contributions.email": email }
            ]
          })
          .toArray();
        
        console.log(`Found ${projectsFromCollection.length} projects in projects collection`);
        
        if (projectsFromCollection.length > 0) {
          projects = projectsFromCollection.map((project: any) => ({
            project_id: project._id.toString(),
            project_title: project.name || project.project_title || 'Unnamed Project',
            project_description: project.description || project.project_description || '',
            project_status: project.status || project.project_status || 'Active',
            // Extract contribution details if available
            user_contribution: project.contributors?.find((c: any) => 
              c.email === email || c.employee_email === email
            ) || null
          }));
        }
      }
    }
    
    // Format projects to ensure consistent structure
    const formattedProjects = projects.map((project: any) => {
      return {
        project_id: project.project_id || project.id || project._id?.toString() || '',
        project_title: project.project_title || project.title || project.name || 'Unnamed Project',
        project_description: project.project_description || project.description || '',
        project_status: project.project_status || project.status || 'Active',
        hours_per_week: project.hours_per_week || project.user_contribution?.hours_per_week || null
      };
    });
    
    console.log(`Returning ${formattedProjects.length} formatted projects`);
    
    return NextResponse.json({ 
      projects: formattedProjects 
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 