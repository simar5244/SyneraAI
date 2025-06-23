import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/dbConnect";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { v4 as uuidv4 } from 'uuid';

// Define types for simulation scenarios
type SimulationType = 'attrition' | 'reorganization' | 'growth' | 'cost_reduction';

interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  type: SimulationType;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  parameters: any;
  isTemplate: boolean;
}

// Mock scenarios for development
const mockScenarios: SimulationScenario[] = [
  {
    id: 'scen-1',
    name: 'Annual Attrition Analysis',
    description: 'Evaluate departmental attrition risk and impact over next 12 months',
    type: 'attrition',
    createdAt: new Date('2023-09-10'),
    updatedAt: new Date('2023-09-10'),
    userId: 'user-1',
    parameters: {
      timeframe: 12,
      departmentsIncluded: ['Engineering', 'Sales', 'Marketing', 'Customer Support'],
      focusAreas: ['retention', 'compensation', 'workload'],
      considerSalaryAdjustment: true
    },
    isTemplate: false
  },
  {
    id: 'scen-2',
    name: 'Q3 Reorganization Plan',
    description: 'Evaluate cost-saving opportunities through department restructuring',
    type: 'reorganization',
    createdAt: new Date('2023-10-05'),
    updatedAt: new Date('2023-10-15'),
    userId: 'user-1',
    parameters: {
      targetDepartments: ['IT', 'Operations'],
      desiredHeadcountReduction: 15,
      savingsTarget: 300000,
      prioritizePerformance: true,
      considerRemoteWork: true
    },
    isTemplate: false
  },
  {
    id: 'temp-1',
    name: 'Standard Attrition Analysis',
    description: 'Basic template for running attrition risk simulation',
    type: 'attrition',
    createdAt: new Date('2023-08-01'),
    updatedAt: new Date('2023-08-01'),
    userId: 'system',
    parameters: {
      timeframe: 12,
      departmentsIncluded: [],
      focusAreas: ['retention', 'compensation', 'workload'],
      considerSalaryAdjustment: true
    },
    isTemplate: true
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
    const type = searchParams.get('type');
    const includeTemplates = searchParams.get('includeTemplates') === 'true';
    
    try {
      // Connect to database
      const client = await connectToDatabase();
      const db = client.db();
      const scenariosCollection = db.collection('simulationScenarios');
      
      // Build query
      const query: any = {};
      
      if (!includeTemplates) {
        query.userId = session.user.id;
      } else {
        query.$or = [
          { userId: session.user.id },
          { isTemplate: true }
        ];
      }
      
      if (type) {
        query.type = type;
      }
      
      // Execute query
      const scenarios = await scenariosCollection.find(query)
        .sort({ updatedAt: -1 })
        .toArray();
      
      return NextResponse.json({ scenarios }, { status: 200 });
    } catch (error) {
      console.error("Database error:", error);
      
      // Filter mock data based on query parameters
      let filteredScenarios = [...mockScenarios];
      
      if (!includeTemplates) {
        filteredScenarios = filteredScenarios.filter(s => s.userId === session.user.id);
      } else {
        filteredScenarios = filteredScenarios.filter(s => 
          s.userId === session.user.id || s.isTemplate);
      }
      
      if (type) {
        filteredScenarios = filteredScenarios.filter(s => s.type === type);
      }
      
      // Sort by updated date descending
      filteredScenarios.sort((a, b) => 
        b.updatedAt.getTime() - a.updatedAt.getTime());
      
      return NextResponse.json({ scenarios: filteredScenarios }, { status: 200 });
    }
  } catch (error) {
    console.error("Error in GET /api/simulation/scenarios:", error);
    return NextResponse.json(
      { error: "Failed to retrieve simulation scenarios" },
      { status: 500 }
    );
  }
}

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
    const data = await request.json();
    
    // Validate required fields
    if (!data.name || !data.type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }
    
    // Check if type is valid
    const validTypes: SimulationType[] = ['attrition', 'reorganization', 'growth', 'cost_reduction'];
    if (!validTypes.includes(data.type)) {
      return NextResponse.json(
        { error: "Invalid simulation type" },
        { status: 400 }
      );
    }
    
    // Create new scenario
    const newScenario: SimulationScenario = {
      id: uuidv4(),
      name: data.name,
      description: data.description || '',
      type: data.type,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: session.user.id,
      parameters: data.parameters || {},
      isTemplate: data.isTemplate || false
    };
    
    try {
      // Connect to database
      const client = await connectToDatabase();
      const db = client.db();
      const scenariosCollection = db.collection('simulationScenarios');
      
      // Insert new scenario
      await scenariosCollection.insertOne(newScenario);
      
      return NextResponse.json(newScenario, { status: 201 });
    } catch (error) {
      console.error("Database error:", error);
      
      // For development, return mock response
      return NextResponse.json(newScenario, { status: 201 });
    }
  } catch (error) {
    console.error("Error in POST /api/simulation/scenarios:", error);
    return NextResponse.json(
      { error: "Failed to create simulation scenario" },
      { status: 500 }
    );
  }
} 