import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { ERPService } from '@/services/erpService';
import { connectToDatabase } from '@/services/mongodb';
import Organization from '@/models/Organization';

// DELETE /api/admin/integrations/erp/[id] - Delete an ERP connection
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify the token and ensure admin access
    const tokenData = await verifyToken(req);
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to delete ERP connections' },
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

    // Delete the connection
    const result = await ERPService.deleteERPConnection(params.id, tokenData.orgId);
    
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