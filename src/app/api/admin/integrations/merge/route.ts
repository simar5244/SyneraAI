import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import integrationDataMerger, { mergeIntegrationDataToUsers } from '@/utils/integrationDataMerger';

// POST /api/admin/integrations/merge - Manually trigger the merge process
export async function POST(req: NextRequest) {
  try {
    // Verify authentication and admin role
    const tokenData = await verifyToken(req.headers.get('authorization') || '');
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to perform this action' },
        { status: 403 }
      );
    }

    // Get company code from authenticated user
    const companyCode = tokenData.companyCode;
    if (!companyCode) {
      return NextResponse.json(
        { error: 'No company code associated with your account' },
        { status: 400 }
      );
    }

    // Execute the merge process
    const result = await mergeIntegrationDataToUsers(companyCode);

    // Return the result
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error merging integration data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to merge integration data', 
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/admin/integrations/merge - Get status and info about the merger service
export async function GET(req: NextRequest) {
  try {
    // Verify authentication and admin role
    const tokenData = await verifyToken(req.headers.get('authorization') || '');
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to perform this action' },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Handle different actions
    if (action === 'merge-all') {
      // Only super admins can run merge for all companies
      if (tokenData.role !== 'admin' || !tokenData.isSuperAdmin) {
        return NextResponse.json(
          { error: 'Only super admins can merge all companies' },
          { status: 403 }
        );
      }

      // Run merge for all companies
      const result = await integrationDataMerger.mergeAllCompanies();
      return NextResponse.json(result);
    }

    // Default response - just return basic service info
    return NextResponse.json({
      status: 'active',
      message: 'Integration data merger service is running'
    });
  } catch (error: any) {
    console.error('Error getting integration data merger info:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get integration data merger info', 
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
} 