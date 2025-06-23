'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Employee, Department, Project, Collaboration } from '@/types/organization';

interface NetworkViewProps {
  employees: Employee[];
  departments: Department[];
  projects?: Project[];
  collaborations?: Collaboration[];
}

const NetworkView: React.FC<NetworkViewProps> = ({ 
  employees, 
  departments, 
  projects = [], 
  collaborations = [] 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLinks, setShowLinks] = useState('all'); // 'all', 'hierarchy', 'collaboration'
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

  // Create the network visualization
  useEffect(() => {
    if (!svgRef.current || employees.length === 0 || dimensions.width === 0) return;

    // Filter employees based on search and filters
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

    // If we have very few employees after filtering, include their direct connections
    if (filteredEmployees.length < 5 && filteredEmployees.length > 0) {
      const employeeIds = new Set(filteredEmployees.map(emp => emp.id));
      
      // Add manager relationships
      employees.forEach(emp => {
        if (employeeIds.has(emp.id) && emp.managerId) {
          const manager = employees.find(e => e.id === emp.managerId);
          if (manager && !employeeIds.has(manager.id)) {
            filteredEmployees.push(manager);
            employeeIds.add(manager.id);
          }
        }
        
        if (employeeIds.has(emp.managerId || '') && !employeeIds.has(emp.id)) {
          filteredEmployees.push(emp);
          employeeIds.add(emp.id);
        }
      });
      
      // Add project collaborations
      collaborations.forEach(collab => {
        if (employeeIds.has(collab.employeeId1) && !employeeIds.has(collab.employeeId2)) {
          const emp2 = employees.find(e => e.id === collab.employeeId2);
          if (emp2) {
            filteredEmployees.push(emp2);
            employeeIds.add(emp2.id);
          }
        }
        
        if (employeeIds.has(collab.employeeId2) && !employeeIds.has(collab.employeeId1)) {
          const emp1 = employees.find(e => e.id === collab.employeeId1);
          if (emp1) {
            filteredEmployees.push(emp1);
            employeeIds.add(emp1.id);
          }
        }
      });
    }

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    // Create nodes (employees)
    const nodes = filteredEmployees.map(emp => ({
      id: emp.id,
      name: emp.name,
      role: emp.role,
      department: emp.department,
      managerId: emp.managerId,
      workIntensity: emp.workIntensity || 0,
      collaborationIntensity: emp.collaborationIntensity || 0,
      projects: emp.projects || [],
      duties: emp.duties || [],
    }));

    // Create links
    const links: Array<{source: string, target: string, type: string, strength: number}> = [];
    
    // Add hierarchy links (managers)
    if (showLinks === 'all' || showLinks === 'hierarchy') {
      filteredEmployees.forEach(emp => {
        if (emp.managerId) {
          const managerExists = filteredEmployees.some(e => e.id === emp.managerId);
          if (managerExists) {
            links.push({
              source: emp.managerId,
              target: emp.id,
              type: 'hierarchy',
              strength: 0.7
            });
          }
        }
      });
    }
    
    // Add collaboration links
    if (showLinks === 'all' || showLinks === 'collaboration') {
      collaborations.forEach(collab => {
        const emp1Exists = filteredEmployees.some(e => e.id === collab.employeeId1);
        const emp2Exists = filteredEmployees.some(e => e.id === collab.employeeId2);
        
        if (emp1Exists && emp2Exists) {
          links.push({
            source: collab.employeeId1,
            target: collab.employeeId2,
            type: 'collaboration',
            strength: collab.strength || 0.5
          });
        }
      });
    }

    // Create SVG and its elements
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
    
    // Create a simulation with forces
    const simulation = d3.forceSimulation<d3.SimulationNodeDatum & {id: string}>()
      .nodes(nodes.map(n => ({...n})))
      .force('link', d3.forceLink<d3.SimulationNodeDatum & {id: string}, d3.SimulationLinkDatum<d3.SimulationNodeDatum>>()
        .id((d: any) => d.id)
        .links(links.map(l => ({...l})))
        .distance(link => {
          if ((link as any).type === 'hierarchy') return 80;
          return 120 * (1 - ((link as any).strength || 0.5)); // Stronger collaborations are closer
        })
      )
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Create links as lines with different styles based on type
    const linkElements = rootGroup.selectAll('.link')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', d => d.type === 'hierarchy' ? '#666' : '#888')
      .attr('stroke-width', d => d.type === 'hierarchy' ? 2 : 1 + (d.strength * 2))
      .attr('stroke-opacity', d => d.type === 'hierarchy' ? 0.6 : 0.4)
      .attr('stroke-dasharray', d => d.type === 'hierarchy' ? '0' : '3,3');
    
    // Create node groups
    const nodeGroups = rootGroup.selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag<SVGGElement, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
      });
    
    // Create circles for the nodes
    nodeGroups.append('circle')
      .attr('r', d => 10 + (d.workIntensity * 0.3) + (d.collaborationIntensity * 0.5))
      .attr('fill', d => departmentColors[d.department || ''] || defaultColor)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);
    
    // Add name labels
    nodeGroups.append('text')
      .attr('dy', -15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#333')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .text(d => d.name);
    
    // Add role labels
    nodeGroups.append('text')
      .attr('dy', -2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#666')
      .style('font-size', '8px')
      .text(d => d.role || '');
    
    // Update positions on simulation tick
    simulation.on('tick', () => {
      linkElements
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);
        
      nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // Initial zoom to fit content
    const initialTransform = d3.zoomIdentity
      .translate(dimensions.width / 2, dimensions.height / 2)
      .scale(0.8);
    
    svg.call(zoom.transform, initialTransform);
    
    // Click on background to deselect node
    svg.on('click', () => {
      setSelectedNode(null);
    });
    
    // Drag functions
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    return () => {
      simulation.stop();
    };
  }, [employees, departments, projects, collaborations, dimensions, departmentFilter, roleFilter, searchTerm, showLinks, departmentColors]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full bg-gray-50"></svg>
      
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
      
      {/* Link type filter */}
      <div className="absolute top-16 right-4 bg-white/90 rounded-lg p-2 shadow-md z-10">
        <span className="text-xs text-gray-700 mr-2">Show connections:</span>
        <button
          className={`px-3 py-1 text-xs rounded-md mr-2 ${
            showLinks === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setShowLinks('all')}
        >
          All
        </button>
        <button
          className={`px-3 py-1 text-xs rounded-md mr-2 ${
            showLinks === 'hierarchy' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setShowLinks('hierarchy')}
        >
          Reporting Lines
        </button>
        <button
          className={`px-3 py-1 text-xs rounded-md mr-2 ${
            showLinks === 'collaboration' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setShowLinks('collaboration')}
        >
          Collaborations
        </button>
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
          <div className="mt-2">
            <div className="flex items-center mb-1">
              <div className="w-10 h-0.5 mr-1 bg-gray-600"></div>
              <span>Reporting line</span>
            </div>
            <div className="flex items-center">
              <div className="w-10 h-0.5 mr-1 bg-gray-500 border-dashed border-t border-gray-500"></div>
              <span>Collaboration</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Selected node details */}
      {selectedNode && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 bg-white text-gray-800 p-4 rounded-lg shadow-lg max-w-xs z-20">
          <h3 className="text-lg font-bold mb-2">{selectedNode.name}</h3>
          <p className="text-sm mb-1">Role: {selectedNode.role}</p>
          <p className="text-sm mb-1">Department: {selectedNode.department}</p>
          
          <div className="mb-2">
            <div className="text-xs text-gray-500 mb-1">Work Intensity</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-400 h-2 rounded-full" 
                style={{ width: `${(selectedNode.workIntensity || 0) * 10}%` }}
              ></div>
            </div>
          </div>
          
          <div className="mb-2">
            <div className="text-xs text-gray-500 mb-1">Collaboration</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-400 h-2 rounded-full" 
                style={{ width: `${(selectedNode.collaborationIntensity || 0) * 10}%` }}
              ></div>
            </div>
          </div>
          
          <div className="text-xs text-gray-500">
            <p>Projects: {selectedNode.projects?.length || 0}</p>
            <p>Duties: {selectedNode.duties?.length || 0}</p>
          </div>
          
          <button 
            className="mt-3 text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/employee/${selectedNode.id}`, '_blank');
            }}
          >
            View Full Profile
          </button>
          
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
        <p>Drag nodes to reposition | Drag canvas to pan | Scroll to zoom | Click node for details</p>
      </div>
    </div>
  );
};

export default NetworkView; 