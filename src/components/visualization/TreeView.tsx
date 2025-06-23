'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Employee, Department } from '@/types/organization';

interface TreeViewProps {
  employees: Employee[];
  departments: Department[];
}

interface TreeNode {
  id: string;
  name: string;
  role?: string;
  department?: string;
  children: TreeNode[];
  depth?: number;
  x?: number;
  y?: number;
  data?: any;
  type: 'employee' | 'department';
}

const TreeView: React.FC<TreeViewProps> = ({ employees, departments }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Wrap departmentColors in useMemo to prevent recreation on each render
  const departmentColors = useMemo(() => ({
    'Engineering': '#4285F4',  // Google Blue
    'Marketing': '#EA4335',    // Google Red
    'Sales': '#FBBC05',        // Google Yellow
    'HR': '#34A853',           // Google Green
    'Finance': '#8E44AD',      // Purple
    'Operations': '#F39C12',   // Orange
    'Product': '#16A085',      // Turquoise
    'Design': '#E74C3C',       // Red
    'Research': '#2980B9',     // Blue
    'Executive': '#1F618D',    // Dark Blue
  }), []);

  const defaultColor = '#9ca3af';

  // Calculate unique departments
  const uniqueDepartments = React.useMemo(() => {
    const deptSet = new Set<string>();
    employees.forEach(emp => {
      if (emp.department) {
        deptSet.add(emp.department);
      }
    });
    return Array.from(deptSet).sort();
  }, [employees]);

  // Calculate unique roles
  const uniqueRoles = React.useMemo(() => {
    const roleSet = new Set<string>();
    employees.forEach(emp => {
      if (emp.role) {
        roleSet.add(emp.role);
      }
    });
    return Array.from(roleSet).sort();
  }, [employees]);

  // Prepare hierarchical data
  useEffect(() => {
    if (!employees.length || !departments.length) return;

    // Apply filters
    let filteredEmployees = [...employees];
    
    if (departmentFilter) {
      filteredEmployees = filteredEmployees.filter(emp => emp.department === departmentFilter);
    }
    
    if (roleFilter) {
      filteredEmployees = filteredEmployees.filter(emp => emp.role === roleFilter);
    }
    
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filteredEmployees = filteredEmployees.filter(emp => 
        emp.name.toLowerCase().includes(lowerSearchTerm) ||
        (emp.role && emp.role.toLowerCase().includes(lowerSearchTerm)) ||
        (emp.department && emp.department.toLowerCase().includes(lowerSearchTerm))
      );
    }

    // Create a map of employees for quick lookup
    const employeeMap = new Map<string, Employee>();
    filteredEmployees.forEach(emp => employeeMap.set(emp.id, emp));

    // Create a map of departments for quick lookup
    const departmentMap = new Map<string, Department>();
    departments.forEach(dept => departmentMap.set(dept.id, dept));

    // Function to build the tree recursively
    const buildEmployeeTree = (rootEmployeeId: string): TreeNode => {
      const employee = employeeMap.get(rootEmployeeId);
      if (!employee) {
        // Handle case of missing employee (shouldn't happen but for safety)
        return {
          id: rootEmployeeId,
          name: 'Unknown Employee',
          children: [],
          type: 'employee'
        };
      }

      // Get direct reports (employees whose manager is this employee)
      const directReports = filteredEmployees.filter(
        emp => emp.managerId === rootEmployeeId
      );

      // Create tree node for this employee
      const employeeNode: TreeNode = {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        department: employee.department,
        children: [],
        data: employee,
        type: 'employee'
      };

      // Recursively build tree for each direct report
      if (directReports.length > 0) {
        employeeNode.children = directReports.map(report => 
          buildEmployeeTree(report.id)
        );
      }

      return employeeNode;
    };

    // Function to build department tree
    const buildDepartmentTree = (rootDepartmentId: string | null): TreeNode[] => {
      // Get top-level departments (no parent or parent is the specified root)
      const topDepts = departments.filter(dept => {
        if (rootDepartmentId === null) {
          return !dept.parentDepartmentId;
        }
        return dept.parentDepartmentId === rootDepartmentId;
      });

      return topDepts.map(dept => {
        // Get department manager if there is one
        const deptManager = filteredEmployees.find(emp => 
          emp.department === dept.name && emp.role?.toLowerCase().includes('manager')
        );

        // Get employees in this department
        const deptEmployees = filteredEmployees.filter(emp => 
          emp.department === dept.name
        );

        // Start with the manager as the root if there is one
        let deptRoot: TreeNode;

        if (deptManager) {
          deptRoot = buildEmployeeTree(deptManager.id);
        } else {
          // If no manager, create a department node with employees as children
          deptRoot = {
            id: `dept-${dept.id}`,
            name: dept.name,
            children: [],
            type: 'department',
            data: dept
          };

          // Add employees that don't have managers within this filtered set
          const unmanagedEmployees = deptEmployees.filter(emp => 
            !emp.managerId || !employeeMap.has(emp.managerId)
          );

          deptRoot.children = unmanagedEmployees.map(emp => ({
            id: emp.id,
            name: emp.name,
            role: emp.role,
            department: emp.department,
            children: [],
            data: emp,
            type: 'employee'
          }));
        }

        // Get child departments
        const childDepts = buildDepartmentTree(dept.id);
        
        // Add child departments to the tree
        if (childDepts.length > 0) {
          deptRoot.children = [...deptRoot.children, ...childDepts];
        }

        return deptRoot;
      });
    };

    // Find the root employee (CEO or highest level with no manager)
    const rootEmployee = filteredEmployees.find(emp => !emp.managerId);

    let hierarchyRoot: TreeNode;

    if (departmentFilter) {
      // If filtering by department, build tree just for that department
      const dept = departments.find(d => d.name === departmentFilter);
      if (dept) {
        const deptNodes = buildDepartmentTree(dept.parentDepartmentId);
        const deptNode = deptNodes.find(d => d.name === departmentFilter);
        
        if (deptNode) {
          hierarchyRoot = deptNode;
        } else {
          // Fallback - create a department node
          hierarchyRoot = {
            id: `dept-${dept.id}`,
            name: dept.name,
            children: [],
            type: 'department',
            data: dept
          };
          
          // Add all filtered employees
          hierarchyRoot.children = filteredEmployees.map(emp => ({
            id: emp.id,
            name: emp.name,
            role: emp.role,
            department: emp.department,
            children: [],
            data: emp,
            type: 'employee'
          }));
        }
      } else {
        // Fallback for missing department
        hierarchyRoot = {
          id: 'root',
          name: 'Organization',
          children: [],
          type: 'department'
        };
      }
    } else if (rootEmployee) {
      // If we have a CEO or root employee, build from there
      hierarchyRoot = buildEmployeeTree(rootEmployee.id);
    } else {
      // If no clear CEO, build department-based hierarchy
      const deptNodes = buildDepartmentTree(null);
      
      hierarchyRoot = {
        id: 'root',
        name: 'Organization',
        children: deptNodes,
        type: 'department'
      };
    }

    setTreeData(hierarchyRoot);
  }, [employees, departments, departmentFilter, roleFilter, searchTerm]);

  // Handle window resize and initial dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    // Initial dimensions
    updateDimensions();
    
    // Listen for resize
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Draw the tree
  useEffect(() => {
    if (!svgRef.current || !treeData || dimensions.width === 0 || dimensions.height === 0) return;

    // Clear any existing content
    d3.select(svgRef.current).selectAll('*').remove();
    
    // Create the SVG and main group for the tree
    const svg = d3.select(svgRef.current);
    
    // Create the root group that will be transformed for zoom
    const rootGroup = svg.append('g');
    
    // Set up zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        rootGroup.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });
    
    svg.call(zoom);
    
    // Create the hierarchical layout
    const treeLayout = d3.tree<TreeNode>()
      .nodeSize([50, 280]) // First is vertical spacing, second is horizontal spacing
      .separation((a, b) => {
        // Adjust separation based on node depths and whether they're departments or employees
        return (a.type === 'department' || b.type === 'department') ? 2 : 1.3;
      });
    
    // Create the root hierarchy
    const root = d3.hierarchy(treeData);
    
    // Run the layout
    treeLayout(root);
    
    // Calculate total tree dimensions
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    root.each(d => {
      minX = Math.min(minX, d.y); // Note: d3 tree uses .y for horizontal in this case
      maxX = Math.max(maxX, d.y);
      minY = Math.min(minY, d.x); // And .x for vertical
      maxY = Math.max(maxY, d.x);
    });
    
    // Add padding
    minX -= 50;
    maxX += 200;
    minY -= 50;
    maxY += 50;
    
    // Total dimensions
    const treeWidth = maxX - minX;
    const treeHeight = maxY - minY;
    
    // Center the tree in the available space
    const initialTransform = d3.zoomIdentity
      .translate(
        dimensions.width / 2 - treeWidth / 2 - minX, 
        dimensions.height / 2 - treeHeight / 2 - minY
      );
    
    svg.call(zoom.transform, initialTransform);
    
    // Create links between nodes
    rootGroup.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d => {
        const sourceY = d.source.y;  // Horizontal position of source
        const sourceX = d.source.x;  // Vertical position of source
        const targetY = d.target.y;  // Horizontal position of target
        const targetX = d.target.x;  // Vertical position of target
        
        // Calculate control points for a curved path
        const midY = (sourceY + targetY) / 2;
        
        // Draw an elbow connector
        return `
          M ${sourceY},${sourceX}
          L ${midY},${sourceX}
          L ${midY},${targetX}
          L ${targetY},${targetX}
        `;
      })
      .attr('fill', 'none')
      .attr('stroke', d => {
        // Colorize links based on departments
        const targetNode = d.target.data as TreeNode;
        if (targetNode.type === 'department') {
          return departmentColors[targetNode.name] || defaultColor;
        }
        return departmentColors[targetNode.department || ''] || '#888';
      })
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.7);
    
    // Create node groups
    const nodeGroups = rootGroup.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d.data as TreeNode);
      })
      .attr('cursor', 'pointer');
    
    // Draw different shapes based on node type
    nodeGroups.each(function(d) {
      const g = d3.select(this);
      const node = d.data as TreeNode;
      
      if (node.type === 'department') {
        // Create rectangles for departments
        g.append('rect')
          .attr('x', -60)
          .attr('y', -15)
          .attr('width', 120)
          .attr('height', 30)
          .attr('rx', 5)
          .attr('ry', 5)
          .attr('fill', departmentColors[node.name] || defaultColor)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);
      } else {
        // Create circles for employees
        const intensity = node.data?.workIntensity || 0;
        
        g.append('circle')
          .attr('r', 10 + (intensity / 10) * 5) // Size based on work intensity
          .attr('fill', departmentColors[node.department || ''] || defaultColor)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);
      }
      
      // Add text labels
      g.append('text')
        .attr('dy', node.type === 'department' ? 5 : -15)
        .attr('text-anchor', 'middle')
        .attr('fill', node.type === 'department' ? '#fff' : '#333')
        .style('font-weight', node.type === 'department' ? 'bold' : 'normal')
        .style('font-size', node.type === 'department' ? '12px' : '11px')
        .text(node.name);
      
      if (node.type === 'employee' && node.role) {
        g.append('text')
          .attr('dy', 5)
          .attr('text-anchor', 'middle')
          .attr('fill', '#666')
          .style('font-size', '9px')
          .text(node.role);
      }
    });
    
    // Add click handler to clear selection when clicking on background
    svg.on('click', () => {
      setSelectedNode(null);
    });
    
  }, [treeData, dimensions, departmentColors]);

  return (
    <div className="relative w-full h-full bg-gray-100" ref={containerRef}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full"></svg>
      
      {/* Department filters */}
      <div className="absolute top-4 left-4 bg-white/90 rounded-lg p-2 shadow-md z-10">
        <div>
          <span className="text-xs text-gray-700 mr-2">Department:</span>
          <button
            className={`px-3 py-1 text-xs rounded-md mr-2 ${
              departmentFilter === null ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => setDepartmentFilter(null)}
          >
            All
          </button>
          
          {uniqueDepartments.map(dept => (
            <button
              key={dept}
              className={`px-3 py-1 text-xs rounded-md mr-2 mb-1 ${
                departmentFilter === dept ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => setDepartmentFilter(dept)}
              style={{ borderLeft: `3px solid ${departmentColors[dept] || defaultColor}` }}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>
      
      {/* Role filters */}
      <div className="absolute top-4 right-4 bg-white/90 rounded-lg p-2 shadow-md z-10">
        <div>
          <span className="text-xs text-gray-700 mr-2">Role:</span>
          <button
            className={`px-3 py-1 text-xs rounded-md mr-2 ${
              roleFilter === null ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => setRoleFilter(null)}
          >
            All
          </button>
          
          {uniqueRoles.slice(0, 5).map(role => (
            <button
              key={role}
              className={`px-3 py-1 text-xs rounded-md mr-2 mb-1 ${
                roleFilter === role ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => setRoleFilter(role)}
            >
              {role}
            </button>
          ))}
          
          {uniqueRoles.length > 5 && (
            <select 
              className="px-2 py-1 text-xs rounded-md bg-gray-200 text-gray-700"
              value={roleFilter || ''}
              onChange={(e) => setRoleFilter(e.target.value || null)}
            >
              <option value="">More roles...</option>
              {uniqueRoles.slice(5).map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      
      {/* Search box */}
      <div className="absolute top-16 left-4 bg-white/90 rounded-lg p-2 shadow-md z-10">
        <input
          type="text"
          placeholder="Search employees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-1 text-xs rounded-md border border-gray-300 focus:outline-none focus:border-blue-400 w-64"
        />
      </div>
      
      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 bg-white/90 rounded-lg p-2 shadow-md z-10 flex items-center">
        <button 
          className="px-2 py-1 text-lg font-bold bg-gray-200 text-gray-700 rounded-l-md hover:bg-gray-300"
          onClick={() => {
            const svg = d3.select(svgRef.current);
            const currentTransform = d3.zoomTransform(svg.node() as any);
            const newTransform = currentTransform.scale(currentTransform.k * 0.8);
            svg.call((d3.zoom() as any).transform, newTransform);
          }}
        >
          -
        </button>
        <span className="px-2 text-xs text-gray-700">{Math.round(zoomLevel * 100)}%</span>
        <button 
          className="px-2 py-1 text-lg font-bold bg-gray-200 text-gray-700 rounded-r-md hover:bg-gray-300"
          onClick={() => {
            const svg = d3.select(svgRef.current);
            const currentTransform = d3.zoomTransform(svg.node() as any);
            const newTransform = currentTransform.scale(currentTransform.k * 1.2);
            svg.call((d3.zoom() as any).transform, newTransform);
          }}
        >
          +
        </button>
        <button 
          className="ml-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => {
            const svg = d3.select(svgRef.current);
            const initialTransform = d3.zoomIdentity.scale(1);
            svg.call((d3.zoom() as any).transform, initialTransform);
          }}
        >
          Reset
        </button>
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg p-2 shadow-md z-10">
        <div className="text-xs text-gray-700">
          <div className="font-bold mb-1">Legend:</div>
          <div className="grid grid-cols-2 gap-x-4">
            {Object.entries(departmentColors).slice(0, 6).map(([dept, color]) => (
              <div key={dept} className="flex items-center mb-1">
                <div className="w-3 h-3 mr-1 rounded-full" style={{ backgroundColor: color }}></div>
                <span>{dept}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Selected node details */}
      {selectedNode && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 bg-white text-gray-800 p-4 rounded-lg shadow-lg max-w-xs z-20">
          {selectedNode.type === 'department' ? (
            <>
              <h3 className="text-lg font-bold mb-2">{selectedNode.name} Department</h3>
              <p className="text-sm">Department information...</p>
              {selectedNode.data && (
                <>
                  <p className="text-sm mt-2">Employees: {selectedNode.children.length}</p>
                </>
              )}
              <button 
                className="mt-3 text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/department/${selectedNode.id.replace('dept-', '')}`, '_blank');
                }}
              >
                View Department Details
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold mb-2">{selectedNode.name}</h3>
              <p className="text-sm mb-1">Role: {selectedNode.role}</p>
              <p className="text-sm mb-1">Department: {selectedNode.department}</p>
              {selectedNode.data && (
                <>
                  <div className="mb-2">
                    <div className="text-xs text-gray-500 mb-1">Work Intensity</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-400 h-2 rounded-full" 
                        style={{ width: `${(selectedNode.data.workIntensity || 0) * 10}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="text-xs text-gray-500 mb-1">Collaboration</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-400 h-2 rounded-full" 
                        style={{ width: `${(selectedNode.data.collaborationIntensity || 0) * 10}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    <p>Projects: {selectedNode.data.projects?.length || 0}</p>
                    <p>Duties: {selectedNode.data.duties?.length || 0}</p>
                    <p>Direct Reports: {selectedNode.children?.length || 0}</p>
                  </div>
                </>
              )}
              <button 
                className="mt-3 text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/employee/${selectedNode.id}`, '_blank');
                }}
              >
                View Full Profile
              </button>
            </>
          )}
          <button 
            className="mt-2 text-xs bg-gray-300 hover:bg-gray-400 text-gray-800 py-1 px-3 rounded w-full"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedNode(null);
            }}
          >
            Close
          </button>
        </div>
      )}
      
      {/* Instructions */}
      <div className="absolute bottom-16 left-4 bg-white/90 text-gray-700 p-2 rounded-lg shadow-md text-xs z-10">
        <p>Drag to pan | Scroll to zoom | Click node for details</p>
      </div>
    </div>
  );
};

export default TreeView; 