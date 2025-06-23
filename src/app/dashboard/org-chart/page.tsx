'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  Panel,
  BackgroundVariant,
  MiniMap
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FaSearch, FaPlus, FaFilter, FaExpandAlt, FaUserPlus, FaTrash, FaEdit, FaSyncAlt, FaCamera, FaTimes, FaUndo, FaRobot } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { toast } from "@/components/ui/use-toast";

// Import types from ReactFlow
import type { Node, Edge, ReactFlowInstance } from 'reactflow';

// Type definition for employee data
interface EmployeeData {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  utilization?: number;
  jobResponsibilities?: Array<{ duty?: string }>;
  jobDuties?: Array<{ duty?: string }>;
  jobTitle?: string;
  [key: string]: any; // For other properties
}

// Type definition for node with employee data
interface EmployeeNode extends Node {
  data: EmployeeData;
}

// Removed dynamic imports to include components in main bundle
import EmployeeNode from './components/EmployeeNode';
import EmployeeProfile from './components/EmployeeProfile';
import CreateEmployeeModal from './components/CreateEmployeeModal';
import AIRecommendationsPanel from './components/AIRecommendationsPanel';
import RedistributionModal from './components/RedistributionModal';
import { handleEmployeeRemovalWithRedistribution } from './utils/redistribution';

// Import html2canvas for screenshot functionality
import html2canvas from 'html2canvas';

// Import layout utils
import { applyHierarchicalLayout } from './utils/layoutUtils';
import { departmentColors, getUtilizationCategory } from './utils/colorUtils';
import { buildGraph } from './utils/graphUtils';
import { getNodesById, getEdgesById } from './utils/graphUtils';

// Import UI components for the org chart
import SearchPanel from './components/SearchPanel';
import UtilizationLegend from './components/UtilizationLegend';

// Import node and edge types
import { nodeTypes, edgeTypes } from './types/flowTypes';

// Import employee score calculator functions
import { calculateUtilizationScore, calculateAttritionScore } from './utils/employeeScoreCalculator';

// Import the AddedCostPrompt component
import AddedCostPrompt from './components/AddedCostPrompt';

// Import the DeleteEmployeePrompt component
import DeleteEmployeePrompt from './components/DeleteEmployeePrompt';

// Define types for AI recommendations
interface DutyReassignment {
  duty: string;
  assignToEmployeeId: string;
}

interface AIRecommendation {
  type: 'move_employee' | 'add_employee' | 'remove_employee' | 'change_supervisor' | 'change_salary';
  employeeId?: string;
  employeeName?: string;
  fromDepartment?: string;
  toDepartment?: string;
  newSupervisorId?: string;
  newJobTitle?: string;
  newSalary?: number;
  currentSalary?: number;
  recommendedSalary?: number;
  dutyReassignments?: DutyReassignment[];
  rationale: string;
}

interface AIRecommendationResponse {
  recommendations: AIRecommendation[];
}

// Function to redistribute workload when adding/removing employees
const redistributeWorkload = (
  allNodes: Node[], 
  allEdges: Edge[],
  removedNodeId?: string, 
  addedNodeId?: string, 
  newManagerId?: string
): Node[] => {
  // If no change is happening, return original nodes
  if (!removedNodeId && !addedNodeId) return allNodes;
  
  // Deep clone nodes to avoid side effects
  const nodes = JSON.parse(JSON.stringify(allNodes));
  
  // Case 1: Removing an employee - redistribute their workload
  if (removedNodeId) {
    const removedNode = nodes.find((n: Node) => n.id === removedNodeId);
    if (!removedNode) return nodes; // Node not found
    
    // Find connections (direct reports and manager)
    const incomingEdges = allEdges.filter(e => e.target === removedNodeId);
    const outgoingEdges = allEdges.filter(e => e.source === removedNodeId);
    const managerIds = incomingEdges.map(e => e.source);
    const reportIds = outgoingEdges.map(e => e.target);
    
    // Get utilization score of removed employee
    const utilScore = removedNode.data?.utilization?.score ?? 0.8;
    
    // If no connections, no redistribution needed
    if (managerIds.length === 0 && reportIds.length === 0) return nodes;
    
    // Redistribute workload to connections
    const totalConnections = managerIds.length + reportIds.length;
    if (totalConnections > 0) {
      // Calculate workload distribution per connection
      const workloadPerConnection = (utilScore * 40) / totalConnections; // 40 hours per work week
      
      // Update each manager's utilization
      managerIds.forEach(managerId => {
        const managerIndex = nodes.findIndex((n: Node) => n.id === managerId);
        if (managerIndex >= 0) {
          const manager = nodes[managerIndex];
          const currentScore = manager.data?.utilization?.score ?? 0.8;
          // Add workload (hours / 40 hours) to current utilization
          const newScore = Math.min(currentScore + (workloadPerConnection / 40), 1.5);
          nodes[managerIndex] = {
            ...manager,
            data: {
              ...manager.data,
              utilization: {
                score: newScore,
                category: getUtilizationCategory(newScore)
              }
            }
          };
        }
      });
      
      // Update each direct report's utilization
      reportIds.forEach(reportId => {
        const reportIndex = nodes.findIndex((n: Node) => n.id === reportId);
        if (reportIndex >= 0) {
          const report = nodes[reportIndex];
          const currentScore = report.data?.utilization?.score ?? 0.8;
          // Add workload (hours / 40 hours) to current utilization
          const newScore = Math.min(currentScore + (workloadPerConnection / 40), 1.5);
          nodes[reportIndex] = {
            ...report,
            data: {
              ...report.data,
              utilization: {
                score: newScore,
                category: getUtilizationCategory(newScore)
              }
            }
          };
        }
      });
    }
  }
  
  // Case 2: Adding a new employee
  if (addedNodeId && newManagerId) {
    // New employees typically take workload away from their manager
    const managerIndex = nodes.findIndex((n: Node) => n.id === newManagerId);
    if (managerIndex >= 0) {
      const manager = nodes[managerIndex];
      const currentScore = manager.data?.utilization?.score ?? 0.8;
      
      // Calculate reduction: 10% of the manager's current utilization
      const reductionAmount = Math.min(currentScore * 0.1, 0.2);
      
      // Reduce manager's utilization (taking away work)
      const newScore = Math.max(currentScore - reductionAmount, 0.3);
      nodes[managerIndex] = {
        ...manager,
        data: {
          ...manager.data,
          utilization: {
            score: newScore,
            category: getUtilizationCategory(newScore)
          }
        }
      };
    }
  }
  
  return nodes;
};

// Create a utility function to call the Python analyzer without affecting the main database
const getUpdatedUtilizationScore = async (email: string, newDuties: any[]) => {
  try {
    // Log that we're calculating a new score but not modifying the database
    console.log(`Calculating new utilization score for ${email} with ${newDuties.length} duties`);
    
    // First get the current data for this employee from the API
    const response = await fetch(`/api/organization/employee?email=${email}`);
    
    if (!response.ok) {
      console.error(`Could not fetch employee data for ${email}`);
      return null;
    }
    
    const employeeData = await response.json();
    
    // Add the new duties to the employee data for analysis
    const dataForAnalysis = {
      ...employeeData,
      // Ensure job_intensity_analysis exists
      job_intensity_analysis: employeeData.job_intensity_analysis || { 
        duties: [],
        overall_intensity: 0 
      }
    };
    
    // Add the new duties to the existing ones
    dataForAnalysis.job_intensity_analysis.duties = [
      ...(dataForAnalysis.job_intensity_analysis.duties || []),
      ...newDuties
    ];
    
    // Call a special API endpoint that will analyze but not save to DB
    const analysisResponse = await fetch('/api/organization/analyze-utilization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        employee: dataForAnalysis,
        simulationOnly: true
      }),
    });
    
    if (!analysisResponse.ok) {
      console.error('Failed to analyze utilization');
      return null;
    }
    
    const result = await analysisResponse.json();
    return result.utilization_score || null;
  } catch (error) {
    console.error('Error calculating utilization:', error);
    return null;
  }
};

// Update the calculateCustomRedistribution function
const calculateCustomRedistribution = (
  removedEmployeeData: EmployeeData,
  successors: Array<{ id: string; email: string }>,
  nodes: EmployeeNode[]
) => {
  // Get the duties from the removed employee
  const duties = removedEmployeeData.jobResponsibilities || removedEmployeeData.jobDuties || [];
  
  // If no duties or no successors, return empty result
  if (duties.length === 0 || successors.length === 0) {
    return {};
  }
  
  // Create a map to store duties per successor
  const dutiesPerSuccessor: Record<string, Array<{ duty: string; hours: number }>> = {};
  
  // Distribute duties evenly among successors
  duties.forEach((duty, index) => {
    const successorIndex = index % successors.length;
    const successorId = successors[successorIndex].id;
    
    if (!dutiesPerSuccessor[successorId]) {
      dutiesPerSuccessor[successorId] = [];
    }
    
    if (typeof duty === 'object' && duty !== null && 'duty' in duty) {
      dutiesPerSuccessor[successorId].push({
        duty: duty.duty || '',
        hours: (duty as any).hours || 5
      });
    }
  });
  
  return dutiesPerSuccessor;
};

// Helper function to save redistributed duties to MongoDB
const saveRedistributedDutiesToDB = async (successorEmail: string, newDuties: any[]) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/organization/duties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email: successorEmail,
        duties: newDuties
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update duties for ${successorEmail}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error saving redistributed duties for ${successorEmail}:`, error);
    throw error;
  }
};

const OrganizationChartPage = () => {
  // No need for useToast hook, use the imported toast function directly
  
  // Flow states
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  
  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  // 'all' means show all departments
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showEmployeeProfile, setShowEmployeeProfile] = useState(false);
  
  // Redistribution states
  const [showRedistributionModal, setShowRedistributionModal] = useState(false);
  const [employeeToRemove, setEmployeeToRemove] = useState<any>(null);
  const [redistributionState, setRedistributionState] = useState<{
    isOpen: boolean;
    employee: any;
    availableEmployees: any[];
    employeeToRemoveEmail: string | null;
  }>({
    isOpen: false,
    employee: null,
    availableEmployees: [],
    employeeToRemoveEmail: null
  });
  
  const orgChartRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter();
  
  // Memoize defaultEdgeOptions to prevent unnecessary re-renders
  const defaultEdgeOptionsMemo = useMemo(() => ({
    type: 'step',
    style: { stroke: '#888', strokeWidth: 1.5 },
    markerEnd: {
      type: 'arrow',
      width: 15,
      height: 15,
      color: '#888',
    }
  }), []); // Empty dependency array means it's created only once
  
  // Memoize node and edge types to prevent unnecessary re-renders
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  const memoizedEdgeTypes = useMemo(() => edgeTypes, []);
  
  // Add a timestamp to track redistribution
  const [lastRedistributionTime, setLastRedistributionTime] = useState<number>(0);
  const REDISTRIBUTION_FREEZE_PERIOD = 30000; // 30 seconds freeze on MongoDB fetches after redistribution
  
  // Add a global function to check if we should block MongoDB data updates
  const shouldBlockMongoDBUpdates = () => {
    const timeSinceRedistribution = Date.now() - lastRedistributionTime;
    const shouldBlock = timeSinceRedistribution < REDISTRIBUTION_FREEZE_PERIOD;
    if (shouldBlock) {
      console.log(`BLOCKING MongoDB updates - only ${Math.round(timeSinceRedistribution/1000)}s since redistribution (need ${REDISTRIBUTION_FREEZE_PERIOD/1000}s)`);
    }
    return shouldBlock;
  };
  
  // Load organization data and utilization data
  useEffect(() => {
    const loadData = async () => {
      await fetchOrganizationData();
      // Fetch utilization data after organization data is loaded
      await fetchUtilizationData();
    };
    
    loadData();
  }, []);
  
  // Add keyboard event listener for delete key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' && selectedEmployee) {
        handleRemoveEmployee(selectedEmployee.email);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedEmployee]);
  
  // Update the fetchUtilizationData function to block MongoDB fetches after redistribution
  const fetchUtilizationData = async (preserveUpdatedNodes = false) => {
    // Block utilization data fetch if we just completed a redistribution
    if (shouldBlockMongoDBUpdates()) {
      console.log(`Skipping utilization data fetch - too soon after redistribution`);
      return;
    }

    try {
      console.log("Fetching utilization data from MongoDB...");
      let response = await fetch('/api/organization/utilization');
      
      if (!response.ok) {
        console.warn('Failed to fetch from utilization API, generating default values');
        // If API fails, generate some default utilization values based on existing nodes
        const defaultUtilization = {
          employees: Object.fromEntries(
            nodes.map(node => [
              node.id, 
              { 
                score: Math.random() * 1.3,  // Random score between 0-1.3
                category: 'default',
                attritionRisk: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
              }
            ])
          ),
          timestamp: new Date().toISOString()
        };
        
        // Update nodes with generated utilization data
        setNodes(nodes => nodes.map(node => {
          const utilData = defaultUtilization.employees[node.id];
          return {
            ...node,
            data: {
              ...node.data,
              utilization: {
                score: utilData?.score || 0.5,
                category: getUtilizationCategory(utilData?.score || 0.5)
              },
              attritionRisk: utilData?.attritionRisk || 'low'
            }
          };
        }));
        
        return;
      }
      
      const data = await response.json();
      
      // Debug log to understand the structure of the utilization data
      console.log('Utilization data structure example:', 
        Object.keys(data.employees).length > 0 
          ? JSON.stringify(data.employees[Object.keys(data.employees)[0]], null, 2) 
          : 'No employees data');
      
      console.log('Received utilization data from MongoDB:', data);
      
      // Get the list of removed employee emails to filter them out
      const removedEmployeeEmail = redistributionState.employeeToRemoveEmail;
      
      // Update nodes with utilization data from MongoDB
      setNodes(nodes => nodes.map((node) => {
        // Skip updating nodes for removed employees
        if (removedEmployeeEmail && node.data?.email === removedEmployeeEmail) {
          console.log(`Skipping utilization update for removed employee: ${node.data.email}`);
          return node;
        }
        
        // Find utilization data for this employee
        const employeeUtil = data.employees[node.id];
        
        // If we're preserving updated nodes and this node has recently updated utilization data,
        // don't overwrite it with MongoDB data
        if (preserveUpdatedNodes && node.data?.utilization?.pendingAnalysis) {
          console.log(`Preserving recently updated utilization data for ${node.id}`);
          return node;
        }
        
        if (employeeUtil) {
          console.log(`Found utilization data for ${node.id}:`, employeeUtil);
          
          // Ensure we have valid data
          const utilScore = typeof employeeUtil.score === 'number' ? employeeUtil.score : 0.5;
          const attritionRisk = employeeUtil.attritionRisk || 'low';
          
          // Get job duties from database - check all possible field names based on MongoDB schema
          // First check if we have jobResponsibilities from MongoDB schema
          const jobDuties = employeeUtil.jobResponsibilities || 
                            employeeUtil.jobDuties || 
                            employeeUtil.job_duties || 
                            node.data.jobResponsibilities || 
                            [];
          
          // Map the job duties to the format expected by the calculator if needed
          const formattedDuties = jobDuties.map((duty: any) => {
            // Check if duty is in the MongoDB format or our internal format
            if (duty.duty && duty.hours !== undefined) {
              return {
                duty: duty.duty,
                hours: duty.hours,
                tools: duty.tools || ''
              };
            }
            return duty;
          });
          
          console.log(`Job duties for ${node.id}:`, formattedDuties);
          
          // Generate calculated values (raw scores) based on job duties
          // Use the employee score calculator for real-time calculation
          const employeeData = {
            ...node.data,
            jobTitle: node.data.jobTitle || '',
            jobDuties: formattedDuties
          };
          
          let calculatedUtilScore = utilScore;
          let calculatedAttritionRisk = attritionRisk;
          
          try {
            // Calculate real-time scores using the same calculator used for new employees
            const utilResult = calculateUtilizationScore(employeeData);
            const attrResult = calculateAttritionScore(employeeData);
            
            calculatedUtilScore = utilResult.score;
            calculatedAttritionRisk = attrResult.risk;
            
            console.log(`Calculated real-time scores for ${node.id}:`, {
              utilization: calculatedUtilScore,
              attrition: calculatedAttritionRisk
            });
          } catch (error) {
            console.error(`Error calculating scores for ${node.id}:`, error);
          }
          
          return {
            ...node,
            data: {
              ...node.data,
              utilization: {
                score: utilScore,
                category: employeeUtil.category || getUtilizationCategory(utilScore),
                sources: employeeUtil.sources,
                hoursPerWeek: employeeUtil.hoursPerWeek
              },
              // Make attrition risk available to the EmployeeNode component 
              attritionRisk: attritionRisk,
              // Add calculated (raw) values
              calculatedUtilization: {
                score: calculatedUtilScore,
                category: getUtilizationCategory(calculatedUtilScore)
              },
              calculatedAttritionRisk: calculatedAttritionRisk,
              // Add job duties using the MongoDB schema field name
              jobResponsibilities: formattedDuties
            }
          };
        }
        return node;
      }));
      
    } catch (error) {
      console.error('Error fetching utilization data:', error);
      // Don't set error state for utilization as it's supplementary data
    }
  };
  
  const fetchOrganizationData = async () => {
    // Block organization data fetch if we just completed a redistribution
    if (shouldBlockMongoDBUpdates()) {
      console.log(`Skipping organization data fetch - too soon after redistribution`);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Try to fetch from the real API endpoint first
      let response = await fetch('/api/organization/hierarchy');
      
      // If that fails, use the mock data instead
      if (!response.ok) {
        console.warn('Failed to fetch from main API, using mock data instead');
        response = await fetch('/api/organization/mock');
        
        if (!response.ok) {
          throw new Error('Failed to fetch organization data from both main and mock endpoints');
        }
      }
      
      const data = await response.json();
      
      // Check if we got valid data
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Received invalid organization data format');
      }
      
      console.log(`Loaded ${data.length} employee records`);
      
      // Extract departments
      const uniqueDepartments = Array.from(
        new Set(data.map((emp: any) => emp.department || 'Unassigned'))
      ).filter(Boolean);
      
      setDepartments(uniqueDepartments as string[]);
      
      // Transform data into nodes (email IDs)
      const initialNodes = data.map((employee: any) => ({
        id: employee.email,
        type: 'employee',
        position: { x: 0, y: 0 },
        data: { ...employee, department: employee.department || 'Unassigned' }
      }));
      
      // Build reporting edges, resolving reportsTo strings to emails
      const initialEdges = data.flatMap((employee: any) => {
        const rpt = employee.reportsTo;
        if (!rpt) return [];
        let managerEmail: string | undefined;
        if (typeof rpt === 'object') {
          // Handle object form with email or username
          managerEmail = rpt.email || rpt.username;
        }
        else if (typeof rpt === 'string') {
          if (rpt.includes('@')) {
            managerEmail = rpt;
          } else {
            const manager = data.find((e: any) =>
              e.email.split('@')[0] === rpt ||
              e.firstName?.toLowerCase() === rpt.toLowerCase() ||
              (e.firstName && e.lastName && `${e.firstName.toLowerCase()} ${e.lastName.toLowerCase()}` === rpt.toLowerCase())
            );
            managerEmail = manager?.email;
          }
        }
        if (!managerEmail) {
          console.warn('OrgChart: could not resolve reportsTo for', employee.email, rpt);
          return [];
        }
        return [{
          id: `${managerEmail}-${employee.email}`,
          source: managerEmail,
          target: employee.email,
          type: 'step',
          style: { stroke: '#888', strokeWidth: 1.5 }
        }];
      });
      
      // Apply layout algorithm to position nodes
      const layoutedNodes = applyHierarchicalLayout(
        initialNodes,
        initialEdges
      );
      
      setNodes(layoutedNodes);
      setEdges(initialEdges);
    } catch (error) {
      console.error('Error fetching organization data:', error);
      setError('Failed to load organization data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle connections between nodes
  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge(params, eds));
    setNodes((nds) => {
      const managerNode = nds.find((node) => node.id === params.source);
      const employeeNode = nds.find((node) => node.id === params.target);

      if (managerNode && employeeNode) {
        const employeeName = `${employeeNode.data.firstName || ''} ${employeeNode.data.lastName || ''}`.trim();
        if (employeeName) {
          const supervisionDuty = { duty: `Supervise ${employeeName}`, hours: 5, tools: 'Management tools' };
          const existingDuties = managerNode.data.jobResponsibilities || managerNode.data.jobDuties || [];
          const newDuties = [...existingDuties, supervisionDuty];

          return nds.map((node) => {
            if (node.id === params.source) {
              return { ...node, data: { ...node.data, jobResponsibilities: newDuties, jobDuties: newDuties } };
            }
            return node;
          });
        }
      }
      return nds;
    });
  }, [setEdges, setNodes]);

  // Update reporting structure in DB
  const updateReportingStructure = useCallback(async (sourceId: string, targetId: string) => {
    // DISABLED FOR VISUALIZATION EXPERIMENTATION
    /*
    try {
      const response = await fetch('/api/organization/reporting', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeEmail: sourceId,
          managerEmail: targetId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update reporting structure');
      }
      
      // Success - the edge is already added to the graph
    } catch (error) {
      console.error('Error updating reporting structure:', error);
      // Rollback the edge if the API call fails
      setEdges(edges => edges.filter(e => !(e.source === sourceId && e.target === targetId)));
      alert('Failed to update reporting structure. Please try again.');
    }
    */
    console.log(`VISUALIZATION ONLY: Would connect ${sourceId} to ${targetId}`);
  }, [setEdges]);
  
  // Handle node selection (click)
  const onNodeClick = useCallback((event: React.MouseEvent, clickedNode: Node) => {
    event.stopPropagation();
    const employeeNode = clickedNode as EmployeeNode;
    
    if (employeeNode && employeeNode.data) {
      setSelectedEmployee(employeeNode.data as EmployeeData);
      setShowEmployeeProfile(true);
    }
  }, []);
  
  // Search for an employee
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    const foundNode = nodes.find(node => 
      node.data.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.data.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.data.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${node.data.firstName} ${node.data.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (foundNode && reactFlowInstance) {
      // Center view on the found node
      reactFlowInstance.setCenter(
        foundNode.position.x, 
        foundNode.position.y, 
        { zoom: 1.5, duration: 800 }
      );
      
      // Highlight the found node
      setNodes(nodes.map(node => ({
        ...node,
        style: node.id === foundNode.id 
          ? { ...node.style, boxShadow: '0 0 10px 5px rgba(66, 153, 225, 0.8)' }
          : { ...node.style, boxShadow: 'none' }
      })));
      
      // Set as selected employee
      setSelectedEmployee(foundNode.data);
    } else {
      alert('No employee found with that name or email.');
    }
  };
  
  // Filter by department
  const handleDepartmentFilter = (department: string) => {
    setSelectedDepartment(department);
    
    if (department && reactFlowInstance) {
      if (department === 'all') {
        // reset highlights & view
        setNodes(nodes.map(node => ({ ...node, style: { ...node.style, opacity: 1 } })));
        reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
        return;
      }
      // Filter nodes by department
      const departmentNodes = nodes.filter(node => node.data.department === department);
      
      if (departmentNodes.length > 0) {
        // Highlight department nodes
        setNodes(nodes.map(node => ({
          ...node,
          style: {
            ...node.style,
            opacity: node.data.department === department ? 1 : 0.3,
          }
        })));
        
        // Fit view to show all department nodes
        reactFlowInstance.fitView({
          nodes: departmentNodes,
          padding: 0.2,
          duration: 800
        });
      }
    } else if (reactFlowInstance) {
      // Reset highlights
      setNodes(nodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          opacity: 1,
        }
      })));
      
      // Reset view to show all nodes
      reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
    }
  };
  
  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!orgChartRef.current) return;
    
    if (!document.fullscreenElement) {
      // Enter fullscreen
      if (orgChartRef.current.requestFullscreen) {
        orgChartRef.current.requestFullscreen()
          .then(() => {
            setIsFullscreen(true);
            // Let ReactFlow recalculate its dimensions
            setTimeout(() => {
              if (reactFlowInstance) {
                reactFlowInstance.fitView({ padding: 0.2 });
              }
            }, 100);
          })
          .catch(err => {
            console.error('Error attempting to enable fullscreen:', err);
          });
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen()
          .then(() => {
            setIsFullscreen(false);
            // Let ReactFlow recalculate its dimensions
            setTimeout(() => {
              if (reactFlowInstance) {
                reactFlowInstance.fitView({ padding: 0.2 });
              }
            }, 100);
          })
          .catch(err => {
            console.error('Error attempting to exit fullscreen:', err);
          });
      }
    }
  };
  
  // Function to remove a connection between nodes
  const handleRemoveConnection = useCallback((edgeId: string) => {
    // Get the edge to be removed - using a more reliable approach to find by ID
    // or by source-target combination if ID lookup fails
    let edge = edges.find(e => e.id === edgeId);
    
    // If edge not found by ID, try by source-target if edgeId contains a hyphen
    if (!edge && edgeId.includes('-')) {
      try {
        const [source, target] = edgeId.split('-');
        edge = edges.find(e => e.source === source && e.target === target);
      } catch (error) {
        console.error('Failed to parse edge ID:', edgeId, error);
      }
    }
    
    if (!edge) {
      console.error('Edge not found:', edgeId);
      // Fallback to just removing the edge by ID
      setEdges(prevEdges => prevEdges.filter(e => e.id !== edgeId));
      return;
    }
    
    // Get source and target nodes for logging
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) {
      console.error('Source or target node not found for edge:', edgeId);
      // Still remove the edge even if nodes not found
      setEdges(prevEdges => prevEdges.filter(e => e.id !== edgeId));
      return;
    }
    
    // Remove the edge
    setEdges(prevEdges => prevEdges.filter(e => e.id !== edgeId));
    
    // Note: No longer automatically changing utilization scores when removing connections
    
    // Log the action
    console.log(`Removed connection from ${sourceNode.data.firstName || sourceNode.data.email} ${sourceNode.data.lastName || ''} to ${targetNode.data.firstName || targetNode.data.email} ${targetNode.data.lastName || ''}`);
  }, [nodes, edges, setEdges]);
  
  // Handle edge removal and automatically remove supervision duties
  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    
    // Immediately remove the edge without confirmation
    handleRemoveConnection(edge.id);
    
    // Find the source (manager) and target (employee) nodes
    const managerNode = nodes.find(node => node.id === edge.source) as EmployeeNode | undefined;
    const employeeNode = nodes.find(node => node.id === edge.target) as EmployeeNode | undefined;
    
    // If both nodes exist, remove the supervision duty from the manager
    if (managerNode && employeeNode && managerNode.data && employeeNode.data) {
      // Get employee name
      const employeeName = `${employeeNode.data.firstName || ''} ${employeeNode.data.lastName || ''}`.trim();
      if (!employeeName) return; // Skip if no name available
      
      // Get existing duties
      const existingDuties = managerNode.data.jobResponsibilities || managerNode.data.jobDuties || [];
      
      // Filter out the supervision duty for this employee
      const updatedDuties = existingDuties.filter(
        (duty: { duty?: string }) => !(duty.duty && duty.duty.includes(`Supervise ${employeeName}`))
      );
      
      // Only update if duties actually changed
      if (updatedDuties.length !== existingDuties.length) {
        // Create updated manager data
        const updatedManager = {
          ...managerNode.data,
          id: managerNode.id,
          jobResponsibilities: updatedDuties,
          jobDuties: updatedDuties
        };
        
        // Update the manager node with removed duty
        handleUpdateEmployee(updatedManager);
        
        // Show toast notification
        toast({
          title: "Supervision Duty Removed",
          description: `Removed supervision duty for ${employeeName} from manager's responsibilities`,
          variant: "default"
        });
      }
    }
  };
  
  // Add state for tracking added/removed employees with salary
  const [addedEmployees, setAddedEmployees] = useState<Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    salary?: number;
  }>>([]);

  const [removedEmployees, setRemovedEmployees] = useState<Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    salary?: number;
  }>>([]);

  // Calculate total added cost
  const addedCost = addedEmployees.reduce((sum: number, emp) => sum + (emp.salary || 0), 0);

  // Calculate total removed cost
  const removedCost = removedEmployees.reduce((sum: number, emp) => sum + (emp.salary || 0), 0);

  // Calculate net cost
  const netCost = addedCost - removedCost;

  // Format as currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Update handleCreateEmployee to track added employees
  const handleCreateEmployee = (formData: any) => {
    console.log('Creating new employee with data:', formData);
    
    // Generate a unique ID for the new employee
    const newEmployeeId = `employee-${Date.now()}`;
    
    // Get the calculated scores from the form data or calculate them
    let utilScore = formData.calculatedUtilization?.score;
    let attritionRisk = formData.calculatedAttritionRisk;
    
    // If no calculated scores provided, calculate them from job duties
    if (utilScore === undefined || attritionRisk === undefined) {
      try {
        const utilResult = calculateUtilizationScore(formData);
        const attrResult = calculateAttritionScore(formData);
        
        utilScore = utilResult.score;
        attritionRisk = attrResult.risk;
        
        console.log('Calculated scores for new employee:', {
          utilization: utilScore,
          attrition: attritionRisk
        });
      } catch (error) {
        console.error('Error calculating scores for new employee:', error);
        utilScore = 0.5;
        attritionRisk = 'medium';
      }
    }
    
    // For new employees, comp and raw metrics should be the same
    const utilizationCategory = getUtilizationCategory(utilScore);
    
    // Create a new node for the employee
    const newNode = {
      id: newEmployeeId,
      type: 'employee', // Use the correct node type defined in flowTypes.ts
      position: { x: 100, y: 100 },
      data: {
        id: newEmployeeId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        jobTitle: formData.jobTitle,
        department: formData.department,
        managerId: formData.managerId,
        imageUrl: formData.imageUrl,
        salary: formData.salary || 0, // Store salary information
        // For new employees, comp and raw utilization should be identical
        utilization: {
          score: utilScore,
          category: utilizationCategory,
          sources: [],
          hoursPerWeek: formData.hoursPerWeek || 40
        },
        attritionRisk: attritionRisk,
        // Also store the calculated values separately (same as comp for new employees)
        calculatedUtilization: {
          score: utilScore,
          category: utilizationCategory
        },
        calculatedAttritionRisk: attritionRisk,
        // Store job duties
        jobResponsibilities: formData.jobDuties || [],
        jobDuties: formData.jobDuties || []
      }
    };
    
    console.log('Created new node:', newNode);
    
    // Add the new node to the graph
    setNodes(nodes => [...nodes, newNode]);
    
    // If a manager was selected, create an edge connecting the manager to this employee
    if (formData.managerId) {
      const newEdge = {
        id: `edge-${formData.managerId}-${newEmployeeId}`,
        source: formData.managerId,
        target: newEmployeeId,
        type: 'smoothstep'
      };
      setEdges(edges => [...edges, newEdge]);
    }
    
    // Track the added employee for cost calculation
    setAddedEmployees(prev => [...prev, {
      id: newEmployeeId,
      firstName: formData.firstName,
      lastName: formData.lastName,
      salary: parseFloat(formData.salary) || 0
    }]);
    
    // Close the form
    setShowCreateModal(false);
    
    // Show success toast
    toast({
      title: "Employee Added",
      description: `${formData.firstName} ${formData.lastName} has been added to the organization chart.`,
      variant: "default"
    });
  };
  
  // Update handleRemoveEmployee to remove supervision duties
  const handleRemoveEmployee = (email: string) => {
    console.log(`Starting removal process for employee with email: ${email}`);
    
    // Find the employee by email
    const employeeToRemove = nodes.find(node => {
      const nodeData = node.data as EmployeeData;
      return nodeData.email === email;
    });
    
    if (employeeToRemove) {
      console.log(`Found employee to remove: ${employeeToRemove.id}`);
      setEmployeeToDelete(employeeToRemove.data as EmployeeData);
      setShowDeletePrompt(true);
      setShowEmployeeProfile(false); // Hide the profile while showing delete prompt
    } else {
      console.error(`Employee with email ${email} not found`);
      toast({
        title: "Error",
        description: `Could not find employee with email: ${email}`,
        variant: "destructive"
      });
    }
  };
  
  // Add a function to manually update utilization data for successors
  const manuallyUpdateUtilization = (successors: any[], removedEmployeeEmail: string) => {
    console.log(`Manually updating utilization for ${successors.length} successors`);
    
    setNodes((nds) => {
      // Filter out the removed employee
      const nodesWithoutRemovedEmployee = nds.filter(node => node.data?.email !== removedEmployeeEmail);
      
      // Update nodes with redistribution results
      return nodesWithoutRemovedEmployee.map((node) => {
        // Find if this node is one of the successors that got updated
        const updatedSuccessor = successors.find(
          (s: any) => s.email === node.data?.email
        );
        
        if (updatedSuccessor) {
          console.log(`Manually updating utilization for ${node.data?.email} to ${updatedSuccessor.utilization.score}`);
          
          return {
            ...node,
            data: {
              ...node.data,
              utilization: {
                score: updatedSuccessor.utilization.score,
                category: updatedSuccessor.utilization.category || getUtilizationCategory(updatedSuccessor.utilization.score),
                pendingAnalysis: true  // Flag to prevent overwriting by MongoDB data fetch
              }
            }
          };
        }
        
        return node;
      });
    });
  };
  
  // Update the handleConfirmRedistribution function
  const handleConfirmRedistribution = async (selectedSuccessors: string[], redistributionResult?: any) => {
    const { employeeToRemoveEmail } = redistributionState;
    
    if (!employeeToRemoveEmail) {
      console.error("No employee email to remove");
      return;
    }
    
    console.log(`Confirming redistribution for ${employeeToRemoveEmail} to ${selectedSuccessors.length} successors`);
    console.log(`Redistribution result:`, redistributionResult);
    
    // Find the employee to be removed
    const employeeNode = nodes.find(node => node.data?.email === employeeToRemoveEmail);
    
    if (!employeeNode) {
      toast({
        title: "Error",
        description: "Employee not found.",
        variant: "destructive",
      });
      return;
    }
    
    // Get all duties to redistribute
    const employeeData = employeeNode.data;
    console.log(`Found employee to remove:`, employeeData);
    
    try {
      // Show loading toast
      toast({
        title: "Processing",
        description: "Updating organization chart...",
      });
      
      // If we don't have redistributionResult, call the API to perform redistribution
      if (!redistributionResult) {
        try {
          console.log(`Calling redistribution API for ${employeeToRemoveEmail}`);
          const response = await fetch('/api/organization/redistribute', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              removedEmployeeEmail: employeeToRemoveEmail,
              selectedSuccessors,
              duties: employeeData.jobResponsibilities || []
            }),
          });
          
          if (!response.ok) {
            console.error(`Redistribution API error: ${response.status}`);
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to redistribute duties');
          }
          
          redistributionResult = await response.json();
          console.log(`Redistribution API result:`, redistributionResult);
        } catch (apiError) {
          console.error(`Error calling redistribution API:`, apiError);
        }
      }
      
      // Always close the employee profile if it's open for the removed employee
      if (selectedEmployee && selectedEmployee.email === employeeToRemoveEmail) {
        setSelectedEmployee(null);
      }
      
      // Set the last redistribution time to block MongoDB fetches - IMPORTANT!
      const now = Date.now();
      console.log(`SETTING MONGODB BLOCK at timestamp ${now} for ${REDISTRIBUTION_FREEZE_PERIOD/1000} seconds`);
      setLastRedistributionTime(now);
      
      // Store the removed employee's email to prevent adding it back
      const removedEmployeeEmail = employeeToRemoveEmail;
      
      // Remove the employee node from the UI
      setNodes((nds) => nds.filter((n) => n.id !== employeeNode.id));
      
      // Remove all edges connected to the employee
      setEdges((eds) => eds.filter((e) => e.source !== employeeNode.id && e.target !== employeeNode.id));
      
      // If we have redistribution results, update the nodes directly instead of refreshing
      if (redistributionResult && redistributionResult.updatedSuccessors && redistributionResult.updatedSuccessors.length > 0) {
        console.log("Applying redistribution results directly to nodes...");
        
        // Create a deeply persistent version of the successor data we can reference later
        const persistentSuccessorData = JSON.parse(JSON.stringify(redistributionResult.updatedSuccessors));
        
        // Manually update successors' utilization first to ensure it's applied
        manuallyUpdateUtilization(redistributionResult.updatedSuccessors, removedEmployeeEmail);
        
        // Then update the nodes with new duties
        setNodes((nds) => {
          // Filter out the removed employee
          const nodesWithoutRemovedEmployee = nds.filter(node => node.data?.email !== removedEmployeeEmail);
          
          // Update nodes with redistribution results
          return nodesWithoutRemovedEmployee.map((node) => {
            // Find if this node is one of the successors that got updated
            const updatedSuccessor = redistributionResult.updatedSuccessors.find(
              (s: any) => s.email === node.data?.email
            );
            
            if (updatedSuccessor) {
              console.log(`Updating node for ${node.data?.email} with redistribution results. New utilization: ${updatedSuccessor.utilization.score}`);
              
              // Find duty assignments for this successor
              const dutyAssignments = redistributionResult.dutyAssignments?.filter(
                (a: any) => a.successorEmail === node.data?.email
              ) || [];
              
              // Convert duty assignments to duties
              const newDuties = dutyAssignments.map((a: any) => ({
                ...a.duty,
                redistributed: true,
                originalOwner: removedEmployeeEmail,
                dateReassigned: new Date().toISOString()
              }));
              
              // Create a merged list of duties
              const originalDuties = node.data?.jobResponsibilities || [];
              const allDuties = [...originalDuties, ...newDuties];
              
              return {
                ...node,
                data: {
                  ...node.data,
                  jobResponsibilities: allDuties,
                  job_intensity_analysis: {
                    ...(node.data.job_intensity_analysis || {}),
                    duties: allDuties
                  },
                  utilization: {
                    score: updatedSuccessor.utilization.score,
                    category: updatedSuccessor.utilization.category || getUtilizationCategory(updatedSuccessor.utilization.score),
                    pendingAnalysis: true, // Flag to prevent overwriting by MongoDB data fetch
                    lastUpdateTimestamp: Date.now() // Add timestamp to know when this was updated
                  },
                  // Store redistributed data in node to reference later
                  redistributionData: {
                    isSuccessor: true,
                    receivedDuties: newDuties.length,
                    utilScoreAfterRedistribution: updatedSuccessor.utilization.score
                  }
                }
              };
            }
            
            return node;
          });
        });
        
        // Create a recurring check to ensure utilization scores don't get overwritten
        // This will run every 2 seconds for the duration of the freeze period
        const intervalId = setInterval(() => {
          if (shouldBlockMongoDBUpdates()) {
            console.log("Running protection check to ensure redistribution changes weren't overwritten...");
            
            // Reapply successors' utilization if needed
            setNodes((nds) => {
              return nds.map((node) => {
                // Check if this node was a successor in the redistribution
                const persistentData = persistentSuccessorData.find(
                  (s: any) => s.email === node.data?.email
                );
                
                // If this was a successor and it doesn't have the correct utilization or pendingAnalysis flag
                if (persistentData && 
                    (!node.data.utilization?.pendingAnalysis || 
                     Math.abs(node.data.utilization?.score - persistentData.utilization.score) > 0.01)) {
                  
                  console.log(`FIXING OVERWRITTEN DATA: Restoring utilization for ${node.data?.email} to ${persistentData.utilization.score}`);
                  
                  // Restore the correct utilization data
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      utilization: {
                        score: persistentData.utilization.score,
                        category: persistentData.utilization.category || getUtilizationCategory(persistentData.utilization.score),
                        pendingAnalysis: true,
                        lastUpdateTimestamp: Date.now(),
                        wasRestored: true // Flag to indicate this was restored
                      }
                    }
                  };
                }
                
                return node;
              });
            });
          } else {
            // If we're past the block period, clear the interval
            clearInterval(intervalId);
          }
        }, 2000); // Check every 2 seconds
        
      } else {
        // Fall back to local update without fetching from MongoDB
        console.log("No redistribution results available, updating nodes locally...");
        
        // Update nodes and apply protected status
        setNodes((nds) => {
          // Filter out the removed employee
          return nds.filter(node => node.data?.email !== removedEmployeeEmail)
            .map(node => ({
              ...node,
              data: {
                ...node.data,
                // Add pendingAnalysis flag to prevent MongoDB overwrite
                utilization: {
                  ...(node.data.utilization || { score: 0.5 }),
                  pendingAnalysis: true, 
                  lastUpdateTimestamp: Date.now()
                }
              }
            }));
        });
      }
      
      // If redistribution result is provided, show success message with details
      if (redistributionResult) {
        const dutiesCount = redistributionResult.redistributedDuties || redistributionResult.totalDuties || 0;
        const successors = redistributionResult.updatedSuccessors || [];
        
        toast({
          title: "Success",
          description: `Removed ${employeeData.firstName} ${employeeData.lastName} and redistributed ${dutiesCount} duties to ${successors.length} successors.`,
          variant: "default",
        });
      } else {
        // Simple success toast for manual removal
        toast({
          title: "Success",
          description: `Removed ${employeeData.firstName} ${employeeData.lastName} from organization chart.`,
          variant: "default",
        });
      }
      
      // Close the modal
      setRedistributionState({
        isOpen: false,
        employee: null,
        availableEmployees: [],
        employeeToRemoveEmail: null
      });
      
      setShowRedistributionModal(false);
      
      // Apply a forced layout update to reflect changes visually
      setTimeout(() => {
        forceRelayout();
      }, 500);
      
    } catch (error) {
      console.error("Error removing employee:", error);
      toast({
        title: "Error",
        description: "Failed to remove employee from organization chart.",
        variant: "destructive",
      });
    }
  };
  
  // Function to force relayout
  const forceRelayout = () => {
    if (!reactFlowInstance) return;
    
    // Re-apply the layout algorithm
    const relayoutedNodes = applyHierarchicalLayout(
      nodes,
      edges
    );
    
    // Update nodes with the new layout
    setNodes(relayoutedNodes);
    
    // Fit view to show all nodes
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.3 });
    }, 100);
  };
  
  // Navigate to the full-screen view page
  const handleOpenFullView = () => {
    router.push('/dashboard/org-chart');
  };
  
  // Add screenshot functionality
  const handleScreenshot = () => {
    if (!orgChartRef.current) {
      alert('Could not capture screenshot. Chart element not found.');
      return;
    }

    html2canvas(orgChartRef.current, {
      useCORS: true, // Important if nodes contain external images
      backgroundColor: '#f9fafb', // Match background if needed
      scale: 2, // Increase scale for higher resolution
    }).then((canvas) => {
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = 'organization-chart.png';
      link.click();
    }).catch(err => {
      console.error('Error taking screenshot:', err);
      alert('Failed to capture screenshot.');
    });
  };
  
  // Toggle legend visibility
  const toggleLegend = () => {
    setShowLegend(!showLegend);
  };
  
  // Add a function to handle employee updates (especially job duties changes)
  const handleUpdateEmployee = (updatedEmployee: EmployeeData) => {
    console.log('Updating employee:', updatedEmployee);
    
    // Find the node for this employee - handle both ID and email matching for compatibility
    setNodes(nodes => nodes.map(node => {
      // Match by ID or by email (for preloaded employees from MongoDB)
      const nodeData = node.data as EmployeeData;
      const isMatchingNode = 
        (node.id === updatedEmployee.id) || 
        (nodeData?.email && updatedEmployee.email && nodeData.email === updatedEmployee.email);
        
      if (isMatchingNode) {
        console.log(`Found node to update: ${node.id}`);
        
        // Extract job duties from the updated employee data
        const jobDuties = updatedEmployee.jobResponsibilities || updatedEmployee.jobDuties || [];
        console.log(`Job duties for ${node.id}:`, jobDuties);
        
        // Calculate new utilization and attrition scores based on job duties
        let calculatedUtilScore = 0.5; // Default
        let calculatedAttritionRisk = 'medium'; // Default
        
        try {
          // Prepare employee data for score calculation
          const employeeDataForCalculation = {
            ...updatedEmployee,
            jobDuties: jobDuties.map((duty: { duty?: string; hours?: number; tools?: string }) => ({
              duty: duty.duty,
              hours: duty.hours || 0,
              tools: duty.tools || ''
            }))
          };
          
          // Calculate real-time scores using the employee score calculator
          const utilResult = calculateUtilizationScore(employeeDataForCalculation);
          const attrResult = calculateAttritionScore(employeeDataForCalculation);
          
          calculatedUtilScore = utilResult.score;
          calculatedAttritionRisk = attrResult.risk;
          
          console.log(`Calculated real-time scores for ${node.id}:`, {
            utilization: calculatedUtilScore,
            attrition: calculatedAttritionRisk
          });
        } catch (error) {
          console.error(`Error calculating scores for ${node.id}:`, error);
        }
        
        // Check if this is a preloaded employee (has different comp vs raw values)
        // For preloaded employees, we keep the original comp values
        // For newly added employees, we update both comp and raw values
        const isPreloadedEmployee = 
          nodeData?.utilization?.score !== nodeData?.calculatedUtilization?.score ||
          nodeData?.attritionRisk !== nodeData?.calculatedAttritionRisk;
          
        console.log(`Is preloaded employee: ${isPreloadedEmployee}`);
        
        // Create updated node data
        const updatedNodeData = {
          ...nodeData,
          ...updatedEmployee,
          // Update utilization based on employee type
          utilization: isPreloadedEmployee 
            ? {
                ...nodeData.utilization,
                pendingAnalysis: true // Mark as pending to prevent overwrite
              }
            : {
                // For newly added employees, update both comp and raw
                score: calculatedUtilScore,
                category: getUtilizationCategory(calculatedUtilScore),
                sources: nodeData.utilization?.sources || [],
                hoursPerWeek: nodeData.utilization?.hoursPerWeek || 40
              },
          // Update attrition risk based on employee type
          attritionRisk: isPreloadedEmployee 
            ? nodeData.attritionRisk 
            : calculatedAttritionRisk,
          // Always update the calculated (raw) values
          calculatedUtilization: {
            score: calculatedUtilScore,
            category: getUtilizationCategory(calculatedUtilScore)
          },
          calculatedAttritionRisk: calculatedAttritionRisk,
          // Ensure job duties are stored in both fields for compatibility
          jobDuties: jobDuties,
          jobResponsibilities: jobDuties
        };
        
        console.log(`Updated node data for ${node.id}:`, updatedNodeData);
        
        // Also update the selected employee if this is the one being viewed
        if (selectedEmployee) {
          // Check if this is the selected employee by ID or email
          const isSelectedEmployee = 
            (selectedEmployee.id === updatedEmployee.id) || 
            (selectedEmployee.email && updatedEmployee.email && selectedEmployee.email === updatedEmployee.email);
            
          if (isSelectedEmployee) {
            setSelectedEmployee({
              ...selectedEmployee,
              ...updatedEmployee,
              utilization: isPreloadedEmployee 
                ? selectedEmployee.utilization 
                : {
                    score: calculatedUtilScore,
                    category: getUtilizationCategory(calculatedUtilScore),
                    sources: selectedEmployee.utilization?.sources || [],
                    hoursPerWeek: selectedEmployee.utilization?.hoursPerWeek || 40
                  },
              attritionRisk: isPreloadedEmployee 
                ? selectedEmployee.attritionRisk 
                : calculatedAttritionRisk,
              calculatedUtilization: {
                score: calculatedUtilScore,
                category: getUtilizationCategory(calculatedUtilScore)
              },
              calculatedAttritionRisk: calculatedAttritionRisk,
              jobDuties: jobDuties,
              jobResponsibilities: jobDuties
            });
          }
        }
        
        // Return the updated node
        return {
          ...node,
          data: updatedNodeData
        } as EmployeeNode;
      }
      
      // Return unchanged node
      return node;
    }));
    
    // Show success toast
    toast({
      title: "Employee Updated",
      description: "Job duties and performance metrics updated successfully",
      variant: "default"
    });
  };
  
  // Add state for delete employee modal
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeData | null>(null);

  // Handle cancel delete
  const handleCancelDelete = () => {
    setShowDeletePrompt(false);
    setEmployeeToDelete(null);
    setShowEmployeeProfile(true); // Show the profile again
  };

  // Add state to track deleted employees with their original data and duty reassignments
  const [deletedEmployees, setDeletedEmployees] = useState<Array<{
    employeeNode: Node;
    dutyAssignments: Array<{ duty: any, assignedToEmployeeId: string }>;
    originalConnections: Edge[];
  }>>([]);

  // Handle confirm delete with duty reassignments
  const handleConfirmDelete = (employeeId: string, dutyAssignments: Array<{ duty: any, assignedToEmployeeId: string }>) => {
    if (!employeeId) {
      console.error('No employee ID provided for deletion');
      return;
    }
    
    console.log('Deleting employee:', employeeId);
    console.log('Duty assignments:', dutyAssignments);
    
    // Find the employee node by ID or email
    const employeeNode = nodes.find(node => 
      node.id === employeeId || 
      (node.data as EmployeeData).email === employeeId
    );
    
    if (!employeeNode) {
      console.error(`Could not find employee node with ID: ${employeeId}`);
      return;
    }
    
    // Check if employee is already deleted
    if ((employeeNode.data as EmployeeData).isDeleted) {
      toast({
        title: "Already Deleted",
        description: "This employee has already been marked as deleted",
        variant: "destructive"
      });
      return;
    }
    
    // Save the original connections for potential undo
    const originalConnections = edges.filter(edge => 
      edge.source === employeeNode.id || edge.target === employeeNode.id
    );
    
    // Process duty assignments - group by target employee
    const dutyAssignmentsByEmployee = new Map<string, Array<any>>();
    
    dutyAssignments.forEach(assignment => {
      if (assignment.assignedToEmployeeId && 
          assignment.assignedToEmployeeId !== 'unassigned' && 
          assignment.duty) {
        
        // Make sure we're not assigning to the employee being deleted
        if (assignment.assignedToEmployeeId === employeeId) {
          console.warn('Attempted to assign duty to employee being deleted, skipping');
          return;
        }
        
        // Group duties by target employee
        if (!dutyAssignmentsByEmployee.has(assignment.assignedToEmployeeId)) {
          dutyAssignmentsByEmployee.set(assignment.assignedToEmployeeId, []);
        }
        
        dutyAssignmentsByEmployee.get(assignment.assignedToEmployeeId)?.push(assignment.duty);
      }
    });
    
    // Now process each target employee with all their assigned duties
    dutyAssignmentsByEmployee.forEach((duties, targetEmployeeId) => {
      // Find the target employee node
      const targetNode = nodes.find(node => 
        node.id === targetEmployeeId || 
        (node.data as EmployeeData).email === targetEmployeeId
      );
      
      if (targetNode && targetNode.data) {
        console.log(`Reassigning ${duties.length} duties to employee ${targetNode.id}:`, duties);
        
        // Get existing duties
        const existingDuties = (targetNode.data as EmployeeData).jobResponsibilities || 
                              (targetNode.data as EmployeeData).jobDuties || 
                              [];
        
        // Add all new duties
        const updatedDuties = [...existingDuties, ...duties];
        
        // Create updated employee data
        const updatedEmployee = {
          ...(targetNode.data as EmployeeData),
          id: targetNode.id,
          jobResponsibilities: updatedDuties,
          jobDuties: updatedDuties
        };
        
        // Update the employee with new duties
        handleUpdateEmployee(updatedEmployee);
      }
    });
    
    // Store the deleted employee data for potential undo
    setDeletedEmployees(prev => [
      ...prev,
      {
        employeeNode: {...employeeNode},
        dutyAssignments,
        originalConnections
      }
    ]);
    
    // Mark the employee as deleted in the nodes
    setNodes(nodes => nodes.map(node => {
      if (node.id === employeeNode.id) {
        return {
          ...node,
          data: {
            ...node.data,
            isDeleted: true
          }
        };
      }
      return node;
    }));
    
    // Remove all connections to/from this employee
    setEdges(edges => edges.filter(edge => 
      edge.source !== employeeNode.id && edge.target !== employeeNode.id
    ));
    
    // Add to removed employees list for cost tracking
    if (employeeToDelete) {
      setRemovedEmployees(prev => [
        ...prev, 
        {
          id: employeeToDelete.id || employeeId,
          firstName: employeeToDelete.firstName || '',
          lastName: employeeToDelete.lastName || '',
          salary: employeeToDelete.salary || 0
        }
      ]);
    }
    
    // Close the delete prompt
    setShowDeletePrompt(false);
    setEmployeeToDelete(null);
    
    // Show success toast
    toast({
      title: "Employee Marked as Deleted",
      description: "The employee has been marked as deleted and duties reassigned",
      variant: "default"
    });
  };

  // Add function to undo the last delete operation
  const handleUndoDelete = () => {
    // Get the last deleted employee
    const lastDeleted = deletedEmployees[deletedEmployees.length - 1];
    if (!lastDeleted) {
      console.error('No deleted employees to restore');
      return;
    }
    
    const { employeeNode, dutyAssignments, originalConnections } = lastDeleted;
    
    // Restore the employee by removing the isDeleted flag
    setNodes(nodes => nodes.map(node => {
      if (node.id === employeeNode.id) {
        return {
          ...node,
          data: {
            ...node.data,
            isDeleted: false
          }
        };
      }
      return node;
    }));
    
    // Restore original connections
    setEdges(edges => [...edges, ...originalConnections]);
    
    // Group duty assignments by target employee to handle multiple duties assigned to the same person
    const dutyAssignmentsByEmployee = new Map<string, Array<any>>();
    
    dutyAssignments.forEach(assignment => {
      if (assignment.assignedToEmployeeId && 
          assignment.assignedToEmployeeId !== 'unassigned' && 
          assignment.duty) {
        
        // Skip if assigned to the employee being restored
        if (assignment.assignedToEmployeeId === employeeNode.id) {
          return;
        }
        
        // Group duties by target employee
        if (!dutyAssignmentsByEmployee.has(assignment.assignedToEmployeeId)) {
          dutyAssignmentsByEmployee.set(assignment.assignedToEmployeeId, []);
        }
        
        dutyAssignmentsByEmployee.get(assignment.assignedToEmployeeId)?.push(assignment.duty);
      }
    });
    
    // Now process each target employee with all their assigned duties
    dutyAssignmentsByEmployee.forEach((duties, targetEmployeeId) => {
      // Find the target employee node
      const targetNode = nodes.find(node => 
        node.id === targetEmployeeId || 
        (node.data as EmployeeData).email === targetEmployeeId
      );
      
      if (targetNode && targetNode.data) {
        console.log(`Removing ${duties.length} duties from employee ${targetNode.id}:`, duties);
        
        // Get existing duties
        const existingDuties = (targetNode.data as EmployeeData).jobResponsibilities || 
                              (targetNode.data as EmployeeData).jobDuties || 
                              [];
        
        // Remove all reassigned duties by filtering out any duty that matches any in the duties array
        const dutyTexts = duties.map(d => d.duty);
        const updatedDuties = existingDuties.filter(duty => 
          !dutyTexts.includes(duty.duty)
        );
        
        // Create updated employee data
        const updatedEmployee = {
          ...(targetNode.data as EmployeeData),
          id: targetNode.id,
          jobResponsibilities: updatedDuties,
          jobDuties: updatedDuties
        };
        
        // Update the employee with removed duties
        handleUpdateEmployee(updatedEmployee);
      }
    });
    
    // Remove from cost tracking
    setRemovedEmployees(prev => prev.filter(emp => emp.id !== employeeNode.id));
    
    // Remove from deleted employees list
    setDeletedEmployees(prev => prev.slice(0, -1));
    
    // Show success toast
    toast({
      title: "Delete Operation Undone",
      description: "Employee has been restored with original connections and duties",
      variant: "default"
    });
    
    // Show the restored employee's profile
    setSelectedEmployee(employeeNode.data as EmployeeData);
    setShowEmployeeProfile(true);
  };
  
  // Add AI Recommendations state variables
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [aiRecommendations, setAIRecommendations] = useState<AIRecommendationResponse | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  // Function to fetch AI recommendations
  const fetchAIRecommendations = async () => {
    setIsLoadingRecommendations(true);
    
    try {
      // Prepare the company data to send to the AI
      const companyData = {
        employees: nodes.map(node => ({
          id: node.id,
          ...node.data,
        })),
        connections: edges.map(edge => ({
          source: edge.source,
          target: edge.target,
        }))
      };
      
      // Construct the prompt for the AI
      const prompt = `
        You are an expert organizational design AI consultant. Provide up to 5 of the most useful and actionable recommendations only. Do not output more than 5 suggestions.
        Analyze the following organization chart data and recommend concise changes to optimize team performance, reduce inefficiencies, and align with business objectives.
        THIS IS FOR DEBUGGING BUT PLEASE RIGHT NOW, ALL SUGGESTIONS MUST INCLUDE CHANGING SALARY OF ANY EMPLOYEE (IM TESTING THIS SO I NEED TO MAKE SURE THIS WORKS/ THIS IS CRITIDCAL AND UTMOST PRIORTIY)
        Consider the following change types:
        1. Moving employees to different departments
        2. Adding new employees
        3. Removing employees and reassigning their duties
        4. Changing supervisors/managers
        5. Changing job duties and/or hours worked per duty
        6. Changing job titles and/or salary for promotion/demotion
        
        For each recommendation, provide a clear rationale and specific details.
        
        Format your response as a structured JSON object with the following format:
        {
          "recommendations": [
            {
              "type": "move_employee", // One of: move_employee, add_employee, remove_employee, change_supervisor
              "employeeId": "employee-id", // Only for existing employees
              "employeeName": "Employee Name", // Only for existing employees
              "fromDepartment": "Current Department", // Only for move_employee
              "toDepartment": "New Department", // For move_employee and add_employee
              "newSupervisorId": "supervisor-id", // For change_supervisor
              "newJobTitle": "New Job Title", // For add_employee
              "recommendedSalary": 80000, // For add_employee
              "dutyReassignments": [ // For remove_employee
                {
                  "duty": "Duty description",
                  "assignToEmployeeId": "employee-id"
                }
              ],
              "rationale": "Detailed explanation for this recommendation"
            }
          ]
        }
        
        Company Data: ${JSON.stringify(companyData)}
      `;
      
      // Call the claude-query.js API endpoint
      const response = await fetch('/api/claude-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: prompt,
          session_id: `org_recommendations_${Date.now()}`,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('AI Recommendations response:', data);
      
      // Parse the AI response to extract recommendations
      let recommendations: AIRecommendationResponse;
      try {
        // Try to extract JSON from the text response
        const jsonMatch = data.response.match(/```json\n([\s\S]*?)\n```/) || 
                        data.response.match(/```\n([\s\S]*?)\n```/) ||
                        data.response.match(/{[\s\S]*?}/);
        
        const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : data.response;
        const parsedRecommendations = JSON.parse(jsonString);
        
        if (!parsedRecommendations.recommendations || !Array.isArray(parsedRecommendations.recommendations)) {
          throw new Error('Invalid recommendations format');
        }
        
        recommendations = parsedRecommendations as AIRecommendationResponse;
        // Limit to top 5 recommendations
        recommendations.recommendations = recommendations.recommendations.slice(0, 5);
      } catch (error) {
        console.error('Failed to parse AI recommendations:', error);
        throw new Error('Failed to parse AI recommendations');
      }
      
      setAIRecommendations(recommendations);
      setShowAIRecommendations(true);
    } catch (error) {
      console.error('Error fetching AI recommendations:', error);
      toast({
        title: "Error",
        description: `Failed to get AI recommendations: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  // Add this function before the AIRecommendationsPanel component
  // Function to apply a single AI recommendation
  const applySingleRecommendation = (rec: AIRecommendation) => {
    try {
      switch (rec.type) {
        case 'move_employee':
          if (rec.employeeId) {
            // Update the employee's department
            setNodes(prevNodes => {
              const updatedNodes = prevNodes.map(node => {
                if (node.id === rec.employeeId) {
                  console.log(`Moving employee ${node.id} from ${node.data.department} to ${rec.toDepartment}`);
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      department: rec.toDepartment
                    }
                  };
                }
                return node;
              });
              
              // Force relayout after state update
              setTimeout(() => forceRelayout(), 100);
              return updatedNodes;
            });
          }
          break;
          
        case 'change_salary':
          if (rec.employeeId && rec.newSalary !== undefined) {
            setNodes(prevNodes => {
              return prevNodes.map(node => {
                if (node.id === rec.employeeId) {
                  const currentSalary = node.data.salary || 0;
                  console.log(`Changing salary for ${node.id} from ${currentSalary} to ${rec.newSalary}`);
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      salary: rec.newSalary,
                      previousSalary: currentSalary,
                      salaryChange: rec.newSalary - currentSalary
                    }
                  };
                }
                return node;
              });
            });
            
            // Update the recommendation with current salary for display
            rec.currentSalary = rec.currentSalary || nodes.find(n => n.id === rec.employeeId)?.data.salary || 0;
            // Reflect salary change in profile if open
            if (selectedEmployee?.id === rec.employeeId) {
              setSelectedEmployee(prev => prev && ({ ...prev, salary: rec.newSalary, previousSalary: rec.currentSalary, salaryChange: rec.newSalary - rec.currentSalary }));
            }
            
            // Force relayout after state update
            setTimeout(() => forceRelayout(), 100);
          }
          break;
          
        case 'add_employee':
          // Create a new employee node
          const newEmployeeId = `employee-${Date.now()}`;
          const newEmployee = {
            id: newEmployeeId,
            firstName: rec.employeeName?.split(' ')[0] || 'New',
            lastName: rec.employeeName?.split(' ')[1] || 'Employee',
            jobTitle: rec.newJobTitle || 'Employee',
            department: rec.toDepartment || 'General',
            email: `${rec.employeeName?.toLowerCase().replace(/ /g, '.')}@company.com` || `new.employee@company.com`,
            salary: rec.recommendedSalary || 50000,
            jobResponsibilities: [],
            jobDuties: [],
            isNew: true // Mark as new for visual indication
          };
          
          // Find a good position for the new node
          const departmentNodes = nodes.filter(node => 
            node.data.department === rec.toDepartment && !node.data.isDeleted
          );
          
          let newNodePosition = { x: 100, y: 100 };
          if (departmentNodes.length > 0) {
            // Position near other nodes in the same department
            const avgX = departmentNodes.reduce((sum, node) => sum + node.position.x, 0) / departmentNodes.length;
            const avgY = departmentNodes.reduce((sum, node) => sum + node.position.y, 0) / departmentNodes.length;
            newNodePosition = { 
              x: avgX + 150, 
              y: avgY + 100 
            };
          }
          
          console.log(`Adding new employee ${newEmployeeId} to department ${rec.toDepartment}`);
          
          // Add the new node
          setNodes(prevNodes => {
            const updatedNodes = [
              ...prevNodes,
              {
                id: newEmployeeId,
                type: 'employee',
                position: newNodePosition,
                data: newEmployee
              }
            ];
            
            // Force relayout after state update
            setTimeout(() => forceRelayout(), 100);
            return updatedNodes;
          });
          
          // Add to added employees for cost tracking
          setAddedEmployees(prev => [
            ...prev,
            {
              id: newEmployeeId,
              firstName: newEmployee.firstName,
              lastName: newEmployee.lastName,
              salary: newEmployee.salary
            }
          ]);
          break;
          
        case 'remove_employee':
          if (rec.employeeId) {
            const employeeNode = nodes.find(node => node.id === rec.employeeId);
            if (employeeNode && employeeNode.data) {
              // Handle duty reassignments
              if (rec.dutyReassignments && rec.dutyReassignments.length > 0) {
                rec.dutyReassignments.forEach(reassignment => {
                  const targetNode = nodes.find(node => node.id === reassignment.assignToEmployeeId);
                  if (targetNode && targetNode.data) {
                    const existingDuties = targetNode.data.jobResponsibilities || targetNode.data.jobDuties || [];
                    
                    const updatedDuties = [
                      ...existingDuties,
                      { duty: reassignment.duty, hours: 5 }
                    ];
                    
                    console.log(`Assigning duty "${reassignment.duty}" to employee ${targetNode.id}`);
                    
                    // Update the employee with new duties
                    handleUpdateEmployee({
                      ...targetNode.data,
                      id: targetNode.id,
                      jobResponsibilities: updatedDuties,
                      jobDuties: updatedDuties
                    });
                  }
                });
              }
              
              // Mark the employee as deleted
              console.log(`Removing employee ${rec.employeeId}`);
              
              setNodes(prevNodes => {
                const updatedNodes = prevNodes.map(node => {
                  if (node.id === rec.employeeId) {
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        isDeleted: true
                      }
                    };
                  }
                  return node;
                });
                
                // Force relayout after state update
                setTimeout(() => forceRelayout(), 100);
                return updatedNodes;
              });
              
              // Remove connections
              setEdges(edges => edges.filter(edge => 
                edge.source !== rec.employeeId && edge.target !== rec.employeeId
              ));
              
              // Add to removed employees for cost tracking
              setRemovedEmployees(prev => [
                ...prev,
                {
                  id: rec.employeeId,
                  firstName: employeeNode.data.firstName || '',
                  lastName: employeeNode.data.lastName || '',
                  salary: employeeNode.data.salary || 0
                }
              ]);
              
              // Save the deleted employee in the deletedEmployees array for potential undo
              const originalConnections = edges.filter(edge => 
                edge.source === rec.employeeId || edge.target === rec.employeeId
              );
              
              setDeletedEmployees(prev => [
                ...prev,
                {
                  employeeNode,
                  originalConnections,
                  dutyAssignments: rec.dutyReassignments || []
                }
              ]);
            }
          }
          break;
          
        case 'change_supervisor':
          if (rec.employeeId && rec.newSupervisorId) {
            // Remove existing supervisor connection
            setEdges(prevEdges => {
              const filteredEdges = prevEdges.filter(edge => edge.target !== rec.employeeId);
              
              // Add new supervisor connection
              const newEdges = [
                ...filteredEdges,
                {
                  id: `edge-${rec.newSupervisorId}-${rec.employeeId}`,
                  source: rec.newSupervisorId,
                  target: rec.employeeId,
                  type: 'default' // Use default edge type
                }
              ];
              
              console.log(`Changing supervisor for ${rec.employeeId} to ${rec.newSupervisorId}`);
              
              // Force relayout after state update
              setTimeout(() => forceRelayout(), 100);
              return newEdges;
            });
            
            // Add supervision duty to new supervisor
            const supervisorNode = nodes.find(node => node.id === rec.newSupervisorId);
            if (supervisorNode && supervisorNode.data) {
              const employeeNode = nodes.find(node => node.id === rec.employeeId);
              if (employeeNode && employeeNode.data) {
                const employeeName = `${employeeNode.data.firstName || ''} ${employeeNode.data.lastName || ''}`.trim();
                
                const existingDuties = supervisorNode.data.jobResponsibilities || supervisorNode.data.jobDuties || [];
                
                const supervisionDuty = `Supervise ${employeeName}`;
                if (!existingDuties.some(duty => duty.duty === supervisionDuty)) {
                  const updatedDuties = [
                    ...existingDuties,
                    { duty: supervisionDuty, hours: 5 }
                  ];
                  
                  // Update the supervisor with the new duty
                  handleUpdateEmployee({
                    ...supervisorNode.data,
                    id: supervisorNode.id,
                    jobResponsibilities: updatedDuties,
                    jobDuties: updatedDuties
                  });
                }
              }
            }
          }
          break;
      }
      
      // Show success message
      toast({
        title: "Applied",
        description: `Successfully applied the recommendation`,
        variant: "default",
      });
      
    } catch (error) {
      console.error('Error applying recommendation:', error);
      toast({
        title: "Error",
        description: `Failed to apply recommendation: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    }
  };

  {showAIRecommendations && aiRecommendations && (
    <AIRecommendationsPanel
      recommendations={aiRecommendations}
      nodes={nodes}
      edges={edges}
      setNodes={setNodes}
      setEdges={setEdges}
      setAddedEmployees={setAddedEmployees}
      setRemovedEmployees={setRemovedEmployees}
      setDeletedEmployees={setDeletedEmployees}
      handleUpdateEmployee={handleUpdateEmployee}
      forceRelayout={forceRelayout}
      onClose={() => setShowAIRecommendations(false)}
    />
  )}

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* New header that includes all action buttons */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-3 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 mr-2"
            onClick={() => router.push('/dashboard')}
            title="Close"
          >
            <FaTimes className="w-4 h-4" />
          </Button>
          
        </div>
        
        <div className="flex items-center space-x-2">

          
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            onClick={fetchAIRecommendations}
            disabled={isLoadingRecommendations}
          >
            {isLoadingRecommendations ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Analyzing...
              </>
            ) : (
              <>
                <FaRobot className="mr-2 h-4 w-4" />
                AI Recommendations
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            onClick={forceRelayout}
          >
            <FaSyncAlt className="w-4 h-4 mr-2" />
            Relayout
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            onClick={() => setShowCreateModal(true)}
          >
            <FaUserPlus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
          
          <div className="relative">
            <Input
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white text-black placeholder:text-gray-500 border border-gray-300 w-60"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full text-gray-600 hover:bg-transparent"
              onClick={handleSearch}
            >
              <FaSearch className="w-4 h-4" />
            </Button>
          </div>

          <Select 
            value={selectedDepartment}
            onValueChange={useCallback((value) => {
              setSelectedDepartment(value);
              // Prevent immediate re-render by adding a small delay
              setTimeout(() => {
                // Trigger a re-render after the state update
                setDepartments([...departments]);
              }, 0);
            }, [departments])}
            className="w-44"
          >
            <SelectTrigger className="bg-white/10 text-white border-white/20 w-44">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {useMemo(() => departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              )), [departments])}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            onClick={handleScreenshot}
          >
            <FaCamera className="w-4 h-4" />
            
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            onClick={toggleFullscreen}
          >
            <FaExpandAlt className="w-4 h-4" />
            
          </Button>
        </div>
      </div>

      {/* Add the AIRecommendationsPanel */}
      {showAIRecommendations && aiRecommendations && (
        <AIRecommendationsPanel
          recommendations={aiRecommendations}
          nodes={nodes}
          edges={edges}
          setNodes={setNodes}
          setEdges={setEdges}
          setAddedEmployees={setAddedEmployees}
          setRemovedEmployees={setRemovedEmployees}
          setDeletedEmployees={setDeletedEmployees}
          handleUpdateEmployee={handleUpdateEmployee}
          forceRelayout={forceRelayout}
          onClose={() => setShowAIRecommendations(false)}
        />
      )}

      {/* Chart area */}
      <div className="flex-grow relative" ref={orgChartRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            <span className="ml-3 text-lg">Loading...</span>
          </div>
        ) : error ? (
          <Alert variant="destructive" className="m-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <ReactFlowProvider>
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-lg">Loading organization chart...</span>
              </div>
            }>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onInit={(instance: ReactFlowInstance) => {
                  setReactFlowInstance(instance);
                  setTimeout(() => instance.fitView({ padding: 0.3 }), 500);
                }}
                nodeTypes={memoizedNodeTypes}
                edgeTypes={memoizedEdgeTypes}
                fitView
                fitViewOptions={{
                  padding: 0.3,
                  includeHiddenNodes: false
                }}
                attributionPosition="bottom-left"
                minZoom={0.2}
                maxZoom={2}
                defaultEdgeOptions={defaultEdgeOptionsMemo}
                className="bg-gray-50 w-full h-full"
                nodesDraggable={true}
                elementsSelectable={true}
                panOnScroll={true}
                zoomOnScroll={true}
                panOnDrag={true}
                tabIndex={0}
              >
                {/* Zoom controls */}
                <div className="absolute right-8 top-1/4 transform -translate-y-1/2 flex flex-col gap-2 z-10">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="rounded-full bg-white shadow-lg hover:bg-gray-100 border border-gray-300 text-black h-10 w-10 flex items-center justify-center"
                    onClick={() => reactFlowInstance?.zoomIn()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="rounded-full bg-white shadow-lg hover:bg-gray-100 border border-gray-300 text-black h-10 w-10 flex items-center justify-center"
                    onClick={() => reactFlowInstance?.zoomOut()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </Button>
                </div>
                
                <Background color="#aaa" gap={16} variant={BackgroundVariant.Dots} />
              </ReactFlow>
            </Suspense>
          </ReactFlowProvider>
        )}
      </div>

      {/* Employee Profile Sidebar */}
      {selectedEmployee && (
        <div className="fixed right-0 top-0 bottom-0 w-2/5 z-20 shadow-xl bg-white overflow-auto transform transition-transform duration-300 ease-in-out">
          <EmployeeProfile 
            employee={selectedEmployee} 
            onClose={() => setSelectedEmployee(null)} 
            onRemove={handleRemoveEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onUndoDelete={selectedEmployee.isDeleted && deletedEmployees.length > 0 ? handleUndoDelete : undefined}
          />
        </div>
      )}

      {/* Modals */}
      <CreateEmployeeModal
        departments={departments} 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        onSubmit={handleCreateEmployee}
        existingEmployees={nodes.map(node => ({
          id: node.id,
          name: `${node.data.firstName || ''} ${node.data.lastName || ''}`.trim() || node.data.email,
          email: node.data.email
        }))}
      />

      <RedistributionModal
        isOpen={showRedistributionModal}
        onClose={() => setShowRedistributionModal(false)}
        employee={employeeToRemove}
        onRedistribute={(selectedSuccessors, dutyAssignments) => {
          handleConfirmRedistribution(selectedSuccessors);
        }}
        availableEmployees={redistributionState.availableEmployees}
      />

      {/* Added Cost Prompt */}
      <AddedCostPrompt 
        addedEmployees={addedEmployees}
        removedEmployees={removedEmployees}
      />

      {showDeletePrompt && employeeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          {console.log('Rendering DeleteEmployeePrompt with:', {
            employee: employeeToDelete,
            allEmployees: nodes.map(node => ({ 
              id: node.id,
              ...node.data
            }))
          })}
          <DeleteEmployeePrompt
            employee={employeeToDelete}
            allEmployees={nodes.map(node => ({ 
              id: node.id,
              ...node.data
            }))}
            onCancel={handleCancelDelete}
            onConfirmDelete={handleConfirmDelete}
          />
        </div>
      )}
    </div>
  );
};

export default OrganizationChartPage;
