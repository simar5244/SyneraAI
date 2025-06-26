import { NextRequest, NextResponse } from 'next/server';
import connectToMongoDB from '@/lib/dbConnect';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// Define TokenPayload interface since it's not exported from auth.ts
interface TokenPayload {
  id: string;
  userId?: string;
  email: string;
  role: string;
  company?: string;
  companyCode?: string;
  tier?: number;
  notificationPreferences?: {
    email: boolean;
    browser: boolean;
    types: {
      system: boolean;
      project: boolean;
      mention: boolean;
      task: boolean;
    };
  };
}

// Helper function to get session (replace original getSession)
const getSession = async (request: NextRequest): Promise<{ user: TokenPayload | null } | null> => {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return null;
  }

  try {
    const user = verifyToken(token);
    if (!user) {
      return null;
    }
    return { user };
  } catch (e) {
    console.error('Error verifying token in getSession:', e);
    return null;
  }
};

// Types
type SimulationType = 'attrition' | 'reorganization' | 'growth' | 'cost_reduction';

interface AuthenticatedUser extends Omit<TokenPayload, 'role'> {
  id: string;
  email: string;
  companyCode: string;
  role: string; // Make role required
  tier?: number;
  notificationPreferences?: {
    email: boolean;
    browser: boolean;
    types: {
      system: boolean;
      project: boolean;
      mention: boolean;
      task: boolean;
    };
  };
}

interface SimulationScenario {
  id?: string;
  _id?: string | mongoose.Types.ObjectId;
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
    id: '1',
    name: 'Annual Attrition Analysis',
    description: 'Predicts attrition patterns based on historical data for the next fiscal year',
    type: 'attrition',
    createdAt: new Date('2023-05-15'),
    updatedAt: new Date('2023-05-15'),
    userId: 'user123',
    parameters: {
      timeframe: 12,
      departments: ['Engineering', 'Sales', 'Marketing'],
      riskFactors: ['tenure', 'compensation', 'performance']
    },
    isTemplate: false
  },
  {
    id: '2',
    name: 'Department Reorganization',
    description: 'Simulate the impact of reorganizing the engineering department',
    type: 'reorganization',
    createdAt: new Date('2023-06-10'),
    updatedAt: new Date('2023-06-12'),
    userId: 'user123',
    parameters: {
      departments: ['Engineering'],
      newStructure: 'matrix',
      moveEmployees: true
    },
    isTemplate: false
  },
  {
    id: '3',
    name: 'Q3 Growth Planning',
    description: 'Project headcount needs based on Q3 growth targets',
    type: 'growth',
    createdAt: new Date('2023-07-05'),
    updatedAt: new Date('2023-07-05'),
    userId: 'user123',
    parameters: {
      growthRate: 15,
      departmentsToGrow: ['Sales', 'Customer Success'],
      timeline: 3
    },
    isTemplate: false
  },
  {
    id: '4',
    name: 'Standard Attrition Analysis',
    description: 'Template for basic attrition analysis across all departments',
    type: 'attrition',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    userId: 'system',
    parameters: {
      timeframe: 12,
      departments: ['All'],
      riskFactors: ['tenure', 'compensation', 'performance', 'manager_change']
    },
    isTemplate: true
  },
  {
    id: '5',
    name: 'Department Cost Reduction',
    description: 'Template for analyzing potential cost reductions while minimizing impact',
    type: 'cost_reduction',
    createdAt: new Date('2023-02-15'),
    updatedAt: new Date('2023-02-15'),
    userId: 'system',
    parameters: {
      targetReduction: 10,
      preserveTopPerformers: true,
      considerContractors: true
    },
    isTemplate: true
  }
];

// GET a specific scenario
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getSession(request);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const id = params.id;
    
    try {
      // Connect to database with company code
      const user = session.user as TokenPayload;
      if (!user.companyCode) {
        throw new Error('Company code is required');
      }
      
      await connectToMongoDB(user.companyCode);
      if (!mongoose.connection?.db) {
        throw new Error('Failed to connect to database');
      }
      const db = mongoose.connection.db;
      
      // Query for the scenario
      let scenario;
      
      // Handle special case for templates that might belong to system
      try {
        scenario = await db.collection('simulationScenarios').findOne({
          $or: [
            // Either it belongs to the user
            { _id: new mongoose.Types.ObjectId(id) as any, userId: session.user.id },
            // Or it's a template
            { _id: new mongoose.Types.ObjectId(id) as any, isTemplate: true }
          ]
        });
      } catch (idError) {
        // If ObjectId conversion fails, try as a string ID (for mock data)
        scenario = await db.collection('simulationScenarios').findOne({
          $or: [
            { id: id, userId: session.user.id },
            { id: id, isTemplate: true }
          ]
        });
      }
      
      if (!scenario) {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
      }
      
      // Transform ObjectId to string
      return NextResponse.json({
        ...scenario,
        id: scenario._id ? scenario._id.toString() : scenario.id,
        _id: undefined
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      
      // Fall back to mock data in development
      console.log('Falling back to mock data for scenario ID:', id);
      const mockScenario = mockScenarios.find(s => s.id === id);
      
      if (!mockScenario) {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
      }
      
      return NextResponse.json({ 
        ...mockScenario,
        note: 'Using mock data - database connection failed'
      });
    }
  } catch (error) {
    console.error('Error in GET scenario:', error);
    return NextResponse.json({ error: 'Failed to fetch scenario' }, { status: 500 });
  }
}

// PUT to update a scenario
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getSession(request);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const id = params.id;
    const updateData: Partial<SimulationScenario> = await request.json();
    
    // Remove protected fields from the update
    const { id: _, _id: __, createdAt: ___, userId: ____, ...safeUpdateData } = updateData;
    
    // Always update the updatedAt timestamp
    const finalUpdateData = {
      ...safeUpdateData,
      updatedAt: new Date()
    };
    
    try {
      // Connect to database with company code
      const user = session.user as TokenPayload;
      if (!user.companyCode) {
        throw new Error('Company code is required');
      }
      
      await connectToMongoDB(user.companyCode);
      if (!mongoose.connection?.db) {
        throw new Error('Failed to connect to database');
      }
      const db = mongoose.connection.db;
      
      // Check if scenario exists and belongs to user
      let scenario;
      try {
        scenario = await db.collection('simulationScenarios').findOne({
          _id: new mongoose.Types.ObjectId(id) as any,
          userId: user.id
        });
      } catch (idError) {
        // If ObjectId conversion fails, try as string ID
        scenario = await db.collection('simulationScenarios').findOne({
          id: id,
          userId: user.id
        });
      }
      
      if (!scenario) {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
      }
      
      // Check if user has permission (owner or template)
      if (scenario.userId !== session.user.id && !scenario.isTemplate) {
        return NextResponse.json({ error: 'Not authorized to update this scenario' }, { status: 403 });
      }
      
      // If it's a template and user is not the owner, create a copy instead
      if (scenario.isTemplate && scenario.userId !== session.user.id) {
        const newScenario = {
          ...scenario,
          ...finalUpdateData,
          userId: session.user.id,
          isTemplate: false,
          createdAt: new Date(),
          name: `Copy of ${scenario.name}`
        };
        
        const result = await db.collection('simulationScenarios').insertOne(newScenario);
        return NextResponse.json({
          ...newScenario,
          id: result.insertedId.toString(),
          _id: undefined,
          message: 'Created a copy of the template'
        });
      }
      
      // Otherwise update the existing scenario
      await db.collection('simulationScenarios').updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: finalUpdateData }
      );
      
      // Return the updated scenario
      const updatedScenario = await db.collection('simulationScenarios').findOne({
        _id: new mongoose.Types.ObjectId(id)
      });
      
      return NextResponse.json({
        ...updatedScenario,
        id: updatedScenario?._id.toString(),
        _id: undefined
      });
    } catch (dbError) {
      console.error('Database error on update:', dbError);
      
      // In development, simulate a successful update with mock data
      if (process.env.NODE_ENV === 'development') {
        const mockIndex = mockScenarios.findIndex(s => s.id === id);
        
        if (mockIndex === -1) {
          return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
        }
        
        // Create updated mock scenario
        const updatedScenario = {
          ...mockScenarios[mockIndex],
          ...finalUpdateData
        };
        
        // Update the mock array
        mockScenarios[mockIndex] = updatedScenario;
        
        return NextResponse.json({
          ...updatedScenario,
          note: 'Using mock data - database update failed'
        });
      }
      
      throw dbError;
    }
  } catch (error) {
    console.error('Error in PUT scenario:', error);
    return NextResponse.json({ error: 'Failed to update scenario' }, { status: 500 });
  }
}

// DELETE a scenario
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getSession(request);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const id = params.id;
    
    try {
      // Connect to database with company code
      const user = session.user as TokenPayload;
      if (!user.companyCode) {
        throw new Error('Company code is required');
      }
      
      await connectToMongoDB(user.companyCode);
      if (!mongoose.connection?.db) {
        throw new Error('Failed to connect to database');
      }
      const db = mongoose.connection.db;
      
      // Check if scenario exists and belongs to user
      let scenario;
      try {
        scenario = await db.collection('simulationScenarios').findOne({
          _id: new mongoose.Types.ObjectId(id) as any,
          userId: user.id
        });
      } catch (idError) {
        // If ObjectId conversion fails, try as string ID
        scenario = await db.collection('simulationScenarios').findOne({
          id: id,
          userId: user.id
        });
      }
      
      if (!scenario) {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
      }
      
      // Protect system templates
      if (scenario.isTemplate && scenario.userId === 'system') {
        return NextResponse.json({ 
          error: 'Cannot delete system templates' 
        }, { status: 403 });
      }
      
      // Check ownership
      if (scenario.userId !== session.user.id) {
        return NextResponse.json({ 
          error: 'Not authorized to delete this scenario' 
        }, { status: 403 });
      }
      
      // Delete the scenario
      await db.collection('simulationScenarios').deleteOne({
        _id: new mongoose.Types.ObjectId(id)
      });
      
      return NextResponse.json({ 
        message: 'Scenario deleted successfully'
      });
    } catch (dbError) {
      console.error('Database error on delete:', dbError);
      
      // In development, simulate a successful delete with mock data
      if (process.env.NODE_ENV === 'development') {
        const mockIndex = mockScenarios.findIndex(s => s.id === id);
        
        if (mockIndex === -1) {
          return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
        }
        
        // For mock, we'd just remove it from our array
        mockScenarios.splice(mockIndex, 1);
        
        return NextResponse.json({
          message: 'Scenario deleted successfully',
          note: 'Using mock data - database delete failed'
        });
      }
      
      throw dbError;
    }
  } catch (error) {
    console.error('Error in DELETE scenario:', error);
    return NextResponse.json({ error: 'Failed to delete scenario' }, { status: 500 });
  }
} 