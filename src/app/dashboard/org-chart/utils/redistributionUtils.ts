import { Node, Edge } from 'reactflow';
import { getUtilizationCategory } from './colorUtils';

// Interface for a job duty from job_intensity_analysis
interface JobDuty {
  duty: string;
  intensity: number;
  hours_per_week?: number;
  required_skills?: string[];
}

// Interface for successor information
interface Successor {
  email: string;
  name?: string;
  score: number; // Skill match score (0-1)
  readinessLevel?: string;
  utilization?: number;
  currentRole?: string;
  matchingSkills?: string[];
}

/**
 * Calculate the optimal redistribution of job duties to successors
 * based on both skill match (50%) and available capacity (50%)
 */
export const calculateDutyRedistribution = (
  removedEmployeeData: any,
  successors: Successor[],
  nodes: Node[]
): {
  updatedNodes: Node[];
  redistributionDetails: any[];
} => {
  console.log('Calculating duty redistribution for:', removedEmployeeData.email);
  
  // If no job duties or successors, return original nodes
  if (!Array.isArray(successors) || successors.length === 0) {
    console.log('No successors available for redistribution');
    return { updatedNodes: nodes, redistributionDetails: [] };
  }
  
  // Extract job duties from removed employee
  const jobDuties: JobDuty[] = removedEmployeeData.job_intensity_analysis?.duties || [];
  if (jobDuties.length === 0) {
    console.log('No job duties found for redistribution');
    return { updatedNodes: nodes, redistributionDetails: [] };
  }
  
  console.log(`Found ${jobDuties.length} duties and ${successors.length} successors for redistribution`);
  
  // Limit to top 3 successors
  const topSuccessors = successors.slice(0, 3);
  
  // Ensure successors have utilization values
  const successorsWithData = topSuccessors.map(successor => {
    // Find the successor node to get current utilization
    const successorNode = nodes.find(node => node.id === successor.email);
    const utilization = successor.utilization || 
                        successorNode?.data?.utilization?.score || 0.5;
    
    return {
      ...successor,
      utilization,
      node: successorNode
    };
  });
  
  // Calculate the redistribution weights for each successor
  const totalRedistributionWeights = calculateRedistributionWeights(successorsWithData);
  
  // Distribute duties based on the calculated weights
  const redistributionDetails = redistributeDuties(jobDuties, successorsWithData, totalRedistributionWeights);
  
  // Update node utilization based on redistribution
  const updatedNodes = nodes.map(node => {
    // Merge redistributed duties into job_intensity_analysis.duties if exists
    const existingAnalysis = node.data.job_intensity_analysis;
    const existingDuties: JobDuty[] = existingAnalysis?.duties ?? [];

    const redistribution = redistributionDetails.find(r => r.successorEmail === node.id);
    
    if (!redistribution) return node;
    
    // Update node with new utilization score
    const currentScore = node.data?.utilization?.score || 0.5;
    const newScore = Math.min(currentScore + redistribution.utilizationChange, 1.5);
    
    // Merge redistributed duties into existing job_intensity_analysis.duties
    const newAssigned: JobDuty[] = redistribution.assignedDuties.map(d => ({
      duty: d.duty,
      intensity: d.intensity,
      hours_per_week: d.hours_per_week,
      required_skills: d.required_skills,
      redistributed: true,
      originalOwner: removedEmployeeData.email
    }));
    const mergedDuties = [...existingDuties, ...newAssigned];
    
    return {
      ...node,
      data: {
        ...node.data,
        utilization: {
          score: newScore,
          category: getUtilizationCategory(newScore)
        },
        job_intensity_analysis: {
          ...existingAnalysis,
          duties: mergedDuties
        }
      }
    };
  });
  
  return { updatedNodes, redistributionDetails };
};

/**
 * Calculate redistribution weights for each successor
 * based on 50% skill match and 50% available capacity
 */
const calculateRedistributionWeights = (successors: any[]): any => {
  // Calculate available capacity (inverse of utilization)
  const availableCapacities = successors.map(successor => {
    // Normalize to 0-1 range where 1 is completely available
    // If already over-utilized (>1.0), give them a small capacity
    const utilization = successor.utilization || 0.5;
    return utilization >= 1.0 ? 0.1 : (1 - utilization);
  });
  
  // Calculate skill match scores (already 0-1)
  const skillMatchScores = successors.map(successor => successor.score);
  
  // Calculate combined weights (50% skill match, 50% available capacity)
  const combinedWeights = successors.map((_, index) => {
    return (skillMatchScores[index] * 0.5) + (availableCapacities[index] * 0.5);
  });
  
  // Normalize weights to sum to 1.0
  const totalWeight = combinedWeights.reduce((sum, weight) => sum + weight, 0);
  const normalizedWeights = combinedWeights.map(weight => weight / totalWeight);
  
  // Return full weight calculations for logging/debugging
  return {
    normalizedWeights,
    successors: successors.map((successor, index) => ({
      email: successor.email,
      skillMatch: skillMatchScores[index],
      availableCapacity: availableCapacities[index],
      combinedWeight: combinedWeights[index],
      normalizedWeight: normalizedWeights[index]
    }))
  };
};

/**
 * Redistribute job duties to balance utilization among successors
 * using 50% skill match and 50% available capacity
 */
const redistributeDuties = (
  duties: JobDuty[],
  successors: Successor[],
  weightData: {
    normalizedWeights: number[];
    successors: Array<{
      email: string;
      skillMatch: number;
      availableCapacity: number;
      combinedWeight: number;
      normalizedWeight: number;
    }>;
  }
): Array<{
  successorEmail: string;
  successorName: string;
  skillMatch: number;
  assignedDuties: JobDuty[];
  totalHoursAssigned: number;
  utilizationChange: number;
}> => {
  // Clone duties to avoid side effects
  const dutiesToAssign: JobDuty[] = JSON.parse(JSON.stringify(duties));
  
  // Initialize results structure for successors
  const results = weightData.successors.map(succ => ({
    successorEmail: succ.email,
    successorName: successors.find(s => s.email === succ.email)?.name || succ.email,
    skillMatch: succ.skillMatch,
    assignedDuties: [] as JobDuty[],
    totalHoursAssigned: 0,
    utilizationChange: 0
  }));
  
  // Track base utilization and target utilization
  const baseUtilizations = successors.map(s => s.utilization ?? 0.5);
  const avgUtilization = baseUtilizations.reduce((sum, util) => sum + util, 0) / baseUtilizations.length;
  
  // Calculate how much each successor can take to reach target utilization
  // Target = average + redistribution (based on removed employee's workload)
  const totalDutyHours = dutiesToAssign.reduce(
    (sum, duty) => sum + (duty.hours_per_week ?? (duty.intensity * 10)), 0
  );
  const totalDutyUtilChange = totalDutyHours / 40 / successors.length;
  
  // Set target utilization for all successors
  const targetUtilization = Math.min(avgUtilization + totalDutyUtilChange, 1.0);
  console.log(`Redistribution target utilization: ${targetUtilization.toFixed(2)}`);
  
  // Sort duties by descending intensity
  dutiesToAssign.sort((a: JobDuty, b: JobDuty) => b.intensity - a.intensity);
  
  // First pass: Assign duties based on skill match for 
  // successors below target utilization
  dutiesToAssign.forEach((duty, index) => {
    // Calculate duty hours
    const dutyHours = duty.hours_per_week ?? (duty.intensity * 10);
    const dutyUtilChange = dutyHours / 40;
    
    // Calculate scores for each successor (50% skill, 50% available capacity)
    const scores = results.map((result, idx) => {
      const currentUtil = baseUtilizations[idx] + result.utilizationChange;
      const belowTarget = targetUtilization - currentUtil;
      
      // Penalize successors already at or above target utilization
      const capacityFactor = belowTarget > 0 
        ? Math.min(belowTarget / dutyUtilChange, 1) // Capacity score (0-1)
        : 0.01; // Small chance for overutilized successors
      
      // Get skill match
      const skillFactor = result.skillMatch;
      
      // Weighted score: 50% skill, 50% capacity
      return (skillFactor * 0.5) + (capacityFactor * 0.5);
    });
    
    // Find best successor (highest score)
    const bestSuccessorIdx = scores.reduce(
      (bestIdx, score, idx) => score > scores[bestIdx] ? idx : bestIdx, 
      0
    );
    
    // Assign duty to best successor
    results[bestSuccessorIdx].assignedDuties.push(duty);
    results[bestSuccessorIdx].totalHoursAssigned += dutyHours;
    results[bestSuccessorIdx].utilizationChange += dutyUtilChange;
    
    // Log assignment info
    console.log(
      `Assigned duty "${duty.duty.slice(0, 20)}..." (${dutyUtilChange.toFixed(2)} util) ` +
      `to ${results[bestSuccessorIdx].successorEmail} ` +
      `(new util: ${(baseUtilizations[bestSuccessorIdx] + results[bestSuccessorIdx].utilizationChange).toFixed(2)})`
    );
  });
  
  return results;
};

/**
 * Find the top successors for an employee, including utilization data
 */
export const findSuccessorsWithData = (
  removedEmployeeData: any,
  nodes: Node[]
): Successor[] => {
  // Get successors from the removed employee data
  const successors = removedEmployeeData.successorAnalysis?.top_successors || [];
  
  if (!Array.isArray(successors) || successors.length === 0) {
    console.log('No successors found in data');
    return [];
  }
  
  // Enhance successors with utilization data from nodes
  return successors.map(successor => {
    const successorNode = nodes.find(node => node.id === successor.email);
    
    return {
      ...successor,
      utilization: successorNode?.data?.utilization?.score || 0.5
    };
  });
};

/**
 * Main function to handle duty redistribution when an employee is removed
 */
export const handleEmployeeRemovalWithRedistribution = (
  removedEmployeeId: string,
  nodes: Node[],
  edges: Edge[]
): Node[] => {
  // Find removed employee node
  const removedNode = nodes.find(node => node.id === removedEmployeeId);
  if (!removedNode) return nodes;
  
  // Find successors
  const successors = findSuccessorsWithData(removedNode.data, nodes);
  
  // If no successors, cannot redistribute
  if (successors.length === 0) return nodes.filter(node => node.id !== removedEmployeeId);
  
  // Calculate redistribution
  const { updatedNodes } = calculateDutyRedistribution(
    removedNode.data,
    successors,
    nodes.filter(node => node.id !== removedEmployeeId) // Exclude removed node
  );
  
  // Make sure to filter out the removed node from final results
  return updatedNodes.filter(node => node.id !== removedEmployeeId);
}; 