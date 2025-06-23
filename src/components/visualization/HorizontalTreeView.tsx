'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Employee, Department } from '@/types/organization';

interface HorizontalTreeViewProps {
  employees: Employee[];
  departments: Department[];
}

const HorizontalTreeView: React.FC<HorizontalTreeViewProps> = ({ 
  employees, 
  departments 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [rootEmployeeId, setRootEmployeeId] = useState<string | null>(null);

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

  // Find the root employee (CEO/highest level)
  useEffect(() => {
    if (!rootEmployeeId) {
      // If no root is specified, try to find the top-level employee (one without a manager)
      const topEmployee = employees.find(emp => !emp.managerId);
      if (topEmployee) {
        setRootEmployeeId(topEmployee.id);
      }
    }
  }, [employees, rootEmployeeId]);

  // Handle window resize
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

  // Toggle node expansion
  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      return newExpanded;
    });
  };

  // Also wrap buildHierarchy in useCallback
  const buildHierarchy = useCallback((rootEmp, emps) => {
    if (!rootEmp) return null;
    
    const idToEmployee = new Map<string, any>();
    
    // Initialize with basic data
    emps.forEach(emp => {
      idToEmployee.set(emp.id, {
        ...emp,
        children: []
      });
    });
    
    // Build the tree structure
    const root = idToEmployee.get(rootEmp);
    if (!root) return null;
    
    // Connect managers and direct reports
    emps.forEach(emp => {
      if (emp.id !== rootEmp && emp.managerId) {
        const manager = idToEmployee.get(emp.managerId);
        const employee = idToEmployee.get(emp.id);
        if (manager && employee) {
          manager.children.push(employee);
        }
      }
    });
    
    return root;
  }, []);

  // Create the tree visualization
  useEffect(() => {
    if (!svgRef.current || employees.length === 0 || !rootEmployeeId || dimensions.width === 0) return;

    // Filter employees based on search and filters
    let filteredEmployees = [...employees];
    
    if (departmentFilter) {
      filteredEmployees = filteredEmployees.filter(emp => emp.department === departmentFilter);
      
      // Make sure we keep the path to these filtered employees
      const keepIds = new Set<string>();
      
      // First identify the employees that match the filter
      filteredEmployees.forEach(emp => keepIds.add(emp.id));
      
      // Then add all ancestors to ensure paths remain connected
      let added = true;
      while (added) {
        added = false;
        filteredEmployees.forEach(emp => {
          if (keepIds.has(emp.id) && emp.managerId && !keepIds.has(emp.managerId)) {
            const manager = employees.find(e => e.id === emp.managerId);
            if (manager) {
              filteredEmployees.push(manager);
              keepIds.add(manager.id);
              added = true;
            }
          }
        });
      }
    }
    
    if (roleFilter) {
      // Similar approach to keep the tree connected when filtering by role
      const matchingEmployees = filteredEmployees.filter(emp => emp.role === roleFilter);
      const keepIds = new Set<string>();
      
      matchingEmployees.forEach(emp => keepIds.add(emp.id));
      
      // Add ancestors to keep paths connected
      let added = true;
      while (added) {
        added = false;
        employees.forEach(emp => {
          if (keepIds.has(emp.id) && emp.managerId && !keepIds.has(emp.managerId)) {
            const manager = employees.find(e => e.id === emp.managerId);
            if (manager && !filteredEmployees.some(e => e.id === manager.id)) {
              filteredEmployees.push(manager);
              keepIds.add(manager.id);
              added = true;
            }
          }
        });
      }
      
      // Filter to only include matching employees and their ancestors
      filteredEmployees = filteredEmployees.filter(emp => keepIds.has(emp.id));
    }
    
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchingEmployees = filteredEmployees.filter(emp => 
        emp.name.toLowerCase().includes(lowerSearchTerm) ||
        (emp.role && emp.role.toLowerCase().includes(lowerSearchTerm)) ||
        (emp.department && emp.department.toLowerCase().includes(lowerSearchTerm))
      );
      
      const keepIds = new Set<string>();
      matchingEmployees.forEach(emp => keepIds.add(emp.id));
      
      // Add ancestors to keep paths connected
      let added = true;
      while (added) {
        added = false;
        employees.forEach(emp => {
          if (keepIds.has(emp.id) && emp.managerId && !keepIds.has(emp.managerId)) {
            const manager = employees.find(e => e.id === emp.managerId);
            if (manager && !filteredEmployees.some(e => e.id === manager.id)) {
              filteredEmployees.push(manager);
              keepIds.add(manager.id);
              added = true;
            }
          }
        });
      }
      
      // Filter to only include matching employees and their ancestors
      filteredEmployees = filteredEmployees.filter(emp => keepIds.has(emp.id));
    }

    // Build the hierarchy
    const hierarchyRoot = buildHierarchy(rootEmployeeId, filteredEmployees);
    if (!hierarchyRoot) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    // Generate tree layout
    const treeLayout = d3.tree()
      .nodeSize([80, 200])
      .separation((a, b) => a.parent === b.parent ? 1.2 : 1.8);
    
    // Process the data to create a D3 hierarchy
    const root = d3.hierarchy(hierarchyRoot);
    
    // Filter the tree to only show expanded nodes
    root.descendants().forEach(d => {
      // @ts-ignore
      if (!expandedNodes.has(d.data.id) && d.children) {
        d._children = d.children;
        d.children = null;
      }
    });
    
    // Apply the tree layout
    treeLayout(root);

    // Create SVG and its elements
    const svg = d3.select(svgRef.current);
    const g = svg.append('g');
    
    // Set up zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    
    // Initial transform to center the root node
    const initialTransform = d3.zoomIdentity
      .translate(dimensions.width / 2 - root.y, dimensions.height / 2 - root.x)
      .scale(0.8);
    
    svg.call(zoom.transform, initialTransform);
    
    // Create links as curved paths between nodes
    const linkGroup = g.append('g')
      .attr('class', 'links');
    
    linkGroup.selectAll('path')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d => {
        return `M${d.source.y},${d.source.x}
                C${(d.source.y + d.target.y) / 2},${d.source.x}
                 ${(d.source.y + d.target.y) / 2},${d.target.x}
                 ${d.target.y},${d.target.x}`;
      })
      .attr('fill', 'none')
      .attr('stroke', '#888')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.7);
    
    // Create nodes (employees)
    const nodeGroup = g.append('g')
      .attr('class', 'nodes');
    
    const nodes = nodeGroup.selectAll('g')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .on('click', (event, d) => {
        event.stopPropagation();
        // @ts-ignore
        toggleNodeExpansion(d.data.id);
      })
      .on('mouseover', (event, d) => {
        setSelectedNode(d.data);
      })
      .on('mouseout', () => {
        setSelectedNode(null);
      });
    
    // Node rectangles
    nodes.append('rect')
      .attr('x', -120)
      .attr('y', -30)
      .attr('width', 240)
      .attr('height', 60)
      .attr('rx', 6)
      .attr('ry', 6)
      .attr('fill', d => {
        // @ts-ignore
        return departmentColors[d.data.department] || defaultColor;
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', 0.8);
    
    // Employee names
    nodes.append('text')
      .attr('dy', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ffffff')
      .text(d => {
        // @ts-ignore
        return d.data.name;
      });
    
    // Job titles
    nodes.append('text')
      .attr('dy', 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#ffffff')
      .text(d => {
        // @ts-ignore
        return d.data.role || '';
      });
    
    // Department labels
    nodes.append('text')
      .attr('dy', 28)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#ffffff')
      .text(d => {
        // @ts-ignore
        return d.data.department || '';
      });
    
    // Expansion indicator for nodes with children
    nodes.filter(d => d._children || d.children)
      .append('circle')
      .attr('cx', 100)
      .attr('cy', 0)
      .attr('r', 10)
      .attr('fill', '#fff')
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer');
    
    // Plus/minus symbols for expansion/collapse
    nodes.filter(d => d._children || d.children)
      .append('text')
      .attr('x', 100)
      .attr('y', 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('fill', '#666')
      .style('cursor', 'pointer')
      .text(d => d._children ? '+' : '-');
    
    // Direct reports count
    nodes.filter(d => d._children || d.children)
      .append('text')
      .attr('x', 125)
      .attr('y', 0)
      .attr('dy', 4)
      .attr('text-anchor', 'start')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .text(d => {
        const count = d._children ? d._children.length : (d.children ? d.children.length : 0);
        return count > 0 ? `${count} direct reports` : '';
      });
    
    // Add click handler on background to deselect
    svg.on('click', () => {
      setSelectedNode(null);
    });
  }, [employees, rootEmployeeId, dimensions, expandedNodes, departmentFilter, roleFilter, searchTerm, buildHierarchy, departmentColors]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <svg ref={svgRef} className="w-full h-full bg-gray-50" />
      
      {/* Controls */}
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
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-white/90 text-gray-700 p-2 rounded-lg shadow-md text-xs z-10">
        <p>Click + or - to expand/collapse nodes | Click and drag to pan | Scroll to zoom</p>
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/90 rounded-lg p-2 shadow-md z-10">
        <div className="text-xs text-gray-700">
          <div className="font-bold mb-1">Department Colors:</div>
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
      
      {/* Employee details tooltip */}
      {selectedNode && (
        <div
          className="absolute bg-white p-3 rounded-lg shadow-lg text-sm z-20 max-w-xs"
          style={{
            left: '50%',
            top: '10%',
            transform: 'translateX(-50%)'
          }}
        >
          <h3 className="font-bold text-lg">{selectedNode.name}</h3>
          <p><span className="font-semibold">Role:</span> {selectedNode.role || 'N/A'}</p>
          <p><span className="font-semibold">Department:</span> {selectedNode.department || 'N/A'}</p>
          <p><span className="font-semibold">Email:</span> {selectedNode.email || 'N/A'}</p>
          {selectedNode.startDate && (
            <p><span className="font-semibold">Started:</span> {new Date(selectedNode.startDate).toLocaleDateString()}</p>
          )}
          {selectedNode.workIntensity && (
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-1">Work Intensity</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-400 h-2 rounded-full" 
                  style={{ width: `${(selectedNode.workIntensity) * 10}%` }}
                ></div>
              </div>
            </div>
          )}
          <div className="mt-2 text-xs">
            <button 
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded"
              onClick={() => {
                window.open(`/employee/${selectedNode.id}`, '_blank');
              }}
            >
              View Full Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HorizontalTreeView; 