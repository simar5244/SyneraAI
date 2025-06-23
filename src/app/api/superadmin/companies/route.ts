import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from "@/lib/auth";
import connectDB from '@/lib/dbConnect';
import Organization from '@/models/Organization';
import User from '@/models/User';

// GET handler to fetch companies
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAuth(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow superadmin to access this route
    if (payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await connectDB();
    
    // Fetch all companies
    const companies = await Organization.find()
      .select('name companyCode domain createdAt')
      .sort({ name: 1 });
    
    return NextResponse.json(companies);
  } catch (error: any) {
    console.error('Error fetching companies:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch companies' }, { status: 500 });
  }
}

// POST handler to create a new company
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAuth(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow superadmin to access this route
    if (payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await connectDB();
    
    const { name, domain, companyCode } = await request.json();
    
    // Generate a company code if not provided
    const finalCompanyCode = companyCode || generateCompanyCode(name);

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    // Check if company already exists with the same name, domain, or code
    const existingCompany = await Organization.findOne({
      $or: [
        { name },
        { domain: domain || '' },
        { companyCode: finalCompanyCode }
      ]
    });

    if (existingCompany) {
      let errorMessage = 'Company already exists';
      if (existingCompany.name === name) {
        errorMessage = 'A company with this name already exists';
      } else if (existingCompany.domain === domain) {
        errorMessage = 'A company with this domain already exists';
      } else if (existingCompany.companyCode === finalCompanyCode) {
        errorMessage = 'A company with this code already exists';
      }
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Create the company
    const company = new Organization({
      name,
      domain: domain || '',
      companyCode: finalCompanyCode,
      createdBy: payload.id,
      updatedBy: payload.id
    });

    await company.save();
    
    return NextResponse.json(company, { status: 201 });
  } catch (error: any) {
    console.error('Error creating company:', error);
    return NextResponse.json({ error: error.message || 'Failed to create company' }, { status: 500 });
  }
}

// DELETE handler to remove a company
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyAuth(token);
    if (!payload || payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    await connectDB();
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Company id is required' }, { status: 400 });
    }
    const deleted = await Organization.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Company deleted' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting company:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete company' }, { status: 500 });
  }
}

// Helper function to generate a company code
function generateCompanyCode(name: string): string {
  // Create a code from the first 3 letters of the company name + random digits
  const prefix = name.substring(0, 3).toUpperCase();
  const randomDigits = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
  return `${prefix}${randomDigits}`;
} 