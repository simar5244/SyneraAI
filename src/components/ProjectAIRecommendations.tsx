import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { FiLoader } from 'react-icons/fi';
import { FaUserTie, FaBrain, FaTools, FaTasks, FaClock, FaUserAlt, FaBuilding, FaMoneyBillAlt, FaFileAlt, FaLaptopCode, FaClock as FaDuration, FaMapMarkerAlt, FaClipboardList } from 'react-icons/fa';
import { useClaudeRecommendations } from '../services/claudeRecommendationService';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

type Employee = {
  _id?: string;
  name: string;
  email: string;
  position?: string;
  department: string;
  skills?: string[];
  utilization?: number;
  jobResponsibilities?: string[];
  score?: number;
  role: string;
  tasks: string;
  hours: string;
  toolsUsed: string;
  isLead: boolean;
  matchReason?: string;
  jobTitle?: string;
  currentroleduration?: string;
  industry?: string;
  officeLocation?: string;
  salary?: string;
  toolsProficient?: string;
  totalduration?: string;
  workMode?: string;
  collaboration_analysis?: any;
  job_intensity_analysis?: any;
  utilizationAssessment?: any;
  attritionAssessment?: any;
  timestamp?: string;
  attrition_score?: number;
  attrition_risk?: string;
  primary_explanation?: string;
  feedbackmetrics?: any;
};

interface ProjectAIRecommendationsProps {
  projectData: any;
  onApplyRecommendations: (recommendations: any) => void;
  companyCode: string;
}

const ProjectAIRecommendations: React.FC<ProjectAIRecommendationsProps> = ({
  projectData,
  onApplyRecommendations,
  companyCode
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const { getRecommendations } = useClaudeRecommendations();

  // Auto-fetch recommendations only when component mounts
  useEffect(() => {
    if (projectData && projectData.name) {
      handleGetRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only runs once on mount

  const handleGetRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Transform project data to the format expected by the recommendation engine
      const projectDetails = {
        project_title: projectData.name,
        project_description: projectData.description || '',
        department: projectData.department || '',
        status: projectData.status || 'planning',
        priority: projectData.priority || 'low',
        tech_stack: projectData.toolsUsed ? projectData.toolsUsed.split(',').map((t: string) => t.trim()) : [],
        total_hours: projectData.total_hours || 0,
        total_budget: projectData.total_budget || 0
      };

      const result = await getRecommendations(projectDetails, companyCode);
      setRecommendations(result);
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      setError(error.message || 'Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRecommendations = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!recommendations) return;

    // Transform recommendations to the format expected by the project form
    const recommendedEmployees = recommendations.employees.map((emp: Employee) => ({
      name: emp.name,
      email: emp.email,
      department: emp.department,
      role: emp.role,
      tasks: emp.tasks,
      hours: emp.hours,
      toolsUsed: emp.toolsUsed,
      isLead: emp.isLead || false
    }));

    // Apply recommendations: pass tools array for parent to process
    onApplyRecommendations({
      employees: recommendedEmployees,
      tools: recommendations.tools
    });
  };

  const getEmployeeName = (emp: Employee) => {
    return emp.name;
  };

  // Function to view employee profile
  const viewEmployeeProfile = (e: React.MouseEvent, emp: Employee) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling up to parent elements
    setSelectedEmployee(emp);
    setProfileOpen(true);
  };

  return (
    <div className="bg-white p-4 rounded-md shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <FaBrain className="text-purple-600 mr-2" />
          <h3 className="text-lg font-medium text-purple-900">AI Recommendations</h3>
        </div>
        <button 
          onClick={handleGetRecommendations}
          className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors flex items-center"
          disabled={loading}
        >
          {loading ? <FiLoader className="animate-spin mr-1" /> : null}
          {loading ? 'Processing...' : 'Get Recommendations'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <FiLoader className="animate-spin text-purple-600 text-xl" />
          <span className="ml-2 text-sm text-gray-600">Finding the best team for your project...</span>
        </div>
      )}

      {error && (
        <div className="text-red-500 text-xs p-2 bg-red-50 rounded-md border border-red-100">
          {error}
        </div>
      )}

      {!loading && !error && recommendations && (
        <div>
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recommended Team</h4>
            <div className="space-y-3">
              {recommendations.employees.map((emp: Employee, index: number) => (
                <div key={index} className="flex items-start p-2 bg-gray-50 rounded-md">
                  <div className="text-purple-600 mr-2 mt-1">
                    <FaUserTie />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div className="font-medium text-sm">{getEmployeeName(emp)}</div>
                      <div className="flex items-center space-x-2">
                        <div className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          {emp.role}
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-xs h-6 px-2 py-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                            onClick={(e) => viewEmployeeProfile(e, emp)}
                            type="button"
                          >
                            Employee Profile
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex">
                      <div className="mt-1 mr-1 flex-shrink-0">
                        <FaTasks /> 
                      </div>
                      <span>{emp.tasks}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                      <FaClock className="mr-1" /> 
                      <span>{emp.hours} hours</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                      <FaTools className="mr-1" /> 
                      <span>{emp.toolsUsed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleApplyRecommendations}
            className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white"
            size="sm"
            type="button"
          >
            Apply Recommendations
          </Button>
        </div>
      )}

      {/* Employee Profile Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="flex items-center">
              <span className="text-indigo-600 mr-2">👤</span>
              <DialogTitle>{selectedEmployee?.name || 'Employee Profile'}</DialogTitle>
            </div>
          </DialogHeader>

          {selectedEmployee && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column - Employment Information */}
              <div>
                <h3 className="text-sm font-medium mb-3">Employment Information</h3>
                
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">Email</div>
                    <div className="text-sm">{selectedEmployee.email || 'Not specified'}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-500">Job Title</div>
                    <div className="text-sm">{selectedEmployee.role || selectedEmployee.jobTitle || 'Not available'}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-500">Department</div>
                    <div className="text-sm">{selectedEmployee.department || 'Not specified'}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-500">Work Mode</div>
                    <div className="text-sm">{selectedEmployee.workMode || 'Not available'}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-500">Feedback Rating</div>
                    <div className="text-sm">{selectedEmployee.feedbackmetrics ? 'Available' : 'No feedback available'}</div>
                  </div>
                </div>
              </div>
              
              {/* Right Column - Skills & Responsibilities */}
              <div>
                <h3 className="text-sm font-medium mb-3">Skills & Responsibilities</h3>
                
                <div className="space-y-3">
                  <div className="mb-4">
                    <h3 className="text-md font-semibold text-gray-800 mb-2 flex items-center">
                      <FaClipboardList className="text-purple-500 mr-2" size={16} />
                      Job Responsibilities
                    </h3>
                    {selectedEmployee.jobResponsibilities && selectedEmployee.jobResponsibilities.length > 0 ? (
                      <ul className="pl-5 list-disc text-gray-700 space-y-1">
                        {selectedEmployee.jobResponsibilities.map((responsibility: {duty: string, hours: number} | string, idx: number) => (
                          <li key={idx}>
                            {typeof responsibility === 'object' ? 
                              `${responsibility.duty} (${responsibility.hours} hrs/week)` : 
                              responsibility}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 italic">No detailed responsibilities available</p>
                    )}
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-500">Office Location</div>
                    <div className="text-sm">{selectedEmployee.officeLocation || 'Not specified'}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-500">Utilization Score</div>
                    <div className="text-sm">{selectedEmployee.utilizationAssessment ? 'Available' : 'Not calculated'}</div>
                  </div>
                </div>
              </div>
              
              {/* Additional employee data sections - if needed but hidden to match UI */}
              <div className="md:col-span-2">
                <div className="hidden">
                  {/* We keep these fields in the component but don't display them */}
                  {selectedEmployee.salary && <div>Salary: {selectedEmployee.salary}</div>}
                  {selectedEmployee.industry && <div>Industry: {selectedEmployee.industry}</div>}
                  {selectedEmployee.toolsProficient && <div>Tools: {selectedEmployee.toolsProficient}</div>}
                  {selectedEmployee.currentroleduration && <div>Duration: {selectedEmployee.currentroleduration}</div>}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white" 
              onClick={() => setProfileOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectAIRecommendations;
