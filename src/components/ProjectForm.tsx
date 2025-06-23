'use client';

import React, { useState, useEffect } from 'react';
import { FaTimes, FaPlus, FaExclamationCircle } from 'react-icons/fa';
import { Project, EmployeeContribution, ProjectStatus, ProjectPriority } from '@/types/project';

interface ProjectFormProps {
  project?: Project;
  onSubmit: (projectData: any) => void;
  onCancel: () => void;
  isEdit?: boolean;
}

export default function ProjectForm({ project, onSubmit, onCancel, isEdit = false }: ProjectFormProps) {
  // State for form data
  const [formData, setFormData] = useState<Partial<Project>>(
    project || {
      project_title: '',
      project_description: '',
      tech_stack: [],
      start_date: new Date(),
      end_date: undefined,
      department: '',
      status: 'Planning',
      priority: 'Medium',
      total_hours: 0,
      employee_contributions: [],
      methodologies: [],
      tools_and_resources: []
    }
  );
  
  // State for tech stack options
  const [techStackOptions, setTechStackOptions] = useState<Record<string, string[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('programming');
  const [customTechOption, setCustomTechOption] = useState('');
  const [loadingTechOptions, setLoadingTechOptions] = useState(true);
  
  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Employee selection state
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employeeRole, setEmployeeRole] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(0);
  
  // Additional state for employee tasks
  const [employeeTasks, setEmployeeTasks] = useState<Record<string, Array<{description: string, hours: number, status: string}>>>({});
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskHours, setNewTaskHours] = useState<number>(1);
  
  // State for methodology options
  const [methodologies, setMethodologies] = useState([
    'Agile', 'Scrum', 'Kanban', 'Waterfall', 'Lean', 'Six Sigma', 'DevOps', 'Design Thinking'
  ]);
  const [customMethodology, setCustomMethodology] = useState('');
  
  // Predefined roles with descriptions
  const predefinedRoles = [
    { value: 'Project Lead', description: 'Overall project leadership and coordination' },
    { value: 'Developer', description: 'Software development and implementation' },
    { value: 'Designer', description: 'Design and user experience' },
    { value: 'QA Engineer', description: 'Quality assurance and testing' },
    { value: 'Business Analyst', description: 'Business requirements and stakeholder management' },
    { value: 'Treasurer', description: 'Budget management and financial oversight' },
    { value: 'Subject Matter Expert', description: 'Domain knowledge and expertise' },
    { value: 'Technical Writer', description: 'Documentation and user guides' },
    { value: 'DevOps Engineer', description: 'Infrastructure and deployment' },
    { value: 'Product Owner', description: 'Product vision and backlog management' },
    { value: 'Scrum Master', description: 'Facilitate Agile processes and remove impediments' },
    { value: 'Stakeholder', description: 'Represents business interests' },
    { value: 'Other', description: 'Custom role' }
  ];
  
  // State for resource types
  const [resourceTypes, setResourceTypes] = useState([
    { category: 'software', items: ['Development Tools', 'Design Tools', 'Communication Tools', 'Project Management', 'Repositories', 'Testing Frameworks'] },
    { category: 'hardware', items: ['Servers', 'Mobile Devices', 'IoT Devices', 'Custom Hardware', 'Specialized Equipment'] },
    { category: 'services', items: ['Cloud Services', 'APIs', 'SaaS Platforms', 'Integration Services', 'Security Services'] },
    { category: 'human_resources', items: ['Training', 'External Consultants', 'Specialized Skills', 'User Testing Participants'] },
    { category: 'documentation', items: ['Requirements', 'Architecture Docs', 'User Guides', 'API Documentation', 'Test Plans'] }
  ]);
  const [selectedResourceCategory, setSelectedResourceCategory] = useState('software');
  
  // Fetch tech stack options
  useEffect(() => {
    const fetchTechOptions = async () => {
      try {
        const response = await fetch('/api/projects/tech-stack');
        if (response.ok) {
          const data = await response.json();
          setTechStackOptions(data.techStackOptions);
        } else {
          // Fallback options if API fails
          setTechStackOptions({
            programming: ['JavaScript', 'TypeScript', 'Python', 'Java'],
            frontend: ['React', 'Angular', 'Vue.js'],
            backend: ['Node.js', 'Django', 'Spring Boot'],
            microsoft: ['SharePoint', 'Power Apps', 'Office 365', 'Teams'],
            productivity: ['Jira', 'Asana', 'Trello', 'Smartsheet'],
            other: []
          });
        }
      } catch (error) {
        console.error('Error fetching tech stack options:', error);
      } finally {
        setLoadingTechOptions(false);
      }
    };
    
    fetchTechOptions();
  }, []);
  
  // Fetch employees for assignment
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch('/api/employees');
        if (response.ok) {
          const data = await response.json();
          setEmployees(data);
        } else {
          // Mock employees if API fails
          setEmployees([
            { id: 'emp-001', firstName: 'John', lastName: 'Doe', position: 'Developer' },
            { id: 'emp-002', firstName: 'Jane', lastName: 'Smith', position: 'Designer' },
            { id: 'emp-003', firstName: 'Mike', lastName: 'Johnson', position: 'Project Manager' }
          ]);
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
      }
    };
    
    fetchEmployees();
  }, []);
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Clear error when field is updated
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle date changes
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: value ? new Date(value) : undefined 
    }));
  };
  
  // Add tech stack item
  const handleAddTechStack = (tech: string) => {
    if (tech && !formData.tech_stack?.includes(tech)) {
      setFormData(prev => ({
        ...prev,
        tech_stack: [...(prev.tech_stack || []), tech]
      }));
    }
  };
  
  // Add custom tech stack item
  const handleAddCustomTech = () => {
    if (customTechOption.trim()) {
      handleAddTechStack(customTechOption.trim());
      
      // Also add to server for future use
      fetch('/api/projects/tech-stack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option: customTechOption.trim() })
      }).catch(err => console.error('Error adding custom tech option:', err));
      
      setCustomTechOption('');
    }
  };
  
  // Remove tech stack item
  const handleRemoveTechStack = (tech: string) => {
    setFormData(prev => ({
      ...prev,
      tech_stack: prev.tech_stack?.filter(t => t !== tech) || []
    }));
  };
  
  // Add methodology
  const handleAddMethodology = (methodology: string) => {
    if (methodology && !formData.methodologies?.includes(methodology)) {
      setFormData(prev => ({
        ...prev,
        methodologies: [...(prev.methodologies || []), methodology]
      }));
    }
  };
  
  // Add custom methodology
  const handleAddCustomMethodology = () => {
    if (customMethodology.trim()) {
      handleAddMethodology(customMethodology.trim());
      setCustomMethodology('');
    }
  };
  
  // Remove methodology
  const handleRemoveMethodology = (methodology: string) => {
    setFormData(prev => ({
      ...prev,
      methodologies: prev.methodologies?.filter(m => m !== methodology) || []
    }));
  };
  
  // Add tool or resource
  const handleAddResource = (resource: string) => {
    if (resource && !formData.tools_and_resources?.includes(resource)) {
      setFormData(prev => ({
        ...prev,
        tools_and_resources: [...(prev.tools_and_resources || []), resource]
      }));
    }
  };
  
  // Add employee task
  const handleAddTask = (employeeId: string) => {
    if (!newTaskDescription.trim() || newTaskHours <= 0) return;
    
    const newTask = {
      description: newTaskDescription,
      hours: newTaskHours,
      status: 'Not Started'
    };
    
    setEmployeeTasks(prev => {
      const employeeTasks = [...(prev[employeeId] || [])];
      return {
        ...prev,
        [employeeId]: [...employeeTasks, newTask]
      };
    });
    
    // Update total project hours
    setFormData(prev => ({
      ...prev,
      total_hours: (prev.total_hours || 0) + newTaskHours
    }));
    
    // Reset form fields
    setNewTaskDescription('');
    setNewTaskHours(1);
  };
  
  // Remove employee task
  const handleRemoveTask = (employeeId: string, taskIndex: number) => {
    const taskHours = employeeTasks[employeeId][taskIndex].hours;
    
    setEmployeeTasks(prev => {
      const updatedTasks = [...prev[employeeId]];
      updatedTasks.splice(taskIndex, 1);
      return {
        ...prev,
        [employeeId]: updatedTasks
      };
    });
    
    // Update total project hours
    setFormData(prev => ({
      ...prev,
      total_hours: Math.max(0, (prev.total_hours || 0) - taskHours)
    }));
  };
  
  // Add employee contribution
  const handleAddContributor = () => {
    if (!selectedEmployee || !employeeRole || hoursPerWeek <= 0) {
      return;
    }
    
    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;
    
    const newContribution: EmployeeContribution = {
      employee_id: selectedEmployee,
      role: employeeRole,
      hours_per_week: hoursPerWeek,
      start_date: new Date(),
      end_date: null,
      active: true
    };
    
    setFormData(prev => ({
      ...prev,
      employee_contributions: [
        ...(prev.employee_contributions || []),
        newContribution
      ]
    }));
    
    // Reset fields
    setSelectedEmployee('');
    setEmployeeRole('');
    setHoursPerWeek(0);
  };
  
  // Remove employee contribution
  const handleRemoveContributor = (employeeId: string) => {
    setFormData(prev => ({
      ...prev,
      employee_contributions: prev.employee_contributions?.filter(
        c => c.employee_id !== employeeId
      ) || []
    }));
  };
  
  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.project_title?.trim()) {
      newErrors.project_title = 'Project title is required';
    }
    
    if (!formData.project_description?.trim()) {
      newErrors.project_description = 'Project description is required';
    }
    
    if (!formData.department?.trim()) {
      newErrors.department = 'Department is required';
    }
    
    if (!formData.total_hours || formData.total_hours <= 0) {
      newErrors.total_hours = 'Total hours must be greater than 0';
    }
    
    if (!formData.tech_stack || formData.tech_stack.length === 0) {
      newErrors.tech_stack = 'At least one technology must be selected';
    }
    
    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }
    
    // Validate that each team member has at least one task
    if (formData.employee_contributions && formData.employee_contributions.length > 0) {
      formData.employee_contributions.forEach(contribution => {
        const employeeId = contribution.employee_id;
        if (!employeeTasks[employeeId] || employeeTasks[employeeId].length === 0) {
          newErrors[`tasks_${employeeId}`] = 'At least one task is required for each team member';
        }
      });
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    // Combine tasks with employee contributions for final submission
    const updatedEmployeeContributions = formData.employee_contributions?.map(contribution => {
      return {
        ...contribution,
        tasks: employeeTasks[contribution.employee_id] || []
      };
    }) || [];
    
    onSubmit({
      ...formData,
      employee_contributions: updatedEmployeeContributions,
      // Ensure dates are properly formatted
      start_date: formData.start_date,
      end_date: formData.end_date,
      // Convert total_hours to number
      total_hours: Number(formData.total_hours)
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Project Title*
        </label>
        <input
          type="text"
          name="project_title"
          value={formData.project_title || ''}
          onChange={handleInputChange}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.project_title ? 'border-red-500' : 'border-gray-300'
          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
        {errors.project_title && (
          <p className="mt-1 text-sm text-red-600">{errors.project_title}</p>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Project Description*
        </label>
        <textarea
          name="project_description"
          value={formData.project_description || ''}
          onChange={handleInputChange}
          rows={3}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.project_description ? 'border-red-500' : 'border-gray-300'
          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
        {errors.project_description && (
          <p className="mt-1 text-sm text-red-600">{errors.project_description}</p>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department*
          </label>
          <input
            type="text"
            name="department"
            value={formData.department || ''}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md ${
              errors.department ? 'border-red-500' : 'border-gray-300'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          {errors.department && (
            <p className="mt-1 text-sm text-red-600">{errors.department}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Hours*
          </label>
          <input
            type="number"
            name="total_hours"
            value={formData.total_hours || ''}
            onChange={handleInputChange}
            min="1"
            className={`w-full px-3 py-2 border rounded-md ${
              errors.total_hours ? 'border-red-500' : 'border-gray-300'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          {errors.total_hours && (
            <p className="mt-1 text-sm text-red-600">{errors.total_hours}</p>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date*
          </label>
          <input
            type="date"
            name="start_date"
            value={formData.start_date ? new Date(formData.start_date).toISOString().split('T')[0] : ''}
            onChange={handleDateChange}
            className={`w-full px-3 py-2 border rounded-md ${
              errors.start_date ? 'border-red-500' : 'border-gray-300'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          {errors.start_date && (
            <p className="mt-1 text-sm text-red-600">{errors.start_date}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date (Optional)
          </label>
          <input
            type="date"
            name="end_date"
            value={formData.end_date ? new Date(formData.end_date).toISOString().split('T')[0] : ''}
            onChange={handleDateChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            name="status"
            value={formData.status || 'Planning'}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Planning">Planning</option>
            <option value="In Progress">In Progress</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            name="priority"
            value={formData.priority || 'Medium'}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      </div>
      
      {/* Tech Stack Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Tech Stack*
        </label>
        
        {/* Selected tech stack items */}
        <div className="flex flex-wrap gap-2 mb-3">
          {formData.tech_stack?.map(tech => (
            <div 
              key={tech} 
              className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center"
            >
              <span>{tech}</span>
              <button
                type="button"
                onClick={() => handleRemoveTechStack(tech)}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                <FaTimes size={12} />
              </button>
            </div>
          ))}
          
          {(formData.tech_stack?.length === 0) && (
            <p className="text-sm text-gray-500 italic">
              No technologies selected
            </p>
          )}
        </div>
        
        {errors.tech_stack && (
          <p className="mt-1 text-sm text-red-600 flex items-center">
            <FaExclamationCircle className="mr-1" />
            {errors.tech_stack}
          </p>
        )}
        
        {/* Tech stack category selection */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Select Category
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {!loadingTechOptions && Object.keys(techStackOptions).map(category => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 text-sm rounded-md ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        
        {/* Tech options from selected category */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Select Technology
          </label>
          <div className="flex flex-wrap gap-2 mb-3 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-md">
            {loadingTechOptions ? (
              <p className="text-sm text-gray-500 italic">Loading options...</p>
            ) : (
              techStackOptions[selectedCategory]?.map(tech => (
                <button
                  key={tech}
                  type="button"
                  onClick={() => handleAddTechStack(tech)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md"
                  disabled={formData.tech_stack?.includes(tech)}
                >
                  {tech}
                </button>
              ))
            )}
          </div>
        </div>
        
        {/* Add custom tech option */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customTechOption}
            onChange={(e) => setCustomTechOption(e.target.value)}
            placeholder="Add custom technology..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAddCustomTech}
            disabled={!customTechOption.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <FaPlus size={14} />
          </button>
        </div>
      </div>
      
      {/* Employee Contributions */}
      <div className="space-y-3">
        <h3 className="text-md font-medium text-gray-800">Team Members</h3>
        
        {/* Team members list */}
        <div className="space-y-4">
          {formData.employee_contributions?.map((contribution) => {
            const employee = employees.find(e => e.id === contribution.employee_id);
            const employeeFullName = employee ? `${employee.firstName} ${employee.lastName}` : contribution.employee_id;
            
            return (
              <div key={contribution.employee_id} className="border border-gray-200 rounded-md overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
                <div>
                    <p className="font-medium text-gray-800">
                      {employeeFullName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {contribution.role} • {contribution.hours_per_week} hours/week
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveContributor(contribution.employee_id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <FaTimes />
                </button>
                </div>
                
                {/* Tasks for this employee */}
                <div className="p-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Assigned Tasks</h4>
                  
                  {employeeTasks[contribution.employee_id] && employeeTasks[contribution.employee_id].length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {employeeTasks[contribution.employee_id].map((task, index) => (
                        <div key={index} className="flex items-start justify-between p-2 bg-gray-50 border border-gray-200 rounded">
                          <div className="flex-grow">
                            <p className="text-sm">{task.description}</p>
                            <p className="text-xs text-gray-500">{task.hours} hours</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveTask(contribution.employee_id, index)}
                            className="text-red-500 hover:text-red-700 ml-2"
                          >
                            <FaTimes size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic mb-3">No tasks assigned</p>
                  )}
                  
                  {errors[`tasks_${contribution.employee_id}`] && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <FaExclamationCircle className="mr-1" />
                      {errors[`tasks_${contribution.employee_id}`]}
                    </p>
                  )}
                  
                  {/* Add new task */}
                  <div className="grid grid-cols-12 gap-2 mt-2">
                    <div className="col-span-7">
                      <input
                        type="text"
                        value={newTaskDescription}
                        onChange={(e) => setNewTaskDescription(e.target.value)}
                        placeholder="Task description"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        value={newTaskHours}
                        onChange={(e) => setNewTaskHours(Number(e.target.value))}
                        min="1"
                        placeholder="Hours"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => handleAddTask(contribution.employee_id)}
                        disabled={!newTaskDescription.trim() || newTaskHours <= 0}
                        className="w-full h-full bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        <FaPlus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {(!formData.employee_contributions || formData.employee_contributions.length === 0) && (
            <p className="text-sm text-gray-500 italic">
              No team members added
            </p>
          )}
        </div>
        
        {/* Add new team member */}
        <div className="p-4 border border-gray-200 rounded-md">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Add Team Member</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Employee</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName} ({employee.position})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-gray-600 mb-1">Role</label>
              <select
                value={employeeRole}
                onChange={(e) => setEmployeeRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Role</option>
                {predefinedRoles.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.value}
                  </option>
                ))}
              </select>
              {employeeRole && (
                <p className="mt-1 text-xs text-gray-500 italic">
                  {predefinedRoles.find(r => r.value === employeeRole)?.description || ''}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-xs text-gray-600 mb-1">Hours per Week</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={hoursPerWeek || ''}
                  onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                  min="1"
                  max="40"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddContributor}
                  disabled={!selectedEmployee || !employeeRole || hoursPerWeek <= 0}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <FaPlus size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Project Methodologies */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Project Methodologies
        </label>
        
        {/* Selected methodologies */}
        <div className="flex flex-wrap gap-2 mb-3">
          {formData.methodologies?.map(methodology => (
            <div 
              key={methodology} 
              className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center"
            >
              <span>{methodology}</span>
              <button
                type="button"
                onClick={() => handleRemoveMethodology(methodology)}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                <FaTimes size={12} />
              </button>
            </div>
          ))}
          
          {(!formData.methodologies || formData.methodologies.length === 0) && (
            <p className="text-sm text-gray-500 italic">
              No methodologies selected
            </p>
          )}
        </div>
        
        {/* Methodology selection */}
        <div className="flex flex-wrap gap-2 mb-3">
          {methodologies.map(methodology => (
            <button
              key={methodology}
              type="button"
              onClick={() => handleAddMethodology(methodology)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md"
              disabled={formData.methodologies?.includes(methodology)}
            >
              {methodology}
            </button>
          ))}
        </div>
        
        {/* Add custom methodology */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customMethodology}
            onChange={(e) => setCustomMethodology(e.target.value)}
            placeholder="Add custom methodology..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAddCustomMethodology}
            disabled={!customMethodology.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <FaPlus size={14} />
          </button>
        </div>
      </div>
      
      {/* Tools and Resources */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Tools and Resources
        </label>
        
        {/* Selected tools and resources */}
        <div className="flex flex-wrap gap-2 mb-3">
          {formData.tools_and_resources?.map(resource => (
            <div 
              key={resource} 
              className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm flex items-center"
            >
              <span>{resource}</span>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    tools_and_resources: prev.tools_and_resources?.filter(r => r !== resource) || []
                  }));
                }}
                className="ml-2 text-purple-600 hover:text-purple-800"
              >
                <FaTimes size={12} />
              </button>
            </div>
          ))}
          
          {(!formData.tools_and_resources || formData.tools_and_resources.length === 0) && (
            <p className="text-sm text-gray-500 italic">
              No tools or resources selected
            </p>
          )}
        </div>
        
        {/* Resource category selection */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Select Resource Category
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {resourceTypes.map(resource => (
              <button
                key={resource.category}
                type="button"
                onClick={() => setSelectedResourceCategory(resource.category)}
                className={`px-3 py-1 text-sm rounded-md ${
                  selectedResourceCategory === resource.category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {resource.category.charAt(0).toUpperCase() + resource.category.slice(1).replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        
        {/* Resources from selected category */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Select Resource
          </label>
          <div className="flex flex-wrap gap-2 mb-3 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-md">
            {resourceTypes.find(r => r.category === selectedResourceCategory)?.items.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => handleAddResource(item)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md"
                disabled={formData.tools_and_resources?.includes(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        
        {/* Add custom resource */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customTechOption}
            onChange={(e) => setCustomTechOption(e.target.value)}
            placeholder="Add custom tool or resource..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => {
              if (customTechOption.trim()) {
                handleAddResource(customTechOption.trim());
                setCustomTechOption('');
              }
            }}
            disabled={!customTechOption.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <FaPlus size={14} />
          </button>
        </div>
      </div>
      
      {/* Form actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {isEdit ? 'Update Project' : 'Create Project'}
        </button>
      </div>
    </form>
  );
} 