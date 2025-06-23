// Test script to verify email configuration
// Run with: node src/scripts/test-email.js

const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

const main = async () => {
  console.log('Email Configuration Test');
  console.log('=======================');
  
  // Check environment variables
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = process.env.SMTP_PORT || process.env.EMAIL_PORT;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  
  console.log(`Host: ${host || 'Not set'}`);
  console.log(`Port: ${port || 'Not set'}`);
  console.log(`User: ${user || 'Not set'}`);
  console.log(`Pass: ${pass ? '********' : 'Not set'}`);
  
  if (!host || !port || !user || !pass) {
    console.error('Missing required email configuration. Please check your .env.local file.');
    return;
  }
  
  // Create transporter
  try {
    console.log('\nCreating transporter...');
    
    // For Gmail with port 465, we need to set secure to true
    const secure = port === '465' || process.env.SMTP_SECURE === 'true' || process.env.EMAIL_SECURE === 'true';
    console.log(`Using secure connection: ${secure}`);
    
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: secure,
      auth: {
        user,
        pass
      },
      // Add debug option to see more information
      debug: true
    });
    
    // Verify connection
    console.log('Verifying connection...');
    await transporter.verify();
    console.log('✅ Connection successful!');
    
    // Send test email
    const testEmail = process.argv[2] || user;
    if (!testEmail) {
      console.error('No test email address provided. Please provide an email address as an argument.');
      return;
    }
    
    console.log(`\nSending test email to ${testEmail}...`);
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"InsideBox Test" <${user}>`,
      to: testEmail,
      subject: 'Email Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Email Configuration Test</h2>
          <p>This is a test email to verify your email configuration is working correctly.</p>
          <p>If you received this email, your configuration is correct!</p>
          <p>Configuration details:</p>
          <ul>
            <li>Host: ${host}</li>
            <li>Port: ${port}</li>
            <li>Secure: ${secure}</li>
            <li>User: ${user}</li>
          </ul>
          <p>Time sent: ${new Date().toLocaleString()}</p>
        </div>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Response: ${info.response}`);
  } catch (error) {
    console.error('❌ Error:', error);
    
    // Provide more helpful error message for common issues
    if (error.code === 'EAUTH') {
      console.error('\nAuthentication failed. This could be due to:');
      console.error('1. Incorrect password or app password');
      console.error('2. Less secure app access is disabled (use App Password instead)');
      console.error('3. 2-Step Verification is not enabled (required for App Passwords)');
      console.error('\nFor Gmail, go to https://myaccount.google.com/apppasswords to generate an App Password');
    } else if (error.code === 'ESOCKET') {
      console.error('\nConnection error. This could be due to:');
      console.error('1. Incorrect port or secure settings');
      console.error('2. Network issues or firewall blocking the connection');
      console.error('\nTry using port 587 with secure=false or port 465 with secure=true');
    }
  }
};

main().catch(console.error); 