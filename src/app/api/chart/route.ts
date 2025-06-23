import { NextRequest, NextResponse } from 'next/server';

// Define backend API URL based on environment
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    // Get authentication token from cookies or headers
    const token = request.cookies.get('auth_token')?.value || 
                  request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Forward the request to the backend API
    const response = await fetch(`${BACKEND_API_URL}/chart`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Check if the response is OK
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch organization chart' },
        { status: response.status }
      );
    }
    
    // Get the response data
    const chartData = await response.json();
    
    // Transform the data to the format expected by the OrgChart component if needed
    const transformedData = transformChartData(chartData);
    
    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error in chart API route:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// Function to transform the backend chart data to the format expected by the OrgChart component
function transformChartData(chartData: any) {
  // The backend returns a structure with root_nodes and stress_zones
  if (!chartData || !chartData.root_nodes || !chartData.root_nodes.length) {
    return {
      id: 'root',
      name: 'No data',
      role: 'CEO',
      workload: 0,
      children: []
    };
  }
  
  // Start with the first root node (typically the CEO)
  const rootNode = chartData.root_nodes[0];
  
  // Transform the node and its children
  return transformNode(rootNode);
}

// Helper function to transform a single node and its children recursively
function transformNode(node: any) {
  return {
    id: node.id.toString(),
    name: node.name,
    role: node.role,
    department: node.tier <= 2 ? 'Management' : undefined, // Set department based on tier
    workload: calculateWorkloadPercentage(node),
    skills: node.skills || [],
    children: Array.isArray(node.children) ? node.children.map(transformNode) : []
  };
}

// Helper function to calculate workload percentage
function calculateWorkloadPercentage(node: any) {
  // If stress_level is between -1 and 1, convert to percentage (0-100)
  if (typeof node.stress_level === 'number') {
    // Convert from -1 to 1 scale to 0 to 100 scale
    // -1 = 0%, 0 = 50%, 1 = 100%
    return Math.round((node.stress_level + 1) * 50);
  }
  
  // Fallback if stress_level is not available
  return node.workload_hours ? Math.min(100, Math.round((node.workload_hours / 40) * 100)) : 50;
} 