import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/dbConnect';
import { getUserModel } from '@/models/User';
import { generateToken } from '@/lib/auth';

interface SessionData {
  session_id: string;
  company_code: string;
  email: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const companyCode = searchParams.get('company_code');
    const email = searchParams.get('email');

    if (!sessionId || !companyCode || !email) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Connect to the company's database via default connector
    console.log('Connecting to tenant DB for company:', companyCode);
    await connectDB(companyCode);

    // Instantiate the tenant-specific User model
    const TenantUser = getUserModel(companyCode);
    // Find the user in the company's database
    const user = await TenantUser.findOne({ email });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      email: user.email,
      companyCode: user.companyCode,
      role: user.role,
    });

    // Redirect back to signup page with company code and email
    const response = NextResponse.redirect(
      new URL(
        `/company-signup?company_code=${encodeURIComponent(companyCode)}&email=${encodeURIComponent(email)}`,
        req.url
      )
    );

    // Set the JWT as an HTTP-only cookie
    response.cookies.set({
      name: 'token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Error verifying session:', error);
    return NextResponse.json(
      { error: 'Failed to verify session' },
      { status: 500 }
    );
  }
}
