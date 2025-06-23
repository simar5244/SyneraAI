// Placeholder for email utilities
// TODO: Implement actual email sending logic (e.g., using Nodemailer, SendGrid, etc.)

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  console.log(`[Email Util - Mock] Sending email to ${options.to} with subject: ${options.subject}`);
  // In a real implementation, you would use a service like nodemailer here:
  // const transporter = nodemailer.createTransport(...);
  // await transporter.sendMail(...);
  
  // Simulate sending delay
  await new Promise(resolve => setTimeout(resolve, 100)); 
  
  console.log("[Email Util - Mock] Email 'sent'.");
  return Promise.resolve();
};

export default sendEmail; 