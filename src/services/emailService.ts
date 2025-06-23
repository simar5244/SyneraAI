import nodemailer from 'nodemailer';

// Configuration for email service using environment variables
const getEmailConfig = () => {
  console.log('[EMAIL] Getting email configuration');
  
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587');
  
  // For port 465, secure should always be true
  const secure = port === 465 || 
                process.env.SMTP_SECURE === 'true' || 
                process.env.EMAIL_SECURE === 'true';
  
  const config = {
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER || '',
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || ''
    }
  };
  
  // Log config but hide password
  console.log('[EMAIL] Configuration:', {
    ...config,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass ? '********' : 'not set'
    }
  });
  
  return config;
};

// Create a fallback transporter that logs but doesn't send actual emails
const createFallbackTransporter = () => {
  return {
    sendMail: async (mailOptions: any) => {
      console.log('[EMAIL] Email sending attempted (log only):', mailOptions);
      return { 
        messageId: `log_${Date.now()}`,
        response: 'Email logged successfully (not sent)'
      };
    }
  };
};

// Get the appropriate transporter
const getTransporter = () => {
  // Check if we have credentials
  if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
    console.log('[EMAIL] No email credentials found, using fallback logger');
    return createFallbackTransporter();
  }
  
  try {
    // Use nodemailer transporter with configuration
    console.log('[EMAIL] Creating email transporter');
    const transporter = nodemailer.createTransport(getEmailConfig());
    
    // Verify connection configuration
    transporter.verify(function(error, success) {
      if (error) {
        console.error('[EMAIL] SMTP connection error:', error);
      } else {
        console.log('[EMAIL] SMTP connection successful, server is ready to send emails');
      }
    });
    
    return transporter;
  } catch (error) {
    console.error('[EMAIL] Failed to create email transporter:', error);
    console.log('[EMAIL] Using fallback logger');
    return createFallbackTransporter();
  }
};

// Send a welcome email to a new user
export const sendWelcomeEmail = async (to: string, username: string): Promise<boolean> => {
  try {
    console.log(`[EMAIL] Sending welcome email to ${to}`);
    const transporter = getTransporter();
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"InsideBox" <${process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@insidebox.com'}>`,
      to,
      subject: 'Welcome to InsideBox',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Welcome to InsideBox, ${username}!</h2>
          <p>Thank you for joining our platform. We're excited to have you on board!</p>
          <p>You can now log in to your account and start exploring the features.</p>
          <p>If you have any questions, feel free to contact our support team.</p>
          <p>Best regards,<br>The InsideBox Team</p>
        </div>
      `
    });
    
    console.log(`[EMAIL] Welcome email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send welcome email:', error);
    return false;
  }
};

// Interface for invitation email data
interface InvitationEmailData {
  fullName: string;
  organizationName: string;
}

// Send an invitation email to an employee
export const sendInvitationEmail = async (
  to: string, 
  token: string, 
  data: InvitationEmailData
): Promise<boolean> => {
  try {
    console.log(`[EMAIL] Sending invitation email to ${to}`);
    const transporter = getTransporter();
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/invite?token=${token}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"InsideBox" <${process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@insidebox.com'}>`,
      to,
      subject: `Invitation to join ${data.organizationName} on InsideBox`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Hello ${data.fullName},</h2>
          <p>You have been invited to join <strong>${data.organizationName}</strong> on InsideBox.</p>
          <p>Please click the button below to accept the invitation and create your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 4px; font-weight: bold;">
              Accept Invitation
            </a>
          </div>
          <p>This invitation link will expire in 7 days.</p>
          <p>If you believe this invitation was sent to you by mistake, please disregard this email.</p>
          <p>Best regards,<br>The InsideBox Team</p>
        </div>
      `
    });
    
    console.log(`[EMAIL] Invitation email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send invitation email:', error);
    return false;
  }
};

// Send a password reset email
export const sendPasswordResetEmail = async (to: string, token: string, companyCode: string): Promise<boolean> => {
  try {
    console.log(`[EMAIL] Sending password reset email to ${to}`);
    const transporter = getTransporter();
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}&email=${encodeURIComponent(to)}&companyCode=${companyCode}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"InsideBox" <${process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@insidebox.com'}>`,
      to,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #333;">Password Reset</h1>
          </div>
          <p style="font-size: 16px; color: #555;">We received a request to reset your password for your InsideBox account.</p>
          <p style="font-size: 16px; color: #555;">Please click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #4a6cf7; color: white; padding: 14px 28px; text-align: center; text-decoration: none; display: inline-block; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Reset Password
            </a>
          </div>
          <p style="font-size: 14px; color: #777;">This link will expire in 1 hour.</p>
          <p style="font-size: 14px; color: #777;">If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888;">
            <p>Best regards,<br>The InsideBox Team</p>
          </div>
        </div>
      `
    });
    
    console.log(`[EMAIL] Password reset email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send password reset email:', error);
    return false;
  }
};

// Send a notification email
export const sendNotificationEmail = async (
  to: string, 
  subject: string, 
  message: string
): Promise<boolean> => {
  try {
    console.log(`[EMAIL] Sending notification email to ${to}`);
    const transporter = getTransporter();
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"InsideBox" <${process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@insidebox.com'}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>${subject}</h2>
          <p>${message}</p>
          <p>Best regards,<br>The InsideBox Team</p>
        </div>
      `
    });
    
    console.log(`[EMAIL] Notification email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send notification email:', error);
    return false;
  }
};

// Send an OTP verification email
export const sendOTPVerificationEmail = async (
  to: string, 
  otp: string,
  username: string
): Promise<boolean> => {
  try {
    console.log(`[EMAIL] Sending OTP verification email to ${to} with code ${otp}`);
    const transporter = getTransporter();
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"InsideBox" <${process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@insidebox.com'}>`,
      to,
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #f9f9f9; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333;">Account Verification</h1>
          </div>
          <p style="font-size: 16px; color: #555;">Hello ${username},</p>
          <p style="font-size: 16px; color: #555;">Thank you for signing up with InsideBox. To complete your registration, please use the verification code below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e0e0e0; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #4a6cf7;">
              ${otp}
            </div>
          </div>
          <p style="font-size: 14px; color: #777;">This code will expire in 10 minutes.</p>
          <p style="font-size: 14px; color: #777;">If you didn't request this code, please ignore this email.</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888;">
            <p>Best regards,<br>The InsideBox Team</p>
          </div>
        </div>
      `
    });
    
    console.log(`[EMAIL] OTP verification email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send OTP verification email:', error);
    return false;
  }
}; 