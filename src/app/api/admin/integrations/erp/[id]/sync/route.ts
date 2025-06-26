import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/edgeAuth';
import { ERPService } from '@/services/erpService';
import { connectToDatabase } from '@/services/mongodb';
import Organization from '@/models/Organization';

interface TokenPayload {
  role: string;
  orgId: string;
  [key: string]: any;
}

// POST /api/admin/integrations/erp/[id]/sync - Sync data from an ERP connection
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get and verify the token
    const token = req.headers.get('authorization')?.split(' ')[1] || '';
    const tokenData = await verifyAuth(token);
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
  } catch (error: unknown) {
    console.error('Error syncing ERP data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync ERP data';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 