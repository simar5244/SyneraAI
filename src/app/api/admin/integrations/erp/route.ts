import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { ERPService } from '@/services/erpService';
import Organization from '@/models/Organization';
import { connectToDatabase } from '@/services/mongodb';

// GET /api/admin/integrations/erp - Get all ERP connections for the organization
export async function GET(req: NextRequest) {
  try {
    // Verify the token and ensure admin access
    const tokenData = await verifyToken(req);
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to access integration settings' },
        { status: 403 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Get user's organization
    const organization = await Organization.findOne({ _id: tokenData.orgId });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get ERP connections
    const connections = await ERPService.getERPConnections(tokenData.orgId);

    return NextResponse.json({ connections });
  } catch (error: any) {
    console.error('Error fetching ERP connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ERP connections' },
      { status: 500 }
    );
  }
}

// POST /api/admin/integrations/erp - Create a new ERP connection
export async function POST(req: NextRequest) {
  try {
    // Verify the token and ensure admin access
    const tokenData = await verifyToken(req);
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to create ERP connections' },
        { status: 403 }
      );
    }

    // Get request body
    const connectionSettings = await req.json();

    // Add organization ID to connection settings
    connectionSettings.organizationId = tokenData.orgId;
    connectionSettings.userId = tokenData.userId;

    // Connect to database
    await connectToDatabase();

    // Verify organization exists
    const organization = await Organization.findOne({ _id: tokenData.orgId });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Connect to ERP
    const result = await ERPService.connectToERP(connectionSettings);
    
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error('Error creating ERP connection:', error);
    return NextResponse.json(
      { error: 'Failed to create ERP connection' },
      { status: 500 }
    );
  }
} 