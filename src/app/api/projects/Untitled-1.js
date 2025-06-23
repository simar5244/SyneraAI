//THIS IS EMPLOYEE PROFILE BACKUP
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Using custom divider instead of Separator component
import { FaTimes, FaTrash, FaEdit, FaChartLine, FaUserClock, FaUserTie, FaBell } from 'react-icons/fa';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmployeeProfileProps {
  employee: any;
  onClose: () => void;
  onRemove: (email: string) => void;
}

const EmployeeProfile = ({ employee, onClose, onRemove }: EmployeeProfileProps) => {
  const [activeTab, setActiveTab] = useState<string>("duties");
  
  // Get utilization data directly from employee data with improved nesting access
  const utilizationScore = employee.utilization?.score || 
                        employee.utilizationAssessment?.utilization_score || 
                        employee.utilization_score || 0;
  const utilizationPercent = Math.round(utilizationScore * 100);
  
  // Get attrition risk with improved nesting access
  const attritionRisk = employee.attritionAssessment?.attrition_risk || 'unknown';
  
  // Get attrition risk category and color
  let riskCategory = 'Unknown';
  let riskColor = 'bg-gray-200';
  
  if (typeof attritionRisk === 'string') {
    // Handle string risk categories (low, medium, high)
    if (attritionRisk?.toLowerCase() === 'high') {
      riskCategory = 'High Risk';
      riskColor = 'bg-red-500';
    } else if (attritionRisk?.toLowerCase() === 'medium') {
      riskCategory = 'Medium Risk';
      riskColor = 'bg-orange-400';
    } else if (attritionRisk?.toLowerCase() === 'low') {
      riskCategory = 'Low Risk';
      riskColor = 'bg-yellow-300';
    } else {
      riskCategory = 'Unknown';
      riskColor = 'bg-gray-200';
    }
  } else {
    // Handle numeric attrition score
    const attritionScore = employee.attritionAssessment?.attrition_score || 0;
    
    if (attritionScore > 0.7) {
      riskCategory = 'High Risk';
      riskColor = 'bg-red-500';
    } else if (attritionScore > 0.5) {
      riskCategory = 'Medium Risk';
      riskColor = 'bg-orange-400';
    } else if (attritionScore > 0.3) {
      riskCategory = 'Low Risk';
      riskColor = 'bg-yellow-300';
    } else if (attritionScore > 0) {
      riskCategory = 'Very Low Risk';
      riskColor = 'bg-green-400';
    }
  }
  
  // Get job responsibilities from MongoDB data
  const jobResponsibilities = employee.jobResponsibilities || [];
  
  // Process toolsProficient data
  let toolsList = [];
  if (typeof employee.toolsProficient === 'string') {
    // Handle comma-separated string
    toolsList = employee.toolsProficient.split(',').map(tool => tool.trim()).filter(Boolean);
  } else if (Array.isArray(employee.toolsProficient)) {
    // Handle array 
    toolsList = employee.toolsProficient;
  }
  
  // Get successors from MongoDB data
  const successors = employee.successorAnalysis?.successorCandidates || [];
  
  return (
    <div className="fixed right-0 top-0 h-full w-1/3 bg-white border-l border-gray-200 overflow-y-auto shadow-lg z-10">
      <Card className="h-full rounded-none border-0">
        <CardHeader className="sticky top-0 bg-white z-10 pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl text-black">Employee Profile</CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-red-500 border-red-200 hover:bg-red-50"
                onClick={() => onRemove(employee.email)}
              >
                <FaTrash className="mr-1" size={12} />
                Remove
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <FaTimes />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 pb-20 text-black">
          {/* Basic Info */}
          <div className="flex items-start space-x-4">
            {employee.avatar ? (
              <img 
                src={employee.avatar} 
                alt={`${employee.firstName} ${employee.lastName}`} 
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-500">
                {employee.firstName?.[0] || ''}{employee.lastName?.[0] || ''}
              </div>
            )}
            
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-black">
                {`${employee.firstName || ''} ${employee.lastName || ''}`}
              </h2>
              <p className="text-lg text-black">{employee.jobTitle || 'No Title'}</p>
              
              <div className="flex items-center mt-2">
                <Badge variant="outline" className="mr-2">
                  {employee.department || 'Unassigned'}
                </Badge>
                
                {attritionRisk !== 'unknown' && (
                  <Badge 
                    variant="outline" 
                    className="flex items-center"
                    style={{ borderColor: riskColor.replace('bg-', 'border-') }}
                  >
                    <div className={`w-2 h-2 rounded-full ${riskColor} mr-1`}></div>
                    {riskCategory}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="h-px w-full bg-gray-200 my-4"></div>
          
          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-black">Email</p>
                <p className="text-black">{employee.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-black">Phone</p>
                <p className="text-black">{employee.phone || 'N/A'}</p>
              </div>
            </div>
          </div>
          
          <div className="h-px w-full bg-gray-200 my-4"></div>
          
          {/* Employment Details */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Employment Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-black">Department</p>
                <p className="text-black">{employee.department || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-sm text-black">Reports To</p>
                <p className="text-black">
                  {employee.reportsTo ? `${employee.reportsTo.name || employee.reportsTo.email}` : 'No Manager'}
                </p>
              </div>
              <div>
                <p className="text-sm text-black">Tenure</p>
                <p className="text-black">
                  {employee.totalduration ? `${employee.totalduration} months` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-black">Current Role Duration</p>
                <p className="text-black">
                  {employee.currentroleduration ? `${employee.currentroleduration} months` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-black">Salary</p>
                <p className="text-black">
                  {employee.salary ? `$${Number(employee.salary).toLocaleString()}` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-black">Work Setting</p>
                <p className="text-black">{employee.workMode || employee.workSetting || 'N/A'}</p>
              </div>
            </div>
          </div>
          
          <div className="h-px w-full bg-gray-200 my-4"></div>
          
          {/* Utilization and Attrition Risk Cards */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-black">Utilization</h3>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-black">{utilizationPercent}%</span>
              <div className="w-full mx-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-full rounded-full ${
                      utilizationPercent > 100 ? 'bg-red-500' : 
                      utilizationPercent > 90 ? 'bg-green-500' : 
                      utilizationPercent > 70 ? 'bg-blue-400' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Attrition Risk */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2 text-black">Retention Risk</h3>
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full ${riskColor} mr-2`}></div>
              <span className="text-black">{riskCategory}</span>
            </div>
          </div>
          
          <div className="h-px w-full bg-gray-200 my-4"></div>
          
          {/* Job Duties */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-black">Job Duties</h3>
            {jobResponsibilities && jobResponsibilities.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {jobResponsibilities.map((duty, index) => (
                  <div key={index} className="bg-gray-50 p-2 rounded border border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm text-black">{duty.duty}</span>
                      {duty.hours && (
                        <Badge variant="outline" className="bg-gray-100 text-gray-700">
                          {duty.hours} hrs/week
                        </Badge>
                      )}
                    </div>
                    {duty.intensity_score && (
                      <p className="text-xs text-gray-600 mt-1">
                        Intensity: {Math.round(duty.intensity_score * 100)}%
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No job duties listed</p>
            )}
          </div>
          
          <div className="h-px w-full bg-gray-200 my-4"></div>
          
          {/* Skills & Tools */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Skills & Tools</h3>
            {toolsList.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {toolsList.map((tool, index) => (
                  <Badge key={index} variant="outline">{tool}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic text-sm">
                {employee.toolsProficient ? String(employee.toolsProficient) : 'No skills or tools listed'}
              </p>
            )}
          </div>
          
          <div className="h-px w-full bg-gray-200 my-4"></div>
          
          {/* Projects */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Projects</h3>
            {employee.projects && employee.projects.length > 0 ? (
              <div className="space-y-2">
                {employee.projects.map((project: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-md border border-gray-200">
                    <p className="font-medium text-gray-800">{project.project_title}</p>
                    <div className="flex items-center mt-1">
                      <Badge variant="outline" className="text-xs mr-2">{project.project_status}</Badge>
                      <span className="text-xs text-gray-500">
                        {project.user_contribution?.hours_per_week 
                          ? `${project.user_contribution.hours_per_week} hrs/week` 
                          : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {project.project_description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic text-sm">No projects assigned</p>
            )}
          </div>
          
          <div className="h-px w-full bg-gray-200 my-4"></div>
          
          {/* Successor Analysis */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Successor Analysis</h3>
            {successors && successors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-1">
                  Last Updated: {employee.successorAnalysis?.lastUpdated 
                    ? new Date(employee.successorAnalysis.lastUpdated).toLocaleDateString() 
                    : 'Never'}
                </p>
                
                {successors.map((successor, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-md border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800">{successor.name || successor.email}</p>
                        <div className="flex items-center mt-1">
                          <Badge variant="outline" className="text-xs mr-2">{successor.readinessLevel}</Badge>
                          <span className="text-xs text-gray-500">
                            Match: {(successor.score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic text-sm">No potential successors identified</p>
            )}
          </div>
          
          <div className="h-px w-full bg-gray-200 my-4"></div>
          
          {/* Feedback */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Feedback & Performance</h3>
            {employee.feedbackMetrics ? (
              <div className="space-y-3">
                {employee.feedbackMetrics.given && (
                  <div>
                    <p className="text-sm font-medium">Feedback Given</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs">Count: {employee.feedbackMetrics.given.count || 0}</span>
                      <span className="text-xs">Avg Rating: {employee.feedbackMetrics.given.averageRating?.toFixed(1) || '0.0'}</span>
                    </div>
                  </div>
                )}
                
                {employee.feedbackMetrics.received && (
                  <div>
                    <p className="text-sm font-medium">Feedback Received</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs">Count: {employee.feedbackMetrics.received.count || 0}</span>
                      <span className="text-xs">Avg Rating: {employee.feedbackMetrics.received.averageRating?.toFixed(1) || '0.0'}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${((employee.feedbackMetrics.received.averageRating || 0) / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 italic text-sm">No feedback data available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeProfile;
