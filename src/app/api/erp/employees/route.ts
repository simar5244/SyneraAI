import { NextRequest, NextResponse } from 'next/server';

// In a real application, this would come from a database or ERP integration
// Here we're using mock data for demonstration
const MOCK_EMPLOYEE_DATA = {
  employees: [
    {
      id: '1',
      name: 'John Smith',
      role: 'CEO',
      department: 'Executive',
      workIntensity: 85,
      collaborationIntensity: 90,
      projects: ['Corporate Strategy', 'Annual Planning'],
      duties: ['Leadership', 'Vision Setting', 'Executive Management'],
      collaborators: ['2', '3', '4']
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      role: 'CTO',
      department: 'Engineering',
      workIntensity: 80,
      collaborationIntensity: 75,
      projects: ['Tech Infrastructure', 'Product Roadmap'],
      duties: ['Technology Strategy', 'Engineering Leadership'],
      managerId: '1',
      collaborators: ['1', '5', '6']
    },
    {
      id: '3',
      name: 'Michael Williams',
      role: 'CFO',
      department: 'Finance',
      workIntensity: 75,
      collaborationIntensity: 65,
      projects: ['Financial Planning', 'Investment Strategy'],
      duties: ['Financial Oversight', 'Reporting', 'Risk Management'],
      managerId: '1',
      collaborators: ['1', '4']
    },
    {
      id: '4',
      name: 'Jessica Brown',
      role: 'CMO',
      department: 'Marketing',
      workIntensity: 70,
      collaborationIntensity: 85,
      projects: ['Brand Strategy', 'Market Expansion'],
      duties: ['Marketing Strategy', 'Brand Management'],
      managerId: '1',
      collaborators: ['1', '3']
    },
    {
      id: '5',
      name: 'David Lee',
      role: 'Engineering Manager',
      department: 'Engineering',
      workIntensity: 90,
      collaborationIntensity: 80,
      projects: ['Platform Development', 'API Services'],
      duties: ['Team Leadership', 'Technical Architecture'],
      managerId: '2',
      collaborators: ['2', '6', '7', '8']
    },
    {
      id: '6',
      name: 'Amanda Chen',
      role: 'Product Manager',
      department: 'Engineering',
      workIntensity: 85,
      collaborationIntensity: 95,
      projects: ['Mobile App', 'Web Platform'],
      duties: ['Product Strategy', 'User Experience'],
      managerId: '2',
      collaborators: ['2', '5', '7', '8']
    },
    {
      id: '7',
      name: 'James Wilson',
      role: 'Senior Developer',
      department: 'Engineering',
      workIntensity: 95,
      collaborationIntensity: 70,
      projects: ['Backend Services', 'Data Processing'],
      duties: ['Code Development', 'System Design'],
      managerId: '5',
      collaborators: ['5', '6', '8']
    },
    {
      id: '8',
      name: 'Emily Davis',
      role: 'UX Designer',
      department: 'Engineering',
      workIntensity: 75,
      collaborationIntensity: 90,
      projects: ['User Interface', 'Design System'],
      duties: ['User Research', 'Prototyping'],
      managerId: '5',
      collaborators: ['5', '6', '7']
    },
    {
      id: '9',
      name: 'Robert Garcia',
      role: 'Sales Director',
      department: 'Sales',
      workIntensity: 80,
      collaborationIntensity: 85,
      projects: ['Sales Strategy', 'Enterprise Accounts'],
      duties: ['Sales Team Management', 'Revenue Growth'],
      managerId: '1',
      collaborators: ['10', '11', '1']
    },
    {
      id: '10',
      name: 'Lisa Martinez',
      role: 'Account Executive',
      department: 'Sales',
      workIntensity: 85,
      collaborationIntensity: 70,
      projects: ['Enterprise Accounts', 'Client Retention'],
      duties: ['Client Relationships', 'Sales Negotiations'],
      managerId: '9',
      collaborators: ['9', '11']
    },
    {
      id: '11',
      name: 'Kevin Thompson',
      role: 'Sales Representative',
      department: 'Sales',
      workIntensity: 75,
      collaborationIntensity: 65,
      projects: ['Lead Generation', 'SMB Accounts'],
      duties: ['Prospecting', 'Client Demos'],
      managerId: '9',
      collaborators: ['9', '10']
    },
    {
      id: '12',
      name: 'Michelle Rodriguez',
      role: 'HR Director',
      department: 'HR',
      workIntensity: 65,
      collaborationIntensity: 90,
      projects: ['Talent Management', 'Employee Engagement'],
      duties: ['HR Strategy', 'Organizational Development'],
      managerId: '1',
      collaborators: ['1', '13']
    },
    {
      id: '13',
      name: 'Daniel Kim',
      role: 'Recruiter',
      department: 'HR',
      workIntensity: 70,
      collaborationIntensity: 75,
      projects: ['Technical Hiring', 'Onboarding'],
      duties: ['Candidate Sourcing', 'Interviews'],
      managerId: '12',
      collaborators: ['12']
    },
    {
      id: '14',
      name: 'Jennifer Foster',
      role: 'Marketing Specialist',
      department: 'Marketing',
      workIntensity: 75,
      collaborationIntensity: 70,
      projects: ['Content Strategy', 'Social Media'],
      duties: ['Content Creation', 'Campaign Management'],
      managerId: '4',
      collaborators: ['4', '15']
    },
    {
      id: '15',
      name: 'Thomas Wright',
      role: 'Digital Analyst',
      department: 'Marketing',
      workIntensity: 80,
      collaborationIntensity: 65,
      projects: ['Analytics', 'Performance Tracking'],
      duties: ['Data Analysis', 'Reporting'],
      managerId: '4',
      collaborators: ['4', '14']
    }
  ]
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connectionId');
    
    // In a real app, validate the connection ID
    if (!connectionId) {
      return NextResponse.json(
        { success: false, message: 'Missing connection ID' },
        { status: 400 }
      );
    }
    
    // In a real app, fetch data from the connected ERP system
    // For demo purposes, we'll return mock data
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return NextResponse.json({
      success: true,
      data: MOCK_EMPLOYEE_DATA
    });
    
  } catch (error) {
    console.error('Error fetching employee data:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
} 