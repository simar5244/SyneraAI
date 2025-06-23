'use client';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FaPlus, FaTimes } from 'react-icons/fa';
import { calculateUtilizationScore, calculateAttritionScore } from '../utils/employeeScoreCalculator';

interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (employeeData: any) => void;
  departments?: string[];
  existingEmployees?: Array<{id: string; name: string; email: string}>;
}

const CreateEmployeeModal = ({ isOpen, onClose, onSubmit, departments = [], existingEmployees = [] }: CreateEmployeeModalProps) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    jobTitle: '',
    department: '',
    newDepartment: '',
    workSetting: 'Hybrid',
    salary: '',
    skillsInput: '',
    officeLocation: '',
    industry: '',
    jobDuties: [{ duty: '', hours: '', tools: '' }]
  });

  // New state for calculated metrics
  const [utilizationScore, setUtilizationScore] = useState({
    score: 0,
    status: 'optimal',
    confidence: 0,
    factors: {}
  });

  const [attritionScore, setAttritionScore] = useState({
    score: 0,
    risk: 'low',
    factors: {}
  });
  
  // Effect to recalculate scores whenever form data changes
  useEffect(() => {
    // Only calculate if we have at least some basic data
    if (formData.jobTitle || formData.jobDuties.some(duty => duty.duty)) {
      const utilization = calculateUtilizationScore(formData);
      const attrition = calculateAttritionScore(formData);
      
      setUtilizationScore(utilization);
      setAttritionScore(attrition);
    }
  }, [formData]);
  
  const workSettings = ['Remote', 'In Office', 'Hybrid'];
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDutyChange = (index: number, field: string, value: string) => {
    const updatedDuties = [...formData.jobDuties];
    updatedDuties[index] = { ...updatedDuties[index], [field]: value };
    setFormData(prev => ({ ...prev, jobDuties: updatedDuties }));
  };

  const addDuty = () => {
    setFormData(prev => ({
      ...prev,
      jobDuties: [...prev.jobDuties, { duty: '', hours: '', tools: '' }]
    }));
  };

  const removeDuty = (index: number) => {
    if (formData.jobDuties.length > 1) {
      const updatedDuties = formData.jobDuties.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, jobDuties: updatedDuties }));
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    console.log('CreateEmployeeModal: submitting', formData);
    e.preventDefault();
    
    // Transform skills from comma-separated string to array
    const toolsProficient = formData.skillsInput
      .split(',')
      .map(skill => skill.trim())
      .filter(Boolean);
    
    // Process job duties
    const processedDuties = formData.jobDuties
      .filter(duty => duty.duty.trim() !== '')
      .map(duty => ({
        ...duty,
        hours: parseInt(duty.hours) || 0
      }));
    
    // Create the employee object with the full calculated metrics
    const newEmployee = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      jobTitle: formData.jobTitle,
      department: formData.department === 'New Department' ? formData.newDepartment : formData.department,
      workSetting: formData.workSetting,
      salary: formData.salary ? parseInt(formData.salary, 10) : undefined,
      toolsProficient,
      officeLocation: formData.officeLocation,
      industry: formData.industry,
      jobDuties: processedDuties,
      reportsTo: null,  // Will be set when connecting in the org chart
      // Add calculated metrics with complete data
      utilization: {
        score: utilizationScore.score,
        status: utilizationScore.status,
        category: utilizationScore.status,
        confidence: utilizationScore.confidence,
        factors: utilizationScore.factors
      },
      attritionRisk: attritionScore.risk,
      attritionScore: {
        score: attritionScore.score,
        risk: attritionScore.risk,
        factors: attritionScore.factors
      }
    };
    
    onSubmit(newEmployee);
    resetForm();
  };
  
  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      jobTitle: '',
      department: '',
      newDepartment: '',
      workSetting: 'Hybrid',
      salary: '',
      skillsInput: '',
      officeLocation: '',
      industry: '',
      jobDuties: [{ duty: '', hours: '', tools: '' }]
    });
    
    // Reset calculated scores
    setUtilizationScore({
      score: 0,
      status: 'optimal',
      confidence: 0,
      factors: {}
    });
    
    setAttritionScore({
      score: 0,
      risk: 'low',
      factors: {}
    });
  };

  // Get utilization color based on status
  const getUtilizationColor = () => {
    switch (utilizationScore.status) {
      case 'severely_underutilized': return 'bg-blue-700';
      case 'underutilized': return 'bg-blue-600';
      case 'optimal': return 'bg-green-600';
      case 'highly_utilized': return 'bg-orange-600';
      case 'overutilized': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  // Get attrition risk color
  const getAttritionColor = () => {
    switch (attritionScore.risk) {
      case 'high': return 'bg-red-600';
      case 'medium': return 'bg-yellow-600';
      case 'low': return 'bg-green-600';
      default: return 'bg-gray-500';
    }
  };

  // Format utilization status for display
  const formatUtilizationStatus = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
        <DialogTitle className="text-black mb-2">Add New Employee</DialogTitle>

        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: First Name, Last Name, Email */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name*</Label>
              <Input
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name*</Label>
              <Input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="email">Email*</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          
          {/* Row 2: Job Title, Department, Salary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="jobTitle">Job Title*</Label>
              <Input
                id="jobTitle"
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-1">
              <Label>Department</Label>
              <div className="flex gap-2">
                {formData.department === 'New Department' ? (
                  <Input
                    name="newDepartment"
                    value={formData.newDepartment}
                    onChange={handleInputChange}
                    placeholder="New department name"
                    className="w-full"
                  />
                ) : (
                  <Select
                    value={formData.department}
                    onValueChange={(value) => handleSelectChange('department', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                      <SelectItem value="New Department">+ New Department</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="salary">Salary</Label>
              <Input
                id="salary"
                name="salary"
                type="number"
                value={formData.salary}
                onChange={handleInputChange}
                placeholder="e.g., 75000"
              />
            </div>
          </div>
          
          {/* Row 3: Work Setting, Office Location, Industry */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="workSetting">Work Setting</Label>
              <Select
                value={formData.workSetting}
                onValueChange={(value) => handleSelectChange('workSetting', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select work setting" />
                </SelectTrigger>
                <SelectContent>
                  {workSettings.map((setting) => (
                    <SelectItem key={setting} value={setting}>
                      {setting}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="officeLocation">Office Location</Label>
              <Input
                id="officeLocation"
                name="officeLocation"
                value={formData.officeLocation}
                onChange={handleInputChange}
                placeholder="e.g., New York, Floor 5"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                name="industry"
                value={formData.industry}
                onChange={handleInputChange}
                placeholder="e.g., Technology, Finance"
              />
            </div>
          </div>
          
          {/* Row 4: Job Duties */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Job Duties</Label>
              <Button
                type="button"
                size="icon"
                onClick={addDuty}
                className="h-8 w-8 p-0 bg-purple-600 hover:bg-purple-700"
              >
                <FaPlus className="h-4 w-4 text-white" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {formData.jobDuties.map((duty, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    placeholder="Duty description"
                    value={duty.duty}
                    onChange={(e) => handleDutyChange(index, 'duty', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Hours"
                    value={duty.hours}
                    onChange={(e) => handleDutyChange(index, 'hours', e.target.value)}
                    min="0"
                    max="168"
                    className="w-24"
                  />
                  <Input
                    placeholder="Tools"
                    value={duty.tools}
                    onChange={(e) => handleDutyChange(index, 'tools', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeDuty(index)}
                    className="h-9 w-9 text-red-600 hover:bg-red-100"
                    disabled={formData.jobDuties.length <= 1}
                  >
                    <FaTimes className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics Display */}
          <div className="mt-6 border rounded-lg p-4 bg-gray-50">
            <div className="grid grid-cols-2 gap-6">
              {/* Utilization Score */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-800">Utilization Score:</span>
                  <span className={`px-2 py-1 rounded text-xs font-bold text-white ${getUtilizationColor()}`}>
                    {formatUtilizationStatus(utilizationScore.status)} ({Math.round(utilizationScore.score * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full ${getUtilizationColor()}`} 
                    style={{ width: `${utilizationScore.score * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-medium text-blue-700">Underutilized</span>
                  <span className="text-xs font-medium text-green-700">Optimal</span>
                  <span className="text-xs font-medium text-orange-700">Overutilized</span>
                </div>
                <p className="text-xs text-gray-700 mt-1">
                  Data confidence: {Math.round(utilizationScore.confidence * 100)}%
                </p>
              </div>

              {/* Attrition Risk */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-800">Attrition Risk:</span>
                  <span className={`px-2 py-1 rounded text-xs font-bold text-white ${getAttritionColor()}`}>
                    {attritionScore.risk.toUpperCase()} ({Math.round(attritionScore.score * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full ${getAttritionColor()}`} 
                    style={{ width: `${attritionScore.score * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-medium text-green-700">Low</span>
                  <span className="text-xs font-medium text-yellow-700">Medium</span>
                  <span className="text-xs font-medium text-red-700">High</span>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2 pt-4">
            <DialogClose asChild>

            </DialogClose>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
              Add Employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateEmployeeModal;
