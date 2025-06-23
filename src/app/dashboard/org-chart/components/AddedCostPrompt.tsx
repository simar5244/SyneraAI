import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, DollarSign } from 'lucide-react';

export interface EmployeeWithSalary {
  id: string;
  firstName: string;
  lastName: string;
  salary?: number;
  previousSalary?: number; // Track previous salary for changes
  removed?: boolean;
  salaryChange?: number; // Track salary change amount
}

interface AddedCostPromptProps {
  addedEmployees: EmployeeWithSalary[];
  removedEmployees: EmployeeWithSalary[];
}

const AddedCostPrompt = ({ addedEmployees, removedEmployees }: AddedCostPromptProps) => {
  // Split into new hires, actual removals, and salary changes
  const newHires = addedEmployees.filter(emp => emp.previousSalary === undefined);
  const actualRemoved = removedEmployees.filter(emp => emp.previousSalary === undefined);
  const salaryChanges = [...addedEmployees, ...removedEmployees].filter(emp => emp.previousSalary !== undefined);

  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate total added cost (new employees + salary increases)
  const addedCost = addedEmployees.reduce((sum, emp) => {
    // If this is a salary change (has previousSalary), only count the increase
    const salaryIncrease = emp.previousSalary && emp.salary ? 
      Math.max(0, emp.salary - emp.previousSalary) : 
      (emp.salary || 0);
    return sum + salaryIncrease;
  }, 0);
  
  // Calculate total removed cost (removed employees + salary decreases)
  const removedCost = removedEmployees.reduce((sum, emp) => {
    // If this is a salary change (has previousSalary), only count the decrease
    const salaryDecrease = emp.previousSalary && emp.salary ? 
      Math.max(0, emp.previousSalary - emp.salary) : 
      (emp.salary || 0);
    return sum + salaryDecrease;
  }, 0);
  
  // Calculate net cost (added cost - removed cost)
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
  
  return (
    <div 
      className="absolute bottom-4 left-4 z-10 cursor-pointer"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Simple cost display with gold background */}
      <div 
        className="bg-amber-100 px-3 py-1 rounded-md mb-2 text-center"
        style={{ color: 'black' }}
      >
        {formatCurrency(netCost)}
      </div>

      {/* Expanded details panel */}
      {isExpanded && (
        <Card className="w-64 shadow-md bg-white absolute left-0 bottom-8">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                
                <span className="font-medium text-sm text-black">Added Cost to Company</span>
              </div>
              <ChevronUp className="h-4 w-4 text-black" />
            </div>
            
            {/* Total cost summary */}
            <div className="mt-1 font-bold text-lg text-black">
              {formatCurrency(netCost)}
            </div>
            
            <div className="mt-3 border-t pt-2">
  {/* New Hires */}
  {newHires.length > 0 && (
    <div className="mb-2">
      <h4 className="text-xs font-medium text-black mb-1">New Hires</h4>
      <ul className="space-y-1">
        {newHires.map(emp => (
          <li key={emp.id} className="text-xs flex justify-between">
            <span className="text-black">{emp.firstName} {emp.lastName}</span>
            <span className="font-medium text-green-600">
              {formatCurrency(emp.salary || 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )}

  {/* Removed Employees */}
  {actualRemoved.length > 0 && (
    <div className="mb-2">
      <h4 className="text-xs font-medium text-black mb-1">Removed Employees</h4>
      <ul className="space-y-1">
        {actualRemoved.map(emp => (
          <li key={emp.id} className="text-xs flex justify-between">
            <span className="text-black">{emp.firstName} {emp.lastName}</span>
            <span className="font-medium text-red-600">
              -{formatCurrency(emp.salary || 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )}

  {/* Salary Changes */}
  {salaryChanges.length > 0 && (
    <div className="mb-2">
      <h4 className="text-xs font-medium text-black mb-1">Salary Changes</h4>
      <ul className="space-y-1">
        {salaryChanges.map(emp => (
          <li key={emp.id} className="text-xs flex justify-between">
            <span className="text-black">{emp.firstName} {emp.lastName}</span>
            <span className={emp.salaryChange! >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
              {(emp.salaryChange! >= 0 ? "+" : "-") + formatCurrency(Math.abs(emp.salaryChange!))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )}

  {/* Fallback */}
  {newHires.length === 0 && actualRemoved.length === 0 && salaryChanges.length === 0 && (
    <div className="text-xs text-black text-center py-2">
      No employee changes yet
    </div>
  )}
</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AddedCostPrompt; 