import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { ERPService } from '@/services/erpService';
import { connectToDatabase } from '@/services/mongodb';
import Organization from '@/models/Organization';

interface RequestWithAuth extends NextRequest {
  user?: {
    id: string;
    role: string;
    organizationId?: string;
    companyCode?: string;
    [key: string]: any;
  };
}

// DELETE /api/admin/integrations/erp/[id] - Delete an ERP connection
export async function DELETE(
  req: RequestWithAuth,
  { params }: { params: { id: string } }
) {
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
        { error: 'You do not have permission to delete ERP connections' },
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

    // Delete the connection
    const result = await ERPService.deleteERPConnection(params.id, orgId);
    
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Connection deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting ERP connection:', error);
    return NextResponse.json(
      { error: 'Failed to delete ERP connection' },
      { status: 500 }
    );
  }
} 