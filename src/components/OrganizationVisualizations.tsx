'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiSearch, FiFilter, FiUser, FiRefreshCw } from 'react-icons/fi';
import { BsThreeDots } from 'react-icons/bs';
import { MdOutlineNetworkWifi, MdAccountTree, MdStars } from 'react-icons/md';
import Image from 'next/image';

interface EmployeeNode {
  id: string;
  name: string;
  role: string;
  department: string;
  profileImage?: string;
  workIntensity: number; // 0-100
  collaborationIntensity: number; // 0-100
  projects: string[];
  duties: string[];
  managerId?: string;
  collaborators: string[];
}

interface OrganizationVisualizationsProps {
  organizationData?: {
    employees: EmployeeNode[];
  };
  isLoading?: boolean;
}

/**
 * Component that displays organization data in three different visualizations:
 * 1. 3D Galaxy View
 * 2. Network View
 * 3. Tree View
 */
export default function OrganizationVisualizations({ 
  organizationData, 
  isLoading = false 
}: OrganizationVisualizationsProps) {
  const [activeView, setActiveView] = useState<'galaxy' | 'network' | 'tree'>('galaxy');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    departments: [] as string[],
    roles: [] as string[],
    showFilters: false
  });
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeNode | null>(null);
  
  const galaxyCanvasRef = useRef<HTMLCanvasElement>(null);
  const networkCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Extract unique departments and roles from data
  useEffect(() => {
    if (organizationData?.employees) {
      const departments = Array.from(new Set(organizationData.employees.map(emp => emp.department)));
      const roles = Array.from(new Set(organizationData.employees.map(emp => emp.role)));
      
      setFilterOptions(prev => ({
        ...prev,
        departments,
        roles
      }));
    }
  }, [organizationData]);
  
  // Initialize 3D Galaxy visualization
  useEffect(() => {
    if (galaxyCanvasRef.current && organizationData?.employees && activeView === 'galaxy') {
      initGalaxyVisualization(galaxyCanvasRef.current, organizationData.employees);
    }
  }, [galaxyCanvasRef, organizationData, activeView]);
  
  // Initialize Network visualization
  useEffect(() => {
    if (networkCanvasRef.current && organizationData?.employees && activeView === 'network') {
      initNetworkVisualization(networkCanvasRef.current, organizationData.employees);
    }
  }, [networkCanvasRef, organizationData, activeView, initNetworkVisualization]);
  
  // Initialize Tree visualization handled in render method with DOM elements
  
  const handleFilterChange = (type: 'departments' | 'roles', value: string) => {
    if (type === 'departments') {
      if (selectedDepartments.includes(value)) {
        setSelectedDepartments(prev => prev.filter(dep => dep !== value));
      } else {
        setSelectedDepartments(prev => [...prev, value]);
      }
    } else {
      if (selectedRoles.includes(value)) {
        setSelectedRoles(prev => prev.filter(role => role !== value));
      } else {
        setSelectedRoles(prev => [...prev, value]);
      }
    }
  };
  
  const filteredEmployees = () => {
    if (!organizationData?.employees || organizationData.employees.length === 0) return [];
    
    return organizationData.employees.filter(emp => {
      // Apply department filter
      if (selectedDepartments.length > 0 && !selectedDepartments.includes(emp.department)) {
        return false;
      }
      
      // Apply role filter
      if (selectedRoles.length > 0 && !selectedRoles.includes(emp.role)) {
        return false;
      }
      
      // Apply search filter
      if (searchTerm && !emp.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  };
  
  const initGalaxyVisualization = (canvas: HTMLCanvasElement, employees: EmployeeNode[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Initialize 3D visualization using Three.js or similar library
    // This is a placeholder - actual implementation would require 3D library integration
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw simulated galaxy visualization
    employees.forEach((emp, index) => {
      const x = 150 + Math.cos(index * 0.5) * (50 + emp.workIntensity * 0.5);
      const y = 150 + Math.sin(index * 0.5) * (50 + emp.collaborationIntensity * 0.5);
      
      // Draw collaboration connections
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(100, 100, 255, 0.2)';
      ctx.lineWidth = 1;
      emp.collaborators.forEach(collabId => {
        const collaborator = employees.find(e => e.id === collabId);
        if (collaborator) {
          const cx = 150 + Math.cos(employees.indexOf(collaborator) * 0.5) * (50 + collaborator.workIntensity * 0.5);
          const cy = 150 + Math.sin(employees.indexOf(collaborator) * 0.5) * (50 + collaborator.collaborationIntensity * 0.5);
          ctx.moveTo(x, y);
          ctx.lineTo(cx, cy);
        }
      });
      ctx.stroke();
      
      // Draw employee planet
      const intensity = (emp.workIntensity + emp.collaborationIntensity) / 2;
      const radius = 3 + (intensity / 20);
      
      // Glow effect
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity/100})`);
      gradient.addColorStop(0.5, `rgba(100, 100, 255, ${intensity/200})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Planet core
      ctx.beginPath();
      ctx.fillStyle = `hsl(${240 - intensity}, 80%, 60%)`;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  };
  
  const initNetworkVisualization = useCallback((canvas: HTMLCanvasElement, employees: EmployeeNode[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw simulated network visualization
    const positions: {[key: string]: {x: number, y: number}} = {};
    
    // Calculate positions (simplified force-directed layout)
    employees.forEach((emp, index) => {
      const angle = (index / employees.length) * Math.PI * 2;
      const radius = 120;
      positions[emp.id] = {
        x: canvas.width / 2 + Math.cos(angle) * radius,
        y: canvas.height / 2 + Math.sin(angle) * radius
      };
    });
    
    // Draw connections
    employees.forEach(emp => {
      const pos = positions[emp.id];
      
      // Draw collaboration connections
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(100, 100, 255, 0.3)';
      ctx.lineWidth = 1;
      emp.collaborators.forEach(collabId => {
        const collabPos = positions[collabId];
        if (collabPos) {
          ctx.moveTo(pos.x, pos.y);
          ctx.lineTo(collabPos.x, collabPos.y);
        }
      });
      ctx.stroke();
      
      // Draw hierarchy connections
      if (emp.managerId) {
        const managerPos = positions[emp.managerId];
        if (managerPos) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
          ctx.lineWidth = 2;
          ctx.moveTo(pos.x, pos.y);
          ctx.lineTo(managerPos.x, managerPos.y);
          ctx.stroke();
        }
      }
      
      // Draw nodes
      ctx.beginPath();
      ctx.fillStyle = getDepartmentColor(emp.department);
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw outline
      ctx.beginPath();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw label
      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(emp.name, pos.x, pos.y + 25);
    });
  }, []);
  
  const getDepartmentColor = (department: string) => {
    const colorMap: {[key: string]: string} = {
      'Engineering': '#4f46e5',
      'Marketing': '#059669',
      'Sales': '#0284c7',
      'HR': '#db2777',
      'Finance': '#ca8a04',
      'Operations': '#d97706',
      'Executive': '#7c3aed'
    };
    
    return colorMap[department] || '#6b7280';
  };
  
  const renderTreeVisualization = () => {
    if (!organizationData?.employees || organizationData.employees.length === 0) return null;
    
    // Find root employees (no manager)
    const rootEmployees = organizationData.employees.filter(emp => !emp.managerId);
    
    // If no root employees are found, display a message
    if (rootEmployees.length === 0) {
      return (
        <div className="flex justify-center items-center h-full">
          <p className="text-gray-500">No organizational hierarchy available</p>
        </div>
      );
    }
    
    return (
      <div className="p-4 overflow-auto max-w-full">
        <div className="flex justify-center min-w-[800px]">
          <ul className="tree">
            {rootEmployees.map(emp => renderEmployeeNode(emp))}
          </ul>
        </div>
      </div>
    );
  };
  
  const renderEmployeeNode = (employee: EmployeeNode) => {
    if (!organizationData?.employees || organizationData.employees.length === 0) return null;
    
    // Find direct reports
    const directReports = organizationData.employees.filter(emp => emp.managerId === employee.id);
    
    return (
      <li key={employee.id} className="mb-4">
        <div className="flex items-center bg-white p-2 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden">
            {employee.profileImage ? (
              <Image src={employee.profileImage} alt={employee.name} width={40} height={40} className="h-full w-full object-cover" />
            ) : (
              <FiUser className="h-6 w-6 text-indigo-600" />
            )}
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">{employee.name}</p>
            <p className="text-xs text-gray-500">{employee.role}</p>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
              {employee.department}
            </span>
          </div>
        </div>
        
        {directReports.length > 0 && (
          <ul className="mt-4 ml-8 space-y-4">
            {directReports.map(report => renderEmployeeNode(report))}
          </ul>
        )}
      </li>
    );
  };
  
  // Placeholder data for development
  const dummyData = {
    employees: [
      {
        id: '1',
        name: 'John Smith',
        role: 'CEO',
        department: 'Executive',
        workIntensity: 85,
        collaborationIntensity: 90,
        projects: ['Corporate Strategy', 'Annual Planning'],
        duties: ['Leadership', 'Vision Setting', 'Executive Management'],
        collaborators: ['2', '3', '4']
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        role: 'CTO',
        department: 'Engineering',
        workIntensity: 80,
        collaborationIntensity: 75,
        projects: ['Tech Infrastructure', 'Product Roadmap'],
        duties: ['Technology Strategy', 'Engineering Leadership'],
        managerId: '1',
        collaborators: ['1', '5', '6']
      },
      {
        id: '3',
        name: 'Michael Williams',
        role: 'CFO',
        department: 'Finance',
        workIntensity: 75,
        collaborationIntensity: 65,
        projects: ['Financial Planning', 'Investment Strategy'],
        duties: ['Financial Oversight', 'Reporting', 'Risk Management'],
        managerId: '1',
        collaborators: ['1', '4']
      },
      {
        id: '4',
        name: 'Jessica Brown',
        role: 'CMO',
        department: 'Marketing',
        workIntensity: 70,
        collaborationIntensity: 85,
        projects: ['Brand Strategy', 'Market Expansion'],
        duties: ['Marketing Strategy', 'Brand Management'],
        managerId: '1',
        collaborators: ['1', '3']
      },
      {
        id: '5',
        name: 'David Lee',
        role: 'Engineering Manager',
        department: 'Engineering',
        workIntensity: 90,
        collaborationIntensity: 80,
        projects: ['Platform Development', 'API Services'],
        duties: ['Team Leadership', 'Technical Architecture'],
        managerId: '2',
        collaborators: ['2', '6', '7', '8']
      },
      {
        id: '6',
        name: 'Amanda Chen',
        role: 'Product Manager',
        department: 'Engineering',
        workIntensity: 85,
        collaborationIntensity: 95,
        projects: ['Mobile App', 'Web Platform'],
        duties: ['Product Strategy', 'User Experience'],
        managerId: '2',
        collaborators: ['2', '5', '7', '8']
      },
      {
        id: '7',
        name: 'James Wilson',
        role: 'Senior Developer',
        department: 'Engineering',
        workIntensity: 95,
        collaborationIntensity: 70,
        projects: ['Backend Services', 'Data Processing'],
        duties: ['Code Development', 'System Design'],
        managerId: '5',
        collaborators: ['5', '6', '8']
      },
      {
        id: '8',
        name: 'Emily Davis',
        role: 'UX Designer',
        department: 'Engineering',
        workIntensity: 75,
        collaborationIntensity: 90,
        projects: ['User Interface', 'Design System'],
        duties: ['User Research', 'Prototyping'],
        managerId: '5',
        collaborators: ['5', '6', '7']
      }
    ]
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="border-b border-gray-200">
        <nav className="flex overflow-x-auto">
          {[
            { id: 'galaxy', label: 'Organization Galaxy', icon: MdStars },
            { id: 'network', label: 'Network View', icon: MdOutlineNetworkWifi },
            { id: 'tree', label: 'Hierarchical Tree', icon: MdAccountTree }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={`flex items-center py-4 px-6 text-sm font-medium whitespace-nowrap ${
                activeView === tab.id
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="mr-2" size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Controls */}
      <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
        <div className="relative flex-grow max-w-md">
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
        </div>
        
        <button 
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          onClick={() => setFilterOptions(prev => ({ ...prev, showFilters: !prev.showFilters }))}
        >
          <FiFilter className="mr-2" />
          Filter
        </button>
        
        <button 
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          onClick={() => {
            setSelectedDepartments([]);
            setSelectedRoles([]);
            setSearchTerm('');
          }}
        >
          <FiRefreshCw className="mr-2" />
          Reset
        </button>
      </div>
      
      {/* Filters Panel */}
      {filterOptions.showFilters && (
        <div className="bg-white p-4 border-b border-gray-200">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Departments</h3>
              <div className="space-y-2">
                {filterOptions.departments.map(dept => (
                  <label key={dept} className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      checked={selectedDepartments.includes(dept)}
                      onChange={() => handleFilterChange('departments', dept)}
                    />
                    <span className="ml-2 text-sm text-gray-700">{dept}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Roles</h3>
              <div className="space-y-2">
                {filterOptions.roles.map(role => (
                  <label key={role} className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      checked={selectedRoles.includes(role)}
                      onChange={() => handleFilterChange('roles', role)}
                    />
                    <span className="ml-2 text-sm text-gray-700">{role}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Visualization Area */}
      <div className="flex-grow overflow-hidden bg-gray-50 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : !organizationData?.employees || organizationData.employees.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div>
              <p className="text-gray-500 mb-4">No organization data available</p>
              <button 
                onClick={() => window.location.href = '/app/dashboard/employees'} 
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Connect ERP System
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 3D Galaxy View */}
            {activeView === 'galaxy' && (
              <div className="h-full w-full overflow-hidden relative">
                <canvas
                  ref={galaxyCanvasRef}
                  className="w-full h-full"
                  width={800}
                  height={600}
                ></canvas>
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded text-xs">
                  <p>Navigate: Drag to rotate | Scroll to zoom | Shift+drag to pan</p>
                </div>
              </div>
            )}
            
            {/* Network View */}
            {activeView === 'network' && (
              <div className="h-full w-full overflow-hidden">
                <canvas
                  ref={networkCanvasRef}
                  className="w-full h-full"
                  width={800}
                  height={600}
                ></canvas>
              </div>
            )}
            
            {/* Tree View */}
            {activeView === 'tree' && (
              <div className="h-full w-full overflow-auto p-8">
                {renderTreeVisualization()}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Employee Detail Popup */}
      {selectedEmployee && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-10">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden mr-4">
                  {selectedEmployee.profileImage ? (
                    <Image src={selectedEmployee.profileImage} alt={selectedEmployee.name} width={64} height={64} className="h-full w-full object-cover" />
                  ) : (
                    <FiUser className="h-10 w-10 text-indigo-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{selectedEmployee.name}</h3>
                  <p className="text-sm text-gray-500">{selectedEmployee.role} • {selectedEmployee.department}</p>
                </div>
              </div>
              <button 
                className="text-gray-400 hover:text-gray-500"
                onClick={() => setSelectedEmployee(null)}
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500 mb-1">Work Intensity</div>
                <div className="flex items-center">
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${selectedEmployee.workIntensity}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{selectedEmployee.workIntensity}%</span>
                </div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500 mb-1">Collaboration</div>
                <div className="flex items-center">
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                    <div 
                      className="bg-purple-600 h-2.5 rounded-full" 
                      style={{ width: `${selectedEmployee.collaborationIntensity}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{selectedEmployee.collaborationIntensity}%</span>
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Projects</h4>
              <div className="flex flex-wrap gap-2">
                {selectedEmployee.projects.map(project => (
                  <span 
                    key={project} 
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {project}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Duties</h4>
              <div className="flex flex-wrap gap-2">
                {selectedEmployee.duties.map(duty => (
                  <span 
                    key={duty} 
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                  >
                    {duty}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end pt-2 border-t border-gray-200">
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                onClick={() => setSelectedEmployee(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Use dummy data for development */}
      {!organizationData && !isLoading && (
        <script dangerouslySetInnerHTML={{ __html: `
          // This would be replaced with actual data fetching in production
          setTimeout(() => {
            // Initialize visualizations with dummy data
            const galaxyCanvas = document.getElementById('galaxy-canvas');
            const networkCanvas = document.getElementById('network-canvas');
            if (galaxyCanvas) initGalaxyVisualization(galaxyCanvas, dummyData.employees);
            if (networkCanvas) initNetworkVisualization(networkCanvas, dummyData.employees);
          }, 500);
        `}} />
      )}
    </div>
  );
} 