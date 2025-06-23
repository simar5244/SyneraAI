'use client';

// This page provides a full-screen view of the organization chart
// It re-uses the core logic and components from the main org-chart page
// but renders outside the standard dashboard layout.

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  Panel,
  BackgroundVariant,
  Node,
  Edge,
  ReactFlowInstance,
  MarkerType,
  getBezierPath,
  EdgeProps
} from 'reactflow';
import type { NodeTypes, DefaultEdgeOptions } from 'reactflow';
import 'reactflow/dist/style.css';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { FaTimes, FaUserPlus, FaSyncAlt, FaInfoCircle, FaTrash } from 'react-icons/fa';
import dynamic from 'next/dynamic';

// Use dynamic imports for components
const EmployeeNode = dynamic(() => import('../org-chart/components/EmployeeNode'), { ssr: false });
const CreateEmployeeModal = dynamic(() => import('../org-chart/components/CreateEmployeeModal'), { ssr: false });

// Import layout utils
import { applyHierarchicalLayout } from '../org-chart/utils/layoutUtils';

// Node types (defined outside component)
const nodeTypes: NodeTypes = {
  employee: EmployeeNode,
};

// Edge types (defined outside component)
const edgeTypes = {
  'custom-edge': CustomEdge,
};

// Static default edge options for ReactFlow to avoid re-creation on each render
const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'custom-edge',
  style: { stroke: '#888', strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.Arrow },
};

// Utility function to categorize utilization levels
const getUtilizationCategory = (score: number): string => {
  if (score > 1.3) return "critical";
  if (score > 1.2) return "very-high";
  if (score > 1.1) return "high";
  if (score > 1.0) return "above-optimal";
  if (score > 0.9) return "optimal";
  if (score > 0.7) return "moderate";
  if (score > 0.5) return "low";
  if (score > 0.3) return "very-low";
  return "minimal";
};

// Define a custom edge component for better control
const CustomEdge = ({ id, source, target, style = {}, markerEnd }: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: 0,
    sourceY: 0,
    sourcePosition: 'bottom',
    targetX: 0,
    targetY: 0,
    targetPosition: 'top',
  });
  
  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={style}
        markerEnd={markerEnd}
      />
      <g transform={`translate(${labelX - 15}, ${labelY - 10})`} className="opacity-0 hover:opacity-100 transition-opacity">
        <rect width="30" height="20" rx="10" fill="white" fillOpacity="0.8" />
        <foreignObject width="30" height="20" style={{ overflow: 'visible' }}>
          <div className="flex items-center justify-center h-full cursor-pointer">
            <FaTrash className="w-3 h-3 text-red-500" />
          </div>
        </foreignObject>
      </g>
    </>
  );
};

const OrgChartViewPage = () => {
  const router = useRouter();
  // Flow states
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  
  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const orgChartRef = useRef(null);

  // Fetch data on mount (Simplified from original page, no interval)
  useEffect(() => {
    fetchOrganizationData();
  }, []);

  const fetchOrganizationData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let response = await fetch('/api/organization/hierarchy');
      if (!response.ok) {
        console.warn('Full-view: Failed main API, using mock');
        response = await fetch('/api/organization/mock');
        if (!response.ok) throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('Invalid data format');
      
      const initialNodes = data.map((employee: any) => ({
        id: employee.email,
        type: 'employee',
        position: { x: 0, y: 0 },
        data: { ...employee, department: employee.department || 'Unassigned' }
      }));
      
      const initialEdges = data
        .filter((e: any) => e.reportsTo?.email)
        .map((e: any) => ({
          id: `${e.email}-${e.reportsTo.email}`,
          source: e.reportsTo.email,
          target: e.email,
          type: 'step'
        }));
        
      const layoutedNodes = applyHierarchicalLayout(initialNodes, initialEdges);
      setNodes(layoutedNodes);
      setEdges(initialEdges);
      
      // Fetch utilization separately (optional, non-blocking)
      fetchUtilizationData(layoutedNodes); 

    } catch (err: any) {
      console.error('Full-view: Error fetching org data:', err);
      setError('Failed to load organization data.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch utilization data and update nodes (non-blocking)
  const fetchUtilizationData = async (currentNodes: Node[]) => {
    try {
      const response = await fetch('/api/organization/utilization');
      if (!response.ok) {
        console.warn('Full-view: Failed utilization API');
        return; // Don't block on error
      }
      const data = await response.json();
      setNodes(nds => nds.map(node => {
        const employeeUtil = data.employees[node.id];
        return employeeUtil ? { ...node, data: { ...node.data, utilization: employeeUtil } } : node;
      }));
    } catch (err) {
      console.error('Full-view: Error fetching utilization:', err);
    }
  };

  // Connection handler (VISUAL ONLY)
  const onConnect = useCallback((params: any) => {
    console.log('VISUALIZATION ONLY (Full View): Connecting nodes', params);
    
    // Check if connection already exists
    const existingEdge = edges.find(edge => 
      edge.source === params.source && edge.target === params.target
    );
    
    if (existingEdge) {
      console.log('Connection already exists, skipping');
      return;
    }
    
    // Add the edge with proper styling
    setEdges((eds) => addEdge({ 
      ...params, 
      // Create a consistent ID format
      id: `${params.source}-${params.target}`,
      type: 'custom-edge', 
      style: { stroke: '#888', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.Arrow },
      data: { edgeType: 'reporting' } 
    }, eds));
    
    // Adjust utilization scores
    setNodes(nodes => nodes.map(node => {
      // Source (manager) gets a slight utilization increase
      if (node.id === params.source) {
        const currentScore = node.data?.utilization?.score ?? 0.8;
        const newScore = Math.min(currentScore + 0.05, 1.5); // Add 5% utilization, cap at 150%
        return {
          ...node,
          data: {
            ...node.data,
            utilization: {
              score: newScore,
              category: getUtilizationCategory(newScore)
            }
          }
        };
      }
      
      // Target (report) gets a slight utilization decrease
      if (node.id === params.target) {
        const currentScore = node.data?.utilization?.score ?? 0.8;
        const newScore = Math.max(currentScore - 0.1, 0.2); // Reduce by 10%, min 20%
        return {
          ...node,
          data: {
            ...node.data,
            utilization: {
              score: newScore,
              category: getUtilizationCategory(newScore)
            }
          }
        };
      }
      
      return node;
    }));
  }, [edges, setEdges, setNodes]);
  
  // Function to remove a connection between nodes
  const handleRemoveConnection = (edgeId: string) => {
    // Find the edge to remove - log all edges to help debug
    console.log('All edges:', edges);
    console.log('Looking for edge ID:', edgeId);
    
    // Try finding the edge by ID first
    let edgeToRemove = edges.find(edge => edge.id === edgeId);
    
    // If not found by ID, try to find by source-target combination
    if (!edgeToRemove && edgeId.includes('-')) {
      const [source, target] = edgeId.split('-');
      edgeToRemove = edges.find(edge => edge.source === source && edge.target === target);
      console.log('Trying to find by source-target:', source, target);
    }
    
    if (!edgeToRemove) {
      console.error('Edge not found:', edgeId);
      
      // As a fallback, show all edges to help identify the issue
      console.log('Available edges:');
      edges.forEach(edge => {
        console.log(`Edge ${edge.id}: ${edge.source} -> ${edge.target}`);
      });
      
      // If we can't find the edge, remove by ID anyway - it might be a display issue only
      setEdges(prevEdges => prevEdges.filter(edge => edge.id !== edgeId));
      return;
    }
    
    const sourceId = edgeToRemove.source;
    const targetId = edgeToRemove.target;
    
    console.log(`VISUALIZATION ONLY: Removing connection from ${sourceId} to ${targetId}`);
    
    // Remove the edge
    setEdges(prevEdges => prevEdges.filter(edge => edge.id !== edgeId));
    
    // Adjust utilization scores
    setNodes(nodes => nodes.map(node => {
      // Source (manager) gets a slight utilization decrease
      if (node.id === sourceId) {
        const currentScore = node.data?.utilization?.score ?? 0.8;
        const newScore = Math.max(currentScore - 0.05, 0.2); // Reduce by 5%, min 20%
        return {
          ...node,
          data: {
            ...node.data,
            utilization: {
              score: newScore,
              category: getUtilizationCategory(newScore)
            }
          }
        };
      }
      
      // Target (report) gets a slight utilization increase
      if (node.id === targetId) {
        const currentScore = node.data?.utilization?.score ?? 0.8;
        const newScore = Math.min(currentScore + 0.1, 1.5); // Add 10%, cap at 150%
        return {
          ...node,
          data: {
            ...node.data,
            utilization: {
              score: newScore,
              category: getUtilizationCategory(newScore)
            }
          }
        };
      }
      
      return node;
    }));
  };
  
  // Handle edge click - for removing connections
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    
    if (confirm(`Remove connection from ${edge.source} to ${edge.target}?`)) {
      handleRemoveConnection(edge.id);
    }
  }, []);

  // Function to force relayout
  const forceRelayout = () => {
    if (!reactFlowInstance) return;
    const relayoutedNodes = applyHierarchicalLayout(nodes, edges);
    setNodes(relayoutedNodes);
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.3 }), 100);
  };

  // Handle closing the full view
  const handleClose = () => {
    router.push('/dashboard/visualizations');
  };
  
  // Add a new employee
  const handleCreateEmployee = async (employeeData: any) => {
    console.log('Adding employee locally (full view):', employeeData);
    setIsLoading(true);
    
    try {
      // Find a position that doesn't overlap with existing nodes
      const existingPositions = nodes.map(n => n.position);
      let posX = 100 + Math.random() * 400;
      let posY = 100 + Math.random() * 300;
      
      // Try to avoid existing positions
      if (existingPositions.length > 0) {
        // Find average position
        const avgX = existingPositions.reduce((sum, pos) => sum + pos.x, 0) / existingPositions.length;
        const avgY = existingPositions.reduce((sum, pos) => sum + pos.y, 0) / existingPositions.length;
        
        // Place slightly away from average with some randomness
        const angle = Math.random() * Math.PI * 2; // Random angle
        const distance = 200 + Math.random() * 100; // Random distance
        posX = avgX + Math.cos(angle) * distance;
        posY = avgY + Math.sin(angle) * distance;
      }
      
      // Add department if not specified
      const department = employeeData.department || 
        (employeeData.jobTitle && employeeData.jobTitle.toLowerCase().includes('engineer') ? 'Engineering' :
         employeeData.jobTitle && employeeData.jobTitle.toLowerCase().includes('design') ? 'Design' :
         employeeData.jobTitle && employeeData.jobTitle.toLowerCase().includes('market') ? 'Marketing' :
         employeeData.jobTitle && employeeData.jobTitle.toLowerCase().includes('manage') ? 'Management' :
         'Unassigned');
      
      // Create the new node
      const newNode = {
        id: employeeData.email, // Use email as ID
        type: 'employee',
        position: { x: posX, y: posY },
        data: {
          ...employeeData,
          department: department,
          utilization: { 
            score: 0.8, // Default to optimal utilization
            category: 'optimal' 
          }
        }
      };
      
      console.log('New node created:', newNode);
      
      // Add the node to the state
      setNodes(nds => {
        const updatedNodes = [...nds, newNode];
        
        // If we have reactFlowInstance, force a re-layout
        if (reactFlowInstance) {
          setTimeout(() => {
            reactFlowInstance.fitView({ padding: 0.2 });
          }, 100);
        }
        
        return updatedNodes;
      });
      
      // Close modal and finish
      setShowCreateModal(false);
      alert(`Employee ${employeeData.firstName} ${employeeData.lastName} added successfully. Connect them to the org chart using the connection handles.`);
    } catch (error: any) {
      console.error('Error creating employee:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle showing/hiding the legend
  const toggleLegend = () => {
    setShowLegend(!showLegend);
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-gray-50" ref={orgChartRef}> 
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-lg text-gray-700">Loading Organization Chart...</span>
        </div>
      ) : error ? (
        <div className="p-4 text-red-600 bg-red-100 border border-red-400 rounded">
          Error: {error}
        </div>
      ) : (
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            fitViewOptions={{ padding: 0.1 }}
            className="w-full h-full"
            nodesDraggable={true}
            elementsSelectable={true}
            panOnScroll={true}
            zoomOnScroll={true}
            panOnDrag={true}
          >
            <Controls />
            <MiniMap 
               nodeColor={node => {
                  const departmentColors = {
                    'Engineering': '#3498db', 'Tool Design': '#27ae60', 'Design': '#9b59b6',
                    'Management': '#e74c3c', 'Marketing': '#f39c12', 'Sales': '#2ecc71',
                    'HR': '#f39c12', 'Finance': '#9b59b6', 'Operations': '#1abc9c',
                    'Executive': '#34495e', 'Product': '#1abc9c', 'Unassigned': '#95a5a6',
                  };
                  return departmentColors[node.data?.department as keyof typeof departmentColors] || '#95a5a6';
                }}
            />
            <Background color="#aaa" gap={16} variant={BackgroundVariant.Dots} />
            
            {/* Modern, clean top header */}
            <Panel position="top-center" className="p-2 mt-4 rounded-lg flex items-center backdrop-blur bg-white/60 shadow-sm">
              <div className="flex items-center space-x-2">
                <Button 
                  size="sm" 
                  onClick={forceRelayout} 
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1 rounded-md transition-all"
                >
                  <FaSyncAlt className="mr-2 h-3 w-3" /> Fix Layout
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => setShowCreateModal(true)} 
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1 rounded-md transition-all"
                >
                  <FaUserPlus className="mr-2 h-3 w-3" /> Add Employee
                </Button>
                <Button 
                  size="sm" 
                  onClick={toggleLegend} 
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1 rounded-md transition-all"
                >
                  <FaInfoCircle className="mr-2 h-3 w-3" /> Legend
                </Button>
              </div>
            </Panel>
            
            {/* Close button - top right */}
            <Panel position="top-right" className="mt-4 mr-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClose}
                className="bg-white hover:bg-gray-100 rounded-full shadow-md text-gray-700 hover:text-gray-900"
                title="Close Full View"
              >
                <FaTimes className="h-4 w-4" />
              </Button>
            </Panel>
          </ReactFlow>
          
          {/* Legend panel */}
          {showLegend && (
            <div className="fixed right-4 top-20 bg-white/95 backdrop-blur-md shadow-lg rounded-lg p-4 max-w-xs z-50 border border-gray-200 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-900">Utilization Legend</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleLegend}
                  className="h-6 w-6 p-0"
                >
                  <FaTimes className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <div className="text-xs font-medium">Overutilized</div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                  <span className="text-xs">Critical (130%+)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-400 mr-2"></div>
                  <span className="text-xs">Very High (120-130%)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-orange-400 mr-2"></div>
                  <span className="text-xs">High (110-120%)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-orange-300 mr-2"></div>
                  <span className="text-xs">Above Optimal (100-110%)</span>
                </div>
                
                <div className="text-xs font-medium mt-3">Optimal</div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-400 mr-2"></div>
                  <span className="text-xs">Optimal (90-100%)</span>
                </div>
                
                <div className="text-xs font-medium mt-3">Underutilized</div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-sky-300 mr-2"></div>
                  <span className="text-xs">Moderate (70-90%)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-sky-400 mr-2"></div>
                  <span className="text-xs">Low (50-70%)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-sky-500 mr-2"></div>
                  <span className="text-xs">Very Low (30-50%)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-sky-600 mr-2"></div>
                  <span className="text-xs">Minimal (below 30%)</span>
                </div>
              </div>
            </div>
          )}
        </ReactFlowProvider>
      )}
       
      {/* Create Employee Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="max-w-2xl w-full mx-auto">
            <CreateEmployeeModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onSubmit={handleCreateEmployee}
              departments={['Engineering', 'Design', 'Management', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Executive', 'Product']}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgChartViewPage; 