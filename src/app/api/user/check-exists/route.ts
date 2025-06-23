import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/dbConnect';
import { getUserModel } from '@/models/User';
import { verifyAuth } from '@/lib/auth';
import { unstable_noStore as noStore } from 'next/cache';

export async function GET(request: NextRequest) {
  noStore();
  await connectDB();
  
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    
    if (!token) {
      return NextResponse.json({ 
        error: 'Authentication required',
        exists: false
      }, { status: 401 });
    }
    
    const payload = await verifyAuth(token);
    
    if (!payload || !payload.id) {
      return NextResponse.json({ 
        error: 'Invalid authentication',
        exists: false
      }, { status: 401 });
    }
    
    // Extract company code from token
    const companyCode = payload.companyCode || payload.company_code;
    if (!companyCode) {
      return NextResponse.json({ 
        error: 'Company context required',
        exists: false
      }, { status: 403 });
    }
    
    // Get the email to check from the query params
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email')?.toLowerCase();
    
    if (!email) {
      return NextResponse.json({ 
        error: 'Email parameter is required',
        exists: false
      }, { status: 400 });
    }
    
    // Get the company-specific User model
    const UserModel = getUserModel(companyCode);
    
    // Look for the user in the company's database
    const user = await UserModel.findOne({
      $or: [
        { email: email },
        { email: { $regex: `^${email}$`, $options: 'i' } }
      ]
    });
    
    return NextResponse.json({
      exists: !!user
    });
    
  } catch (error: any) {
    console.error('Error checking if user exists:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to check if user exists',
      exists: false
    }, { status: 500 });
  }
} 