'use client';

import React, { useState, useEffect } from 'react';
import OrgChart from './OrgChart';
import EmployeeDetailsPanel from './EmployeeDetailsPanel';
import ConfirmationModal from './ConfirmationModal';

// Define the OrgNode interface for organization data structure
export interface OrgNode {
  id: string;
  name: string;
  role: string;
  workload: number;
  children: OrgNode[];
  skills?: string[];
  experience?: number;
  projects?: string[];
  salary?: number; // Added for cost calculations
  department?: string; // Added for department filtering
}

// Add this interface for drag and drop operations
export interface MoveAnalysis {
  employeeId: string;
  employeeName: string;
  currentManagerId: string | null;
  destinationId: string | null;
  destinationName: string | null;
  pros: string[];
  cons: string[];
  workloadChange: number;
  costChange?: number;
}

// Sample organization data with salary information added
const sampleOrgData: OrgNode = {
  id: "1",
  name: "Sarah Johnson",
  role: "CEO",
  workload: 80,
  skills: ["Leadership", "Strategic Planning", "Business Development"],
  experience: 15,
  projects: ["Company Growth Strategy", "Investor Relations"],
  salary: 250000,
  department: "Executive",
  children: [
    {
      id: "2",
      name: "Michael Chen",
      role: "CTO",
      workload: 90,
      skills: ["System Architecture", "Cloud Infrastructure", "Team Leadership"],
      experience: 12,
      projects: ["Platform Modernization", "Cloud Migration"],
      salary: 200000,
      department: "Technology",
      children: [
        {
          id: "5",
          name: "Raj Patel",
          role: "Lead Developer",
          workload: 95,
          skills: ["JavaScript", "React", "Node.js"],
          experience: 8,
          projects: ["Frontend Refactoring", "API Development"],
          salary: 150000,
          department: "Technology",
          children: [
            {
              id: "8",
              name: "Lisa Wong",
              role: "Senior Developer",
              workload: 85,
              skills: ["React", "TypeScript", "GraphQL"],
              experience: 5,
              projects: ["User Dashboard", "Authentication System"],
              salary: 120000,
              department: "Technology",
              children: []
            },
            {
              id: "9",
              name: "David Kim",
              role: "Developer",
              workload: 70,
              skills: ["JavaScript", "CSS", "HTML"],
              experience: 3,
              projects: ["Landing Page Redesign", "Mobile Responsiveness"],
              salary: 90000,
              department: "Technology",
              children: []
            }
          ]
        },
        {
          id: "6",
          name: "Emily Rodriguez",
          role: "DevOps Manager",
          workload: 75,
          skills: ["Docker", "Kubernetes", "CI/CD"],
          experience: 7,
          projects: ["Deployment Pipeline", "Infrastructure Automation"],
          salary: 140000,
          department: "Technology",
          children: [
            {
              id: "10",
              name: "Carlos Sanchez",
              role: "DevOps Engineer",
              workload: 65,
              skills: ["AWS", "Terraform", "Jenkins"],
              experience: 4,
              projects: ["Monitoring Setup", "Disaster Recovery"],
              salary: 110000,
              department: "Technology",
              children: []
            }
          ]
        }
      ]
    },
    {
      id: "3",
      name: "Jessica Taylor",
      role: "CFO",
      workload: 70,
      skills: ["Financial Planning", "Risk Management", "Investor Relations"],
      experience: 10,
      projects: ["Annual Budget", "Investment Strategy"],
      salary: 190000,
      department: "Finance",
      children: [
        {
          id: "7",
          name: "Robert Johnson",
          role: "Financial Analyst",
          workload: 55,
          skills: ["Financial Modeling", "Data Analysis", "Reporting"],
          experience: 5,
          projects: ["Quarterly Reports", "Cost Analysis"],
          salary: 95000,
          department: "Finance",
          children: []
        }
      ]
    },
    {
      id: "4",
      name: "James Williams",
      role: "COO",
      workload: 85,
      skills: ["Operations Management", "Process Optimization", "Team Building"],
      experience: 11,
      projects: ["Operational Efficiency", "Supply Chain Optimization"],
      salary: 195000,
      department: "Operations",
      children: [
        {
          id: "11",
          name: "Maria Garcia",
          role: "Operations Manager",
          workload: 80,
          skills: ["Project Management", "Process Improvement", "Team Leadership"],
          experience: 7,
          projects: ["Process Redesign", "Team Expansion"],
          salary: 130000,
          department: "Operations",
          children: [
            {
              id: "12",
              name: "Alex Brown",
              role: "Project Manager",
              workload: 90,
              skills: ["Agile Methodology", "Risk Management", "Stakeholder Communication"],
              experience: 5,
              projects: ["Product Launch", "Client Portal"],
              salary: 100000,
              department: "Operations",
              children: []
            },
            {
              id: "13",
              name: "Sophia Lee",
              role: "Project Manager",
              workload: 75,
              skills: ["Scrum", "Resource Allocation", "Client Management"],
              experience: 4,
              projects: ["Mobile App Development", "Website Redesign"],
              salary: 95000,
              department: "Operations",
              children: []
            }
          ]
        }
      ]
    }
  ]
};

// Function to flatten the org data into an array for easier manipulation
const flattenOrgData = (node: OrgNode): OrgNode[] => {
  let result: OrgNode[] = [node];
  if (node.children) {
    for (const child of node.children) {
      result = result.concat(flattenOrgData(child));
    }
  }
  return result;
};

// Function to deep clone an org data structure
const cloneOrgData = (data: OrgNode): OrgNode => {
  return {
    ...data,
    children: data.children.map(child => cloneOrgData(child))
  };
};

// Function to calculate average workload for a team
const calculateTeamWorkload = (node: OrgNode): number => {
  const team = flattenOrgData(node);
  if (team.length === 0) return 0;
  
  return Math.round(team.reduce((sum, member) => sum + member.workload, 0) / team.length);
};

// Function to find a node by ID
const findNodeById = (root: OrgNode, id: string): OrgNode | null => {
  if (root.id === id) return root;
  
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  
  return null;
};

// Function to find a node's parent
const findParentNode = (root: OrgNode, id: string): OrgNode | null => {
  for (const child of root.children) {
    if (child.id === id) return root;
    
    const parent = findParentNode(child, id);
    if (parent) return parent;
  }
  
  return null;
};

// Function to remove a node from the org chart
const removeNodeFromParent = (root: OrgNode, id: string): boolean => {
  const parent = findParentNode(root, id);
  if (!parent) return false;
  
  const index = parent.children.findIndex(child => child.id === id);
  if (index === -1) return false;
  
  const node = parent.children[index];
  
  // Redistribute the node's children to the parent
  parent.children.splice(index, 1, ...node.children);
  
  // Recalculate workloads
  // When someone is removed, their team's workload increases
  const workloadIncrease = Math.min(15, Math.round(node.workload / parent.children.length));
  parent.children.forEach(child => {
    child.workload = Math.min(100, child.workload + workloadIncrease);
  });
  
  return true;
};

// Function to move a node to a new parent
const moveNodeToNewParent = (root: OrgNode, nodeId: string, newParentId: string): boolean => {
  const node = findNodeById(root, nodeId);
  const newParent = findNodeById(root, newParentId);
  const currentParent = findParentNode(root, nodeId);
  
  if (!node || !newParent || !currentParent) return false;
  
  // Remove from current parent
  const index = currentParent.children.findIndex(child => child.id === nodeId);
  if (index === -1) return false;
  
  currentParent.children.splice(index, 1);
  
  // Add to new parent
  newParent.children.push(node);
  
  // Adjust workloads
  // Current parent's team workload increases slightly
  if (currentParent.children.length > 0) {
    const workloadIncrease = Math.min(10, Math.round(node.workload / currentParent.children.length));
    currentParent.children.forEach(child => {
      child.workload = Math.min(100, child.workload + workloadIncrease);
    });
  }
  
  // New parent's team workload decreases slightly
  const workloadDecrease = Math.min(5, Math.round(10 / (newParent.children.length + 1)));
  newParent.children.forEach(child => {
    if (child.id !== nodeId) {
      child.workload = Math.max(30, child.workload - workloadDecrease);
    }
  });
  
  // Employee's workload might change based on team fit
  const skillOverlapWithNewTeam = calculateSkillOverlap(node, newParent);
  if (skillOverlapWithNewTeam > 0.7) {
    // Good skill fit, workload decreases
    node.workload = Math.max(30, node.workload - 10);
  } else if (skillOverlapWithNewTeam < 0.3) {
    // Poor skill fit, workload increases
    node.workload = Math.min(100, node.workload + 15);
  }
  
  return true;
};

// Helper function to calculate skill overlap ratio between an employee and a team
const calculateSkillOverlap = (employee: OrgNode, team: OrgNode): number => {
  if (!employee.skills || employee.skills.length === 0) return 0.5;
  
  const teamSkills = new Set<string>();
  flattenOrgData(team).forEach(member => {
    if (member.skills) {
      member.skills.forEach(skill => teamSkills.add(skill));
    }
  });
  
  if (teamSkills.size === 0) return 0.5;
  
  const matchingSkills = employee.skills.filter(skill => teamSkills.has(skill));
  return matchingSkills.length / employee.skills.length;
};

// Mock function for task intensity analysis using an LLM
const analyzeTalkIntensity = async (projects: string[]): Promise<number> => {
  // In a real implementation, this would call an LLM API
  // For now, we'll use a simple scoring system
  const highIntensityKeywords = ['launch', 'migration', 'redesign', 'optimization'];
  const mediumIntensityKeywords = ['development', 'implementation', 'expansion'];
  
  let intensityScore = 0.5; // Default medium intensity
  
  projects.forEach(project => {
    const projectLower = project.toLowerCase();
    
    highIntensityKeywords.forEach(keyword => {
      if (projectLower.includes(keyword)) {
        intensityScore += 0.1;
      }
    });
    
    mediumIntensityKeywords.forEach(keyword => {
      if (projectLower.includes(keyword)) {
        intensityScore += 0.05;
      }
    });
  });
  
  // Normalize between 0.3 and 1.0
  return Math.min(1.0, Math.max(0.3, intensityScore));
};

export default function NewOrgSimAIContent() {
  const [orgData, setOrgData] = useState<OrgNode>(sampleOrgData);
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState<boolean>(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [moveAnalysis, setMoveAnalysis] = useState<MoveAnalysis | null>(null);
  const [simulationIndex, setSimulationIndex] = useState(0);
  const [simulationHistory, setSimulationHistory] = useState<OrgNode[]>([cloneOrgData(sampleOrgData)]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    fetchOrgData();
  }, []);
  
  const fetchOrgData = async () => {
    // In a real implementation, this would fetch data from an API
    setOrgData(sampleOrgData);
    setSimulationHistory([cloneOrgData(sampleOrgData)]);
  };
  
  // Convert OrgNode structure to OrgChart component's expected format
  const convertToChartNodes = (orgNode: OrgNode): any => {
    const chartNode = {
      id: parseInt(orgNode.id),
      node_type: "person",
      position: { x: 0, y: 0 }, // Positions will be handled by the layout algorithm
      metadata: {
        name: orgNode.name,
        role: orgNode.role,
        department: orgNode.department || "",
        skill_level: orgNode.experience || 5,
        workload_capacity: 100,
      },
      workload: orgNode.workload
    };
    
    return chartNode;
  };
  
  // Convert hierarchy to flat nodes array and connections
  const prepareChartData = (orgData: OrgNode) => {
    const nodes: any[] = [];
    const connections: any[] = [];
    let nextId = 1000; // Starting ID for connections
    
    const processNode = (node: OrgNode, parentId?: string) => {
      const chartNode = convertToChartNodes(node);
      nodes.push(chartNode);
      
      if (parentId) {
        connections.push({
          id: nextId++,
          source_id: parseInt(node.id),
          target_id: parseInt(parentId),
          connection_type: "reports_to",
          workload_impact: 10
        });
      }
      
      for (const child of node.children) {
        processNode(child, node.id);
      }
    };
    
    processNode(orgData);
    
    return { nodes, connections };
  };
  
  const { nodes, connections } = prepareChartData(orgData);
  
  const handleRoleAdded = () => {
    // Function to handle adding a new role
    fetchOrgData();
  };
  
  const handleNodeSelect = (nodeId: string) => {
    const node = findNodeById(orgData, nodeId);
    setSelectedNode(node);
  };
  
  const analyzeMove = (nodeId: string, targetId: string | null): MoveAnalysis => {
    const node = findNodeById(orgData, nodeId);
    const currentParent = findParentNode(orgData, nodeId);
    
    if (!node || !currentParent) {
      return {
        employeeId: '',
        employeeName: '',
        currentManagerId: null,
        destinationId: null,
        destinationName: null,
        pros: ["Unable to analyze move - employee not found"],
        cons: ["Unable to analyze move - employee not found"],
        workloadChange: 0
      };
    }
    
    const pros: string[] = [];
    const cons: string[] = [];
    const currentTeamWorkload = calculateTeamWorkload(currentParent);
    
    // If deleting (no target)
    if (targetId === null) {
      const salaryImpact = node.salary || 0;
      const workloadImpact = Math.min(15, Math.round(node.workload / Math.max(1, currentParent.children.length - 1)));
      
      pros.push(`Cost savings of $${salaryImpact.toLocaleString()} in salary`);
      
      if (node.workload > 90) {
        pros.push("Removing overworked employee may improve team morale");
      } else if (node.workload < 50) {
        pros.push("Removing underutilized employee may improve team efficiency");
      }
      
      cons.push(`Lose ${node.skills?.length || 0} skills: ${node.skills?.join(", ") || "None"}`);
      cons.push(`Team workload will increase by approximately ${workloadImpact}%`);
      
      if (node.children.length > 0) {
        cons.push(`Need to reassign ${node.children.length} direct reports`);
      }
      
      return {
        employeeId: '',
        employeeName: '',
        currentManagerId: null,
        destinationId: null,
        destinationName: null,
        pros,
        cons,
        workloadChange: workloadImpact,
        costChange: -salaryImpact
      };
    }
    
    // If moving to a new parent
    const targetParent = findNodeById(orgData, targetId);
    if (!targetParent) {
      return {
        employeeId: '',
        employeeName: '',
        currentManagerId: null,
        destinationId: null,
        destinationName: null,
        pros: ["Unable to analyze move - target position not found"],
        cons: ["Unable to analyze move - target position not found"],
        workloadChange: 0
      };
    }
    
    const targetTeamWorkload = calculateTeamWorkload(targetParent);
    const skillOverlap = calculateSkillOverlap(node, targetParent);
    
    // Estimate new workload for the employee
    let estimatedNewWorkload = node.workload;
    
    if (skillOverlap > 0.7) {
      estimatedNewWorkload = Math.max(30, node.workload - 10);
      pros.push(`Good skill match (${Math.round(skillOverlap * 100)}%) with new team may reduce workload`);
    } else if (skillOverlap < 0.3) {
      estimatedNewWorkload = Math.min(100, node.workload + 15);
      cons.push(`Poor skill match (${Math.round(skillOverlap * 100)}%) with new team may increase workload`);
    }
    
    // Estimate current team impact
    const currentTeamImpact = Math.min(10, Math.round(node.workload / currentParent.children.length));
    const newTeamRelief = Math.min(5, Math.round(10 / (targetParent.children.length + 1)));
    
    if (currentTeamWorkload + currentTeamImpact > 90) {
      cons.push(`Current team workload will increase to over 90%, which is unsustainable`);
    } else if (currentTeamWorkload + currentTeamImpact > 80) {
      cons.push(`Current team workload will increase to ${currentTeamWorkload + currentTeamImpact}%, which is high`);
    }
    
    if (targetTeamWorkload - newTeamRelief < 60) {
      cons.push(`New team may be underutilized with workload dropping to ${targetTeamWorkload - newTeamRelief}%`);
    } else {
      pros.push(`Will help balance workload in new team, reducing it by ~${newTeamRelief}%`);
    }
    
    // Salary implications
    const salaryDifference = 0; // In a real system, this might change based on the new role
    
    return {
      employeeId: '',
      employeeName: '',
      currentManagerId: null,
      destinationId: null,
      destinationName: null,
      pros,
      cons,
      workloadChange: estimatedNewWorkload - node.workload,
      costChange: salaryDifference
    };
  };
  
  const handleNodeDrag = (nodeId: string, targetId: string | null) => {
    if (!targetId) return;
    
    const analysis = analyzeMove(nodeId, targetId);
    setMoveAnalysis(analysis);
    setMoveModalOpen(true);
  };
  
  const handleAddNode = (node: any) => {
    // Add a new node to the organization
    console.log("Adding node:", node);
    // In a real implementation, this would update the state and backend
  };
  
  const handleUpdateNode = (node: any) => {
    // Update an existing node
    console.log("Updating node:", node);
    // In a real implementation, this would update the state and backend
  };
  
  const handleDeleteNode = (nodeId: number) => {
    // Delete a node
    console.log("Deleting node:", nodeId);
    setDeleteModalOpen(true);
    // In a real implementation, this would update the state and backend
  };
  
  const handleAddConnection = (connection: any) => {
    // Add a new connection
    console.log("Adding connection:", connection);
    // In a real implementation, this would update the state and backend
  };
  
  const handleDeleteConnection = (connectionId: number) => {
    // Delete a connection
    console.log("Deleting connection:", connectionId);
    // In a real implementation, this would update the state and backend
  };
  
  const confirmMove = () => {
    if (!moveAnalysis) return;
    
    const newOrgData = cloneOrgData(orgData);
    
    if (moveAnalysis.destinationId !== null) {
      moveNodeToNewParent(
        newOrgData,
        moveAnalysis.employeeId,
        moveAnalysis.destinationId
      );
    }
    
    // Add to simulation history
    const newHistory = [...simulationHistory.slice(0, simulationIndex + 1), newOrgData];
    setSimulationHistory(newHistory);
    setSimulationIndex(newHistory.length - 1);
    setOrgData(newOrgData);
    setMoveModalOpen(false);
  };
  
  const cancelMove = () => {
    setMoveModalOpen(false);
    setMoveAnalysis(null);
  };
  
  const nextSimulation = () => {
    if (simulationIndex < simulationHistory.length - 1) {
      setSimulationIndex(simulationIndex + 1);
      setOrgData(simulationHistory[simulationIndex + 1]);
    }
  };
  
  const prevSimulation = () => {
    if (simulationIndex > 0) {
      setSimulationIndex(simulationIndex - 1);
      setOrgData(simulationHistory[simulationIndex - 1]);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-semibold">Organization Structure</h2>
        <div className="space-x-2">
          <button
            onClick={prevSimulation}
            disabled={simulationIndex === 0}
            className="px-4 py-2 text-sm bg-gray-200 rounded disabled:opacity-50"
          >
            Previous Change
          </button>
          <button
            onClick={nextSimulation}
            disabled={simulationIndex === simulationHistory.length - 1}
            className="px-4 py-2 text-sm bg-gray-200 rounded disabled:opacity-50"
          >
            Next Change
          </button>
        </div>
      </div>
      
      <div className="flex flex-1 gap-4">
        <div className="w-3/4 h-[800px] bg-white p-4 rounded-lg shadow">
          {/* Use the OrgChart component here */}
          <div className="w-full h-full border rounded">
            {/* Import the OrgChart component from our updated implementation */}
            {nodes.length > 0 && (
              <OrgChart
                nodes={nodes}
                connections={connections}
                onNodeAdd={handleAddNode}
                onNodeUpdate={handleUpdateNode}
                onNodeDelete={handleDeleteNode}
                onConnectionAdd={handleAddConnection}
                onConnectionDelete={handleDeleteConnection}
              />
            )}
          </div>
        </div>
        
        <div className="w-1/4">
          {selectedNode && (
            <EmployeeDetailsPanel
              employee={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          )}
          
          {!selectedNode && (
            <div className="bg-white p-4 rounded-lg shadow h-full">
              <h3 className="text-lg font-medium mb-4">Organization Insights</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-700">Workload Distribution</h4>
                  <div className="mt-2 h-4 bg-gray-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${calculateTeamWorkload(orgData)}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Average team workload: {Math.round(calculateTeamWorkload(orgData))}%
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700">Structure Health</h4>
                  <p className="text-sm text-gray-600">
                    {orgData.children.length} direct reports to CEO
                  </p>
                  <p className="text-sm text-gray-600">
                    {orgData.children.reduce((acc, child) => acc + child.children.length, 0)}{" "}
                    middle managers
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700">Select an employee</h4>
                  <p className="text-sm text-gray-600">
                    Click on an employee in the chart to see their details and get AI
                    recommendations.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal for confirming employee moves */}
      <ConfirmationModal
        open={moveModalOpen}
        title="Confirm Organization Change"
        onConfirm={confirmMove}
        onCancel={cancelMove}
      >
        {moveAnalysis && (
          <div className="space-y-4">
            <p>
              Move <span className="font-medium">{moveAnalysis.employeeName}</span> to
              report to{" "}
              <span className="font-medium">
                {moveAnalysis.destinationName || "no manager (top level)"}
              </span>
              ?
            </p>
            
            <div>
              <h4 className="font-medium text-gray-700">Pros:</h4>
              <ul className="list-disc pl-5 space-y-1">
                {moveAnalysis.pros.map((pro, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700">Cons:</h4>
              <ul className="list-disc pl-5 space-y-1">
                {moveAnalysis.cons.map((con, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    {con}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700">Workload Impact:</h4>
              <p
                className={`text-sm ${
                  moveAnalysis.workloadChange > 0
                    ? "text-green-600"
                    : moveAnalysis.workloadChange < 0
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {moveAnalysis.workloadChange > 0
                  ? `+${moveAnalysis.workloadChange.toFixed(1)}%`
                  : `${moveAnalysis.workloadChange.toFixed(1)}%`}{" "}
                workload efficiency
              </p>
            </div>
            
            {moveAnalysis.costChange !== undefined && (
              <div>
                <h4 className="font-medium text-gray-700">Cost Impact:</h4>
                <p
                  className={`text-sm ${
                    moveAnalysis.costChange < 0
                      ? "text-green-600"
                      : moveAnalysis.costChange > 0
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}
                >
                  {moveAnalysis.costChange < 0
                    ? `-$${Math.abs(moveAnalysis.costChange).toLocaleString()}`
                    : `+$${moveAnalysis.costChange.toLocaleString()}`}{" "}
                  annual cost
                </p>
              </div>
            )}
          </div>
        )}
      </ConfirmationModal>
      
      {/* Modal for confirming employee deletion */}
      <ConfirmationModal
        open={deleteModalOpen}
        title="Confirm Employee Removal"
        onConfirm={() => {
          // Implementation would go here
          setDeleteModalOpen(false);
        }}
        onCancel={() => setDeleteModalOpen(false)}
      >
        <div className="space-y-4">
          <p>
            Are you sure you want to remove this employee from the organization?
          </p>
          <p className="text-sm text-gray-600">
            This action will redistribute their workload and responsibilities to
            other team members.
          </p>
        </div>
      </ConfirmationModal>
    </div>
  );
} 