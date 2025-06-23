import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { verifyAuth } from '@/lib/auth';
import mongoose from 'mongoose';
import connectDB from '@/lib/dbConnect';
import Feedback from '@/models/Feedback';

// PATCH handler to update feedback cycle settings
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  noStore();
  
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const payload = await verifyAuth(token);
    
    if (!payload || !payload.id || !payload.company) {
      return NextResponse.json({ error: 'Unauthorized or invalid company context' }, { status: 401 });
    }
    
    // Get request body
    const { frequency } = await request.json();
    
    // Validate frequency
    if (!frequency || !['monthly', 'quarterly', 'biannually', 'annually'].includes(frequency)) {
      return NextResponse.json({ error: 'Valid frequency is required (monthly, quarterly, biannually, or annually)' }, { status: 400 });
    }
    
    await connectDB();
    
    // Update or create the feedback cycle document in the feedback collection
    const now = new Date();
    const updateResult = await Feedback.updateOne(
      { documentType: 'settings', company: payload.company },
      { 
        $set: {
          documentType: 'settings',
          frequency: frequency,
          lastChanged: now,
          nextChangeAvailable: getNextQuarterDate(),
          updatedBy: new mongoose.Types.ObjectId(payload.id)
        }
      },
      { upsert: true }
    );
    
    // Get the updated settings
    const settings = await Feedback.findOne({ 
      documentType: 'settings', 
      company: payload.company 
    });
    
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Error updating feedback settings:', error);
    return NextResponse.json({ error: error.message || 'Failed to update feedback settings' }, { status: 500 });
  }
}

// GET handler to retrieve feedback cycle settings
export async function GET(request: NextRequest): Promise<NextResponse> {
  noStore();
  
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const payload = await verifyAuth(token);
    
    if (!payload || !payload.id || !payload.company) {
      return NextResponse.json({ error: 'Unauthorized or invalid company context' }, { status: 401 });
    }
    
    await connectDB();
    
    // Get settings from the feedback collection
    let settings = await Feedback.findOne({ 
      documentType: 'settings', 
      company: payload.company 
    });
    
    // If settings don't exist, create default settings in the feedback collection
    if (!settings) {
      settings = await Feedback.create({
        documentType: 'settings',
        company: payload.company,
        frequency: 'quarterly',
        lastChanged: new Date(),
        nextChangeAvailable: getNextQuarterDate(),
        createdBy: new mongoose.Types.ObjectId(payload.id)
      });
    }
    
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Error fetching feedback settings:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch feedback settings' }, { status: 500 });
  }
}

// Helper function to get the date of the next quarter
function getNextQuarterDate(): Date {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);
  const nextQuarterFirstMonth = (currentQuarter + 1) % 4 * 3;
  
  const nextQuarterDate = new Date(now);
  
  if (nextQuarterFirstMonth <= currentMonth) {
    // If the next quarter is in the next year
    nextQuarterDate.setFullYear(now.getFullYear() + 1);
  }
  
  nextQuarterDate.setMonth(nextQuarterFirstMonth, 1);
  nextQuarterDate.setHours(0, 0, 0, 0);
  
  return nextQuarterDate;
} 