import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/dbConnect';
export const runtime = 'nodejs';
import { unstable_noStore as noStore } from 'next/cache';
import { verifyAuth } from '@/lib/auth';
import mongoose from 'mongoose';
import feedbackService from '@/services/feedbackService';

// POST handler to submit feedback
export async function POST(request: NextRequest): Promise<NextResponse> {
  noStore();
  await connectDB();
  
  try {
    // Verify authentication with enhanced company validation
    const token = request.headers.get('authorization')?.split(' ')[1];
    
    if (!token) {
      console.error('No token provided for feedback request');
      return NextResponse.json({ 
        error: 'Authentication required',
        message: 'Please login to access feedback features'
      }, { status: 401 });
    }
    
    const payload = await verifyAuth(token);
    
    if (!payload || !payload.id) {
      console.error('Invalid token payload:', payload);
      return NextResponse.json({ 
        error: 'Invalid authentication',
        message: 'Your session is invalid. Please login again.'
      }, { status: 401 });
    }
    
    // Extract company code and user email
    const rawCompanyCode = payload.companyCode || payload.company_code;
    if (!rawCompanyCode) {
      console.error('Missing company code in token for user:', payload.id);
      return NextResponse.json({ error: 'Company context required', message: 'Your account is not associated with a company. Please contact support.' }, { status: 403 });
    }
    
    // Extract user email from token payload
    const userEmail = payload.email;
    if (!userEmail) {
      console.error('Missing email in token payload');
      return NextResponse.json({ error: 'Invalid authentication', message: 'Your session is invalid. Please login again.' }, { status: 401 });
    }
    
    // Get request body
    const { 
      evaluatedEmail, 
      relationshipType, 
      ratings, 
      topSkills
    } = await request.json();
    
    // Validate required fields
    if (!evaluatedEmail) {
      return NextResponse.json({ error: 'Evaluated employee email is required' }, { status: 400 });
    }
    
    if (!relationshipType || !['direct-reporting', 'project-collaboration', 'no-connection'].includes(relationshipType)) {
      return NextResponse.json({ error: 'Valid relationship type is required' }, { status: 400 });
    }
    
    if (!ratings || !validateRatings(ratings)) {
      return NextResponse.json({ error: 'Valid ratings are required for all categories' }, { status: 400 });
    }
    
    if (!topSkills) {
      return NextResponse.json({ error: 'Top skills feedback is required' }, { status: 400 });
    }
    
    // Submit feedback via service (service will validate evaluator and evaluated user)
    console.log('Route POST /api/feedback: evaluator email =', userEmail, 'companyCode =', rawCompanyCode);
    const feedback = await feedbackService.submitFeedback(
      userEmail.toLowerCase(),
      evaluatedEmail.toLowerCase(),
      relationshipType,
      ratings,
      topSkills,
      rawCompanyCode
    );
    return NextResponse.json(feedback, { status: 201 });
  } catch (error: any) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit feedback' }, { status: 500 });
  }
}

// GET handler to retrieve feedback
export async function GET(request: NextRequest): Promise<NextResponse> {
  noStore();
  await connectDB();
  console.log('Route GET /api/feedback: headers =', Object.fromEntries(request.headers.entries()));
  
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    
    if (!token) {
      console.error('No token provided for feedback request');
      return NextResponse.json({ 
        error: 'Authentication required',
        message: 'Please login to access feedback features'
      }, { status: 401 });
    }
    
    const payload = await verifyAuth(token);
    console.log('Route GET payload =', payload);
    
    if (!payload || !payload.id) {
      console.error('Invalid token payload:', payload);
      return NextResponse.json({ 
        error: 'Invalid authentication',
        message: 'Your session is invalid. Please login again.'
      }, { status: 401 });
    }
    
    // Extract company code and user email from token
    const rawCompanyCode = payload.companyCode || payload.company_code;
    if (!rawCompanyCode) {
      return NextResponse.json({ error: 'Company context required' }, { status: 403 });
    }
    
    const userEmail = payload.email;
    if (!userEmail) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'given';
    const targetEmail = searchParams.get('email')?.toLowerCase();
    const quarter = searchParams.get('quarter') || undefined;
    
    // Return feedback and metrics based on type
    if (type === 'given') {
      const feedbackGiven = await feedbackService.getFeedbackByEvaluator(userEmail.toLowerCase(), rawCompanyCode, quarter);
      const { feedbackGiven: metricsGiven } = await feedbackService.updateUserFeedbackMetrics(userEmail.toLowerCase(), rawCompanyCode);
      return NextResponse.json({ feedback: feedbackGiven, metrics: metricsGiven });
    }
    if (type === 'received') {
      const feedbackReceived = await feedbackService.getFeedbackForEmployee(userEmail.toLowerCase(), rawCompanyCode, quarter);
      const { feedbackReceived: metricsReceived } = await feedbackService.updateUserFeedbackMetrics(userEmail.toLowerCase(), rawCompanyCode);
      return NextResponse.json({ feedback: feedbackReceived, metrics: metricsReceived });
    }
    if (targetEmail) {
      const feedbackFor = await feedbackService.getFeedbackForEmployee(targetEmail, rawCompanyCode, quarter);
      return NextResponse.json({ feedback: feedbackFor });
    }
    
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    console.error('Error retrieving feedback:', error);
    return NextResponse.json({ error: error.message || 'Failed to retrieve feedback' }, { status: 500 });
  }
}

// Helper function to validate ratings
function validateRatings(ratings: any): boolean {
  const validValues = ['Average', 'Good', 'Very Good', 'Excellent', 'Outstanding'];
  
  if (!ratings || typeof ratings !== 'object') {
    return false;
  }
  
  const requiredCategories = ['accountability', 'teamContribution', 'adaptability', 'communication', 'confidence'];
  
  for (const category of requiredCategories) {
    if (!ratings[category] || !validValues.includes(ratings[category])) {
      return false;
    }
  }
  
  return true;
}