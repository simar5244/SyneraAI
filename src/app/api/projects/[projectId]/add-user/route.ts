import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { verifyAuth } from '@/lib/auth';

// MongoDB connection string
const uri = process.env.MONGODB_URI || '';
const projectsCollection = 'projects';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const { projectId } = params;
    const requestData = await request.json();
    const { userId } = requestData;
    
    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
    }
    
    if (!projectId) {
      return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
    }
    
    // Get token from request headers
    const authHeader = request.headers.get('authorization');
    let userEmail = '';
    let companyCode = '';
    let userRole = '';
    
    // Get user data from token if available
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = await verifyAuth(token);
      if (payload) {
        userEmail = payload.email || '';
        companyCode = payload.companyCode || '';
        userRole = payload.role || '';
        console.log(`User authenticated via token: ${payload.email}, Company: ${companyCode}, Role: ${userRole}`);
      }
    }
    
    // If no company code from token, try to get from URL
    if (!companyCode) {
      const url = new URL(request.url);
      companyCode = url.searchParams.get('companyCode') || '';
    }
    
    if (!companyCode) {
      return NextResponse.json({ success: false, message: 'Company code is required' }, { status: 400 });
    }
    
    // First, get the project to check permissions
    const dbName = `company_${companyCode.toLowerCase()}`;
    const db = client.db(dbName);
    const projectsCol = db.collection(projectsCollection);
    
    try {
      const projectObjectId = new ObjectId(projectId);
      const project = await projectsCol.findOne({ _id: projectObjectId });
      
      if (!project) {
        return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
      }
      
      // Check if user has permission to add members
      const isTopManagement = ['top_management_tier_1', 'top_management_tier_2', 'top_management_tier_3'].includes(userRole);
      
      // Only users who are already members or top management can add others
      const isMember = Array.isArray(project.employees) && project.employees.some((e: any) => 
        e.email === userEmail
      );
      
      if (!isTopManagement && !isMember) {
        return NextResponse.json({ 
          success: false, 
          message: 'Access Denied - Only project members or top management can add users' 
        }, { status: 403 });
      }
      
      // Now get the user to be added
      const usersCol = db.collection('users');
      let userToAdd = await usersCol.findOne({ _id: new ObjectId(userId) });
      
      // If user not found by ID, try by email
      if (!userToAdd) {
        userToAdd = await usersCol.findOne({ email: userId });
      }
      
      if (!userToAdd) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }
      
      // Make sure the user being added belongs to the same company (company isolation)
      if (userToAdd.companyCode && userToAdd.companyCode.toLowerCase() !== companyCode.toLowerCase()) {
        return NextResponse.json({ 
          success: false, 
          message: 'Cannot add users from different companies' 
        }, { status: 403 });
      }
      
      // Check if user is already a member
      const isUserAlreadyMember = Array.isArray(project.employees) && project.employees.some((e: any) => 
        (e.email && e.email === userToAdd.email) || 
        (e.userId && e.userId.toString() === userId) ||
        (e.id && e.id.toString() === userId)
      );
      
      if (isUserAlreadyMember) {
        return NextResponse.json({ success: false, message: 'User is already a member of this project' }, { status: 409 });
      }
      
      // Prepare user data to add to project
      const userToAddInfo = {
        userId: userToAdd._id.toString(),
        name: userToAdd.firstName && userToAdd.lastName 
          ? `${userToAdd.firstName} ${userToAdd.lastName}` 
          : userToAdd.username || userToAdd.email,
        email: userToAdd.email,
        role: 'Member',
        department: userToAdd.department || 'General',
        addedAt: new Date()
      };
      
      // Update the project
      const result = await projectsCol.updateOne(
        { _id: projectObjectId },
        { 
          $addToSet: { employees: userToAddInfo },
          $set: { updated_at: new Date() }
        }
      );
      
      if (result.modifiedCount === 1) {
        return NextResponse.json({ 
          success: true, 
          message: 'User added to project successfully' 
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          message: 'Failed to add user to project' 
        }, { status: 500 });
      }
    } catch (error) {
      console.error('Error processing projectId:', error);
      return NextResponse.json({ success: false, message: 'Invalid project ID format' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error adding user to project:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  } finally {
    await client.close();
  }
} 