import { NextRequest, NextResponse } from 'next/server';
import { createAndSendMfaCode } from '@/lib/mfa';
import { getAuthUserModel } from '@/models/AuthUser';
import connectDB from '@/lib/dbConnect';

export async function POST(request: NextRequest) {
  try {
    const { email, username, userId } = await request.json();

    if (!email || !username || !userId) {
      return NextResponse.json(
        { success: false, message: 'Email, username and userId are required' },
        { status: 400 }
      );
    }

    console.log(`[RESEND] Resending verification code to ${email}`);

    // Verify the user exists in the auth database
    try {
      await connectDB('org_sim_db');
      const AuthUserModel = await getAuthUserModel();
      const user = await AuthUserModel.findOne({ 
        $or: [
          { userId },
          { email }
        ]
      });

      if (!user) {
        console.log(`[RESEND] User not found with email ${email} or userId ${userId}`);
        return NextResponse.json(
          { success: false, message: 'User not found' },
          { status: 404 }
        );
      }

      // Generate and send a new MFA code
      const mfaSession = await createAndSendMfaCode(userId, email, username);
      
      if (!mfaSession) {
        console.error(`[RESEND] Failed to send verification code to ${email}`);
        return NextResponse.json(
          { success: false, message: 'Failed to send verification code' },
          { status: 500 }
        );
      }

      console.log(`[RESEND] Verification code sent successfully to ${email}`);
      
      return NextResponse.json({
        success: true,
        message: 'Verification code sent',
        mfaSession
      });
    } catch (error) {
      console.error('[RESEND] Database error:', error);
      return NextResponse.json(
        { success: false, message: 'Database error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[RESEND] Error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred' },
      { status: 500 }
    );
  }
} 