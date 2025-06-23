//THIS IS REDIS BACKUP
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FaSearch, FaFilter, FaTags, FaUserTie } from 'react-icons/fa';

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
  onRedistribute: (selectedSuccessors: string[]) => void;
  availableEmployees: any[]; // All employees that could receive duties
}

const RedistributionModal = ({ 
  isOpen, 
  onClose, 
  employee, 
  onRedistribute,
  availableEmployees 
}: RedistributionModalProps) => {
  // State for selected successors
  const [selectedSuccessors, setSelectedSuccessors] = useState<string[]>([]);
  
  // State for search and filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedSkill, setSelectedSkill] = useState('all');
  
  // Extract recommended successors from employee data
  const recommendedSuccessors = employee?.successorAnalysis?.top_successors || [];
  
  // Extract departments and skills for filtering
  const departments = Array.from(
    new Set(availableEmployees.map(emp => emp.department || 'Unassigned'))
  ).filter(Boolean);
  
  // Collect all skills across employees
  const allSkills = Array.from(
    new Set(
      availableEmployees.flatMap(emp => 
        emp.toolsProficient || []
      )
    )
  ).filter(Boolean);
  
  // Filter employees based on search and filters
  const filteredEmployees = availableEmployees.filter(emp => {
    // Skip the employee being removed
    if (emp.email === employee?.email) return false;
    
    // Apply search filter
    if (searchQuery) {
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      
      if (!fullName.includes(query) && !email.includes(query)) {
        return false;
      }
    }
    
    // Apply department filter
    if (selectedDepartment !== 'all' && emp.department !== selectedDepartment) {
      return false;
    }
    
    // Apply skill filter
    if (selectedSkill !== 'all') {
      const hasSkill = emp.toolsProficient?.includes(selectedSkill);
      if (!hasSkill) return false;
    }
    
    return true;
  });
  
  // Check if an employee is recommended (in top 3 successors)
  const isRecommended = (email: string) => {
    return recommendedSuccessors.some((successor: any) => successor.email === email);
  };
  
  // Toggle selection of a successor
  const toggleSuccessor = (email: string) => {
    if (selectedSuccessors.includes(email)) {
      setSelectedSuccessors(selectedSuccessors.filter(e => e !== email));
    } else {
      setSelectedSuccessors([...selectedSuccessors, email]);
    }
  };
  
  // Handle redistribution
  const handleRedistribute = () => {
    if (selectedSuccessors.length === 0) {
      alert('Please select at least one employee to redistribute duties to.');
      return;
    }
    
    onRedistribute(selectedSuccessors);
    onClose();
  };
  
  // Determine if the employee has viable successors
  const hasViableSuccessors = recommendedSuccessors.length > 0;
  
  // Format the job duties list for display
  const jobDuties = employee?.job_intensity_analysis?.duties || [];
  const totalJobHours = jobDuties.reduce((total: number, duty: any) => 
    total + (duty.hours_per_week || duty.intensity * 10), 0
  );
  
  // Add a function to get non-viable successors
  const getNonViableSuccessors = () => {
    // Only calculate when no viable successors and removed employee skills are an array
    if (recommendedSuccessors.length > 0) return [];
    if (!Array.isArray(employee?.toolsProficient)) return [];
    
    const removedSkills = employee.toolsProficient;
    
    // Consider all other employees
    const candidates = availableEmployees.filter(emp => emp.email !== employee.email);
    
    return candidates
      .map(emp => {
        const empSkills = Array.isArray(emp.toolsProficient) ? emp.toolsProficient : [];
        const matchingSkills = empSkills.filter((skill: string) => removedSkills.includes(skill));
        const score = removedSkills.length > 0 ? matchingSkills.length / removedSkills.length : 0;
        
        return { 
          ...emp, 
          matchingSkills, 
          score, 
          nonViable: true, 
          utilization: emp.utilization?.score || 0 
        };
      })
      .filter(item => Array.isArray(item.matchingSkills))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  };

  // Get non-viable successors
  const nonViableSuccessors = getNonViableSuccessors();
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col bg-white text-black">
        <CardHeader className="border-b pb-3 bg-white">
          <CardTitle className="text-xl text-black">
            Redistribute Duties for {employee?.firstName} {employee?.lastName}
          </CardTitle>
        </CardHeader>
        
        <div className="overflow-y-auto flex-grow">
          <CardContent className="pt-4">
            {/* Job duties section */}
            <div className="mb-6">
              <h3 className="font-medium text-lg mb-2">Job Duties to Redistribute</h3>
              <div className="bg-gray-50 p-3 rounded-md border mb-2">
                <div className="text-sm text-gray-500 mb-1">
                  Workload: ~{totalJobHours.toFixed(1)} hours/week
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {jobDuties.slice(0, 6).map((duty: any, index: number) => (
                    <div key={index} className="text-sm bg-white p-2 rounded border">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">{duty.duty}</span>
                        <Badge 
                          variant={duty.intensity > 0.8 ? "destructive" : "outline"}
                          className={duty.intensity > 0.8 ? undefined : "bg-gray-200 text-gray-800"}
                        >
                          {(duty.intensity * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {duty.hours_per_week 
                          ? `${duty.hours_per_week.toFixed(1)} hrs/week` 
                          : `~${(duty.intensity * 10).toFixed(1)} hrs/week (estimated)`}
                      </div>
                    </div>
                  ))}
                </div>
                {jobDuties.length > 6 && (
                  <div className="text-xs text-gray-500 mt-2">
                    + {jobDuties.length - 6} more duties
                  </div>
                )}
              </div>
            </div>
            
            <Tabs defaultValue="recommended">
              <TabsList className="mb-4">
                <TabsTrigger value="recommended">
                  AI Recommendations
                </TabsTrigger>
                <TabsTrigger value="search">
                  Search & Filter
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="recommended" className="space-y-4">
                {!hasViableSuccessors ? (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                      <h3 className="font-medium text-amber-800 mb-2">
                        No viable successors identified
                      </h3>
                      <p className="text-sm text-amber-700">
                        This employee doesn't have any identified successors. Consider:
                      </p>
                      <ul className="list-disc list-inside text-sm text-amber-700 mt-2">
                        <li>Hiring a new employee with similar skills</li>
                        <li>Distributing duties among team members</li>
                        <li>Consulting with HR about talent development</li>
                      </ul>
                    </div>
                    
                    {nonViableSuccessors.length > 0 && (
                      <div>
                        <h3 className="font-medium mb-2">Non-Viable Alternatives</h3>
                        <p className="text-sm text-gray-500 mb-4">
                          These employees don't have formal successor status but may have some overlapping skills:
                        </p>
                        
                        <div className="space-y-3">
                          {nonViableSuccessors.map((successor) => (
                            <div 
                              key={successor.email}
                              className={`p-4 rounded-md border flex items-start gap-3 
                                ${selectedSuccessors.includes(successor.email) 
                                  ? 'bg-blue-50 border-blue-300' 
                                  : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                              onClick={() => toggleSuccessor(successor.email)}
                            >
                              <Checkbox 
                                checked={selectedSuccessors.includes(successor.email)}
                                onCheckedChange={() => toggleSuccessor(successor.email)}
                                className="mt-1"
                              />
                              
                              <div className="flex-shrink-0">
                                <Avatar className="h-12 w-12">
                                  {successor.avatar ? (
                                    <AvatarImage src={successor.avatar} alt={successor.firstName} />
                                  ) : (
                                    <AvatarFallback>
                                      {successor.firstName?.[0] || ''}
                                      {successor.lastName?.[0] || ''}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex justify-between">
                                  <div>
                                    <h4 className="font-medium">
                                      {successor.firstName} {successor.lastName}
                                    </h4>
                                    <p className="text-sm text-gray-500">
                                      {successor.jobTitle}
                                    </p>
                                  </div>
                                  <Badge className="self-start bg-gray-200 text-gray-800">
                                    Match: {(successor.score * 100).toFixed(0)}%
                                  </Badge>
                                </div>
                                
                                <div className="mt-2 space-y-2">
                                  <div>
                                    <div className="text-xs text-gray-500 flex justify-between mb-1">
                                      <span>Current Utilization</span>
                                      <span>
                                        {Math.round((successor.utilization) * 100)}%
                                      </span>
                                    </div>
                                    <Progress 
                                      value={(successor.utilization) * 100} 
                                      className="h-2"
                                    />
                                  </div>
                                  
                                  {successor.matchingSkills && successor.matchingSkills.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {successor.matchingSkills.slice(0, 4).map((skill: string) => (
                                        <Badge key={skill} variant="outline" className="text-xs">
                                          {skill}
                                        </Badge>
                                      ))}
                                      {successor.matchingSkills.length > 4 && (
                                        <Badge variant="outline" className="text-xs">
                                          +{successor.matchingSkills.length - 4} more
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <h3 className="font-medium">Recommended Successors</h3>
                    <div className="space-y-3">
                      {recommendedSuccessors.map((successor: any) => {
                        // Find full employee data
                        const employeeData = availableEmployees.find(
                          emp => emp.email === successor.email
                        );
                        
                        if (!employeeData) return null;
                        
                        return (
                          <div 
                            key={successor.email}
                            className={`p-4 rounded-md border flex items-start gap-3 
                              ${selectedSuccessors.includes(successor.email) 
                                ? 'bg-blue-50 border-blue-300' 
                                : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                            onClick={() => toggleSuccessor(successor.email)}
                          >
                            <Checkbox 
                              checked={selectedSuccessors.includes(successor.email)}
                              onCheckedChange={() => toggleSuccessor(successor.email)}
                              className="mt-1"
                            />
                            
                            <div className="flex-shrink-0">
                              <Avatar className="h-12 w-12">
                                {employeeData.avatar ? (
                                  <AvatarImage src={employeeData.avatar} alt={employeeData.firstName} />
                                ) : (
                                  <AvatarFallback>
                                    {employeeData.firstName?.[0] || ''}
                                    {employeeData.lastName?.[0] || ''}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex justify-between">
                                <div>
                                  <h4 className="font-medium">
                                    {employeeData.firstName} {employeeData.lastName}
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    {employeeData.jobTitle}
                                  </p>
                                </div>
                                <Badge className="self-start">
                                  {successor.readinessLevel || 'Match: ' + (successor.score * 100).toFixed(0) + '%'}
                                </Badge>
                              </div>
                              
                              <div className="mt-2 space-y-2">
                                <div>
                                  <div className="text-xs text-gray-500 flex justify-between mb-1">
                                    <span>Current Utilization</span>
                                    <span>
                                      {Math.round((employeeData.utilization?.score || 0) * 100)}%
                                    </span>
                                  </div>
                                  <Progress 
                                    value={(employeeData.utilization?.score || 0) * 100} 
                                    className="h-2"
                                  />
                                </div>
                                
                                {successor.matchingSkills && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {successor.matchingSkills.slice(0, 4).map((skill: string) => (
                                      <Badge key={skill} variant="outline" className="text-xs">
                                        {skill}
                                      </Badge>
                                    ))}
                                    {successor.matchingSkills.length > 4 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{successor.matchingSkills.length - 4} more
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </TabsContent>
              
              <TabsContent value="search">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <div className="flex-1 min-w-[300px]">
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input
                          placeholder="Search by name or email"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <FaFilter className="text-gray-400" />
                      <select 
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                        className="px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Departments</option>
                        {departments.map((dept: string) => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <FaTags className="text-gray-400" />
                      <select 
                        value={selectedSkill}
                        onChange={(e) => setSelectedSkill(e.target.value)}
                        className="px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Skills</option>
                        {allSkills.map((skill: string) => (
                          <option key={skill} value={skill}>{skill}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                    {filteredEmployees.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No employees match your search criteria
                      </div>
                    ) : (
                      filteredEmployees.map(emp => (
                        <div 
                          key={emp.email}
                          className={`p-3 rounded-md border flex items-start gap-3 
                            ${selectedSuccessors.includes(emp.email) 
                              ? 'bg-blue-50 border-blue-300' 
                              : 'bg-white border-gray-200 hover:bg-gray-50'}
                            ${isRecommended(emp.email) ? 'border-l-4 border-l-blue-500' : ''}`}
                          onClick={() => toggleSuccessor(emp.email)}
                        >
                          <Checkbox 
                            checked={selectedSuccessors.includes(emp.email)}
                            onCheckedChange={() => toggleSuccessor(emp.email)}
                            className="mt-1"
                          />
                          
                          <div className="flex-shrink-0">
                            <Avatar className="h-10 w-10">
                              {emp.avatar ? (
                                <AvatarImage src={emp.avatar} alt={emp.firstName} />
                              ) : (
                                <AvatarFallback>
                                  {emp.firstName?.[0] || ''}
                                  {emp.lastName?.[0] || ''}
                                </AvatarFallback>
                              )}
                            </Avatar>
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">
                                  {emp.firstName} {emp.lastName}
                                  {isRecommended(emp.email) && (
                                    <Badge className="ml-2 bg-blue-100 text-blue-800 border border-blue-300">
                                      Recommended
                                    </Badge>
                                  )}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-gray-500">{emp.jobTitle}</p>
                                  <span className="text-xs text-gray-400">•</span>
                                  <p className="text-sm text-gray-500">{emp.department}</p>
                                </div>
                              </div>
                              
                              <div className="text-sm">
                                <span className="font-medium">
                                  {Math.round((emp.utilization?.score || 0) * 100)}%
                                </span>
                                <span className="text-gray-500 text-xs ml-1">utilization</span>
                              </div>
                            </div>
                            
                            {Array.isArray(emp.toolsProficient) && emp.toolsProficient.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {emp.toolsProficient.slice(0, 3).map((skill: string) => (
                                  <Badge key={skill} variant="outline" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                                {emp.toolsProficient.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{emp.toolsProficient.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </div>
        
        <CardFooter className="flex justify-between border-t pt-4 bg-gray-50">
          <Button variant="outline" onClick={onClose} className="bg-white text-black border-gray-300">
            Cancel
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="text-sm text-black">
              <span className="font-medium">{selectedSuccessors.length}</span> employee{selectedSuccessors.length !== 1 ? 's' : ''} selected
            </div>
            <Button 
              onClick={handleRedistribute} 
              disabled={selectedSuccessors.length === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white border-none"
            >
              Redistribute Duties
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default RedistributionModal; 