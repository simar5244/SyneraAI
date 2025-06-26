import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/edgeAuth';
import { ERPService } from '@/services/erpService';
import Organization from '@/models/Organization';
import { connectToDatabase } from '@/services/mongodb';
import { verifyToken } from '@/lib/auth';

interface RequestWithAuth extends NextRequest {
  user?: {
    id: string;
    role: string;
    organizationId?: string;
    companyCode?: string;
    [key: string]: any;
  };
}

// GET /api/admin/integrations/erp - Get all ERP connections for the organization
export async function GET(req: RequestWithAuth) {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }
    
    // Verify the token and ensure admin access
    const tokenData = await verifyToken(token);
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to access integration settings' },
        { status: 403 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Get user's organization
    const orgId = (tokenData as any)?.organizationId || (tokenData as any)?.companyCode;
    if (!orgId || typeof orgId !== 'string') {
      return NextResponse.json({ error: 'Organization not found in token' }, { status: 403 });
    }

    const organization = await Organization.findOne({ _id: orgId });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get ERP connections
    const connections = await ERPService.getERPConnections(orgId);

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
export async function POST(req: RequestWithAuth) {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }
    
    // Verify the token and ensure admin access
    const tokenData = await verifyToken(token);
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to create ERP connections' },
        { status: 403 }
      );
    }

    // Get request body
    const connectionSettings = await req.json();

    // Get organization ID from token
    const orgId = (tokenData as any)?.organizationId || (tokenData as any)?.companyCode;
    const userId = (tokenData as any)?.id || (tokenData as any)?.userId;
    
    if (!orgId || !userId) {
      return NextResponse.json(
        { error: 'Invalid token data' },
        { status: 400 }
      );
    }
    
    // Add organization ID and user ID to connection settings
    connectionSettings.organizationId = orgId;
    connectionSettings.userId = userId;

    // Connect to database
    await connectToDatabase();

    // Verify organization exists
    const organization = await Organization.findOne({ _id: orgId });
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