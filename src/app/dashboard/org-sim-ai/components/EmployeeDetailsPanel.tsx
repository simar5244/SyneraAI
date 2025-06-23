'use client';

import React from 'react';
import { OrgNode } from './NewOrgSimAIContent';

interface EmployeeDetailsPanelProps {
  employee: OrgNode | null;
  allEmployees?: OrgNode[];
  onClose?: () => void;
  teamAverageWorkload?: number;
}

const EmployeeDetailsPanel: React.FC<EmployeeDetailsPanelProps> = ({ 
  employee, 
  allEmployees = [],
  onClose,
  teamAverageWorkload 
}) => {
  if (!employee) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
        <div className="h-16 w-16 mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-8 w-8 text-gray-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-2">No Employee Selected</h3>
        <p className="text-sm">Select an employee from the organization chart to view their details.</p>
      </div>
    );
  }

  // Find direct team members (employees who have the same manager)
  const findManagerId = (root: OrgNode, employeeId: string): string | null => {
    for (const child of root.children) {
      if (child.id === employeeId) {
        return root.id;
      }
      const foundInChild = findManagerId(child, employeeId);
      if (foundInChild) return foundInChild;
    }
    return null;
  };

  // Find all employees under this person (if they're a manager)
  const findTeamMembers = (manager: OrgNode): OrgNode[] => {
    return manager.children;
  };

  // Find the manager of the selected employee
  const managerId = allEmployees.length > 0 && employee.id !== allEmployees[0].id 
    ? findManagerId(allEmployees[0], employee.id) 
    : null;
  
  const manager = managerId && allEmployees.length > 0
    ? findNodeById(allEmployees[0], managerId) 
    : null;
  
  // Get direct reports if this employee has any
  const teamMembers = findTeamMembers(employee);

  // Helper function to find a node by ID
  function findNodeById(node: OrgNode, id: string): OrgNode | null {
    if (node.id === id) return node;
    
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
    
    return null;
  }

  // Get workload status
  const getWorkloadStatus = (workload: number) => {
    if (workload >= 90) return { text: 'Overloaded', color: 'text-red-600', bgColor: 'bg-red-50', indicator: 'bg-red-500' };
    if (workload >= 75) return { text: 'Heavy', color: 'text-orange-600', bgColor: 'bg-orange-50', indicator: 'bg-orange-500' };
    if (workload >= 40) return { text: 'Balanced', color: 'text-green-600', bgColor: 'bg-green-50', indicator: 'bg-green-500' };
    return { text: 'Light', color: 'text-blue-600', bgColor: 'bg-blue-50', indicator: 'bg-blue-500' };
  };

  const workloadStatus = getWorkloadStatus(employee.workload);

  // Get first letter of first and last name for avatar
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  const initials = getInitials(employee.name);

  return (
    <div className="h-full overflow-auto bg-white rounded-lg shadow-sm">
      {/* Modern Card Header with Avatar */}
      <div className="relative">
        {/* Background color band */}
        <div className="h-32 bg-gradient-to-r from-indigo-600 to-indigo-700"></div>
        
        {/* Close button */}
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 bg-white rounded-full p-1 shadow-sm hover:bg-gray-100"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        {/* Avatar that overlaps the color band */}
        <div className="absolute top-20 left-6 flex items-end">
          <div className="h-24 w-24 rounded-full bg-white p-1 shadow-md">
            <div className="h-full w-full rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-indigo-700">{initials}</span>
            </div>
          </div>
          <div className="ml-4 mb-2">
            <h2 className="text-2xl font-bold text-white drop-shadow-sm">{employee.name}</h2>
            <div className="flex items-center text-indigo-100">
              {employee.role && <span>{employee.role}</span>}
              {employee.department && (
                <>
                  <span className="mx-2">•</span>
                  <span>{employee.department}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Content Area with spacing for the overlapping avatar */}
      <div className="mt-20 px-6">
        {/* Workload Card */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <h3 className="text-sm uppercase tracking-wider text-gray-500 font-medium mb-3">Current Workload</h3>
          <div className="flex items-center mb-2">
            <div className="w-full bg-gray-100 rounded-full h-3 mr-3">
              <div 
                className={`h-3 rounded-full ${workloadStatus.indicator}`}
                style={{ width: `${employee.workload}%` }}
              ></div>
            </div>
            <span className="text-xl font-bold min-w-[3rem] text-right">{employee.workload}%</span>
          </div>
          <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${workloadStatus.bgColor} ${workloadStatus.color}`}>
            <span className="w-2 h-2 rounded-full mr-1.5 bg-current"></span>
            {workloadStatus.text}
          </div>
        </div>
        
        {/* Team Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-2">Team Size</h3>
            <div className="text-2xl font-bold">{teamMembers.length}</div>
            <div className="text-sm text-gray-600">
              {teamMembers.length === 1 ? 'Direct Report' : 'Direct Reports'}
            </div>
          </div>
          
          {employee.experience !== undefined && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-2">Experience</h3>
              <div className="text-2xl font-bold">{employee.experience}</div>
              <div className="text-sm text-gray-600">
                {employee.experience === 1 ? 'Year' : 'Years'}
              </div>
            </div>
          )}
        </div>
        
        {/* Manager Card */}
        {manager && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
            <h3 className="text-sm uppercase tracking-wider text-gray-500 font-medium mb-3">Reports To</h3>
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-medium text-indigo-700">
                  {getInitials(manager.name)}
                </span>
              </div>
              <div className="ml-3">
                <div className="font-medium">{manager.name}</div>
                <div className="text-sm text-gray-600">{manager.role}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Team Members */}
        {teamMembers.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
            <h3 className="text-sm uppercase tracking-wider text-gray-500 font-medium mb-3">Team Members</h3>
            <div className="space-y-3">
              {teamMembers.map(member => {
                const memberStatus = getWorkloadStatus(member.workload);
                return (
                  <div key={member.id} className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${memberStatus.bgColor}`}>
                      <span className={`text-base font-medium ${memberStatus.color}`}>
                        {getInitials(member.name)}
                      </span>
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{member.name}</span>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${memberStatus.bgColor} ${memberStatus.color}`}>
                          {member.workload}%
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">{member.role}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Skills */}
        {employee.skills && employee.skills.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
            <h3 className="text-sm uppercase tracking-wider text-gray-500 font-medium mb-3">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {employee.skills.map((skill, index) => (
                <span 
                  key={index}
                  className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Projects */}
        {employee.projects && employee.projects.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
            <h3 className="text-sm uppercase tracking-wider text-gray-500 font-medium mb-3">Projects</h3>
            <ul className="space-y-2">
              {employee.projects.map((project, index) => (
                <li key={index} className="flex items-start">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="ml-2 text-gray-700">{project}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Salary if available */}
        {employee.salary && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
            <h3 className="text-sm uppercase tracking-wider text-gray-500 font-medium mb-2">Annual Salary</h3>
            <div className="text-2xl font-bold text-gray-800">
              {employee.salary.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDetailsPanel; 