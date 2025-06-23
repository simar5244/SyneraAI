import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { ERPService } from '@/services/erpService';
import { connectToDatabase } from '@/services/mongodb';
import Organization from '@/models/Organization';

// POST /api/admin/integrations/erp/[id]/sync - Sync data from an ERP connection
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify the token and ensure admin access
    const tokenData = await verifyToken(req);
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to sync ERP data' },
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

    // Sync data from the ERP connection
    const result = await ERPService.syncFromERP(params.id, tokenData.orgId);
    
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.employeeCount} employees`,
      employeeCount: result.employeeCount
    });
  } catch (error: any) {
    console.error('Error syncing ERP data:', error);
    return NextResponse.json(
      { error: 'Failed to sync ERP data' },
      { status: 500 }
    );
  }
} 