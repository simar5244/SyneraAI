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

interface HierarchyTreeProps {
  employees: Employee[];
  allEmployees: Employee[];
}

interface TreeNode {
  id: string;
  name: string;
  role: string;
  department: string;
  children?: TreeNode[];
  data?: Employee;
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
  'Executive': '#1F618D',    // Dark Blue
};

const defaultColor = '#9ca3af';

const HierarchyTree: React.FC<HierarchyTreeProps> = ({ employees, allEmployees }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [hoveredEmployee, setHoveredEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current || employees.length === 0) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    // Set up dimensions
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const margin = { top: 50, right: 120, bottom: 50, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Build hierarchy structure
    const buildHierarchy = (employees: Employee[]): TreeNode => {
      // Map to store each employee node
      const employeeMap = new Map<string, TreeNode>();
      
      // Create all nodes first
      employees.forEach(emp => {
        employeeMap.set(emp.id, {
          id: emp.id,
          name: emp.name,
          role: emp.role,
          department: emp.department,
          children: [],
          data: emp
        });
      });
      
      // Create a virtual root for the organization
      const root: TreeNode = {
        id: 'root',
        name: 'Organization',
        role: 'Organization',
        department: '',
        children: []
      };
      
      // Now connect nodes based on manager relationships
      employees.forEach(emp => {
        const node = employeeMap.get(emp.id);
        if (node) {
          if (emp.managerId && employeeMap.has(emp.managerId)) {
            // Add this node as a child of its manager
            const managerNode = employeeMap.get(emp.managerId);
            if (managerNode && managerNode.children) {
              managerNode.children.push(node);
            }
          } else {
            // If no manager or manager not in the filtered set, add to root
            root.children!.push(node);
          }
        }
      });
      
      return root;
    };
    
    // Build hierarchy structure from employee data
    const hierarchyRoot = buildHierarchy(employees);
    
    // Create d3 hierarchy layout
    const root = d3.hierarchy(hierarchyRoot);
    
    // Create tree layout
    const treeLayout = d3.tree<TreeNode>()
      .size([innerHeight, innerWidth])
      .nodeSize([50, 180]);
    
    // Apply layout
    const treeData = treeLayout(root);
    
    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
    
    // Create container group with zoom and pan
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom as any);
    
    // Initial zoom to fit the tree
    const descendants = treeData.descendants();
    if (descendants.length > 0) {
      const initialScale = 0.8;
      const initialX = margin.left + width / 2;
      const initialY = margin.top + 50;
      
      svg.call(
        zoom.transform as any,
        d3.zoomIdentity.translate(initialX, initialY).scale(initialScale)
      );
    }
    
    // Create links
    const links = g.append('g')
      .selectAll('path')
      .data(treeData.links())
      .join('path')
      .attr('d', d3.linkHorizontal<any, any>()
        .x(d => d.y)
        .y(d => d.x)
      )
      .attr('fill', 'none')
      .attr('stroke', '#888')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.8);
    
    // Create nodes
    const nodes = g.append('g')
      .selectAll('g')
      .data(treeData.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.data && d.data.data) {
          setSelectedEmployee(d.data.data);
        }
      })
      .on('mouseover', (event, d) => {
        if (d.data && d.data.data) {
          setHoveredEmployee(d.data.data);
        }
      })
      .on('mouseout', () => {
        setHoveredEmployee(null);
      });
    
    // Add node circles
    nodes.append('circle')
      .attr('r', d => d.depth === 0 ? 15 : 10)
      .attr('fill', d => {
        if (d.depth === 0) return '#333';
        return d.data.department ? departmentColors[d.data.department] || defaultColor : defaultColor;
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);
    
    // Add node labels
    nodes.append('text')
      .attr('dy', d => d.children ? -15 : 4)
      .attr('x', d => d.children ? 0 : 15)
      .attr('text-anchor', d => d.children ? 'middle' : 'start')
      .attr('fill', 'white')
      .attr('font-size', d => d.depth === 0 ? '12px' : '10px')
      .attr('text-shadow', '0 1px 3px rgba(0,0,0,0.9)')
      .attr('pointer-events', 'none')
      .text(d => d.data.name);
    
    // Add role labels for non-root nodes
    nodes.filter(d => d.depth !== 0)
      .append('text')
      .attr('dy', 15)
      .attr('x', 15)
      .attr('text-anchor', 'start')
      .attr('fill', 'rgba(255,255,255,0.7)')
      .attr('font-size', '8px')
      .attr('pointer-events', 'none')
      .text(d => d.data.role || 'No Role');
    
    // Handle click outside to clear selection
    svg.on('click', () => {
      setSelectedEmployee(null);
    });
    
    return () => {
      // Cleanup
    };
  }, [employees]);

  return (
    <div className="relative w-full h-full bg-gray-900" ref={containerRef}>
      <svg ref={svgRef} className="w-full h-full"></svg>
      
      {/* Department legend */}
      <div className="absolute top-4 right-4 bg-black/50 rounded-lg p-2 z-10">
        <div className="text-xs text-white">
          <div className="text-sm font-semibold mb-2">Departments</div>
          {Object.entries(departmentColors).map(([dept, color]) => (
            <div key={dept} className="flex items-center mb-1">
              <div className="w-3 h-3 rounded-full mr-2" style={{ background: color }}></div>
              <span>{dept}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Hovered employee tooltip */}
      {hoveredEmployee && !selectedEmployee && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 bg-black/70 text-white p-3 rounded-lg shadow-lg z-20 pointer-events-none">
          <div className="text-md font-semibold">{hoveredEmployee.name}</div>
          <div className="text-xs">{hoveredEmployee.role} | {hoveredEmployee.department}</div>
        </div>
      )}
      
      {/* Selected employee details */}
      {selectedEmployee && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 bg-black/70 text-white p-4 rounded-lg shadow-lg max-w-xs z-10">
          <h3 className="text-lg font-bold mb-2">{selectedEmployee.name}</h3>
          <p className="text-sm mb-1">Role: {selectedEmployee.role}</p>
          <p className="text-sm mb-1">Department: {selectedEmployee.department}</p>
          <div className="mb-2">
            <div className="text-xs text-gray-300 mb-1">Work Intensity</div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-400 h-2 rounded-full" 
                style={{ width: `${selectedEmployee.workIntensity}%` }}
              ></div>
            </div>
          </div>
          <div className="mb-2">
            <div className="text-xs text-gray-300 mb-1">Collaboration</div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-purple-400 h-2 rounded-full" 
                style={{ width: `${selectedEmployee.collaborationIntensity}%` }}
              ></div>
            </div>
          </div>
          <div className="text-xs">
            <p className="text-gray-300 mb-1">Projects: {selectedEmployee.projects.join(', ')}</p>
            <p className="text-gray-300">Duties: {selectedEmployee.duties.join(', ')}</p>
            <p className="text-gray-300 mt-1">
              Collaborators: {selectedEmployee.collaborators.length}
            </p>
          </div>
          <button 
            className="mt-2 text-xs bg-gray-600 hover:bg-gray-700 text-white py-1 px-3 rounded w-full"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedEmployee(null);
            }}
          >
            Close
          </button>
        </div>
      )}
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-2 rounded-lg text-xs">
        <p>Click node to view details | Drag canvas to pan | Scroll to zoom</p>
      </div>
    </div>
  );
};

export default HierarchyTree; 