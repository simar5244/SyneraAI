import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import connectToDatabase from '@/lib/dbConnect';
import SimulationResult from '@/models/SimulationResult';
import { v4 as uuidv4 } from 'uuid';

// Define simulation types and interfaces
type SimulationType = 'attrition' | 'reorganization' | 'growth' | 'cost_reduction';

interface SimulationRequest {
  name: string;
  description?: string;
  type: SimulationType;
  parameters?: any;
  saveResults?: boolean;
}

interface MetricScore {
  name: string;
  score: number;
  change: number;
  impact: 'positive' | 'negative' | 'neutral';
}

interface DepartmentImpact {
  name: string;
  impact: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  notes: string;
}

interface EmployeeImpact {
  id: string;
  name: string;
  position: string;
  impact: number;
  reason: string;
}

interface SimulationRecommendation {
  title: string;
  description: string;
  implementationEffort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  timeline: string;
}

interface SimulationResult {
  id: string;
  name: string;
  description: string;
  type: SimulationType;
  parameters: any;
  createdAt: string;
  metrics: MetricScore[];
  departmentImpacts: DepartmentImpact[];
  employeeImpacts: EmployeeImpact[];
  recommendations: SimulationRecommendation[];
  summary: string;
}

// Function to generate mock simulation results
function generateMockResults(request: SimulationRequest): SimulationResult {
  const now = new Date();
  let metrics: MetricScore[] = [];
  let departmentImpacts: DepartmentImpact[] = [];
  let employeeImpacts: EmployeeImpact[] = [];
  let recommendations: SimulationRecommendation[] = [];
  let summary = '';

  // Generate results based on simulation type
  switch (request.type) {
    case 'attrition':
      metrics = [
        {
          name: "Employee Retention",
          score: 68,
          change: -7,
          impact: "negative"
        },
        {
          name: "Team Morale",
          score: 72,
          change: -5,
          impact: "negative"
        },
        {
          name: "Recruitment Cost",
          score: 125000,
          change: 32000,
          impact: "negative"
        },
        {
          name: "Knowledge Retention",
          score: 64,
          change: -8,
          impact: "negative"
        }
      ];
      
      departmentImpacts = [
        {
          name: "Engineering",
          impact: -12,
          sentiment: "negative",
          notes: "Higher than average turnover expected in senior positions. Potential knowledge gaps in key systems."
        },
        {
          name: "Sales",
          impact: -8,
          sentiment: "negative",
          notes: "Moderate impact, mainly in mid-level positions. Client relationships generally stable."
        },
        {
          name: "Marketing",
          impact: -5,
          sentiment: "neutral",
          notes: "Expected turnover within normal range. Some impact on campaign continuity."
        },
        {
          name: "Customer Support",
          impact: -15,
          sentiment: "negative",
          notes: "Significant impact on service quality and response times if not addressed."
        }
      ];
      
      employeeImpacts = [
        {
          id: uuidv4(),
          name: "Senior Developers",
          position: "Engineering",
          impact: -18,
          reason: "High market demand and competitive compensation packages elsewhere."
        },
        {
          id: uuidv4(),
          name: "Project Managers",
          position: "Operations",
          impact: -12,
          reason: "Work-life balance concerns and burnout risk."
        },
        {
          id: uuidv4(),
          name: "Customer Support Representatives",
          position: "Support",
          impact: -14,
          reason: "Limited growth opportunities and high workload."
        }
      ];
      
      recommendations = [
        {
          title: "Implement Retention Program",
          description: "Develop a targeted retention program for high-risk roles including competitive salary adjustments, career development plans, and recognition initiatives.",
          implementationEffort: "medium",
          impact: "high",
          timeline: "3-6 months"
        },
        {
          title: "Knowledge Transfer Initiative",
          description: "Create a structured knowledge transfer process to capture critical information from departing employees and implement a mentorship program.",
          implementationEffort: "medium",
          impact: "high",
          timeline: "2-4 months"
        },
        {
          title: "Improve Work-Life Balance",
          description: "Review workload distribution, implement flexible work arrangements, and provide better support for high-pressure roles.",
          implementationEffort: "medium",
          impact: "high",
          timeline: "1-3 months"
        },
        {
          title: "Career Progression Framework",
          description: "Develop clearer career progression pathways, especially for technical and support roles with limited upward mobility.",
          implementationEffort: "high",
          impact: "high",
          timeline: "6-12 months"
        }
      ];
      
      summary = "The attrition simulation indicates concerning trends, particularly in engineering and customer support departments. Without intervention, the organization is likely to experience significant knowledge loss, higher recruitment costs, and potential service disruptions. Senior technical roles and customer support positions are at highest risk. Implementing a targeted retention strategy focusing on competitive compensation, knowledge transfer, and improved work-life balance could significantly mitigate these impacts.";
      
      break;

    case 'reorganization':
      metrics = [
        {
          name: "Operational Efficiency",
          score: 78,
          change: 12,
          impact: "positive"
        },
        {
          name: "Decision Speed",
          score: 82,
          change: 15,
          impact: "positive"
        },
        {
          name: "Employee Satisfaction",
          score: 68,
          change: -8,
          impact: "negative"
        },
        {
          name: "Communication Effectiveness",
          score: 74,
          change: 9,
          impact: "positive"
        }
      ];
      
      departmentImpacts = [
        {
          name: "Product Development",
          impact: 14,
          sentiment: "positive",
          notes: "Streamlined approval processes and clearer responsibilities accelerate development cycles."
        },
        {
          name: "Operations",
          impact: 18,
          sentiment: "positive",
          notes: "Reduced redundancies and improved resource allocation significantly enhance operational efficiency."
        },
        {
          name: "Middle Management",
          impact: -10,
          sentiment: "negative",
          notes: "Role uncertainty and possible redundancies create tension and resistance."
        },
        {
          name: "Customer Service",
          impact: 8,
          sentiment: "positive",
          notes: "Better alignment with product teams improves response quality and resolution times."
        }
      ];
      
      employeeImpacts = [
        {
          id: uuidv4(),
          name: "Department Directors",
          position: "Executive",
          impact: 12,
          reason: "Clearer decision authority and more streamlined reporting structure."
        },
        {
          id: uuidv4(),
          name: "Middle Managers",
          position: "Management",
          impact: -14,
          reason: "Flattened hierarchy reduces positions and changes responsibilities."
        },
        {
          id: uuidv4(),
          name: "Individual Contributors",
          position: "Various",
          impact: 9,
          reason: "More direct access to leadership and clearer career paths."
        }
      ];
      
      recommendations = [
        {
          title: "Phased Implementation Approach",
          description: "Implement the reorganization in defined phases with clear milestones and feedback cycles to minimize disruption and allow for adjustments.",
          implementationEffort: "medium",
          impact: "high",
          timeline: "6-9 months"
        },
        {
          title: "Middle Management Transition Plan",
          description: "Develop specific transition plans for affected middle managers, including reskilling opportunities, lateral moves, and clear communication.",
          implementationEffort: "high",
          impact: "high",
          timeline: "3-6 months"
        },
        {
          title: "Enhanced Change Communication",
          description: "Implement a comprehensive change management communication strategy with regular updates, Q&A sessions, and transparent messaging about the reasons and benefits.",
          implementationEffort: "medium",
          impact: "high",
          timeline: "1-8 months"
        },
        {
          title: "Leadership Development Program",
          description: "Provide training for leaders at all levels to effectively manage larger teams and broader responsibilities under the new structure.",
          implementationEffort: "medium",
          impact: "high",
          timeline: "3-9 months"
        }
      ];
      
      summary = "The reorganization simulation indicates significant potential improvements in operational efficiency, decision-making speed, and overall organizational agility. Product development and operations departments stand to benefit most from clearer responsibilities and streamlined processes. However, there are notable concerns regarding middle management disruption and initial employee satisfaction. A carefully phased implementation with dedicated support for affected managers, clear communication, and leadership development will be crucial to achieving the projected benefits while minimizing organizational friction and resistance.";
      
      break;

    case 'growth':
      metrics = [
        {
          name: "Revenue Growth",
          score: 28,
          change: 28,
          impact: "positive"
        },
        {
          name: "Market Share",
          score: 18,
          change: 7,
          impact: "positive"
        },
        {
          name: "Operational Capacity",
          score: 65,
          change: -15,
          impact: "negative"
        },
        {
          name: "Talent Requirements",
          score: 42,
          change: 42,
          impact: "neutral"
        }
      ];
      
      departmentImpacts = [
        {
          name: "Sales",
          impact: 35,
          sentiment: "positive",
          notes: "Significant expansion opportunity but requires rapid scaling of team and resources."
        },
        {
          name: "Product Development",
          impact: 24,
          sentiment: "positive",
          notes: "Increased demand for new features and market-specific adaptations."
        },
        {
          name: "Operations",
          impact: -18,
          sentiment: "negative",
          notes: "Current capacity insufficient to handle projected growth; substantial investment needed."
        },
        {
          name: "Human Resources",
          impact: -12,
          sentiment: "negative",
          notes: "Hiring and onboarding infrastructure will be strained by rapid expansion needs."
        }
      ];
      
      employeeImpacts = [
        {
          id: uuidv4(),
          name: "Sales Team",
          position: "Sales",
          impact: 25,
          reason: "Expanded territories and opportunities, but increased performance pressure."
        },
        {
          id: uuidv4(),
          name: "Product Managers",
          position: "Product",
          impact: 18,
          reason: "Greater product influence and budget, but increased complexity and expectations."
        },
        {
          id: uuidv4(),
          name: "Operations Staff",
          position: "Operations",
          impact: -15,
          reason: "Workload will increase significantly before additional resources are fully onboarded."
        }
      ];
      
      recommendations = [
        {
          title: "Operations Scaling Plan",
          description: "Develop a comprehensive operations scaling strategy with infrastructure investments, process automation, and headcount increases planned ahead of revenue growth.",
          implementationEffort: "high",
          impact: "high",
          timeline: "3-6 months"
        },
        {
          title: "Accelerated Recruitment Strategy",
          description: "Implement an accelerated talent acquisition program focusing on key growth-limiting roles, including referral bonuses, improved employer branding, and recruitment process optimization.",
          implementationEffort: "medium",
          impact: "high",
          timeline: "1-3 months"
        },
        {
          title: "Product Localization Framework",
          description: "Establish a systematic approach to product localization and market-specific feature development to efficiently address new market requirements.",
          implementationEffort: "medium",
          impact: "high",
          timeline: "2-4 months"
        },
        {
          title: "Cross-functional Growth Teams",
          description: "Create dedicated cross-functional teams aligned to specific growth initiatives to improve coordination and reduce organizational friction during expansion.",
          implementationEffort: "medium",
          impact: "high",
          timeline: "1-2 months"
        }
      ];
      
      summary = "The growth simulation projects substantial revenue expansion and market share gains, with particularly positive impacts for sales and product development departments. However, the current operational capacity and talent acquisition infrastructure will be significant constraints if not addressed proactively. Operations and HR departments will experience considerable strain during the growth phase. Implementing a proactive operations scaling plan, accelerated recruitment strategy, and cross-functional growth teams will be essential to capitalizing on the growth opportunity while minimizing operational disruptions and employee burnout.";
      
      break;

    case 'cost_reduction':
      metrics = [
        {
          name: "Annual Cost Savings",
          score: 2800000,
          change: 2800000,
          impact: "positive"
        },
        {
          name: "Operational Efficiency",
          score: 82,
          change: 12,
          impact: "positive"
        },
        {
          name: "Employee Morale",
          score: 58,
          change: -22,
          impact: "negative"
        },
        {
          name: "Service Quality",
          score: 72,
          change: -8,
          impact: "negative"
        }
      ];
      
      departmentImpacts = [
        {
          name: "IT & Infrastructure",
          impact: 25,
          sentiment: "positive",
          notes: "Significant savings through cloud migration and vendor consolidation with minimal service impact."
        },
        {
          name: "Operations",
          impact: 18,
          sentiment: "positive",
          notes: "Process automation and workflow optimization reduce costs while improving throughput."
        },
        {
          name: "Administrative Support",
          impact: -14,
          sentiment: "negative",
          notes: "Headcount reduction will impact service levels and increase workload for remaining staff."
        },
        {
          name: "Customer Support",
          impact: -12,
          sentiment: "negative",
          notes: "Efficiency measures may impact response times and resolution quality initially."
        }
      ];
      
      employeeImpacts = [
        {
          id: uuidv4(),
          name: "Administrative Staff",
          position: "Administration",
          impact: -22,
          reason: "Potential position eliminations and increased workload for remaining staff."
        },
        {
          id: uuidv4(),
          name: "IT Operations",
          position: "IT",
          impact: 15,
          reason: "Shift to more strategic work as routine tasks are automated or outsourced."
        },
        {
          id: uuidv4(),
          name: "Middle Management",
          position: "Various",
          impact: -18,
          reason: "Flattening organizational structure will reduce management positions."
        }
      ];
      
      recommendations = [
        {
          title: "Strategic Technology Investment",
          description: "Invest in strategic automation and workflow technologies to reduce manual work while improving process quality and consistency.",
          implementationEffort: "high",
          impact: "high",
          timeline: "6-12 months"
        },
        {
          title: "Vendor Consolidation Program",
          description: "Implement a systematic vendor consolidation initiative to leverage economies of scale and reduce administrative overhead.",
          implementationEffort: "medium",
          impact: "high",
          timeline: "3-6 months"
        },
        {
          title: "Transparent Change Communication",
          description: "Develop a comprehensive change management and communication plan that clearly explains the rationale and benefits of cost optimization initiatives.",
          implementationEffort: "low",
          impact: "high",
          timeline: "1-2 months"
        },
        {
          title: "Employee Transition Support",
          description: "Provide robust support for affected employees, including reskilling opportunities, placement assistance, and fair severance packages.",
          implementationEffort: "medium",
          impact: "high",
          timeline: "3-9 months"
        }
      ];
      
      summary = "The cost reduction simulation indicates potential annual savings of $2.8 million, primarily through technology optimization, vendor consolidation, and operational efficiency improvements. IT and Operations departments show the most favorable outcomes, while Administrative Support and Customer Service face more challenges. Employee morale and service quality metrics show concerning negative trends that must be managed. Strategic technology investments, vendor consolidation, transparent communication, and strong employee transition support will be crucial to achieving the financial benefits while maintaining organizational health and service standards.";
      
      break;

    default:
      summary = "Simulation completed, but the simulation type was not recognized. Please select a valid simulation type.";
  }

  return {
    id: uuidv4(),
    name: request.name,
    description: request.description || '',
    type: request.type,
    parameters: request.parameters || {},
    createdAt: now.toISOString(),
    metrics,
    departmentImpacts,
    employeeImpacts,
    recommendations,
    summary
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const data: SimulationRequest = await request.json();
    
    // Validate request
    if (!data.name || !data.type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let result: SimulationResult;

    try {
      // Connect to database
      await connectToDatabase();
      
      // TODO: In a production system, we would run actual simulation logic here
      // For now, we'll generate mock results
      result = generateMockResults(data);
      
      // Save simulation result if requested
      if (data.saveResults) {
        await SimulationResult.create({
          name: result.name,
          description: result.description,
          type: result.type,
          parameters: result.parameters,
          createdBy: session.user.id,
          metrics: result.metrics,
          departmentImpacts: result.departmentImpacts,
          employeeImpacts: result.employeeImpacts,
          recommendations: result.recommendations,
          summary: result.summary,
        });
      }
    } catch (error) {
      console.error('Database operation failed:', error);
      // Fall back to mock results if database operations fail
      result = generateMockResults(data);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json({ error: 'Failed to run simulation' }, { status: 500 });
  }
}