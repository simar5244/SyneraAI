import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { verifyAuth } from '@/lib/auth';
import { connectToCompanyDb } from '@/lib/companyDb';

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
    
    // Verify authentication and get company code
    const authResult = await verifyAuth(token);
    if (!authResult) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    const { companyCode } = authResult;
    if (!companyCode) {
      return NextResponse.json({ error: 'Company code not found' }, { status: 400 });
    }
    
    // Connect to the company-specific database
    const { client, companyDb } = await connectToCompanyDb(companyCode);
    
    try {
      // Fetch total employees
      const totalEmployees = await companyDb.collection('employees').countDocuments({ status: 'active' });
      
      // Fetch active projects
      const activeProjects = await companyDb.collection('projects').countDocuments({ status: { $in: ['planning', 'active'] } });
      
      // Fetch overworked employees (>45 hours/week)
      const overworkedEmployees = await companyDb.collection('projects').aggregate([
        { $unwind: '$employeeContributions' },
        { $unwind: '$employeeContributions.weeklyHours' },
        { 
          $group: {
            _id: '$employeeContributions.employeeId',
            totalHours: { $sum: '$employeeContributions.weeklyHours.hours' }
          }
        },
        { $match: { totalHours: { $gt: 45 } } },
        { $count: 'count' }
      ]).toArray();
      
      // Fetch underutilized employees (<20 hours/week)
      const underutilizedEmployees = await companyDb.collection('projects').aggregate([
        { $unwind: '$employeeContributions' },
        { $unwind: '$employeeContributions.weeklyHours' },
        { 
          $group: {
            _id: '$employeeContributions.employeeId',
            totalHours: { $sum: '$employeeContributions.weeklyHours.hours' }
          }
        },
        { $match: { totalHours: { $lt: 20 } } },
        { $count: 'count' }
      ]).toArray();
      
      // Fetch critical roles (employees with specialized skills or high impact)
      const criticalRoles = await companyDb.collection('employees').countDocuments({
        $or: [
          { seniorityLevel: 'Lead' },
          { orgLevel: 'Executive' }
        ]
      });
      
      // Calculate average utilization
      const utilizationData = await companyDb.collection('projects').aggregate([
        { $unwind: '$employeeContributions' },
        { $unwind: '$employeeContributions.weeklyHours' },
        { 
          $group: {
            _id: '$employeeContributions.employeeId',
            totalHours: { $sum: '$employeeContributions.weeklyHours.hours' },
            count: { $sum: 1 }
          }
        },
        { 
          $group: {
            _id: null,
            totalUtilization: { $sum: { $divide: ['$totalHours', '$count'] } },
            employeeCount: { $sum: 1 }
          }
        }
      ]).toArray();
      
      // Calculate average utilization percentage (assuming 40 hours is 100%)
      const avgUtilization = utilizationData.length > 0 
        ? Math.round((utilizationData[0].totalUtilization / utilizationData[0].employeeCount / 40) * 100)
        : 0;
      
      // Fetch feedback counts
      const feedbackGiven = await companyDb.collection('feedback').countDocuments({
        documentType: 'feedback'
      });
      
      const feedbackReceived = await companyDb.collection('feedback').countDocuments({
        documentType: 'feedback'
      });
      
      // Fetch active ERP integrations
      const activeIntegrations = await companyDb.collection('integrations').countDocuments({
        status: 'active'
      });
      
      // Fetch report count
      const reportCount = await companyDb.collection('reports').countDocuments();
      
      // Return dashboard data
      return NextResponse.json({
        totalEmployees,
        activeProjects,
        overworkedEmployees: overworkedEmployees.length > 0 ? overworkedEmployees[0].count : 0,
        underutilizedEmployees: underutilizedEmployees.length > 0 ? underutilizedEmployees[0].count : 0,
        criticalRoles,
        avgUtilization,
        feedback: {
          given: feedbackGiven,
          received: feedbackReceived
        },
        integrations: {
          active: activeIntegrations
        },
        reports: {
          count: reportCount
        }
      });
    } finally {
      // Close the MongoDB connection
      await client.close();
    }
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error.message },
      { status: 500 }
    );
  }
} 