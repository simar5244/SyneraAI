import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateUtilizationScore, calculateAttritionScore } from '../utils/employeeScoreCalculator';

interface EmployeeFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  availableManagers?: Array<{id: string, name: string}>;
  departments?: string[];
}

const EmployeeForm = ({ onSubmit, onCancel, availableManagers = [], departments = [] }: EmployeeFormProps) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    jobTitle: '',
    department: '',
    managerId: '',
    imageUrl: '',
    salary: '',
    jobDuties: []
  });
  
  const [activeTab, setActiveTab] = useState('basic');
  const [newDuty, setNewDuty] = useState({ duty: '', hours: 0, tools: '' });
  const [calculatedScores, setCalculatedScores] = useState({
    utilization: { score: 0.5, category: 'medium' },
    attrition: { risk: 'medium', factors: [] }
  });

  // Calculate scores when job duties change
  useEffect(() => {
    try {
      const utilResult = calculateUtilizationScore(formData);
      const attrResult = calculateAttritionScore(formData);
      
      setCalculatedScores({
        utilization: utilResult,
        attrition: attrResult
      });
    } catch (error) {
      console.error('Error calculating scores:', error);
    }
  }, [formData.jobDuties]);

  const handleAddDuty = () => {
    if (!newDuty.duty || newDuty.hours <= 0) return;
    
    setFormData({
      ...formData,
      jobDuties: [...formData.jobDuties, newDuty]
    });
    
    setNewDuty({ duty: '', hours: 0, tools: '' });
  };

  const handleRemoveDuty = (index: number) => {
    setFormData({
      ...formData,
      jobDuties: formData.jobDuties.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Add calculated scores to the form data
    const submissionData = {
      ...formData,
      calculatedUtilization: calculatedScores.utilization,
      calculatedAttritionRisk: calculatedScores.attrition.risk
    };
    
    onSubmit(submissionData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="duties">Job Duties</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Enter first name"
                required
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Enter last name"
                required
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter email address"
              required
            />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="jobTitle">Job Title</Label>
            <Input
              id="jobTitle"
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              placeholder="Enter job title"
              required
            />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="department">Department</Label>
            {departments.length > 0 ? (
              <Select 
                value={formData.department} 
                onValueChange={(value) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="Enter department"
              />
            )}
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="managerId">Reports To</Label>
            {availableManagers.length > 0 ? (
              <Select 
                value={formData.managerId} 
                onValueChange={(value) => setFormData({ ...formData, managerId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  {availableManagers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="managerId"
                value={formData.managerId}
                onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                placeholder="Enter manager ID"
              />
            )}
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="imageUrl">Profile Image URL (Optional)</Label>
            <Input
              id="imageUrl"
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              placeholder="Enter image URL"
            />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="salary">Salary (Annual)</Label>
            <Input
              id="salary"
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              placeholder="Enter annual salary"
              className="w-full"
            />
          </div>
        </TabsContent>
        
        <TabsContent value="duties" className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Job Duties</h3>
            <p className="text-xs text-gray-500">
              Add duties and responsibilities for this employee. These will affect utilization and attrition risk calculations.
            </p>
          </div>
          
          {formData.jobDuties.length > 0 ? (
            <div className="space-y-3 mb-4">
              {formData.jobDuties.map((duty, index) => (
                <div key={index} className="flex items-start border p-2 rounded-md bg-gray-50">
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center">
                      <span className="text-sm font-medium w-16">Duty:</span>
                      <span className="text-sm">{duty.duty}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium w-16">Hours:</span>
                      <span className="text-sm">{duty.hours} hrs/week</span>
                    </div>
                    {duty.tools && (
                      <div className="flex items-center">
                        <span className="text-sm font-medium w-16">Tools:</span>
                        <span className="text-sm">{duty.tools}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => handleRemoveDuty(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 border rounded-md">
              No job duties defined yet. Add some below.
            </div>
          )}
          
          <div className="border p-3 rounded-md bg-blue-50">
            <h4 className="text-sm font-medium mb-2">Add New Duty</h4>
            <div className="space-y-2">
              <div className="flex items-center">
                <span className="text-sm font-medium w-16">Duty:</span>
                <Input
                  value={newDuty.duty}
                  onChange={(e) => setNewDuty({...newDuty, duty: e.target.value})}
                  placeholder="e.g., Manage client meetings"
                  className="flex-grow"
                />
              </div>
              <div className="flex items-center">
                <span className="text-sm font-medium w-16">Hours:</span>
                <Input
                  type="number"
                  value={newDuty.hours || ''}
                  onChange={(e) => setNewDuty({...newDuty, hours: parseInt(e.target.value) || 0})}
                  placeholder="10"
                  className="w-20"
                />
                <span className="ml-2 text-xs text-gray-500">hours per week</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-medium w-16">Tools:</span>
                <Input
                  value={newDuty.tools}
                  onChange={(e) => setNewDuty({...newDuty, tools: e.target.value})}
                  placeholder="e.g., Zoom, Excel"
                  className="flex-grow"
                />
              </div>
              <div className="flex justify-end mt-2">
                <Button 
                  type="button"
                  size="sm"
                  onClick={handleAddDuty}
                  disabled={!newDuty.duty || newDuty.hours <= 0}
                >
                  Add Duty
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="metrics" className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Performance Metrics</h3>
            <p className="text-xs text-gray-500">
              These metrics are calculated based on the job duties you've defined.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-md p-3">
              <h4 className="text-sm font-medium mb-1">Utilization Score</h4>
              <div className="text-2xl font-bold">
                {Math.round(calculatedScores.utilization.score * 100)}%
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full ${
                    calculatedScores.utilization.score > 1.1
                      ? 'bg-red-500'
                      : calculatedScores.utilization.score > 0.9
                      ? 'bg-green-500'
                      : 'bg-blue-500'
                  }`}
                  style={{
                    width: `${Math.min(Math.round(calculatedScores.utilization.score * 100), 100)}%`,
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {calculatedScores.utilization.score > 1.1
                  ? 'Overloaded'
                  : calculatedScores.utilization.score > 0.9
                  ? 'Optimal'
                  : 'Capacity available'}
              </div>
            </div>
            
            <div className="border rounded-md p-3">
              <h4 className="text-sm font-medium mb-1">Attrition Risk</h4>
              <div className="text-2xl font-bold">
                {calculatedScores.attrition.risk.charAt(0).toUpperCase() + calculatedScores.attrition.risk.slice(1)}
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full ${
                    calculatedScores.attrition.risk === 'high'
                      ? 'bg-red-500'
                      : calculatedScores.attrition.risk === 'medium'
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{
                    width: calculatedScores.attrition.risk === 'high' 
                      ? '100%' 
                      : calculatedScores.attrition.risk === 'medium' 
                        ? '66%' 
                        : '33%',
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {calculatedScores.attrition.risk === 'high'
                  ? 'High risk of turnover'
                  : calculatedScores.attrition.risk === 'medium'
                  ? 'Moderate risk of turnover'
                  : 'Low risk of turnover'}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Add Employee
        </Button>
      </div>
    </form>
  );
};

export default EmployeeForm; 