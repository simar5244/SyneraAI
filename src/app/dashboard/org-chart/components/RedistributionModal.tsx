"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FaSearch, FaFilter, FaTags, FaUserTie, FaTimes, FaChevronRight, FaInfoCircle, FaUserCheck, FaUserTimes, FaShieldAlt, FaPuzzlePiece, FaBrain, FaProjectDiagram, FaChartLine } from 'react-icons/fa';
import SuccessorViabilityCard from '@/components/SuccessorViabilityCard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

// Types for duty redistribution
interface Duty {
  duty: string;
  intensity: number;
  hours?: number;
  id?: string;
}

interface DutyAssignment {
  dutyId: string;
  employeeEmail: string;
  score: number;
  duty: Duty;
}

// Add a type for manual duty assignment
interface ManualDutyAssignment {
  dutyId: string;
  duty: any;
  successorEmail: string;
}

// Add new interface for updated utilization scores
interface UtilizationUpdate {
  email: string;
  previousScore: number;
  newScore: number;
  name: string;
}

// Add interface for successor profile data structure
interface SuccessorProfile {
  name: string;
  email: string;
  score: number;
  isViable: boolean;
  explanation: string;
  factorScores: Record<string, number>;
  factorExplanations: Record<string, string>;
  jobTitle: string;
  department: string;
  utilization: {
    score: number;
  };
  attrition: {
    score: number;
    risk: string;
  };
  tools: any[];
  skills: any[];
  scores?: Record<string, number>; // Optional scores property that can be added
}

// Custom Progress component since the imported one is missing
const Progress = ({ value = 0, className = "" }: { value: number, className?: string }) => {
  return (
    <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
      <div 
        className={`h-full rounded-full ${
          value > 100 ? 'bg-red-500' : 
          value > 90 ? 'bg-green-500' : 
          value > 70 ? 'bg-blue-400' : 'bg-blue-600'
        }`}
        style={{ width: `${Math.min(value, 150)}%` }}
      ></div>
    </div>
  );
};

// Types for props
interface RedistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any; // Employee being removed
  onRedistribute: (selectedSuccessors: string[], dutyAssignments?: DutyAssignment[]) => void;
  availableEmployees: any[]; // All employees that could receive duties
}

// Calculate total job hours for an employee
const calculateTotalJobHours = (employee: any) => {
  if (!employee || !employee.jobResponsibilities || !Array.isArray(employee.jobResponsibilities)) {
    return 0;
  }

  return employee.jobResponsibilities.reduce((total: number, duty: any) => {
    if (duty.hours) {
      return total + duty.hours;
    } else if (duty.intensity) {
      // Estimate hours based on intensity
      return total + (duty.intensity * 10);
    }
    return total;
  }, 0);
};

// Function to calculate duty assignments between successors
const calculateDutyAssignments = (
  duties: Duty[],
  selectedSuccessors: string[],
  availableEmployees: any[]
): DutyAssignment[] => {
  if (!duties.length || !selectedSuccessors.length) return [];
  
  console.log(`Calculating duty assignments for ${duties.length} duties and ${selectedSuccessors.length} selected successors`);

  // Convert selected successor emails to actual successor objects
  const successors = selectedSuccessors
    .map(email => availableEmployees.find(emp => emp.email === email))
    .filter(Boolean);

  // Get the internal extraction of successors to use for matching scores
  const extractedSuccessors = extractSuccessorData().filter(s => 
    selectedSuccessors.includes(s.email)
  );

  // Sort duties by intensity (highest first)
  const sortedDuties = [...duties].sort((a, b) => b.intensity - a.intensity);
  
  const assignments: DutyAssignment[] = [];
  const dutyScoreMap: Map<string, Map<string, number>> = new Map();
  
  // First, calculate match scores for each duty-successor pair
  for (const duty of sortedDuties) {
    const dutyScores = new Map<string, number>();
    
    for (const successor of extractedSuccessors) {
      // Calculate skill overlap
      let score = calculateSkillOverlap(duty, successor);
      
      // Adjust score based on successor viability
      if (successor.score >= 0.7) { // High match
        score *= 1.2; // Boost score for highly matched successors
      } else if (successor.score < 0.4) { // Low match
        score *= 0.8; // Reduce score for poorly matched successors
      }
      
      // Adjust score based on current utilization
      const utilizationScore = successor.utilization?.score || 
                              successor.utilization_score || 
                              successor.utilizationAssessment?.utilization_score || 0.5;
                              
      if (utilizationScore > 0.8) {
        score *= 0.8; // Penalize already overutilized employees
      } else if (utilizationScore < 0.4) {
        score *= 1.2; // Boost underutilized employees
      }
      
      dutyScores.set(successor.email, score);
    }
    
    dutyScoreMap.set(duty.id || '', dutyScores);
  }
  
  // Simple case: only one duty or one successor
  if (sortedDuties.length === 1 || extractedSuccessors.length === 1) {
    // If only one successor, assign all duties to them
    if (extractedSuccessors.length === 1) {
      const successor = extractedSuccessors[0];
      for (const duty of sortedDuties) {
        assignments.push({
          dutyId: duty.id || '',
          employeeEmail: successor.email,
          score: 1.0,
          duty: duty
        });
      }
    } 
    // If only one duty, assign to best matching successor
    else if (sortedDuties.length === 1) {
      const duty = sortedDuties[0];
      const dutyScores = dutyScoreMap.get(duty.id || '') || new Map();
      
      // Find best matching successor
      let bestSuccessorEmail = '';
      let bestScore = -1;
      
      for (const [email, score] of dutyScores.entries()) {
        if (score > bestScore) {
          bestScore = score;
          bestSuccessorEmail = email;
        }
      }
      
      if (bestSuccessorEmail) {
        assignments.push({
          dutyId: duty.id || '',
          employeeEmail: bestSuccessorEmail,
          score: bestScore,
          duty: duty
        });
      }
    }
    
    return assignments;
  }
  
  // Complex case: multiple duties and successors
  // Implement a greedy assignment algorithm that balances:
  // 1. Matching skills (score)
  // 2. Current utilization
  // 3. Distribution of duties
  
  // Track assigned duties for each successor
  const successorDutyCount = new Map<string, number>(
    extractedSuccessors.map(s => [s.email, 0])
  );
  
  // Calculate total workload weights
  const totalDutyHours = sortedDuties.reduce((sum, duty) => 
    sum + (duty.hours || 1), 0);
  
  const successorCapacity = new Map<string, number>();
  for (const successor of extractedSuccessors) {
    // Calculate capacity based on current utilization
    const utilizationScore = successor.utilization?.score || 
                            successor.utilization_score || 
                            successor.utilizationAssessment?.utilization_score || 0.5;
    
    // Higher capacity for underutilized employees
    let capacity = 1.0;
    if (utilizationScore < 0.3) capacity = 1.5;
    else if (utilizationScore < 0.5) capacity = 1.2;
    else if (utilizationScore > 0.8) capacity = 0.5;
    else if (utilizationScore > 0.7) capacity = 0.7;
    
    successorCapacity.set(successor.email, capacity);
  }
  
  // Assign duties one by one
  for (const duty of sortedDuties) {
    const dutyScores = dutyScoreMap.get(duty.id || '') || new Map();
    
    // Find best successor for this duty
    let bestSuccessorEmail = '';
    let bestAdjustedScore = -1;
    
    for (const [email, score] of dutyScores.entries()) {
      const currentAssignedCount = successorDutyCount.get(email) || 0;
      const capacity = successorCapacity.get(email) || 1.0;
      
      // Calculate adjusted score based on current duty count and capacity
      const capacityFactor = Math.max(0.1, 1.0 - (currentAssignedCount / (extractedSuccessors.length * capacity)));
      const adjustedScore = score * capacityFactor;
      
      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestSuccessorEmail = email;
      }
    }
    
    if (bestSuccessorEmail) {
      // Assign duty to best successor
      assignments.push({
        dutyId: duty.id || '',
        employeeEmail: bestSuccessorEmail,
        score: dutyScores.get(bestSuccessorEmail) || 0.5,
        duty: duty
      });
      
      // Update assigned count
      successorDutyCount.set(
        bestSuccessorEmail, 
        (successorDutyCount.get(bestSuccessorEmail) || 0) + 1
      );
    }
  }
  
  return assignments;
};

// Helper function to calculate skill overlap between duty and successor
const calculateSkillOverlap = (duty: Duty, successor: any): number => {
  // Basic implementation - look for skill/tool overlap
  let overlapScore = 0.5; // Default moderate overlap
  
  // Check if duty has associated skills
  const dutySkills = duty.skills || [];
  
  // Get successor skills
  const successorSkills = successor.skills || 
                         successor.skillsProficient || 
                         [];
  
  // Get successor tools
  const successorTools = successor.tools || 
                        successor.toolsProficient || 
                        [];
  
  // Convert all to lowercase strings for comparison
  const normalizedDutySkills = Array.isArray(dutySkills) 
    ? dutySkills.map((s: any) => typeof s === 'string' ? s.toLowerCase() : (s.name || '').toLowerCase())
    : [];
  
  const normalizedSuccessorSkills = Array.isArray(successorSkills)
    ? successorSkills.map((s: any) => typeof s === 'string' ? s.toLowerCase() : (s.name || '').toLowerCase())
    : [];
  
  const normalizedSuccessorTools = Array.isArray(successorTools)
    ? successorTools.map((t: any) => typeof t === 'string' ? t.toLowerCase() : (t.name || '').toLowerCase())
    : [];
  
  // Combine all successor capabilities
  const successorCapabilities = [...normalizedSuccessorSkills, ...normalizedSuccessorTools];
  
  // Count matches
  let matches = 0;
  for (const skill of normalizedDutySkills) {
    if (successorCapabilities.includes(skill)) {
      matches++;
    }
  }
  
  // Calculate score based on matches - more matches = higher score
  if (normalizedDutySkills.length > 0) {
    const matchRatio = matches / normalizedDutySkills.length;
    overlapScore = Math.min(0.9, 0.4 + (matchRatio * 0.5)); // Scale between 0.4 and 0.9
  }
  
  return overlapScore;
};

// Format employee name consistently
const formatEmployeeName = (employee: any): string => {
  return employee
    ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.name || employee.email
    : 'Unknown';
};

// Debug log for successor data
const debugSuccessorData = (data: any, source: string) => {
  console.log(`[DEBUG] Successor data from ${source}:`, 
    Array.isArray(data) 
      ? `Array with ${data.length} items` 
      : typeof data === 'object' && data !== null
        ? Object.keys(data)
        : typeof data
  );
};

// The main component
const RedistributionModal = ({ 
  isOpen, 
  onClose, 
  employee, 
  onRedistribute,
  availableEmployees 
}: RedistributionModalProps) => {
  // Component state
  const [selectedSuccessors, setSelectedSuccessors] = useState<string[]>([]);
  const [manualAssignments, setManualAssignments] = useState<ManualDutyAssignment[]>([]);
  const [updatedUtilization, setUpdatedUtilization] = useState<UtilizationUpdate[]>([]);
  const [isCalculatingUtilization, setIsCalculatingUtilization] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [redistErrorMessage, setRedistErrorMessage] = useState('');
  const [showSuccessorDetails, setShowSuccessorDetails] = useState<string | null>(null);

  // Extract successor data from employee or available employees
  const extractSuccessorData = () => {
    let allSuccessors: any[] = [];

    // First, check if the employee has successors property
    if (employee?.successors && Array.isArray(employee.successors)) {
      allSuccessors = [...employee.successors];
    }

    // Next, check if the employee has succession_plan property
    if (employee?.succession_plan && Array.isArray(employee.succession_plan.successors)) {
      allSuccessors = [...allSuccessors, ...employee.succession_plan.successors];
    }

    // Next, check if the employee has successionPlan property
    if (employee?.successionPlan && Array.isArray(employee.successionPlan.candidates)) {
      allSuccessors = [...allSuccessors, ...employee.successionPlan.candidates];
    }

    // If no successors found in employee object, try to find potential successors from all available employees
    if (allSuccessors.length === 0 && Array.isArray(availableEmployees)) {
      // Filter available employees who are not the current employee
      allSuccessors = availableEmployees
        .filter(emp => emp.email !== employee.email)
        .map(emp => ({
          ...emp,
          score: 0.5, // Default score
          isViable: true, // Consider all as viable by default
          explanation: `Potential successor based on availability.`
        }));
    }

    // Remove duplicates based on email
    const uniqueSuccessors = Array.from(
      new Map(allSuccessors.map(s => [s.email, s])).values()
    );

    return uniqueSuccessors;
  };

  // Calculate updated utilization scores
  const calculateUpdatedUtilization = async (assignments: DutyAssignment[]) => {
    if (!assignments.length) {
      setUpdatedUtilization([]);
      return;
    }
    
    setIsCalculatingUtilization(true);
    
    try {
      // Group assignments by successor
      const dutyAssignmentsBySuccessor: Record<string, any[]> = {};
      
      assignments.forEach(assignment => {
        if (!dutyAssignmentsBySuccessor[assignment.employeeEmail]) {
          dutyAssignmentsBySuccessor[assignment.employeeEmail] = [];
        }
        
        const duty = assignment.duty;
        dutyAssignmentsBySuccessor[assignment.employeeEmail].push(duty);
      });
      
      // Get emails of successors who will receive duties
      const successorEmails = Object.keys(dutyAssignmentsBySuccessor);
      
      // Get actual successor objects
      const successors = successorEmails.map(email => 
        availableEmployees.find(emp => emp.email === email)
      ).filter(Boolean);
      
      // Prepare payload with successor info and new duties
      const payload = {
        successors: successors.map(successor => {
          const email = successor.email;
          const newDuties = dutyAssignmentsBySuccessor[email] || [];
          
          const originalUtilization = successor.utilizationAssessment?.utilization_score || 
                                 successor.utilization_score || 0.5;
          
          return {
            email,
            originalUtilization,
            newDuties
          };
        })
      };
      
      console.log("Calling preview-utilization with payload:", payload);
      
      // Call API endpoint to calculate new utilization
      const response = await fetch('/api/organization/preview-utilization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to calculate utilization scores: ${errorText}`);
      }
      
      const utilizationResults = await response.json();
      console.log("Preview utilization results:", utilizationResults);
      
      // Format and store utilization updates
      const updates: UtilizationUpdate[] = utilizationResults.map((result: any) => {
        const successor = availableEmployees.find(emp => emp.email === result.email);
        
        return {
          email: result.email,
          previousScore: result.previousUtilization || 0.5,
          newScore: result.newUtilization || 0.5,
          name: successor ? formatEmployeeName(successor) : 'Unknown'
        };
      });
      
      setUpdatedUtilization(updates);
    } catch (error) {
      console.error('Error calculating utilization scores:', error);
      
      // Create fallback utilization updates with estimated scores
      const fallbackUpdates: UtilizationUpdate[] = [];
      
      // Group assignments by successor
      const successorEmailSet = new Set<string>();
      assignments.forEach(a => successorEmailSet.add(a.employeeEmail));
      
      // Create estimated updates
      for (const email of successorEmailSet) {
        const successor = availableEmployees.find(emp => emp.email === email);
        if (!successor) continue;
        
        const previousScore = successor.utilizationAssessment?.utilization_score || 
                             successor.utilization_score || 0.5;
        
        // Count duties assigned to this successor
        const assignedDuties = assignments.filter(a => a.employeeEmail === email);
        
        // Sum intensity values of duties
        const intensitySum = assignedDuties.reduce((sum, a) => 
          sum + (a.duty.intensity || 0.5), 0);
        
        // Estimate new score with simple formula based on intensity
        // More duties with higher intensity = higher increase
        const scoreDelta = Math.min(0.3, intensitySum * 0.05);
        const newScore = Math.min(1.0, previousScore + scoreDelta);
        
        fallbackUpdates.push({
          email,
          previousScore,
          newScore,
          name: formatEmployeeName(successor)
        });
      }
      
      setUpdatedUtilization(fallbackUpdates);
    } finally {
      setIsCalculatingUtilization(false);
    }
  };

  // Handle redistribution
  const handleRedistribute = async () => {
    setIsLoading(true);
    setRedistErrorMessage('');
    
    try {
      if (selectedSuccessors.length === 0) {
        throw new Error('Please select at least one successor');
      }
      
      // Get duties from the employee
      const duties = getDutiesFromEmployee();
      
      // Calculate final duty assignments
      let finalAssignments: DutyAssignment[] = [];
      
      if (manualAssignments.length > 0) {
        // Use manual assignments if available
        finalAssignments = manualAssignments.map(assignment => ({
          dutyId: assignment.dutyId,
          employeeEmail: assignment.successorEmail,
          score: 1.0,
          duty: assignment.duty
        }));
      } else {
        // Calculate automatic assignments
        finalAssignments = calculateDutyAssignments(duties, selectedSuccessors, availableEmployees);
      }
      
      // Calculate updated utilization scores if not already done
      if (updatedUtilization.length === 0) {
        await calculateUpdatedUtilization(finalAssignments);
      }
      
      // Group duties by successor for API call
      const dutyAssignmentsBySuccessor: Record<string, any[]> = {};
      
      finalAssignments.forEach(assignment => {
        if (!dutyAssignmentsBySuccessor[assignment.employeeEmail]) {
          dutyAssignmentsBySuccessor[assignment.employeeEmail] = [];
        }
        
        // Format duty properly for API
        const duty = assignment.duty;
        dutyAssignmentsBySuccessor[assignment.employeeEmail].push(duty);
      });
      
      // Create detailed successor updates for API
      const successorUpdates = selectedSuccessors.map(email => {
        const successor = availableEmployees.find(emp => emp.email === email);
        const name = successor ? formatEmployeeName(successor) : 'Unknown';
        const newDuties = dutyAssignmentsBySuccessor[email] || [];
        const utilizationUpdate = updatedUtilization.find(u => u.email === email);
        
        return {
          email,
          name,
          newDuties,
          previousUtilization: utilizationUpdate?.previousScore || 0.5,
          newUtilization: utilizationUpdate?.newScore || 0.5
        };
      });
      
      // Call redistribution API
      const redistResponse = await fetch('/api/organization/redistribute-duties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeToRemove: {
            email: employee.email,
            name: formatEmployeeName(employee)
          },
          successorUpdates
        })
      });
      
      if (!redistResponse.ok) {
        const errorText = await redistResponse.text();
        throw new Error(`Failed to redistribute duties: ${errorText}`);
      }
      
      // Call the parent component's redistribution handler
      onRedistribute(selectedSuccessors, finalAssignments);
      
    } catch (error) {
      console.error('Error during redistribution:', error);
      setRedistErrorMessage(error instanceof Error ? error.message : 'An error occurred during redistribution');
    } finally {
      setIsLoading(false);
    }
  };

  // Get duties from the employee
  const getDutiesFromEmployee = () => {
    return employee?.jobResponsibilities || [];
  };

  // Format successor for viability card
  const formatSuccessorForViabilityCard = (successor: any): SuccessorProfile => {
    // Extract data from successor object
    const name = successor.name || successor.email || 'Unknown';
    const email = successor.email || 'unknown@example.com';
    const score = successor.score || successor.match || successor.match_score || 0.5;
    const isViable = successor.isViable || successor.readinessLevel !== 'Low';
    const explanation = successor.summary || successor.explanation || 'No explanation provided';
    const jobTitle = successor.jobTitle || successor.title || 'Unknown';
    const department = successor.department || 'Unknown';
    const utilization = successor.utilization || successor.utilizationAssessment || { score: 0.5 };
    const attrition = successor.attrition || successor.attritionAssessment || { score: 0.5, risk: 'medium' };
    const tools = successor.tools || successor.toolsProficient || [];
    const skills = successor.skills || successor.skillsProficient || [];
    
    // Extract factor scores and explanations
    const factorScores: Record<string, number> = {};
    const factorExplanations: Record<string, string> = {};
    
    const factors = successor.factors || successor.factorScores || {};
    for (const [factor, data] of Object.entries(factors)) {
      if (typeof data === 'object' && data !== null) {
        factorScores[factor] = data.score || 0.5;
        factorExplanations[factor] = data.explanation || 'No explanation provided';
      } else if (typeof data === 'number') {
        factorScores[factor] = data;
        factorExplanations[factor] = 'No explanation provided';
      }
    }
    
    // Create successor profile object
    const successorProfile: SuccessorProfile = {
      name,
      email,
      score,
      isViable,
      explanation,
      factorScores,
      factorExplanations,
      jobTitle,
      department,
      utilization: {
        score: utilization.score || utilization.utilization_score || 0.5
      },
      attrition: {
        score: attrition.score || attrition.attrition_score || 0.5,
        risk: attrition.risk || attrition.attrition_risk || 'medium'
      },
      tools,
      skills
    };
    
    return successorProfile;
  };

  // Sort successors by score
  const sortSuccessorsByScore = (successors: SuccessorProfile[]) => {
    return successors.sort((a, b) => b.score - a.score);
  };

  // Toggle successor selection
  const toggleSuccessorSelection = (email: string) => {
    if (selectedSuccessors.includes(email)) {
      setSelectedSuccessors(selectedSuccessors.filter(e => e !== email));
    } else {
      setSelectedSuccessors([...selectedSuccessors, email]);
    }
  };

  // Toggle successor details view
  const toggleSuccessorDetails = (email: string) => {
    setShowSuccessorDetails(showSuccessorDetails === email ? null : email);
  };

  // Extract successor data
  const { recommendedSuccessors, nonViableSuccessors } = useMemo(() => {
    const allSuccessors = extractSuccessorData();
    // Split successors into viable and non-viable groups
    const viable = allSuccessors.filter((s: any) => s.isViable !== false).map(formatSuccessorForViabilityCard);
    const nonViable = allSuccessors.filter((s: any) => s.isViable === false).map(formatSuccessorForViabilityCard);
    
    console.log(`Found ${viable.length} recommended and ${nonViable.length} non-viable successors`);
    return { recommendedSuccessors: viable, nonViableSuccessors: nonViable };
  }, [employee, availableEmployees]);

  // Calculate total job hours for the employee
  const totalJobHours = useMemo(() => calculateTotalJobHours(employee), [employee]);

  // Calculate updated utilization scores
  useEffect(() => {
    if (selectedSuccessors.length > 0) {
      const duties = getDutiesFromEmployee();
      const assignments = calculateDutyAssignments(duties, selectedSuccessors, availableEmployees);
      calculateUpdatedUtilization(assignments);
    } else {
      setUpdatedUtilization([]);
    }
  }, [selectedSuccessors, availableEmployees, employee]);

  // Render the component
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redistribute Duties</DialogTitle>
          <div className="text-sm text-gray-500">
            <div className="space-y-1">
              <div><strong>Employee:</strong> {formatEmployeeName(employee)}</div>
              <div><strong>Total Job Hours:</strong> {totalJobHours}</div>
            </div>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Recommended Successors</h3>
            {recommendedSuccessors.length > 0 ? (
              <div className="space-y-2">
                {recommendedSuccessors.map((successor: SuccessorProfile) => (
                  <SuccessorViabilityCard
                    key={successor.email}
                    name={successor.name}
                    email={successor.email}
                    score={successor.score}
                    isViable={successor.isViable}
                    explanation={successor.explanation}
                    factorScores={successor.factorScores}
                    jobTitle={successor.jobTitle}
                    department={successor.department}
                    utilization={successor.utilization}
                    attrition={successor.attrition}
                    onViewDetails={(name, scores, explanation) => {
                      toggleSuccessorDetails(successor.email);
                    }}
                  />
                ))}
              </div>
            ) : (
              <p>No recommended successors found.</p>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Non-Viable Successors</h3>
            {nonViableSuccessors.length > 0 ? (
              <div className="space-y-2">
                {nonViableSuccessors.map((successor: SuccessorProfile) => (
                  <SuccessorViabilityCard
                    key={successor.email}
                    name={successor.name}
                    email={successor.email}
                    score={successor.score}
                    isViable={successor.isViable}
                    explanation={successor.explanation}
                    factorScores={successor.factorScores}
                    jobTitle={successor.jobTitle}
                    department={successor.department}
                    utilization={successor.utilization}
                    attrition={successor.attrition}
                    onViewDetails={(name, scores, explanation) => {
                      toggleSuccessorDetails(successor.email);
                    }}
                  />
                ))}
              </div>
            ) : (
              <p>No non-viable successors found.</p>
            )}
          </div>
        </div>
        
        <DialogFooter className="flex flex-col items-start">
          <div className="flex items-center space-x-2 mb-4">
            <Button onClick={handleRedistribute} disabled={isLoading}>
              {isLoading ? 'Redistributing...' : 'Redistribute Duties'}
            </Button>
            {redistErrorMessage && (
              <p className="text-red-500">{redistErrorMessage}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <p>Selected Successors:</p>
            <Badge>{selectedSuccessors.length}</Badge>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RedistributionModal;
