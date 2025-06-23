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

interface NetworkChartProps {
  employees: Employee[];
  allEmployees: Employee[];
}

interface ForceNode {
  id: string;
  name: string;
  role: string;
  department: string;
  strength: number;
  group: string;
}

interface ForceLink {
  source: string;
  target: string;
  value: number;
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

const NetworkChart: React.FC<NetworkChartProps> = ({ employees, allEmployees }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!containerRef.current || !svgRef.current || employees.length === 0) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    // Set up dimensions
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create container group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare data for force layout
    const nodes: ForceNode[] = employees.map(emp => ({
      id: emp.id,
      name: emp.name,
      role: emp.role,
      department: emp.department,
      strength: emp.workIntensity + emp.collaborationIntensity,
      group: emp.department
    }));

    // Create a map of employee IDs to positions in the nodes array
    const nodeMap = new Map(nodes.map((node, i) => [node.id, i]));

    // Prepare links based on collaborator relationships
    const links: ForceLink[] = [];
    employees.forEach(emp => {
      // Only create links where both source and target are in the filtered employees
      emp.collaborators.forEach(collaboratorId => {
        if (nodeMap.has(collaboratorId) && emp.id < collaboratorId) {
          links.push({
            source: emp.id,
            target: collaboratorId,
            value: 1
          });
        }
      });
    });

    // Create force simulation
    const simulation = d3.forceSimulation<any, any>(nodes)
      .force('link', d3.forceLink<any, any>(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collision', d3.forceCollide().radius(d => Math.sqrt(d.strength) * 2 + 10));

    // Create links
    const link = g.append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.value));

    // Create node groups
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(drag(simulation) as any)
      .on('click', (event, d) => {
        event.stopPropagation();
        const employee = employees.find(emp => emp.id === d.id);
        if (employee) {
          setSelectedEmployee(employee);
          
          // Highlight connected nodes
          const newHighlighted = new Set<string>([d.id]);
          
          // Add collaborators
          employee.collaborators.forEach(id => newHighlighted.add(id));
          
          setHighlightedNodes(newHighlighted);
        }
      });

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => 5 + Math.sqrt(d.strength) * 0.5)
      .attr('fill', d => departmentColors[d.department] || defaultColor)
      .attr('stroke', 'white')
      .attr('stroke-width', 1.5);

    // Add labels to nodes
    node.append('text')
      .attr('dx', 12)
      .attr('dy', '.35em')
      .text(d => d.name)
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .attr('text-shadow', '0 1px 3px rgba(0,0,0,0.9)')
      .attr('pointer-events', 'none');

    // Add title tooltips
    node.append('title')
      .text(d => `${d.name}\n${d.role}\n${d.department}`);

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', event => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // Update function for simulation
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Update visual state based on highlighted nodes
    const updateHighlighting = () => {
      if (highlightedNodes.size > 0) {
        node.attr('opacity', d => highlightedNodes.has(d.id) ? 1 : 0.2);
        link.attr('opacity', d => 
          highlightedNodes.has(d.source.id) && highlightedNodes.has(d.target.id) ? 1 : 0.1
        );
      } else {
        node.attr('opacity', 1);
        link.attr('opacity', 0.6);
      }
    };

    updateHighlighting();

    // Clear selection when clicking on background
    svg.on('click', () => {
      setSelectedEmployee(null);
      setHighlightedNodes(new Set());
      node.attr('opacity', 1);
      link.attr('opacity', 0.6);
    });

    // Drag functions
    function drag(simulation: d3.Simulation<any, any>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      
      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [employees, highlightedNodes]);

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
              setHighlightedNodes(new Set());
            }}
          >
            Close
          </button>
        </div>
      )}
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-2 rounded-lg text-xs">
        <p>Click and drag nodes to move | Click node to highlight connections | Drag canvas to pan | Scroll to zoom</p>
      </div>
    </div>
  );
};

export default NetworkChart; 