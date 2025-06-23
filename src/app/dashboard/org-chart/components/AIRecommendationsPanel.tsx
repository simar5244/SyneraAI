import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {Scrollbar } from "@/components/ui/scrollbar";
import { Separator } from "@/components/ui/separator";
import { FaTimes } from "react-icons/fa";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';
import { EmployeeWithSalary } from './AddedCostPrompt';

interface AIRecommendationsPanelProps {
  recommendations: any;
  nodes: any[];
  edges: any[];
  setNodes: any;
  setEdges: any;
  setAddedEmployees: any;
  setRemovedEmployees: any;
  setDeletedEmployees: any;
  handleUpdateEmployee: any;
  forceRelayout: any;
  onClose: any;
}

const AIRecommendationsPanel: React.FC<AIRecommendationsPanelProps> = ({
  recommendations,
  nodes,
  edges,
  setNodes,
  setEdges,
  setAddedEmployees,
  setRemovedEmployees,
  setDeletedEmployees,
  handleUpdateEmployee,
  forceRelayout,
  onClose
}) => {
  const [expandedRecommendations, setExpandedRecommendations] = useState<number[]>([]);
  // Counter to generate unique names and emails for newly added employees
  const newEmployeeCounterRef = useRef(1);

  const [appliedRecommendations, setAppliedRecommendations] = useState<number[]>([]);
  const [selectedRationale, setSelectedRationale] = useState<{title: string, content: string} | null>(null);
  
  // Store a reference to the original nodes and edges to prevent them from being reset
  const [originalState] = useState({
    nodesRef: [...nodes],
    edgesRef: [...edges]
  });
  
  // Keep track of all changes made by recommendations
  const appliedChangesRef = useRef<{
    nodeChanges: Map<string, any>;
    edgeChanges: Map<string, any>;
    addedNodeIds: Set<string>;
    removedNodeIds: Set<string>;
    addedEdgeIds: Set<string>;
    removedEdgeIds: Set<string>;
    isApplyingChanges: boolean;
    updateCount: number;
  }>({
    nodeChanges: new Map(),
    edgeChanges: new Map(),
    addedNodeIds: new Set(),
    removedNodeIds: new Set(),
    addedEdgeIds: new Set(),
    removedEdgeIds: new Set(),
    isApplyingChanges: false,
    updateCount: 0
  });
  
  // Use useEffect to ensure changes persist but prevent infinite loops
  useEffect(() => {
    console.log("AIRecommendationsPanel: nodes or edges changed", 
      appliedChangesRef.current.isApplyingChanges ? "(applying changes)" : "",
      "updateCount:", appliedChangesRef.current.updateCount);
    
    // Only apply tracked changes if we're not already in the process of applying changes
    // and we have nodes/edges to work with
    if (!appliedChangesRef.current.isApplyingChanges && 
        (nodes.length > 0 || edges.length > 0)) {
      
      // Limit the number of update cycles to prevent infinite loops
      if (appliedChangesRef.current.updateCount > 10) {
        console.error("Too many update cycles detected, stopping to prevent infinite loop");
        return;
      }
      
      // Check if we have changes to apply
      const hasNodeChanges = appliedChangesRef.current.nodeChanges.size > 0 || 
                            appliedChangesRef.current.addedNodeIds.size > 0 || 
                            appliedChangesRef.current.removedNodeIds.size > 0;
                            
      const hasEdgeChanges = appliedChangesRef.current.edgeChanges.size > 0 || 
                            appliedChangesRef.current.addedEdgeIds.size > 0 || 
                            appliedChangesRef.current.removedEdgeIds.size > 0;
      
      if (hasNodeChanges || hasEdgeChanges) {
        console.log("DEBUG: Scheduling applyTrackedChanges");
        // Use setTimeout to break the React update cycle
        setTimeout(() => {
          applyTrackedChanges();
        }, 0);
      }
    }
  }, [nodes, edges]);
  
  // Function to apply all tracked changes to ensure they persist
  const applyTrackedChanges = () => {
    // Prevent recursive calls
    if (appliedChangesRef.current.isApplyingChanges) {
      console.log("DEBUG: Already applying changes, skipping");
      return;
    }
    
    appliedChangesRef.current.isApplyingChanges = true;
    appliedChangesRef.current.updateCount++;
    
    console.log("DEBUG: Applying tracked changes", appliedChangesRef.current);
    
    try {
      // Apply node changes
      if (appliedChangesRef.current.nodeChanges.size > 0 || 
          appliedChangesRef.current.addedNodeIds.size > 0 || 
          appliedChangesRef.current.removedNodeIds.size > 0) {
        
        console.log("DEBUG: Reapplying node changes to ensure persistence");
        console.log("DEBUG: Current nodes count:", nodes.length);
        console.log("DEBUG: Node changes:", Array.from(appliedChangesRef.current.nodeChanges.keys()));
        console.log("DEBUG: Added node IDs:", Array.from(appliedChangesRef.current.addedNodeIds));
        console.log("DEBUG: Removed node IDs:", Array.from(appliedChangesRef.current.removedNodeIds));
        
        setNodes((prevNodes: any[]) => {
          // Start with nodes that shouldn't be removed
          let updatedNodes = prevNodes.filter((node: any) => 
            !appliedChangesRef.current.removedNodeIds.has(node.id)
          );
          
          // Apply changes to existing nodes
          updatedNodes = updatedNodes.map((node: any) => {
            if (appliedChangesRef.current.nodeChanges.has(node.id)) {
              const changes = appliedChangesRef.current.nodeChanges.get(node.id);
              console.log(`DEBUG: Applying changes to node ${node.id}`, changes);
              return {
                ...node,
                ...changes,
                data: {
                  ...node.data,
                  ...(changes.data || {})
                }
              };
            }
            return node;
          });
          
          // Add any nodes that were added by recommendations but might be missing
          const currentNodeIds = new Set(updatedNodes.map((n: any) => n.id));
          appliedChangesRef.current.addedNodeIds.forEach((nodeId: string) => {
            if (!currentNodeIds.has(nodeId) && appliedChangesRef.current.nodeChanges.has(nodeId)) {
              console.log(`DEBUG: Adding missing node ${nodeId}`);
              updatedNodes.push(appliedChangesRef.current.nodeChanges.get(nodeId));
            }
          });
          
          console.log("DEBUG: Updated nodes count after changes:", updatedNodes.length);
          return updatedNodes;
        });
      }
      
      // Apply edge changes
      if (appliedChangesRef.current.edgeChanges.size > 0 || 
          appliedChangesRef.current.addedEdgeIds.size > 0 || 
          appliedChangesRef.current.removedEdgeIds.size > 0) {
        
        console.log("DEBUG: Reapplying edge changes to ensure persistence");
        console.log("DEBUG: Current edges count:", edges.length);
        console.log("DEBUG: Edge changes:", Array.from(appliedChangesRef.current.edgeChanges.keys()));
        console.log("DEBUG: Added edge IDs:", Array.from(appliedChangesRef.current.addedEdgeIds));
        console.log("DEBUG: Removed edge IDs:", Array.from(appliedChangesRef.current.removedEdgeIds));
        
        setEdges((prevEdges: any[]) => {
          // Start with edges that shouldn't be removed
          let updatedEdges = prevEdges.filter((edge: any) => 
            !appliedChangesRef.current.removedEdgeIds.has(edge.id)
          );
          
          // Apply changes to existing edges
          updatedEdges = updatedEdges.map((edge: any) => {
            if (appliedChangesRef.current.edgeChanges.has(edge.id)) {
              console.log(`DEBUG: Applying changes to edge ${edge.id}`);
              return {
                ...edge,
                ...appliedChangesRef.current.edgeChanges.get(edge.id)
              };
            }
            return edge;
          });
          
          // Add any edges that were added by recommendations but might be missing
          const currentEdgeIds = new Set(updatedEdges.map((e: any) => e.id));
          appliedChangesRef.current.addedEdgeIds.forEach((edgeId: string) => {
            if (!currentEdgeIds.has(edgeId) && appliedChangesRef.current.edgeChanges.has(edgeId)) {
              console.log(`DEBUG: Adding missing edge ${edgeId}`);
              updatedEdges.push(appliedChangesRef.current.edgeChanges.get(edgeId));
            }
          });
          
          console.log("DEBUG: Updated edges count after changes:", updatedEdges.length);
          return updatedEdges;
        });
      }
    } finally {
      // Reset the flag after a delay to allow React to process the updates
      setTimeout(() => {
        appliedChangesRef.current.isApplyingChanges = false;
        console.log("DEBUG: Finished applying changes");
      }, 100);
    }
  };

  const toggleRecommendation = (index: number) => {
    setExpandedRecommendations(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index) 
        : [...prev, index]
    );
  };

  const applySingleRecommendation = (rec: any, index: number) => {
    try {
      console.log("DEBUG: Applying recommendation:", rec.type, rec);
      
      // Reset the update count when applying a new recommendation
      appliedChangesRef.current.updateCount = 0;
      
      switch (rec.type) {
        case "move_employee":
          if (rec.employeeId) {
            console.log(`DEBUG: Moving employee ${rec.employeeId} from current department to ${rec.toDepartment}`);
            
            // Instead of changing department field, we'll:
            // 1. Find a manager/lead in the target department
            // 2. Create a connection to that person
            // 3. Remove old connections
            
            const employeeNode = nodes.find((node: any) => node.id === rec.employeeId);
            if (!employeeNode) {
              console.error(`Could not find employee node with ID ${rec.employeeId}`);
              return;
            }
            
            // Find potential new managers in the target department
            const targetDeptManagers = nodes.filter((node: any) => 
              node.data.department === rec.toDepartment && 
              !node.data.isDeleted &&
              (node.data.jobTitle?.toLowerCase().includes('manager') || 
               node.data.jobTitle?.toLowerCase().includes('director') ||
               node.data.jobTitle?.toLowerCase().includes('lead'))
            );
            
            // If no managers found, find any employee in the target department
            const targetDeptEmployees = nodes.filter((node: any) => 
              node.data.department === rec.toDepartment && 
              !node.data.isDeleted &&
              node.id !== rec.employeeId
            );
            
            const newManager = targetDeptManagers.length > 0 
              ? targetDeptManagers[0] 
              : targetDeptEmployees.length > 0 
                ? targetDeptEmployees[0] 
                : null;
            
            if (newManager) {
              console.log(`DEBUG: Found new manager in ${rec.toDepartment} department:`, newManager.id);
              
              // Batch all our changes to minimize state updates
              const updatedNodes = [...nodes];
              const updatedEdges = edges.filter((edge: any) => edge.target !== rec.employeeId);
              
              // Create new connection to the manager in target department
              const newEdge = {
                id: `edge-${newManager.id}-${rec.employeeId}`,
                source: newManager.id,
                target: rec.employeeId,
                type: "default"
              };
              
              console.log("DEBUG: Adding new department connection:", newEdge);
              
              // Track the edge changes
              edges.forEach(edge => {
                if (edge.target === rec.employeeId) {
                  appliedChangesRef.current.removedEdgeIds.add(edge.id);
                }
              });
              appliedChangesRef.current.addedEdgeIds.add(newEdge.id);
              appliedChangesRef.current.edgeChanges.set(newEdge.id, newEdge);
              
              // Add the new edge
              updatedEdges.push(newEdge);
              
              // Update the node's department
              const nodeIndex = updatedNodes.findIndex((node: any) => node.id === rec.employeeId);
              if (nodeIndex !== -1) {
                const updatedNode = {
                  ...updatedNodes[nodeIndex],
                  data: {
                    ...updatedNodes[nodeIndex].data,
                    department: rec.toDepartment
                  }
                };
                
                updatedNodes[nodeIndex] = updatedNode;
                
                // Track the node changes
                appliedChangesRef.current.nodeChanges.set(rec.employeeId, updatedNode);
              }
              
              // Batch update both nodes and edges
              setNodes(updatedNodes);
              setEdges(updatedEdges);
              
              // Mark this recommendation as applied
              setAppliedRecommendations(prev => [...prev, index]);
              
              // Force relayout after a delay to ensure changes persist
              setTimeout(() => {
                console.log("DEBUG: Forcing relayout after moving employee");
                forceRelayout();
                // Force another relayout after a longer delay to ensure changes stick
                setTimeout(() => {
                  console.log("DEBUG: Second relayout to ensure changes persist");
                  forceRelayout();
                }, 1000);
              }, 500);
            } else {
              console.log(`DEBUG: No manager found in ${rec.toDepartment} department, just updating department field`);
              // Fall back to just changing the department field
              const updatedNodes = nodes.map((node: any) => {
                if (node.id === rec.employeeId) {
                  const updatedNode = {
                    ...node,
                    data: {
                      ...node.data,
                      department: rec.toDepartment
                    }
                  };
                  
                  // Track the node changes
                  appliedChangesRef.current.nodeChanges.set(node.id, updatedNode);
                  
                  return updatedNode;
                }
                return node;
              });
              
              // Batch update nodes
              setNodes(updatedNodes);
              
              // Mark this recommendation as applied
              setAppliedRecommendations(prev => [...prev, index]);
              
              setTimeout(() => {
                forceRelayout();
                // Force another relayout after a longer delay to ensure changes stick
                setTimeout(() => {
                  forceRelayout();
                }, 1000);
              }, 500);
            }
          }
          break;
          
        case "add_job_duty":
          if (rec.employeeId && rec.duty) {
            console.log(`Adding job duty "${rec.duty}" to employee ${rec.employeeId}`);
            
            const employeeNode = nodes.find((node: any) => node.id === rec.employeeId);
            if (employeeNode && employeeNode.data) {
              const existingDuties = employeeNode.data.jobResponsibilities || employeeNode.data.jobDuties || [];
              
              // Check if duty already exists
              if (!existingDuties.some((duty: any) => duty.duty === rec.duty)) {
                const updatedDuties = [
                  ...existingDuties,
                  { duty: rec.duty, hours: rec.hours || 5 }
                ];
                
                // Update the employee with new duties
                handleUpdateEmployee({
                  ...employeeNode.data,
                  id: employeeNode.id,
                  jobResponsibilities: updatedDuties,
                  jobDuties: updatedDuties
                });
                
                // Track the node changes
                appliedChangesRef.current.nodeChanges.set(employeeNode.id, {
                  ...employeeNode,
                  data: {
                    ...employeeNode.data,
                    jobResponsibilities: updatedDuties,
                    jobDuties: updatedDuties
                  }
                });
                
                // Mark this recommendation as applied
                setAppliedRecommendations(prev => [...prev, index]);
                
                // Highlight the node temporarily
                setNodes((prevNodes: any[]) => {
                  return prevNodes.map((node: any) => {
                    if (node.id === rec.employeeId) {
                      const updatedNode = {
                        ...node,
                        style: {
                          ...node.style,
                          border: '2px solid #3b82f6',
                          boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                        }
                      };
                      
                      // Track the node changes with highlighting
                      appliedChangesRef.current.nodeChanges.set(node.id, updatedNode);
                      
                      return updatedNode;
                    }
                    return node;
                  });
                });
                
                // Reset highlight after animation
                setTimeout(() => {
                  setNodes((prevNodes: any[]) => {
                    return prevNodes.map((node: any) => {
                      if (node.id === rec.employeeId) {
                        const { border, boxShadow, ...restStyle } = node.style || {};
                        const updatedNode = {
                          ...node,
                          style: restStyle
                        };
                        
                        // Update tracked changes without highlight styling
                        appliedChangesRef.current.nodeChanges.set(node.id, updatedNode);
                        
                        return updatedNode;
                      }
                      return node;
                    });
                  });
                  
                  // Ensure changes persist
                  setTimeout(applyTrackedChanges, 100);
                }, 2000);
              }
            }
          }
          break;
          
        case "remove_job_duty":
          if (rec.employeeId && rec.duty) {
            console.log(`Removing job duty "${rec.duty}" from employee ${rec.employeeId}`);
            
            const employeeNode = nodes.find((node: any) => node.id === rec.employeeId);
            if (employeeNode && employeeNode.data) {
              const existingDuties = employeeNode.data.jobResponsibilities || employeeNode.data.jobDuties || [];
              
              // Filter out the duty to remove
              const updatedDuties = existingDuties.filter(
                (duty: any) => duty.duty !== rec.duty
              );
              
              // If duties changed, update the employee
              if (updatedDuties.length !== existingDuties.length) {
                handleUpdateEmployee({
                  ...employeeNode.data,
                  id: employeeNode.id,
                  jobResponsibilities: updatedDuties,
                  jobDuties: updatedDuties
                });
                
                // Track the node changes
                appliedChangesRef.current.nodeChanges.set(employeeNode.id, {
                  ...employeeNode,
                  data: {
                    ...employeeNode.data,
                    jobResponsibilities: updatedDuties,
                    jobDuties: updatedDuties
                  }
                });
                
                // Mark this recommendation as applied
                setAppliedRecommendations(prev => [...prev, index]);
                
                // Highlight the node temporarily
                setNodes((prevNodes: any[]) => {
                  return prevNodes.map((node: any) => {
                    if (node.id === rec.employeeId) {
                      return {
                        ...node,
                        style: {
                          ...node.style,
                          border: '2px solid #3b82f6',
                          boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                        }
                      };
                    }
                    return node;
                  });
                });
                
                // Reset highlight after animation
                setTimeout(() => {
                  setNodes((prevNodes: any[]) => {
                    return prevNodes.map((node: any) => {
                      if (node.id === rec.employeeId) {
                        const { border, boxShadow, ...restStyle } = node.style || {};
                        return {
                          ...node,
                          style: restStyle
                        };
                      }
                      return node;
                    });
                  });
                }, 2000);
              }
            }
          }
          break;
          
        case "change_job_duty_hours":
          if (rec.employeeId && rec.duty && rec.newHours) {
            console.log(`Changing hours for job duty "${rec.duty}" to ${rec.newHours} hours for employee ${rec.employeeId}`);
            
            const employeeNode = nodes.find((node: any) => node.id === rec.employeeId);
            if (employeeNode && employeeNode.data) {
              const existingDuties = employeeNode.data.jobResponsibilities || employeeNode.data.jobDuties || [];
              
              // Find and update the specific duty's hours
              const updatedDuties = existingDuties.map((duty: any) => {
                if (duty.duty === rec.duty) {
                  return { ...duty, hours: rec.newHours };
                }
                return duty;
              });
              
              // Update the employee with modified duties
              handleUpdateEmployee({
                ...employeeNode.data,
                id: employeeNode.id,
                jobResponsibilities: updatedDuties,
                jobDuties: updatedDuties
              });
              
              // Track the node changes
              appliedChangesRef.current.nodeChanges.set(employeeNode.id, {
                ...employeeNode,
                data: {
                  ...employeeNode.data,
                  jobResponsibilities: updatedDuties,
                  jobDuties: updatedDuties
                }
              });
              
              // Mark this recommendation as applied
              setAppliedRecommendations(prev => [...prev, index]);
              
              // Highlight the node temporarily
              setNodes((prevNodes: any[]) => {
                return prevNodes.map((node: any) => {
                  if (node.id === rec.employeeId) {
                    return {
                      ...node,
                      style: {
                        ...node.style,
                        border: '2px solid #3b82f6',
                        boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                      }
                    };
                  }
                  return node;
                });
              });
              
              // Reset highlight after animation
              setTimeout(() => {
                setNodes((prevNodes: any[]) => {
                  return prevNodes.map((node: any) => {
                    if (node.id === rec.employeeId) {
                      const { border, boxShadow, ...restStyle } = node.style || {};
                      return {
                        ...node,
                        style: restStyle
                      };
                    }
                    return node;
                  });
                });
              }, 2000);
            }
          }
          break;
          
        case "add_employee":
          // Create a unique ID for the new employee
          const newEmployeeId = `employee-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          console.log(`Creating new employee with ID: ${newEmployeeId} in department ${rec.toDepartment}`);
          
          // Find a good position for the new node
          const departmentNodes = nodes.filter((node: any) => 
            node.data.department === rec.toDepartment && !node.data.isDeleted
          );
          
          // Calculate position - ensure it's visible in the viewport
          let newNodePosition = { x: 300, y: 300 };
          if (departmentNodes.length > 0) {
            const avgX = departmentNodes.reduce((sum: number, node: any) => sum + node.position.x, 0) / departmentNodes.length;
            const avgY = departmentNodes.reduce((sum: number, node: any) => sum + node.position.y, 0) / departmentNodes.length;
            newNodePosition = { x: avgX + 200, y: avgY + 150 };
          }

          // Generate unique name and email for each new employee
          const uniqueIndex = newEmployeeCounterRef.current++;
          const baseFirstName = (rec.employeeName?.split(" ")[0] || "Employee").replace(/[^a-zA-Z]/g, "");
          const firstName = baseFirstName;
          const lastName = `${uniqueIndex}`;
          const randomSuffix = Math.floor(Math.random() * 1000000);
          const email = `employee.${randomSuffix}@company.com`;

          // Populate job duties / hours / tools
          const recommendedDuties = Array.isArray(rec.jobDuties) && rec.jobDuties.length > 0
            ? rec.jobDuties
            : [{
                duty: rec.newJobTitle ? `Perform ${rec.newJobTitle} responsibilities` : "General responsibilities",
                hours: rec.hours || 5,
                tools: rec.tools || ""
              }];

          // Create a complete employee object with all required fields
          const newEmployee = {
            id: newEmployeeId,
            firstName,
            lastName,
            jobTitle: rec.newJobTitle || "Employee",
            department: rec.toDepartment || "General",
            email,
            salary: rec.recommendedSalary || 50000,
            jobResponsibilities: recommendedDuties,
            jobDuties: recommendedDuties,
            attritionAssessment: {
              attrition_score: 0.3,
              attrition_risk: "low"
            },
            utilizationAssessment: {
              utilization_score: 0.5
            },
            utilization: {
              score: 0.5,
              category: "moderate"
            },
            calculatedUtilization: {
              score: 0.5,
              category: "moderate"
            },
            attritionRisk: "low",
            calculatedAttritionRisk: "low",
            isNew: true
          };

          
          // Create the node object for ReactFlow with a highlighted style
          const newNodeObj = {
            id: newEmployeeId,
            type: "employee", // Make sure this matches a registered node type
            position: newNodePosition,
            data: newEmployee,
            // Add styling to make it stand out
            style: {
              border: '2px solid #22c55e',
              boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)',
              zIndex: 1000
            }
          };
          
          console.log("Adding new node to graph:", newNodeObj);
          
          // Add to added employees for cost tracking first
          setAddedEmployees((prev: any[]) => [
            ...prev,
            {
              id: newEmployeeId,
              firstName: newEmployee.firstName,
              lastName: newEmployee.lastName,
              salary: newEmployee.salary
            }
          ]);
          
          // Find a supervisor if available in the same department
          const potentialSupervisors = departmentNodes.filter((node: any) => 
            node.data.jobTitle?.toLowerCase().includes('manager') || 
            node.data.jobTitle?.toLowerCase().includes('director') ||
            node.data.jobTitle?.toLowerCase().includes('lead')
          );
          
          // Create a new edge if we found a supervisor
          let newEdge = null;
          if (potentialSupervisors.length > 0) {
            const supervisor = potentialSupervisors[0];
            newEdge = {
              id: `edge-${supervisor.id}-${newEmployeeId}`,
              source: supervisor.id,
              target: newEmployeeId,
              type: "default",
              // Add styling to make it stand out
              style: { stroke: '#22c55e', strokeWidth: 2 }
            };
            
            // Add supervision duty to the supervisor
            const supervisorName = `${supervisor.data.firstName || ""} ${supervisor.data.lastName || ""}`.trim();
            const employeeName = `${newEmployee.firstName || ""} ${newEmployee.lastName || ""}`.trim();
            
            const existingDuties = supervisor.data.jobResponsibilities || supervisor.data.jobDuties || [];
            const supervisionDuty = `Supervise ${employeeName}`;
            
            if (!existingDuties.some((duty: any) => duty.duty === supervisionDuty)) {
              handleUpdateEmployee({
                ...supervisor.data,
                id: supervisor.id,
                jobResponsibilities: [...existingDuties, { duty: supervisionDuty, hours: 5 }],
                jobDuties: [...existingDuties, { duty: supervisionDuty, hours: 5 }]
              });
            }
          }
          
          // Update nodes state with the new employee
          setNodes((prevNodes: any[]) => {
            console.log("Current nodes before adding:", prevNodes.length);
            const updatedNodes = [...prevNodes, newNodeObj];
            console.log("Updated nodes after adding employee:", updatedNodes.length);
            
            // Track the new node
            appliedChangesRef.current.addedNodeIds.add(newEmployeeId);
            appliedChangesRef.current.nodeChanges.set(newEmployeeId, newNodeObj);
            
            return updatedNodes;
          });
          
          // Add the edge if we have one
          if (newEdge) {
            console.log("Adding supervisor edge:", newEdge);
            setEdges((prevEdges: any[]) => {
              // Track the new edge
              appliedChangesRef.current.addedEdgeIds.add(newEdge.id);
              appliedChangesRef.current.edgeChanges.set(newEdge.id, newEdge);
              
              return [...prevEdges, newEdge];
            });
          }
          
          // Mark this recommendation as applied
          setAppliedRecommendations(prev => [...prev, index]);
          
          // Force relayout after a delay to ensure changes persist
          setTimeout(() => {
            console.log("Forcing relayout after adding employee");
            forceRelayout();
            // Force another relayout after a longer delay to ensure changes stick
            setTimeout(() => {
              console.log("Second relayout to ensure employee addition persists");
              forceRelayout();
              applyTrackedChanges(); // Reapply our changes after the relayout
            }, 1000);
          }, 800);
          break;
          
        case "remove_employee":
          if (rec.employeeId) {
            console.log(`Removing employee with ID: ${rec.employeeId}`);
            const employeeNode = nodes.find((node: any) => node.id === rec.employeeId);
            
            if (employeeNode && employeeNode.data) {
              console.log("Found employee node to remove:", employeeNode);
              
              // Handle duty reassignments first
              if (rec.dutyReassignments && rec.dutyReassignments.length > 0) {
                console.log("Processing duty reassignments:", rec.dutyReassignments);
                
                rec.dutyReassignments.forEach((reassignment: any) => {
                  const targetNode = nodes.find((node: any) => node.id === reassignment.assignToEmployeeId);
                  if (targetNode && targetNode.data) {
                    console.log(`Assigning duty "${reassignment.duty}" to employee ${targetNode.id}`);
                    
                    const existingDuties = targetNode.data.jobResponsibilities || targetNode.data.jobDuties || [];
                    
                    const updatedDuties = [
                      ...existingDuties,
                      { duty: reassignment.duty, hours: 5 }
                    ];
                    
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
              
              // Save the deleted employee in the deletedEmployees array for potential undo
              const originalConnections = edges.filter((edge: any) => 
                edge.source === rec.employeeId || edge.target === rec.employeeId
              );
              
              setDeletedEmployees((prev: any[]) => [
                ...prev,
                {
                  employeeNode,
                  originalConnections,
                  dutyAssignments: rec.dutyReassignments || []
                }
              ]);
              
              // Add to removed employees for cost tracking
              setRemovedEmployees((prev: any[]) => [
                ...prev,
                {
                  id: rec.employeeId,
                  firstName: employeeNode.data.firstName || "",
                  lastName: employeeNode.data.lastName || "",
                  salary: employeeNode.data.salary || 0
                }
              ]);
              
              // Remove connections first
              setEdges((prevEdges: any[]) => {
                const filteredEdges = prevEdges.filter((edge: any) => 
                  edge.source !== rec.employeeId && edge.target !== rec.employeeId
                );
                console.log("Updated edges after removing connections:", filteredEdges.length);
                
                // Track removed edges
                prevEdges.forEach(edge => {
                  if (edge.source === rec.employeeId || edge.target === rec.employeeId) {
                    appliedChangesRef.current.removedEdgeIds.add(edge.id);
                  }
                });
                
                return filteredEdges;
              });
              
              // Visibly mark the employee as deleted and move far off-screen
              setNodes((prevNodes: any[]) => {
                const updatedNodes = prevNodes.map((node: any) => {
                  if (node.id === rec.employeeId) {
                    console.log(`Marking node ${node.id} as deleted and moving off-screen`);
                    const updatedNode = {
                      ...node,
                      position: { x: -99999, y: -99999 }, // Move far off-screen
                      style: {
                        opacity: 0.5,
                        border: '2px solid #ef4444',
                        boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
                      },
                      data: {
                        ...node.data,
                        isDeleted: true
                      }
                    };
                    
                    // Track the node changes
                    appliedChangesRef.current.removedNodeIds.add(node.id);
                    
                    return updatedNode;
                  }
                  return node;
                });
                console.log("Updated nodes after marking as deleted:", updatedNodes.length);
                return updatedNodes;
              });
              
              // Mark this recommendation as applied
              setAppliedRecommendations(prev => [...prev, index]);
              
              // Force relayout after a delay to ensure changes persist
              setTimeout(() => {
                console.log("Forcing relayout after removing employee");
                forceRelayout();
                // Force another relayout after a longer delay to ensure changes stick
                setTimeout(() => {
                  console.log("Second relayout to ensure employee removal persists");
                  forceRelayout();
                  applyTrackedChanges(); // Reapply our changes after the relayout
                }, 1000);
              }, 800);
            }
          }
          break;
          
        case "change_supervisor":
          if (rec.employeeId && rec.newSupervisorId) {
            console.log(`Changing supervisor for ${rec.employeeId} to ${rec.newSupervisorId}`);
            
            // Remove existing supervisor connection
            const filteredEdges = edges.filter((edge: any) => edge.target !== rec.employeeId);
            
            // Add new supervisor connection with highlighted style
            const newEdge = {
              id: `edge-${rec.newSupervisorId}-${rec.employeeId}`,
              source: rec.newSupervisorId,
              target: rec.employeeId,
              type: "default",
              // Add styling to make it stand out
              style: { stroke: '#8b5cf6', strokeWidth: 2 }
            };
            
            console.log("Adding new supervisor edge:", newEdge);
            
            // Update edges with the new connection
            setEdges((prevEdges: any[]) => {
              // Track edge changes
              prevEdges.forEach(edge => {
                if (edge.target === rec.employeeId) {
                  appliedChangesRef.current.removedEdgeIds.add(edge.id);
                }
              });
              appliedChangesRef.current.addedEdgeIds.add(newEdge.id);
              appliedChangesRef.current.edgeChanges.set(newEdge.id, newEdge);
              
              return [...filteredEdges, newEdge];
            });
            
            // Add supervision duty to new supervisor
            const supervisorNode = nodes.find((node: any) => node.id === rec.newSupervisorId);
            if (supervisorNode && supervisorNode.data) {
              const employeeNode = nodes.find((node: any) => node.id === rec.employeeId);
              if (employeeNode && employeeNode.data) {
                const employeeName = `${employeeNode.data.firstName || ""} ${employeeNode.data.lastName || ""}`.trim();
                
                const existingDuties = supervisorNode.data.jobResponsibilities || supervisorNode.data.jobDuties || [];
                
                const supervisionDuty = `Supervise ${employeeName}`;
                if (!existingDuties.some((duty: any) => duty.duty === supervisionDuty)) {
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
                  
                  // Track supervisor node changes
                  appliedChangesRef.current.nodeChanges.set(supervisorNode.id, {
                    ...supervisorNode,
                    data: {
                      ...supervisorNode.data,
                      jobResponsibilities: updatedDuties,
                      jobDuties: updatedDuties
                    }
                  });
                }
              }
            }
            
            // Mark this recommendation as applied
            setAppliedRecommendations(prev => [...prev, index]);
            
            // Force relayout after a delay to ensure changes persist
            setTimeout(() => {
              console.log("Forcing relayout after changing supervisor");
              forceRelayout();
              // Force another relayout after a longer delay to ensure changes stick
              setTimeout(() => {
                console.log("Second relayout to ensure supervisor change persists");
                forceRelayout();
                applyTrackedChanges(); // Reapply our changes after the relayout
              }, 1000);
            }, 500);
        }
        break;
        
        case 'change_salary':
          try {
            // Use newSalary if available, otherwise fall back to recommendedSalary
            const salaryToUse = rec.newSalary !== undefined ? rec.newSalary : rec.recommendedSalary;
            
            console.log('DEBUG: Processing salary change recommendation:', {
              employeeId: rec.employeeId,
              newSalary: salaryToUse,
              currentSalary: rec.currentSalary,
              recommendation: rec
            });
            
            if (!rec.employeeId || salaryToUse === undefined) {
              console.error('DEBUG: Missing employeeId or salary in salary change recommendation:', {
                employeeId: rec.employeeId,
                newSalary: rec.newSalary,
                recommendedSalary: rec.recommendedSalary,
                hasEmployeeId: !!rec.employeeId,
                hasNewSalary: rec.newSalary !== undefined,
                hasRecommendedSalary: rec.recommendedSalary !== undefined
              });
              break;
            }
            
            // Find the employee node
            const employeeNode = nodes.find((node: any) => node.id === rec.employeeId);
            if (!employeeNode) {
              console.error(`DEBUG: Could not find employee node with ID ${rec.employeeId}`);
              break;
            }
            
            // Get current salary from node data or default to 0
            const currentSalary = employeeNode.data.salary || 0;
            const newSalary = Number(salaryToUse);
            
            // Update the recommendation object with current salary for display
            rec.currentSalary = currentSalary;
            
            // Only proceed if there's an actual salary change
            if (newSalary === currentSalary) {
              console.log('DEBUG: No salary change needed, current and new salary are the same');
              setAppliedRecommendations(prev => [...prev, index]);
              break;
            }
            
            // Update the employee's salary
            const updateData = {
              ...employeeNode.data,
              id: employeeNode.id,
              salary: newSalary,
              previousSalary: currentSalary, // Store previous salary for tracking
              salaryChange: newSalary - currentSalary // Calculate the change
            };
            
            console.log('DEBUG: Updating employee with new salary data:', updateData);
            
            // Update the employee data
            handleUpdateEmployee(updateData);
            
            // Track this as a salary change in the added/removed employees
            const salaryChangeEmployee = {
              id: employeeNode.id,
              firstName: employeeNode.data.firstName || '',
              lastName: employeeNode.data.lastName || '',
              email: employeeNode.data.email || '',
              salary: newSalary,
              previousSalary: currentSalary,
              salaryChange: newSalary - currentSalary
            };
            
            console.log('DEBUG: Tracking salary change in cost prompt:', salaryChangeEmployee);
            
            if (newSalary > currentSalary) {
              // Salary increase - add to addedEmployees
              setAddedEmployees((prev: any[]) => [...prev, salaryChangeEmployee]);
            } else if (newSalary < currentSalary) {
              // Salary decrease - add to removedEmployees
              setRemovedEmployees((prev: any[]) => [...prev, salaryChangeEmployee]);
            }
            
            // Mark this recommendation as applied
            setAppliedRecommendations(prev => [...prev, index]);
            
            // Force relayout after a delay to ensure changes persist
            setTimeout(() => {
              console.log("DEBUG: Forcing relayout after salary change");
              forceRelayout();
              // Force another relayout after a longer delay to ensure changes stick
              setTimeout(() => {
                console.log("DEBUG: Second relayout to ensure salary change persists");
                forceRelayout();
              }, 1000);
            }, 500);
          } catch (error) {
            console.error('Error applying salary change:', error);
          }
          break;
          
        case "change_job_duties":
          console.log('DEBUG: Processing change_job_duties recommendation:', {
            employeeId: rec.employeeId,
            recommendation: rec,
            hasJobDuties: !!rec.jobDuties,
            hasNewDuty: !!rec.newDuty,
            hasNewJobDuties: !!rec.newJobDuties
          });
          
          if (!rec.employeeId) {
            console.error('DEBUG: No employeeId in recommendation');
            break;
          }
          
          // Expect the LLM to provide properly formatted jobDuties in the recommendation
          // The LLM should provide an array of duty objects with this structure:
          // [{
          //   duty: string (e.g. 'Assist in legal court proceedings'),
          //   hours: number,
          //   tools: string
          // }]
          let dutiesToSet = [];
          
          if (rec.jobDuties && Array.isArray(rec.jobDuties)) {
            // Use the provided jobDuties if they exist and are properly formatted
            dutiesToSet = rec.jobDuties;
            console.log('DEBUG: Using provided jobDuties:', dutiesToSet);
          } else if (rec.newJobDuties && Array.isArray(rec.newJobDuties)) {
            // Fallback to newJobDuties if available
            dutiesToSet = rec.newJobDuties;
            console.log('DEBUG: Using newJobDuties as fallback:', dutiesToSet);
          } else {
            // If no valid duties provided, log an error and use a default
            console.error('DEBUG: No valid jobDuties or newJobDuties array found in recommendation');
            dutiesToSet = [{
              duty: 'Perform assigned legal support tasks',
              hours: 40,
              tools: ''
            }];
          }
          
          if (!dutiesToSet.length) {
            console.error('DEBUG: No jobDuties, newDuty, or usable rationale found in recommendation');
            toast.error("Error", {
              description: "Could not determine job duties to update. Please try again or update manually.",
            });
            break;
          }
          
          const node = nodes.find((n: any) => n.id === rec.employeeId);
          console.log('DEBUG: Found node for employee:', node);
          
          if (!node) {
            console.error('DEBUG: Could not find node for employee:', rec.employeeId);
            break;
          }
          
          console.log('DEBUG: Current node data:', {
            id: node.id,
            currentDuties: node.data.jobDuties || node.data.jobResponsibilities,
            newDuties: dutiesToSet
          });
          
          try {
            // Create a properly formatted duties array
            const formattedDuties = dutiesToSet.map((duty: any) => {
              // If duty is a string, clean it up and convert to object
              if (typeof duty === 'string') {
                // Clean up the duty text - remove any rationale after a period or colon
                let cleanDuty = duty.split('.')[0].split(':')[0].trim();
                // If the duty is too long or looks like a sentence, take the first few words
                if (cleanDuty.split(' ').length > 8) {
                  cleanDuty = cleanDuty.split(' ').slice(0, 8).join(' ') + '...';
                }
                return {
                  duty: cleanDuty,
                  hours: 40, // Default to 40 hours if not specified
                  tools: ''
                };
              }
              // If it's already an object, clean the duty text and ensure required fields
              let cleanDuty = duty.duty || '';
              if (typeof cleanDuty === 'string') {
                cleanDuty = cleanDuty.split('.')[0].split(':')[0].trim();
                if (cleanDuty.split(' ').length > 8) {
                  cleanDuty = cleanDuty.split(' ').slice(0, 8).join(' ') + '...';
                }
              }
              return {
                duty: cleanDuty || 'New duty',
                hours: typeof duty.hours === 'number' ? duty.hours : 40,
                tools: duty.tools || ''
              };
            });
            
            const updateData = {
              ...node.data,
              id: node.id,
              jobDuties: formattedDuties,
              jobResponsibilities: formattedDuties, // Ensure both fields are set
              // Update the utilization data to trigger a re-render
              utilization: {
                ...(node.data.utilization || {}),
                lastUpdated: new Date().toISOString()
              }
            };
            
            console.log('DEBUG: Calling handleUpdateEmployee with:', updateData);
            
            handleUpdateEmployee(updateData);
            
            console.log('DEBUG: Updating applied recommendations list');
            setAppliedRecommendations(prev => {
              const newList = [...prev, index];
              console.log('DEBUG: New applied recommendations:', newList);
              return newList;
            });
            
            // Show success message
            toast.success("Job duties updated", {
              description: `Successfully updated job duties for ${node.data.firstName || 'the employee'}`,
            });
            
            console.log('DEBUG: Successfully processed change_job_duties');
          } catch (error) {
            console.error('DEBUG: Error in change_job_duties:', error);
            toast.error("Error", {
              description: `Failed to update job duties: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
          }
          break;
          
        case "change_job_title":
          if (rec.employeeId) {
            const node = nodes.find((n: any) => n.id === rec.employeeId);
            if (node) {
              const oldSal = node.data.salary || 0;
              const newSal = rec.recommendedSalary ?? oldSal;
              handleUpdateEmployee({
                ...node.data,
                id: node.id,
                jobTitle: rec.newJobTitle || node.data.jobTitle,
                salary: newSal,
              });
              const delta = newSal - oldSal;
              if (delta > 0) {
                setAddedEmployees(prev => [...prev, { 
                  id: node.id, 
                  firstName: node.data.firstName, 
                  lastName: node.data.lastName, 
                  salary: delta 
                }]);
              } else if (delta < 0) {
                setRemovedEmployees(prev => [...prev, { 
                  id: node.id, 
                  firstName: node.data.firstName, 
                  lastName: node.data.lastName, 
                  salary: -delta 
                }]);
              }
              setAppliedRecommendations(prev => [...prev, index]);
            }
          }
          break;
      }
          // Show success message
      toast.success("Applied", {
        description: `Successfully applied the recommendation`,
      });
      
    } catch (error) {
      console.error("DEBUG: Error applying recommendation:", error);
      toast.error("Error", {
        description: `Failed to apply recommendation: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };

  // Handle closing the panel without reverting changes
  const handleClose = () => {
    // Just close the panel without reverting any changes
    onClose();
  };

  // Apply all tracked changes before unmounting
  useEffect(() => {
    return () => {
      // Final application of changes before unmounting
      console.log("DEBUG: Component unmounting, final application of changes");
      applyTrackedChanges();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
        <div className="flex justify-center items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-black">AI Recommendations</h2>
        </div>
        
        <div className="overflow-y-auto p-4 flex-grow">
          <div className="space-y-3">
            {recommendations.recommendations.map((rec: any, index: number) => (
              <div 
                key={index} 
                className={`border ${appliedRecommendations.includes(index) ? 'border-green-300 bg-green-50' : 'border-gray-200'} rounded-md shadow-sm`}
              >
                <div 
                  className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleRecommendation(index)}
                >
                  <h3 
                    className="font-medium text-black cursor-pointer hover:text-purple-700"
                    onClick={() => {
                      const title = (() => {
                        switch(rec.type) {
                          case "move_employee": return `Move ${rec.employeeName || "Employee"} to ${rec.toDepartment}`;
                          case "add_employee": return `Add new ${rec.newJobTitle || "Employee"} to ${rec.toDepartment}`;
                          case "remove_employee": return `Remove ${rec.employeeName || "Employee"}`;
                          case "change_supervisor": return `Change supervisor for ${rec.employeeName || "Employee"}`;
                          case "add_job_duty": return `Add duty "${rec.duty}" to ${rec.employeeName || "Employee"}`;
                          case "remove_job_duty": return `Remove duty "${rec.duty}" from ${rec.employeeName || "Employee"}`;
                          case "change_job_duty_hours": return `Change hours for duty "${rec.duty}" to ${rec.newHours} hours for ${rec.employeeName || "Employee"}`;
                          case "update_job_duties": 
                            if (rec.action === 'add') return `Add new duties to ${rec.employeeName || "Employee"}`;
                            if (rec.action === 'update') return `Update duties for ${rec.employeeName || "Employee"}`;
                            if (rec.action === 'delete') return `Remove duties from ${rec.employeeName || "Employee"}`;
                            return `Update duties for ${rec.employeeName || "Employee"}`;
                          case "update_compensation": 
                            return `Update compensation for ${rec.employeeName || "Employee"}`;
                          case "change_job_duties": return `Change duties for ${rec.employeeName || "Employee"}`;
                          case "change_job_title": return `Change job title for ${rec.employeeName || "Employee"} to ${rec.newJobTitle || ""}`;
                          default: return "AI Recommendation";
                        }
                      })();
                      setSelectedRationale({
                        title,
                        content: rec.rationale
                      });
                    }}
                  >
                    {(() => {
                      switch(rec.type) {
                        case "move_employee": return `Move ${rec.employeeName || "Employee"} to ${rec.toDepartment}`;
                        case "add_employee": return `Add new ${rec.newJobTitle || "Employee"} to ${rec.toDepartment}`;
                        case "remove_employee": return `Remove ${rec.employeeName || "Employee"}`;
                        case "change_supervisor": return `Change supervisor for ${rec.employeeName || "Employee"}`;
                        case "add_job_duty": return `Add duty "${rec.duty}" to ${rec.employeeName || "Employee"}`;
                        case "remove_job_duty": return `Remove duty "${rec.duty}" from ${rec.employeeName || "Employee"}`;
                        case "change_job_duty_hours": return `Change hours for duty "${rec.duty}" to ${rec.newHours} hours for ${rec.employeeName || "Employee"}`;
                        case "update_job_duties": 
                          if (rec.action === 'add') return `Add new duties to ${rec.employeeName || "Employee"}`;
                          if (rec.action === 'update') return `Update duties for ${rec.employeeName || "Employee"}`;
                          if (rec.action === 'delete') return `Remove duties from ${rec.employeeName || "Employee"}`;
                          return `Update duties for ${rec.employeeName || "Employee"}`;
                        case "update_compensation":
                        case "change_salary":
                          if (!rec.newSalary) return `Update salary for ${rec.employeeName || "Employee"}`;
                          const currentSalary = rec.currentSalary || 0;
                          const newSalary = Number(rec.newSalary);
                          const salaryChange = currentSalary > 0 ? 
                            ` (${newSalary > currentSalary ? '+' : ''}${((newSalary - currentSalary) / currentSalary * 100).toFixed(0)}%)` : '';
                          return `Update salary for ${rec.employeeName || "Employee"} to $${newSalary.toLocaleString()}${salaryChange}`;
                        case "change_job_duties": return `Change duties for ${rec.employeeName || "Employee"}`;
                          case "change_job_title": return `Change job title for ${rec.employeeName || "Employee"} to ${rec.newJobTitle || ""}`;
                          default: return "AI Recommendation";
                      }
                    })()}
                  </h3>
                  
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      applySingleRecommendation(rec, index);
                    }}
                    className={`${
                      appliedRecommendations.includes(index) 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-purple-600 hover:bg-purple-700'
                    } text-white rounded-md px-4 py-1`}
                    disabled={appliedRecommendations.includes(index)}
                  >
                    {appliedRecommendations.includes(index) ? 'Applied' : 'Apply'}
                  </Button>
                </div>
                
                {expandedRecommendations.includes(index) && (
                  <div className="p-3 pt-0 border-t border-gray-100">
                    <p className="text-sm text-black mb-2">{rec.rationale}</p>
                    
                    {rec.type === "remove_employee" && rec.dutyReassignments && rec.dutyReassignments.length > 0 && (
                      <div className="mt-2 bg-gray-50 p-2 rounded-md">
                        <p className="text-sm font-medium text-black">Duty reassignments:</p>
                        <ul className="text-sm ml-4 list-disc text-black">
                          {rec.dutyReassignments.map((reassign: any, idx: number) => {
                            const targetEmployee = nodes.find((node: any) => node.id === reassign.assignToEmployeeId);
                            const targetName = targetEmployee && targetEmployee.data ? 
                              `${targetEmployee.data.firstName || ""} ${targetEmployee.data.lastName || ""}`.trim() : 
                              reassign.assignToEmployeeId;
                            
                            return (
                              <li key={idx}>
                                "{reassign.duty}" → {targetName}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <Button
            variant="outline"
            onClick={handleClose}
            className="mr-2 border-red-500 text-red-500 hover:bg-red-50"
          >
            Close
          </Button>
          <Button
            onClick={() => {
              // Apply recommendations sequentially with delays
              const applySequentially = async () => {
                // Create a copy of the current nodes and edges to work with
                let currentNodes = [...nodes];
                let currentEdges = [...edges];
                
                for (let i = 0; i < recommendations.recommendations.length; i++) {
                  // Skip already applied recommendations
                  if (appliedRecommendations.includes(i)) {
                    continue;
                  }
                  
                  const rec = recommendations.recommendations[i];
                  console.log(`Applying recommendation ${i + 1}/${recommendations.recommendations.length}`);
                  
                  // Apply the recommendation
                  applySingleRecommendation(rec, i);
                  
                  // Mark as applied
                  setAppliedRecommendations(prev => [...prev, i]);
                  
                  // Wait between applying each recommendation
                  await new Promise(resolve => setTimeout(resolve, 1500));
                }
                
                // Final relayout with a longer delay to ensure all changes are applied
                setTimeout(() => {
                  console.log("Final relayout after applying all recommendations");
                  forceRelayout();
                  
                  // Ensure all tracked changes are applied
                  setTimeout(() => {
                    console.log("Final application of tracked changes");
                    applyTrackedChanges();
                  }, 500);
                }, 2000);
              };
              
              applySequentially();
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            disabled={appliedRecommendations.length === recommendations.recommendations.length}
          >
            Apply All
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIRecommendationsPanel;
