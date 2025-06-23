import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserModel } from '@/models/AuthUser';
import connectDB from '@/lib/dbConnect';
import { generateAndSendPasswordResetOtp } from '@/lib/mfa';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    console.log(`[PASSWORD-RESET] Request received for ${email}`);

    // Validate email format server-side
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format' },
        { status: 400 }
      );
    }

    try {
      // Connect to the main database
      await connectDB('org_sim_db');
      
      // Get the auth user model
      const AuthUserModel = await getAuthUserModel();
      
      // Find the user by email
      const user = await AuthUserModel.findOne({ email });
      
      if (!user) {
        console.log(`[PASSWORD-RESET] User not found with email ${email}`);
        // For security reasons, don't reveal that the user doesn't exist
        return NextResponse.json({ 
          success: true, 
          message: 'If your email is registered, you will receive a verification code' 
        });
      }
      
      // Get the company code from the user
      const companyCode = user.companyCode;
      
      // Generate and send a stateless OTP code
      const userId = user.userId || user._id.toString();
      const username = user.username || email.split('@')[0];
      
      const code = await generateAndSendPasswordResetOtp(email, username);
      if (!code) {
        console.error(`[PASSWORD-RESET] Failed to send OTP to ${email}`);
        return NextResponse.json(
          { success: false, message: 'Failed to send verification code' },
          { status: 500 }
        );
      }
      console.log(`[PASSWORD-RESET] OTP code ${code} sent to ${email}`);
      // Store the code and expiration
      user.resetPasswordToken = code;
      user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
      await user.save();
      
      return NextResponse.json({ 
        success: true, 
        message: 'Password reset email sent',
        redirectUrl: `/reset-password/verify?email=${encodeURIComponent(email)}` 
      });
    } catch (error) {
      console.error('[PASSWORD-RESET] Database error:', error);
      return NextResponse.json(
        { success: false, message: 'An error occurred while processing your request' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[PASSWORD-RESET] Request error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred' },
      { status: 500 }
    );
  }
} 