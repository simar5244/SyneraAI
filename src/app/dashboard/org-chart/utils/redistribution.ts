/**
 * Utility functions for handling employee duty redistribution
 */

interface Employee {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  utilization?: any;
  utilizationScore?: number;
  [key: string]: any;
}

interface Node {
  id: string;
  data: Employee;
  [key: string]: any;
}

interface Duty {
  duty: string;
  intensity: number;
  hours?: number;
  id?: string;
  [key: string]: any;
}

interface DutyAssignment {
  dutyId: string;
  employeeEmail: string;
  score: number;
  duty: Duty;
}

interface RedistributionDetails {
  successorAssignments: {
    email: string;
    name: string;
    duties: Duty[];
    utilizationIncrease: number;
  }[];
}

/**
 * Handle the removal of an employee by redistributing their duties to their successors
 * 
 * @param employeeData - The employee being removed
 * @param successors - Array of successor employees
 * @param nodes - All nodes in the organization chart
 * @param dutyAssignments - Optional assignments of which duties go to which successors
 * @returns Updated nodes and redistribution details
 */
export const handleEmployeeRemovalWithRedistribution = (
  employeeData: Employee,
  successors: Employee[],
  nodes: Node[],
  dutyAssignments?: DutyAssignment[]
): { updatedNodes: Node[], redistributionDetails: RedistributionDetails } => {
  // Make a copy of nodes to avoid mutating the original
  const updatedNodes = [...nodes];
  
  // Initialize redistribution details
  const redistributionDetails: RedistributionDetails = {
    successorAssignments: []
  };
  
  // Get all duties of the employee being removed
  const duties = employeeData.jobResponsibilities || employeeData.job_intensity_analysis?.duties || [];
  
  // If there are explicit duty assignments, use those
  if (dutyAssignments && dutyAssignments.length > 0) {
    // Group duties by successor
    const assignmentsBySuccessor = new Map<string, Duty[]>();
    
    dutyAssignments.forEach(assignment => {
      const duties = assignmentsBySuccessor.get(assignment.employeeEmail) || [];
      duties.push(assignment.duty);
      assignmentsBySuccessor.set(assignment.employeeEmail, duties);
    });
    
    // Update each successor node with their new duties
    Array.from(assignmentsBySuccessor.entries()).forEach(([email, assignedDuties]) => {
      const successorIndex = updatedNodes.findIndex(node => node.data.email === email);
      
      if (successorIndex >= 0) {
        const successor = updatedNodes[successorIndex];
        const existingDuties = successor.data.jobResponsibilities || [];
        
        // Add the new duties
        const newDuties = [...existingDuties, ...assignedDuties];
        
        // Calculate utilization increase
        const utilizationIncrease = calculateUtilizationIncrease(assignedDuties);
        
        // Update the node
        updatedNodes[successorIndex] = {
          ...successor,
          data: {
            ...successor.data,
            jobResponsibilities: newDuties,
            
            // Update utilization score
            utilizationScore: (successor.data.utilizationScore || 0.5) + utilizationIncrease,
            utilization: {
              ...successor.data.utilization,
              score: (successor.data.utilization?.score || 0.5) + utilizationIncrease
            }
          }
        };
        
        // Add to redistribution details
        redistributionDetails.successorAssignments.push({
          email,
          name: successor.data.name || `${successor.data.firstName || ''} ${successor.data.lastName || ''}`,
          duties: assignedDuties,
          utilizationIncrease
        });
      }
    });
  } else {
    // Fallback to evenly distributing duties if no specific assignments
    const dutiesPerSuccessor = Math.ceil(duties.length / successors.length);
    
    successors.forEach((successor, index) => {
      // Calculate which duties go to this successor
      const startIdx = index * dutiesPerSuccessor;
      const endIdx = Math.min(startIdx + dutiesPerSuccessor, duties.length);
      const assignedDuties = duties.slice(startIdx, endIdx);
      
      if (assignedDuties.length === 0) return; // No duties assigned to this successor
      
      // Find successor in nodes
      const successorIndex = updatedNodes.findIndex(node => node.data.email === successor.email);
      
      if (successorIndex >= 0) {
        const successorNode = updatedNodes[successorIndex];
        const existingDuties = successorNode.data.jobResponsibilities || [];
        
        // Calculate utilization increase
        const utilizationIncrease = calculateUtilizationIncrease(assignedDuties);
        
        // Update the node
        updatedNodes[successorIndex] = {
          ...successorNode,
          data: {
            ...successorNode.data,
            jobResponsibilities: [...existingDuties, ...assignedDuties],
            
            // Update utilization
            utilizationScore: (successorNode.data.utilizationScore || 0.5) + utilizationIncrease,
            utilization: {
              ...successorNode.data.utilization,
              score: (successorNode.data.utilization?.score || 0.5) + utilizationIncrease
            }
          }
        };
        
        // Add to redistribution details
        redistributionDetails.successorAssignments.push({
          email: successor.email,
          name: successor.name || `${successor.firstName || ''} ${successor.lastName || ''}`,
          duties: assignedDuties,
          utilizationIncrease
        });
      }
    });
  }
  
  return { updatedNodes, redistributionDetails };
};

/**
 * Calculate the utilization increase from a set of duties
 */
const calculateUtilizationIncrease = (duties: Duty[]): number => {
  if (!duties || duties.length === 0) return 0;
  
  // Sum the intensity of all duties
  const totalIntensity = duties.reduce((sum, duty) => {
    // If hours are defined, convert to intensity (assume 40-hour workweek)
    if (duty.hours) {
      return sum + (duty.hours / 40);
    } 
    // Otherwise use the intensity directly
    return sum + (duty.intensity || 0.1);
  }, 0);
  
  // Scale the increase (this is a heuristic - adjust as needed)
  return totalIntensity / 10;
}; 