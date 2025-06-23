'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  workIntensity: number;
  collaborationIntensity: number;
  projects: string[];
  duties: string[];
  managerId?: string;
  collaborators: string[];
}

interface TreeNode extends d3.HierarchyNode<Employee> {
  x: number;
  y: number;
  data: Employee;
  children?: TreeNode[];
}

interface HorizontalTreeProps {
  employees: Employee[];
}

const departmentColors: { [key: string]: string } = {
  'Engineering': '#4285F4',  // Google Blue
  'Marketing': '#EA4335',    // Google Red
  'Sales': '#FBBC05',        // Google Yellow
  'HR': '#34A853',           // Google Green
  'Finance': '#8E44AD',      // Purple
  'Operations': '#F39C12',   // Orange
  'Product': '#16A085',      // Turquoise
  'Design': '#E74C3C',       // Red
  'Research': '#2980B9',     // Blue
};

const defaultColor = '#9ca3af';

const HorizontalTree: React.FC<HorizontalTreeProps> = ({ employees }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [root, setRoot] = useState<TreeNode | null>(null);

  // Create the hierarchy data structure
  useEffect(() => {
    if (!employees || employees.length === 0) return;

    // Apply filters
    let filteredEmployees = [...employees];
    
    if (departmentFilter) {
      filteredEmployees = filteredEmployees.filter(emp => emp.department === departmentFilter);
    }
    
    if (searchTerm) {
      filteredEmployees = filteredEmployees.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Create a map for quick access
    const empMap = new Map<string, Employee & { children: Employee[] }>();
    
    filteredEmployees.forEach(emp => {
      empMap.set(emp.id, { ...emp, children: [] });
    });

    // Find the root nodes (those without managers or with managers not in the filtered set)
    const rootNodes: (Employee & { children: Employee[] })[] = [];
    
    empMap.forEach(emp => {
      if (!emp.managerId || !empMap.has(emp.managerId)) {
        rootNodes.push(emp);
      } else {
        const manager = empMap.get(emp.managerId);
        if (manager) {
          manager.children.push(emp);
        }
      }
    });

    // Create a virtual root if there are multiple root nodes
    const virtualRoot: Employee & { children: Employee[] } = {
      id: 'virtual-root',
      name: 'Organization',
      role: 'Organization',
      department: '',
      workIntensity: 0,
      collaborationIntensity: 0,
      projects: [],
      duties: [],
      collaborators: [],
      children: rootNodes
    };

    // Create the hierarchy
    const hierarchyRoot = d3.hierarchy(virtualRoot, d => d.children) as TreeNode;
    setRoot(hierarchyRoot);
  }, [employees, departmentFilter, searchTerm]);

  // Render the tree visualization
  useEffect(() => {
    if (!containerRef.current || !svgRef.current || !root) return;

    // Clear the previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    // Set up SVG dimensions
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const margin = { top: 20, right: 120, bottom: 20, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG element
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Add a group for the tree
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create a tree layout
    const treeLayout = d3.tree<Employee>()
      .size([innerHeight, innerWidth]);

    // Apply the tree layout to the root node
    treeLayout(root);

    // Create links
    const links = g.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#555')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5)
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('d', d3.linkHorizontal<d3.HierarchyLink<Employee>, d3.HierarchyNode<Employee>>()
        .x(d => d.y)
        .y(d => d.x) as any);

    // Create nodes
    const node = g.append('g')
      .attr('stroke-linejoin', 'round')
      .attr('stroke-width', 3)
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        // Skip virtual root
        if (d.data.id === 'virtual-root') return;
        
        // Toggle expanded state for nodes with children
        if (d.children || d._children) {
          const isExpanded = expandedNodes.has(d.data.id);
          const newExpandedNodes = new Set(expandedNodes);
          
          if (isExpanded) {
            newExpandedNodes.delete(d.data.id);
          } else {
            newExpandedNodes.add(d.data.id);
          }
          
          setExpandedNodes(newExpandedNodes);
        } else {
          // Show details for leaf nodes
          setSelectedEmployee(d.data);
        }
      });
    
    // Skip the virtual root in visualization
    const visibleNodes = node.filter(d => d.data.id !== 'virtual-root');

    // Add circles to nodes
    visibleNodes.append('circle')
      .attr('fill', d => departmentColors[d.data.department] || defaultColor)
      .attr('r', d => {
        const intensity = d.data.workIntensity + d.data.collaborationIntensity;
        return 4 + Math.sqrt(intensity) * 1.5;
      })
      .attr('stroke', 'white')
      .attr('stroke-width', 1);

    // Add node labels
    visibleNodes.append('text')
      .attr('dy', '0.31em')
      .attr('x', d => d.children ? -8 : 8)
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .attr('fill', 'white')
      .text(d => d.data.name)
      .clone(true).lower()
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.7);

    // Add expand/collapse indicators for nodes with children
    visibleNodes.filter(d => (d.children || d._children) && d.data.id !== 'virtual-root')
      .append('text')
      .attr('dy', '0.31em')
      .attr('x', d => d.children ? -25 : 25)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'FontAwesome')
      .attr('font-size', '14px')
      .attr('fill', 'white')
      .text(d => expandedNodes.has(d.data.id) ? '−' : '+');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);
    
    // Clear selection when clicking on background
    svg.on('click', () => setSelectedEmployee(null));
    
    // Initial center and zoom
    const initialTransform = d3.zoomIdentity
      .translate(margin.left, height / 2)
      .scale(0.8);
    
    svg.call((zoom as any).transform, initialTransform);

  }, [root, expandedNodes]);

  // Get unique departments for filtering
  const uniqueDepartments = React.useMemo(() => {
    const departments = new Set<string>();
    employees.forEach(emp => departments.add(emp.department));
    return Array.from(departments).sort();
  }, [employees]);

  return (
    <div className="relative w-full h-full bg-gray-900" ref={containerRef}>
      <svg ref={svgRef} className="w-full h-full"></svg>
      
      {/* Department filters */}
      <div className="absolute top-4 left-4 bg-black/50 rounded-lg p-2">
        <div>
          <span className="text-xs text-white mr-2">Departments:</span>
          <button
            className={`px-3 py-1 text-xs rounded-md mr-2 ${
              departmentFilter === null ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            onClick={() => setDepartmentFilter(null)}
          >
            All
          </button>
          
          {uniqueDepartments.map(dept => (
            <button
              key={dept}
              className={`px-3 py-1 text-xs rounded-md mr-2 mb-1 ${
                departmentFilter === dept ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setDepartmentFilter(dept)}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>
      
      {/* Search */}
      <div className="absolute top-4 right-4 bg-black/50 rounded-lg p-2">
        <input
          type="text"
          placeholder="Search employees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-1 text-xs rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-400 w-full"
        />
      </div>
      
      {/* Selected employee details */}
      {selectedEmployee && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 bg-black/70 text-white p-4 rounded-lg shadow-lg max-w-xs">
          <h3 className="text-lg font-bold mb-2">{selectedEmployee.name}</h3>
          <p className="text-sm mb-1">Role: {selectedEmployee.role}</p>
          <p className="text-sm mb-1">Department: {selectedEmployee.department}</p>
          <div className="mb-2">
            <div className="text-xs text-gray-300 mb-1">Work Intensity</div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-400 h-2 rounded-full" 
                style={{ width: `${selectedEmployee.workIntensity * 10}%` }}
              ></div>
            </div>
          </div>
          <div className="mb-2">
            <div className="text-xs text-gray-300 mb-1">Collaboration</div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-purple-400 h-2 rounded-full" 
                style={{ width: `${selectedEmployee.collaborationIntensity * 10}%` }}
              ></div>
            </div>
          </div>
          <div className="text-xs">
            <p className="text-gray-300 mb-1">Projects: {selectedEmployee.projects.length}</p>
            <p className="text-gray-300">Duties: {selectedEmployee.duties.length}</p>
            <p className="text-gray-300 mt-1">Collaborators: {selectedEmployee.collaborators?.length || 0}</p>
          </div>
          <button 
            className="mt-3 text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded"
            onClick={() => window.open(`/employee/${selectedEmployee.id}`, '_blank')}
          >
            View Full Profile
          </button>
          <button 
            className="mt-2 text-xs bg-gray-600 hover:bg-gray-700 text-white py-1 px-3 rounded w-full"
            onClick={() => setSelectedEmployee(null)}
          >
            Close
          </button>
        </div>
      )}
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-2 rounded-lg text-xs">
        <p>Click + to expand branches | Click - to collapse | Click employee for details | Drag to pan | Scroll to zoom</p>
      </div>
    </div>
  );
};

export default HorizontalTree; 