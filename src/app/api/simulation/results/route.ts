import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/dbConnect";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Mock results for development
const mockResults = [
  {
    id: 'res-1',
    scenarioId: 'scen-1',
    type: 'attrition',
    date: new Date('2023-10-15'),
    metrics: {
      predictedAttritionRate: '0.18',
      costOfTurnover: 650000,
      timeToHire: 45,
      riskScore: 72,
      retentionOpportunity: 64
    },
    departmentImpacts: [
      {
        name: 'Engineering',
        predictedLosses: 12,
        impactScore: 85,
        riskLevel: 'high'
      },
      {
        name: 'Sales',
        predictedLosses: 8,
        impactScore: 63,
        riskLevel: 'medium'
      }
    ],
    recommendations: [
      'Implement performance-based bonuses in high-risk departments',
      'Develop career progression paths for key roles'
    ]
  },
  {
    id: 'res-2',
    scenarioId: 'scen-2',
    type: 'reorganization',
    date: new Date('2023-11-05'),
    metrics: {
      impactedEmployees: 58,
      costSavings: 320000,
      timeToImplement: 90,
      riskScore: 65,
      successProbability: 77
    },
    departmentImpacts: [
      {
        name: 'IT',
        headcountChange: -5,
        budgetChange: -120000,
        riskLevel: 'medium'
      },
      {
        name: 'Operations',
        headcountChange: -8,
        budgetChange: -180000,
        riskLevel: 'high'
      }
    ],
    recommendations: [
      'Phase implementation over 3 months to minimize disruption',
      'Provide retraining opportunities for displaced employees'
    ]
  }
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const scenarioId = searchParams.get('scenarioId');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    try {
      // Connect to database
      const client = await connectToDatabase();
      const db = client.db();
      const resultsCollection = db.collection('simulationResults');
      
      // Build query
      const query: any = { userId: session.user.id };
      
      if (scenarioId) {
        query.scenarioId = scenarioId;
      }
      
      if (type) {
        query.type = type;
      }
      
      if (startDate || endDate) {
        query.date = {};
        
        if (startDate) {
          query.date.$gte = new Date(startDate);
        }
        
        if (endDate) {
          query.date.$lte = new Date(endDate);
        }
      }
      
      // Execute query
      const results = await resultsCollection.find(query)
        .sort({ date: -1 })
        .limit(20)
        .toArray();
      
      return NextResponse.json({ results }, { status: 200 });
    } catch (error) {
      console.error("Database error:", error);
      
      // Filter mock data based on query parameters
      let filteredResults = [...mockResults];
      
      if (scenarioId) {
        filteredResults = filteredResults.filter(r => r.scenarioId === scenarioId);
      }
      
      if (type) {
        filteredResults = filteredResults.filter(r => r.type === type);
      }
      
      if (startDate) {
        const start = new Date(startDate);
        filteredResults = filteredResults.filter(r => r.date >= start);
      }
      
      if (endDate) {
        const end = new Date(endDate);
        filteredResults = filteredResults.filter(r => r.date <= end);
      }
      
      return NextResponse.json({ results: filteredResults }, { status: 200 });
    }
  } catch (error) {
    console.error("Error in GET /api/simulation/results:", error);
    return NextResponse.json(
      { error: "Failed to retrieve simulation results" },
      { status: 500 }
    );
  }
}

// Endpoint to get a specific result by ID
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Parse request body
    const { resultId } = await request.json();
    
    if (!resultId) {
      return NextResponse.json(
        { error: "Result ID is required" },
        { status: 400 }
      );
    }
    
    try {
      // Connect to database
      const client = await connectToDatabase();
      const db = client.db();
      const resultsCollection = db.collection('simulationResults');
      
      // Get the result
      const result = await resultsCollection.findOne({ 
        _id: resultId,
        userId: session.user.id
      });
      
      if (!result) {
        // Try with string ID for mock data
        const resultByStringId = await resultsCollection.findOne({
          id: resultId,
          userId: session.user.id
        });
        
        if (!resultByStringId) {
          // Check mock data
          const mockResult = mockResults.find(r => r.id === resultId);
          
          if (mockResult) {
            return NextResponse.json(mockResult, { status: 200 });
          }
          
          return NextResponse.json(
            { error: "Simulation result not found" },
            { status: 404 }
          );
        }
        
        return NextResponse.json(resultByStringId, { status: 200 });
      }
      
      return NextResponse.json(result, { status: 200 });
    } catch (error) {
      console.error("Database error:", error);
      
      // Check mock data
      const mockResult = mockResults.find(r => r.id === resultId);
      
      if (mockResult) {
        return NextResponse.json(mockResult, { status: 200 });
      }
      
      return NextResponse.json(
        { error: "Failed to retrieve simulation result" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in POST /api/simulation/results:", error);
    return NextResponse.json(
      { error: "Failed to retrieve simulation result" },
      { status: 500 }
    );
  }
} 