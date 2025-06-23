import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection string from environment variable
const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DATABASE || 'org_sim_db';
const collectionName = 'merged_output';

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
    console.error('Authentication required for utilization data');
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  
  // Verify token and extract user information
  let payload;
  try {
    payload = await verifyAuth(token);
    if (!payload?.id) throw new Error('Invalid token payload');
  } catch (error) {
    console.error('Invalid authentication for utilization data:', error);
    return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
  }
  
  // Extract company code from payload
  const rawCompanyCode = (payload.companyCode || payload.company_code) as string;
  if (!rawCompanyCode) {
    console.error('Company context required for utilization data');
    return NextResponse.json({ error: 'Company context required' }, { status: 403 });
  }
  
  const companyCode = rawCompanyCode.toLowerCase();
  console.log(`Fetching utilization data for company: ${companyCode}`);
  
  let client;
  
  try {
    // Connect to MongoDB
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    console.log(`Fetching employee utilization data for company: ${companyCode}...`);
    
    // First try to query the company-specific database
    let employees: any[] = [];
    
    try {
      // Connect to the company-specific database
      const companyDb = client.db(`company_${companyCode}`);
      const usersCollection = companyDb.collection('users');
      
      console.log(`Querying company_${companyCode} database, users collection for utilization data...`);
      
      // Query for employees in the company-specific database
      employees = await usersCollection.find({}, {
        projection: {
          _id: 0,
          email: 1,
          projects: 1,
          utilizationMetrics: 1,
          utilizationAssessment: 1,
          workloadAssessment: 1,
          workload_intensity: 1,
          hoursPer_week: 1,
          utilization_score: 1,
          attritionAssessment: 1,
          reportsTo: 1,
          job_intensity_analysis: 1,
          successorAnalysis: 1,
          contributionHours: 1,
          totalWorkload: 1,
          workCapacity: 1,
          weeklyHours: 1,
          assigned_workload: 1,
          companyCode: 1,
          company_code: 1,
          company: 1,
          firstName: 1,
          lastName: 1,
          jobTitle: 1,
          department: 1
        }
      }).toArray();
      
      console.log(`Found ${employees.length} employees in company_${companyCode} database for utilization`);
    } catch (error) {
      console.warn(`Error querying company_${companyCode} database for utilization:`, error);
      console.log('Falling back to main database with company code filter for utilization...');
      
      // If company-specific database query fails, fall back to the main database with filtering
      const mainDb = client.db(dbName);
      const collection = mainDb.collection(collectionName);
      
      // Query for employees with utilization-related fields, filtered by company code
      employees = await collection.find(
        { 
          $or: [
            { companyCode: { $regex: `^${companyCode}$`, $options: 'i' } },
            { company_code: { $regex: `^${companyCode}$`, $options: 'i' } },
            { company: { $regex: `^${companyCode}$`, $options: 'i' } }
          ]
        }, 
        {
          projection: {
            _id: 0,
            email: 1,
            projects: 1,
            utilizationMetrics: 1,
            utilizationAssessment: 1,
            workloadAssessment: 1,
            workload_intensity: 1,
            hoursPer_week: 1,
            utilization_score: 1,
            attritionAssessment: 1,
            reportsTo: 1,
            job_intensity_analysis: 1,
            successorAnalysis: 1,
            contributionHours: 1,
            totalWorkload: 1,
            workCapacity: 1,
            weeklyHours: 1,
            assigned_workload: 1,
            companyCode: 1,
            company_code: 1,
            company: 1
          }
        }
      ).toArray();
    }
    
    console.log(`Found ${employees.length} employees in the database`);
    
    // If we have at least one employee, log some details to help debugging
    if (employees.length > 0) {
      console.log('Sample employee utilization data:', {
        email: employees[0].email,
        utilization_score: employees[0].utilization_score,
        hasUtilizationAssessment: !!employees[0].utilizationAssessment,
        utilizationAssessmentScore: employees[0].utilizationAssessment?.utilization_score,
        attritionRisk: employees[0].attritionAssessment?.attrition_risk
      });
    }
    
    // Calculate the team utilization for each manager
    const teamUtilization: Record<string, any> = {};
    
    // First pass - calculate individual utilization
    const employeeUtilization: Record<string, any> = {};
    
    employees.forEach(employee => {
      // Get utilization metrics from various possible sources
      let utilizationScore = 0;
      let workloadSources = [];
      let hoursPerWeek = 0;
      
      // Check for hours per week
      if (employee.hoursPer_week) {
        hoursPerWeek = typeof employee.hoursPer_week === 'number' ? 
          employee.hoursPer_week : 
          parseFloat(employee.hoursPer_week) || 0;
      }
      
      if (employee.weeklyHours) {
        hoursPerWeek = Math.max(hoursPerWeek, (typeof employee.weeklyHours === 'number' ? 
          employee.weeklyHours : 
          parseFloat(employee.weeklyHours) || 0));
      }
      
      // Check for utilization_score directly
      if (typeof employee.utilization_score === 'number') {
        utilizationScore = employee.utilization_score;
        workloadSources.push({ source: "utilization_score", score: employee.utilization_score });
      }
      
      // Check for utilization assessment (from the JSON structure)
      if (employee.utilizationAssessment) {
        if (employee.utilizationAssessment.utilization_score) {
          const assessmentScore = typeof employee.utilizationAssessment.utilization_score === 'number' ? 
            employee.utilizationAssessment.utilization_score : 
            parseFloat(employee.utilizationAssessment.utilization_score) || 0;
            
          workloadSources.push({ 
            source: "utilizationAssessment", 
            score: assessmentScore 
          });
          
          utilizationScore = Math.max(utilizationScore, assessmentScore);
        }
      }
      
      // Add projects workload
      if (employee.projects && employee.projects.length > 0) {
        let projectHours = 0;
        employee.projects.forEach((project: any) => {
          if (project.user_contribution && project.user_contribution.hours_per_week) {
            projectHours += project.user_contribution.hours_per_week;
          }
        });
        if (projectHours > 0) {
          workloadSources.push({ source: "projects", hours: projectHours });
          utilizationScore = Math.max(utilizationScore, projectHours / 40); // Normalize to 40 hour work week
          hoursPerWeek = Math.max(hoursPerWeek, projectHours);
        }
      }
      
      // Add contribution hours if available
      if (employee.contributionHours && employee.contributionHours > 0) {
        workloadSources.push({ source: "contributionHours", hours: employee.contributionHours });
        utilizationScore = Math.max(utilizationScore, employee.contributionHours / 40);
        hoursPerWeek = Math.max(hoursPerWeek, employee.contributionHours);
      }
      
      // Add assigned workload if available
      if (employee.assigned_workload && employee.assigned_workload > 0) {
        workloadSources.push({ source: "assigned_workload", workload: employee.assigned_workload });
        // Convert to utilization score if workCapacity is available
        if (employee.workCapacity && employee.workCapacity > 0) {
          const assignedScore = employee.assigned_workload / employee.workCapacity;
          utilizationScore = Math.max(utilizationScore, assignedScore);
        }
      }
      
      // Add totalWorkload if available
      if (employee.totalWorkload && employee.totalWorkload > 0) {
        workloadSources.push({ source: "totalWorkload", workload: employee.totalWorkload });
        // Convert to utilization score if workCapacity is available
        if (employee.workCapacity && employee.workCapacity > 0) {
          const totalScore = employee.totalWorkload / employee.workCapacity;
          utilizationScore = Math.max(utilizationScore, totalScore);
        }
      }
      
      // Add workload assessment if available (from employee_utilization_analyzer.py)
      if (employee.workloadAssessment) {
        if (employee.workloadAssessment.utilization_score) {
          workloadSources.push({ 
            source: "workloadAssessment", 
            score: employee.workloadAssessment.utilization_score,
            assessment: employee.workloadAssessment.assessment || null
          });
          utilizationScore = Math.max(utilizationScore, employee.workloadAssessment.utilization_score);
        }
      }
      
      // Add utilization metrics if available
      if (employee.utilizationMetrics) {
        workloadSources.push({ source: "utilizationMetrics", metrics: employee.utilizationMetrics });
        
        if (employee.utilizationMetrics.score) {
          utilizationScore = Math.max(utilizationScore, employee.utilizationMetrics.score);
        }
      }
      
      // Add intensity if available
      if (employee.workload_intensity) {
        const intensity = typeof employee.workload_intensity === 'number' ? 
          employee.workload_intensity : 
          (parseFloat(employee.workload_intensity) || 0);
        
        workloadSources.push({ source: "workload_intensity", intensity });
        utilizationScore = Math.max(utilizationScore, intensity);
      }
      
      // If we still don't have a utilization score but have hours per week, calculate it
      if (utilizationScore === 0 && hoursPerWeek > 0) {
        utilizationScore = hoursPerWeek / 40; // Normalize to 40 hour work week
      }
      
      // Ensure the score is in range 0-1.5 (where >1.0 means overutilized)
      utilizationScore = Math.min(Math.max(0, utilizationScore), 1.5);
      
      // Store the calculated utilization
      employeeUtilization[employee.email] = {
        score: utilizationScore,
        category: getUtilizationCategory(utilizationScore),
        sources: workloadSources,
        hoursPerWeek: hoursPerWeek,
        attritionRisk: employee.attritionAssessment?.attrition_risk || 'unknown'
      };
    });
    
    // Second pass - calculate team utilization for each manager
    employees.forEach(employee => {
      if (employee.reportsTo && employee.reportsTo.email) {
        const managerEmail = employee.reportsTo.email;
        if (!teamUtilization[managerEmail]) {
          teamUtilization[managerEmail] = {
            teamSize: 0,
            totalUtilization: 0,
            averageUtilization: 0,
            overutilizedCount: 0,
            underutilizedCount: 0
          };
        }
        
        const util = teamUtilization[managerEmail];
        const employeeUtil = employeeUtilization[employee.email] || { score: 0.5 };
        
        util.teamSize++;
        util.totalUtilization += employeeUtil.score;
        
        if (employeeUtil.score > 1.0) {
          util.overutilizedCount++;
        } else if (employeeUtil.score < 0.6) {
          util.underutilizedCount++;
        }
        
        util.averageUtilization = util.totalUtilization / util.teamSize;
      }
    });
    
    // Combine individual and team utilization into a single response
    const utilizationData = {
      employees: employeeUtilization,
      teams: teamUtilization,
      timestamp: new Date().toISOString()
    };
    
    console.log(`Successfully calculated utilization for ${Object.keys(employeeUtilization).length} employees`);
    return NextResponse.json(utilizationData);
  } catch (error: any) {
    console.error('Error fetching utilization data:', error);
    return NextResponse.json({ error: 'Failed to fetch utilization data' }, { status: 500 });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Helper function to categorize utilization levels
function getUtilizationCategory(score: number): string {
  if (score > 1.2) return "critical"; // Severely overutilized
  if (score > 1.0) return "high";     // Overutilized
  if (score > 0.8) return "optimal";  // Well utilized
  if (score > 0.6) return "moderate"; // Moderately utilized
  if (score > 0.3) return "low";      // Underutilized
  return "minimal";                   // Very underutilized
} 