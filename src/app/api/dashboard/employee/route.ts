import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { verifyAuth } from '@/lib/auth';
import { connectToCompanyDb } from '@/lib/companyDb';

// Define interfaces for the data structures
interface WeeklyHours {
  weekStartDate: Date;
  hours: number;
  reportedTech?: string[];
}

interface EmployeeContribution {
  employeeId: string;
  userId?: string;
  role: string;
  isTeamLead: boolean;
  weeklyHours: WeeklyHours[];
}

interface Project {
  _id: any;
  title: string;
  status: string;
  endDate: Date;
  priority: string;
  department: string;
  employeeContributions: EmployeeContribution[];
}

export async function GET(request: NextRequest) {
  noStore();
  
  try {
    // Get token from cookies or authorization header
    const cookieToken = request.cookies.get('token')?.value;
    const headerToken = request.headers.get('authorization')?.split(' ')[1];
    const token = cookieToken || headerToken || '';
    
    if (!token) {
      return NextResponse.json({ error: 'No authentication token provided' }, { status: 401 });
    }
    
    // Verify authentication and get company code and user ID
    const authResult = await verifyAuth(token);
    if (!authResult) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    const { companyCode, id: userId, email } = authResult;
    if (!companyCode) {
      return NextResponse.json({ error: 'Company code not found' }, { status: 400 });
    }
    
    if (!userId && !email) {
      return NextResponse.json({ error: 'User identification not found' }, { status: 400 });
    }
    
    // Connect to the company-specific database
    const { client, companyDb } = await connectToCompanyDb(companyCode);
    
    try {
      // Find the employee record using userId or email
      const employeeQuery = email 
        ? { email: email }
        : { userId: userId };
        
      const employee = await companyDb.collection('employees').findOne(employeeQuery);
      
      if (!employee) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }
      
      const employeeId = employee._id.toString();
      
      // Fetch assigned projects for this employee
      const assignedProjects = await companyDb.collection('projects').find({
        'employeeContributions.employeeId': employeeId,
        status: { $in: ['planning', 'active'] }
      }).toArray() as Project[];
      
      // Calculate weekly hours from project contributions
      let weeklyHours = 0;
      const currentDate = new Date();
      const oneWeekAgo = new Date(currentDate);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Aggregate weekly hours from all projects
      for (const project of assignedProjects) {
        for (const contribution of project.employeeContributions) {
          if (contribution.employeeId === employeeId) {
            for (const weeklyHour of contribution.weeklyHours || []) {
              const weekStartDate = new Date(weeklyHour.weekStartDate);
              if (weekStartDate >= oneWeekAgo && weekStartDate <= currentDate) {
                weeklyHours += weeklyHour.hours;
              }
            }
          }
        }
      }
      
      // Get projects with upcoming deadlines (within next 14 days)
      const twoWeeksFromNow = new Date(currentDate);
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      
      const upcomingDeadlines = assignedProjects.filter(project => {
        const endDate = new Date(project.endDate);
        return endDate >= currentDate && endDate <= twoWeeksFromNow;
      }).length;
      
      // Get feedback counts
      const feedbackGiven = await companyDb.collection('feedback').countDocuments({
        evaluatorEmail: email,
        documentType: 'feedback'
      });
      
      const feedbackReceived = await companyDb.collection('feedback').countDocuments({
        evaluatedEmail: email,
        documentType: 'feedback'
      });
      
      // Return employee dashboard data
      return NextResponse.json({
        assignedProjects: assignedProjects.length,
        weeklyHours,
        upcomingDeadlines,
        feedbackGiven,
        feedbackReceived,
        projects: assignedProjects.map(project => ({
          id: project._id.toString(),
          title: project.title,
          status: project.status,
          endDate: project.endDate,
          priority: project.priority,
          department: project.department,
          weeklyHours: project.employeeContributions
            .find((c: EmployeeContribution) => c.employeeId === employeeId)?.weeklyHours
            .filter((wh: WeeklyHours) => {
              const weekStartDate = new Date(wh.weekStartDate);
              return weekStartDate >= oneWeekAgo && weekStartDate <= currentDate;
            })
            .reduce((total: number, wh: WeeklyHours) => total + wh.hours, 0) || 0
        })).sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()).slice(0, 5)
      });
    } finally {
      // Close the MongoDB connection
      await client.close();
    }
  } catch (error: any) {
    console.error('Error fetching employee dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee dashboard data', details: error.message },
      { status: 500 }
    );
  }
} 