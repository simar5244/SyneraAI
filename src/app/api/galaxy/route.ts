import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { verifyAuth } from '@/lib/edgeAuth';
import { unstable_noStore as noStore } from 'next/cache';

// Get MongoDB connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const MAIN_DB_NAME = process.env.MONGODB_DB_NAME || "org_sim_db";

export async function GET(request: NextRequest) {
  noStore();
  
  // Get authentication token from authorization header or cookie
  let token = request.headers.get('authorization')?.split(' ')[1];
  
  // If no token in authorization header, check cookies
  if (!token) {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      
      token = cookies['token'];
    }
  }
  
  if (!token) {
    console.error('Authentication required for galaxy data');
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  
  // Verify token and extract user information
  let payload;
  try {
    payload = await verifyAuth(token);
    if (!payload?.id) throw new Error('Invalid token payload');
  } catch (error) {
    console.error('Invalid authentication for galaxy data:', error);
    return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
  }
  
  // Extract company code from payload
  const rawCompanyCode = (payload.companyCode || payload.company_code) as string;
  if (!rawCompanyCode) {
    console.error('Company context required for galaxy data');
    return NextResponse.json({ error: 'Company context required' }, { status: 403 });
  }
  
  const companyCode = rawCompanyCode.toLowerCase();
  console.log(`Fetching galaxy data for company: ${companyCode}`);
  
  try {
    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    // First try to query the company-specific database
    let employees: any[] = [];
    
    try {
      // Connect to the company-specific database
      const companyDb = client.db(`company_${companyCode}`);
      const usersCollection = companyDb.collection('users');
      
      console.log(`Querying company_${companyCode} database, users collection for galaxy data...`);
      
      // Query for employees in the company-specific database
      employees = await usersCollection.find({
        // Filter out superadmins
        role: { $ne: "superadmin" }
      }).toArray();
      
      console.log(`Found ${employees.length} employees in company_${companyCode} database for galaxy view`);
    } catch (error) {
      console.warn(`Error querying company_${companyCode} database for galaxy view:`, error);
      console.log('Falling back to main database with company code filter...');
      
      // If company-specific database query fails, fall back to the main database with filtering
      const mainDb = client.db(MAIN_DB_NAME);
      const collection = mainDb.collection('merged_output');
      
      // Query for employees with the needed fields, filtered by company code
      employees = await collection.find(
        { 
          $or: [
            { companyCode: { $regex: `^${companyCode}$`, $options: 'i' } },
            { company_code: { $regex: `^${companyCode}$`, $options: 'i' } },
            { company: { $regex: `^${companyCode}$`, $options: 'i' } }
          ],
          // Filter out superadmins
          role: { $ne: "superadmin" }
        }
      ).toArray();
      
      console.log(`Found ${employees.length} employees in main database for company: ${companyCode}`);
      // Debug: log raw employee documents to inspect field names
      console.log("Galaxy API: raw employees:", JSON.stringify(employees, null, 2));
    }
    
    // Define types for nodes and links
    type GalaxyNode = {
      id: string;
      name: string;
      department: string;
      role: string;
      jobTitle: string;
      internalRole: string;
      email: string;
      avatar: string | null;
      userData: Record<string, any>;
    };
    
    type GalaxyLink = {
      source: string;
      target: string;
      type: string;
      value: number;
      relationship?: string;
      managerEmail?: string;
      employeeEmail?: string;
      project?: {
        title: string;
        id: string;
        description: string;
        department: string;
        status: string;
        priority: string;
        startDate: string;
        endDate: string;
        budget: number;
        techStack: string[];
        totalHours: number;
        userContribution: Record<string, any>;
      };
    };
    
    // Structure for the graph data
    const nodes: GalaxyNode[] = [];
    const links: GalaxyLink[] = [];
    
    // Process employees into nodes
    employees.forEach(employee => {
      console.log("Galaxy API: employee", employee.email, "reportsTo", JSON.stringify(employee.reportsTo), "projects count", Array.isArray(employee.projects) ? employee.projects.length : 0);
      // Skip if no valid email
      if (!employee.email) return;
      
      // Create node for employee
      nodes.push({
        id: employee.email,
        name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        department: employee.department || 'Unknown',
        role: employee.role || 'Employee',
        jobTitle: employee.jobTitle || employee.job_title || employee.title || 'Employee',
        internalRole: employee.internalRole || 'employee3',  // Default to lowest tier
        email: employee.email,
        avatar: employee.avatar || null,
        userData: {
          ...employee,
          // Include only the necessary fields for display
          company: employee.company,
          jobTitle: employee.jobTitle || employee.job_title || employee.title,
          reportsTo: employee.reportsTo,
          utilizationScore: employee.utilizationScore,
          utilization_score: employee.utilization_score,  // Add the alternative field name
          attritionScore: employee.attritionScore,
          attritionassesment: employee.attritionassesment, // Include the nested assessment object
        }
      });
      
      // Process reporting relationships (handle object|string)
      // Combine possible manager fields
      const reportsToVal = employee.reportsTo ?? employee.reports_to ?? employee.managerEmail ?? employee.manager_email;
      let managerEmail: string | undefined;
      if (reportsToVal) {
        if (typeof reportsToVal === 'object' && 'email' in reportsToVal) {
          managerEmail = reportsToVal.email;
        } else if (typeof reportsToVal === 'string') {
          if (reportsToVal.includes('@')) {
            managerEmail = reportsToVal;
          } else {
            const mgr = employees.find(e => e.username === reportsToVal || e.email.split('@')[0] === reportsToVal);
            managerEmail = mgr?.email;
          }
        }
      }
      if (managerEmail) {
        console.log("Galaxy API: pushing reporting link for", employee.email, "->", managerEmail);
        links.push({
          source: employee.email,
          target: managerEmail,
          type: 'reporting',
          value: 1,
          relationship: 'reporting',
          managerEmail,
          employeeEmail: employee.email
        });
      }
      
      // Process project collaborations (handle alt project fields)
      const employeeProjects = Array.isArray(employee.projects) ? employee.projects
        : Array.isArray(employee.project_assignments) ? employee.project_assignments
        : Array.isArray(employee.assignedProjects) ? employee.assignedProjects
        : [];
      console.log("Galaxy API: projects to process for", employee.email, employeeProjects.length);
      employeeProjects.forEach((project: any) => {
        if (Array.isArray(project.collaborators)) {
          project.collaborators.forEach((collaborator: any) => {
            if (collaborator.email && collaborator.email !== employee.email) {
              links.push({
                source: employee.email,
                target: collaborator.email,
                type: 'collaboration',
                value: 0.5,
                project: {
                  title: project.project_title || 'Unknown Project',
                  id: project.project_id || '',
                  description: project.project_description || '',
                  department: project.project_department || '',
                  status: project.project_status || '',
                  priority: project.project_priority || '',
                  startDate: project.project_start_date || '',
                  endDate: project.project_end_date || '',
                  budget: project.budget || 0,
                  techStack: project.tech_stack || [],
                  totalHours: project.total_hours || 0,
                  userContribution: project.user_contribution || {}
                }
              });
            }
          });
        }
      });
    });
    
    // Close the MongoDB connection
    await client.close();
    
    // Debug: log final graph data being returned
    console.log('Galaxy API: returning graph data', { nodesCount: nodes.length, linksCount: links.length, links });
    // Return the graph data
    return NextResponse.json({ nodes, links });
  } catch (error) {
    console.error('Error fetching galaxy data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch galaxy data' },
      { status: 500 }
    );
  }
} 