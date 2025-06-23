import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from 'lucide-react';

interface JobDuty {
  duty?: string;
  hours?: number;
  tools?: string;
  [key: string]: any;
}

interface EmployeeData {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  jobTitle?: string;
  jobDuties?: JobDuty[];
  jobResponsibilities?: JobDuty[];
  utilization?: any;
  calculatedUtilization?: any;
  attritionRisk?: string;
  calculatedAttritionRisk?: string;
  [key: string]: any;
}

interface DeleteEmployeePromptProps {
  employee: EmployeeData;
  allEmployees: EmployeeData[];
  onCancel: () => void;
  onConfirmDelete: (employeeId: string, dutyAssignments: DutyAssignment[]) => void;
}

interface DutyAssignment {
  duty: JobDuty;
  assignedToEmployeeId: string;
}

const DeleteEmployeePrompt = ({ 
  employee, 
  allEmployees, 
  onCancel, 
  onConfirmDelete 
}: DeleteEmployeePromptProps) => {
  const [dutyAssignments, setDutyAssignments] = useState<DutyAssignment[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<EmployeeData[]>([]);

  // Initialize duty assignments
  useEffect(() => {
    const duties = employee.jobDuties || employee.jobResponsibilities || [];
    const initialAssignments = duties.map(duty => ({
      duty,
      assignedToEmployeeId: 'unassigned'
    }));
    setDutyAssignments(initialAssignments);
    
    // Debug logs
    console.log('Employee to delete:', employee);
    console.log('All employees passed to component:', allEmployees);
    
    // Filter out the employee being deleted from available employees
    // Make sure we're comparing by email since that's what we use as ID
    const filteredEmployees = allEmployees.filter(emp => {
      return emp.email !== employee.email;
    });
    
    console.log('Filtered available employees:', filteredEmployees);
    setAvailableEmployees(filteredEmployees);
  }, [employee, allEmployees]);

  // Handle assignment change
  const handleAssignmentChange = (dutyIndex: number, employeeId: string) => {
    console.log(`Assigning duty ${dutyIndex} to employee ${employeeId}`);
    setDutyAssignments(prev => {
      const updated = [...prev];
      updated[dutyIndex].assignedToEmployeeId = employeeId;
      return updated;
    });
  };

  // Check if all duties are assigned
  const allDutiesAssigned = dutyAssignments.every(assignment => 
    assignment.assignedToEmployeeId === 'unassigned' || assignment.assignedToEmployeeId !== '' || !assignment.duty.duty
  );

  // Get employee name for display
  const getEmployeeName = (employeeId: string) => {
    const emp = allEmployees.find(e => e.id === employeeId);
    return emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : 'Unknown';
  };

  // Get employee metrics for display
  const getEmployeeMetrics = (employeeId: string) => {
    const emp = allEmployees.find(e => e.id === employeeId);
    if (!emp) return { utilization: '?', attrition: '?' };
    
    // Use calculated (raw) metrics if available, otherwise use the comp metrics
    const utilScore = emp.calculatedUtilization?.score !== undefined 
      ? emp.calculatedUtilization.score 
      : (emp.utilization?.score || 0.5);
      
    const attrRisk = emp.calculatedAttritionRisk || emp.attritionRisk || 'medium';
    
    return {
      utilization: utilScore.toFixed(2),
      attrition: attrRisk
    };
  };

  // Get color for utilization score
  const getUtilizationColor = (score: number) => {
    if (score <= 0.33) return 'text-red-500';
    if (score <= 0.66) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Get color for attrition risk
  const getAttritionColor = (risk: string) => {
    if (risk === 'high') return 'text-red-500';
    if (risk === 'medium') return 'text-yellow-500';
    return 'text-green-500';
  };

  // Update the onConfirmDelete call to ensure it works
  const handleConfirmDeleteClick = () => {
    console.log('Confirming delete with assignments:', dutyAssignments);
    // Use email as fallback if id is not available
    const employeeId = employee.id || employee.email || '';
    if (!employeeId) {
      console.error('No valid ID found for employee:', employee);
      return;
    }
    onConfirmDelete(employeeId, dutyAssignments);
  };

  return (
    <Card className="w-[600px] max-h-[80vh] overflow-y-auto bg-white">
      <CardHeader className="bg-white text-black">
        <CardTitle className="text-xl font-bold">
          Delete Employee: {employee.firstName} {employee.lastName}
        </CardTitle>
        <p className="text-sm text-gray-600">
          Please assign this employee's job duties to other team members before deletion
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4 bg-white text-black">
        {dutyAssignments.length === 0 ? (
          <div className="text-center py-4">
            <p>This employee has no job duties to reassign</p>
          </div>
        ) : (
          dutyAssignments.map((assignment, index) => (
            <div key={index} className="border p-3 rounded-md">
              <div className="flex justify-between mb-2">
                <Label className="font-medium">{assignment.duty.duty || 'Unnamed duty'}</Label>
                {assignment.duty.hours && (
                  <Badge variant="outline">{assignment.duty.hours} hrs/week</Badge>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`duty-${index}`}>Reassign to:</Label>
                <Select
                  value={assignment.assignedToEmployeeId || 'unassigned'}
                  onValueChange={(value) => handleAssignmentChange(index, value || 'unassigned')}
                >
                  <SelectTrigger id={`duty-${index}`}>
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="unassigned">Leave unassigned</SelectItem>

                    {availableEmployees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName || ''} {emp.lastName || ''} {emp.jobTitle ? `(${emp.jobTitle})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {assignment.assignedToEmployeeId && (
                  <div className="mt-2 text-sm flex items-center justify-between">
                    <span>Current metrics:</span>
                    <div>
                      <span className="mr-2">
                        Util: <span className={getUtilizationColor(parseFloat(getEmployeeMetrics(assignment.assignedToEmployeeId).utilization))}>
                          {getEmployeeMetrics(assignment.assignedToEmployeeId).utilization}
                        </span>
                      </span>
                      <span>
                        Attrition: <span className={getAttritionColor(getEmployeeMetrics(assignment.assignedToEmployeeId).attrition)}>
                          {getEmployeeMetrics(assignment.assignedToEmployeeId).attrition}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {!allDutiesAssigned && dutyAssignments.length > 0 && (
          <div className="flex items-center text-amber-600 mt-2">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">Please assign all duties before proceeding</span>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between bg-white border-t pt-4">
        <Button 
          variant="destructive" 
          onClick={onCancel}
          className="bg-red-600 hover:bg-red-700"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleConfirmDeleteClick}
          disabled={!allDutiesAssigned && dutyAssignments.length > 0}
          className="bg-purple-600 hover:bg-purple-700"
        >
          Delete & Reassign Duties
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DeleteEmployeePrompt; 