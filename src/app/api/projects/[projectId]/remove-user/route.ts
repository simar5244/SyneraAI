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
    
    // Get the project to check permissions
    const dbName = `company_${companyCode.toLowerCase()}`;
    const db = client.db(dbName);
    const projectsCol = db.collection(projectsCollection);
    
    try {
      const projectObjectId = new ObjectId(projectId);
      const project = await projectsCol.findOne({ _id: projectObjectId });
      
      if (!project) {
        return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
      }
      
      // Check if user has permission to remove members
      const isTopManagement = ['top_management_tier_1', 'top_management_tier_2', 'top_management_tier_3'].includes(userRole);
      
      // Get the email of the user to be removed to check if they are trying to remove themselves
      let userToRemoveEmail = userId; // Default to userId which might be an email
      
      // Try to find user email if userId is not an email
      if (!userId.includes('@')) {
        try {
          const usersCol = db.collection('users');
          const userToRemove = await usersCol.findOne({ _id: new ObjectId(userId) });
          if (userToRemove) {
            userToRemoveEmail = userToRemove.email;
          }
        } catch (error) {
          console.error('Error finding user to remove:', error);
        }
      }
      
      // Users can remove themselves or top management can remove anyone
      const isRemovingSelf = userEmail === userToRemoveEmail;
      
      // Only project creator or top management can remove other members
      const isCreator = project.creatorEmail === userEmail;
      
      if (!isTopManagement && !isRemovingSelf && !isCreator) {
        return NextResponse.json({ 
          success: false, 
          message: 'Access Denied - Only project creators, top management, or users removing themselves are allowed' 
        }, { status: 403 });
      }
      
      // Remove user from employees array - using TypeScript 'as any' cast to bypass type checking
      const result = await projectsCol.updateOne(
        { _id: projectObjectId },
        { 
          $pull: { 
            employees: {
              $or: [
                { userId: userId },
                { email: userToRemoveEmail }
              ]
            }
          } as any,
          $set: { updated_at: new Date() }
        }
      );
      
      // Consider it a success if the operation modified the document
      if (result.modifiedCount === 1) {
        return NextResponse.json({ 
          success: true, 
          message: 'User removed from project successfully' 
        });
      } else {
        // User might not be a member, but we'll return success anyway
        return NextResponse.json({ 
          success: true, 
          message: 'User not found in project members or already removed' 
        });
      }
    } catch (error) {
      console.error('Error processing projectId:', error);
      return NextResponse.json({ success: false, message: 'Invalid project ID format' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error removing user from project:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  } finally {
    await client.close();
  }
} 