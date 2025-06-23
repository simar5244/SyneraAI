import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { mergeIntegrationDataNow } from '@/utils/integrationDataMergerUtil';

/**
 * POST /api/integrations/merge
 * 
 * Immediately merges integration data to users for a specific company.
 * Designed to be called from other API endpoints after new integration data is added.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const tokenValue = request.headers.get('authorization')?.split(' ')[1] || 
                      request.cookies.get('token')?.value;
    
    if (!tokenValue) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const payload = await verifyAuth(tokenValue);
    if (!payload || !payload.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get request body
    const body = await request.json();
    
    // Extract company code from either request body or user payload
    let companyCode = body.companyCode || '';
    if (!companyCode && payload.companyCode) {
      companyCode = payload.companyCode;
    }
    
    // Validate company code
    if (!companyCode) {
      return NextResponse.json({
        error: 'No company code provided',
        message: 'Company code is required for merging integration data'
      }, { status: 400 });
    }
    
    console.log(`[Merge API] Triggering immediate merge for company: ${companyCode}`);
    
    // Execute the immediate merge process
    const result = await mergeIntegrationDataNow(companyCode);
    
    // Return the result
    return NextResponse.json({
      ...result,
      message: `Integration merger completed for company ${companyCode}`
    });
    
  } catch (error: any) {
    console.error('[Merge API] Error merging integration data:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to merge integration data', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 