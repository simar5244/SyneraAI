import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { UserRole, Permission, hasPermission } from '@/utils/roles';

export async function POST(req: NextRequest) {
  try {
    // Verify the token
    const tokenData = await verifyToken(req);
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // Check if user has permission to sync ERP data
    const canSyncERP = hasPermission(
      tokenData.role as UserRole, 
      Permission.MANAGE_EMPLOYEES
    );

    if (!canSyncERP) {
      return NextResponse.json(
        { error: 'You do not have permission to trigger ERP synchronization' },
        { status: 403 }
      );
    }

    // Get organization ID from token
    const orgId = tokenData.orgId || 'org-123'; // Fallback for demo

    // In a real implementation, this would trigger a sync job
    // For the demo, we'll simulate a successful sync
    
    // Simulate some processing time (1-2 seconds)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // Get current timestamp for audit
    const timestamp = new Date().toISOString();
    
    // Simulate updating the last sync timestamp in the database
    console.log(`[ERP Sync] Organization ${orgId} synced at ${timestamp} by user ${tokenData.userId}`);
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Data synchronized successfully',
      syncedAt: timestamp,
      recordCount: {
        employees: 324,
        departments: 28
      }
    });
  } catch (error: any) {
    console.error('Error syncing ERP data:', error);
    return NextResponse.json(
      { error: 'Failed to synchronize ERP data' },
      { status: 500 }
    );
  }
} 