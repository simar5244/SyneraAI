import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { ERPService } from '@/services/erpService';

// POST /api/admin/integrations/erp/test - Test an ERP connection
export async function POST(req: NextRequest) {
  try {
    // Verify the token and ensure admin access
    const tokenData = await verifyToken(req);
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to test ERP connections' },
        { status: 403 }
      );
    }

    // Get connection config from request body
    const connectionConfig = await req.json();
    
    // Test the connection
    let result;
    switch(connectionConfig.type) {
      case 'SAP_HR':
        result = await ERPService.testSAPConnection(connectionConfig);
        break;
      case 'ORACLE':
        result = await ERPService.testOracleConnection(connectionConfig);
        break;
      case 'MICROSOFT_AD':
        result = await ERPService.testADConnection(connectionConfig);
        break;
      case 'PEOPLESOFT':
        result = await ERPService.testPeoplesoftConnection(connectionConfig);
        break;
      case 'WORKDAY':
        result = await ERPService.testWorkdayConnection(connectionConfig);
        break;
      default:
        return NextResponse.json({ 
          success: false, 
          message: 'Unsupported ERP type' 
        }, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error testing ERP connection:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred while testing the connection' },
      { status: 500 }
    );
  }
} 