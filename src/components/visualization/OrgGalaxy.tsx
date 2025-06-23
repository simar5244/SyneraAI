'use client';

import React, { useEffect, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import { Employee, Department } from '@/types/organization';

interface OrgGalaxyProps {
  employees: Employee[];
  departments: Department[];
}

interface GraphNode {
  id: string;
  name: string;
  role?: string;
  department?: string;
  workIntensity?: number;
  collaborationIntensity?: number;
  val: number;
  color: string;
  type: 'employee' | 'department';
}

interface GraphLink {
  source: string;
  target: string;
  type: 'hierarchy' | 'collaboration';
  color: string;
  width: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Department colors for grouping
const departmentColors: {[key: string]: string} = {
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

// Default color for departments without a specific color
const defaultColor = '#9ca3af';

const OrgGalaxy: React.FC<OrgGalaxyProps> = ({ employees, departments }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHierarchyLinks, setShowHierarchyLinks] = useState(true);
  const [showCollaborationLinks, setShowCollaborationLinks] = useState(true);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedLinks, setHighlightedLinks] = useState<Set<string>>(new Set());
  const fgRef = useRef<any>(null);

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

  // Prepare data for the 3D graph
  useEffect(() => {
    if (!employees || employees.length === 0) return;

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
        emp.role?.toLowerCase().includes(lowerSearchTerm) ||
        emp.department?.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // Create nodes
    const nodes: GraphNode[] = [];
    
    // Add department nodes
    if (!departmentFilter) {
      departments.forEach(dept => {
        const deptExists = filteredEmployees.some(emp => emp.department === dept.name);
        if (deptExists) {
          nodes.push({
            id: `dept-${dept.id}`,
            name: dept.name,
            val: 10, // Larger size for departments
            color: departmentColors[dept.name] || defaultColor,
            type: 'department',
          });
        }
      });
    }
    
    // Add employee nodes
    filteredEmployees.forEach(emp => {
      const deptColor = departmentColors[emp.department || ''] || defaultColor;
      
      // Node size based on work intensity and collaboration
      const baseSize = 5;
      const intensityFactor = ((emp.workIntensity || 0) + (emp.collaborationIntensity || 0)) / 2;
      const nodeSize = baseSize + intensityFactor;
      
      nodes.push({
        id: emp.id,
        name: emp.name,
        role: emp.role,
        department: emp.department,
        workIntensity: emp.workIntensity,
        collaborationIntensity: emp.collaborationIntensity,
        val: nodeSize,
        color: deptColor,
        type: 'employee',
      });
    });

    // Create links
    const links: GraphLink[] = [];
    
    // Add department hierarchy links
    if (!departmentFilter && showHierarchyLinks) {
      departments.forEach(dept => {
        if (dept.parentDepartmentId) {
          const deptExists = nodes.some(n => n.id === `dept-${dept.id}`);
          const parentExists = nodes.some(n => n.id === `dept-${dept.parentDepartmentId}`);
          
          if (deptExists && parentExists) {
            links.push({
              source: `dept-${dept.parentDepartmentId}`,
              target: `dept-${dept.id}`,
              type: 'hierarchy',
              color: 'rgba(255, 255, 255, 0.6)',
              width: 2
            });
          }
        }
      });
    }
    
    // Add employee to department links
    if (!departmentFilter && showHierarchyLinks) {
      filteredEmployees.forEach(emp => {
        if (emp.department) {
          const deptNodeId = `dept-${departments.find(d => d.name === emp.department)?.id}`;
          const deptExists = nodes.some(n => n.id === deptNodeId);
          
          if (deptExists) {
            links.push({
              source: deptNodeId,
              target: emp.id,
              type: 'hierarchy',
              color: 'rgba(255, 255, 255, 0.3)',
              width: 1
            });
          }
        }
      });
    }
    
    // Add manager-employee links
    if (showHierarchyLinks) {
      filteredEmployees.forEach(emp => {
        if (emp.managerId) {
          const managerExists = filteredEmployees.some(m => m.id === emp.managerId);
          
          if (managerExists) {
            links.push({
              source: emp.managerId,
              target: emp.id,
              type: 'hierarchy',
              color: 'rgba(255, 255, 255, 0.8)',
              width: 1.5
            });
          }
        }
      });
    }
    
    // Add collaboration links
    if (showCollaborationLinks) {
      // To avoid duplicate links
      const processedPairs = new Set<string>();
      
      filteredEmployees.forEach(emp => {
        if (emp.collaborators && emp.collaborators.length > 0) {
          emp.collaborators.forEach(collabId => {
            const collaboratorExists = filteredEmployees.some(c => c.id === collabId);
            
            if (collaboratorExists) {
              // Create a unique key for this pair
              const pairKey = [emp.id, collabId].sort().join('-');
              
              // Only add if we haven't processed this pair yet
              if (!processedPairs.has(pairKey)) {
                processedPairs.add(pairKey);
                
                // Find the collaboration intensity
                const intensity = (((emp.collaborationIntensity || 0) + 
                  (filteredEmployees.find(c => c.id === collabId)?.collaborationIntensity || 0)) / 20) + 0.1;
                
                links.push({
                  source: emp.id,
                  target: collabId,
                  type: 'collaboration',
                  color: `rgba(99, 102, 241, ${intensity})`, // Indigo with opacity based on intensity
                  width: 1
                });
              }
            }
          });
        }
      });
    }

    setGraphData({ nodes, links });
  }, [employees, departments, departmentFilter, roleFilter, searchTerm, showHierarchyLinks, showCollaborationLinks]);

  // Calculate container dimensions
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
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
  
  // Handle node click
  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    if (node) {
      // Set focus on the clicked node
      if (fgRef.current) {
        const distance = 100;
        const distRatio = 1 + distance/Math.hypot(node.x || 0, node.y || 0, node.z || 0);
        fgRef.current.cameraPosition(
          { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
          node as any,
          1000
        );
      }
    }
  };
  
  // Clear selection when clicking the background
  const handleBackgroundClick = () => {
    setSelectedNode(null);
    setHighlightedNodes(new Set());
    setHighlightedLinks(new Set());
  };
  
  // Handle node hover
  const handleNodeHover = (node: GraphNode | null) => {
    if (!node) {
      setHighlightedNodes(new Set());
      setHighlightedLinks(new Set());
      return;
    }
    
    // Get all connected nodes
    const connectedNodes = new Set<string>([node.id]);
    const connectedLinks = new Set<string>();
    
    graphData.links.forEach(link => {
      if (link.source === node.id || (typeof link.source === 'object' && link.source.id === node.id)) {
        connectedNodes.add(typeof link.target === 'object' ? link.target.id : link.target);
        connectedLinks.add(`${link.source}-${link.target}`);
      }
      if (link.target === node.id || (typeof link.target === 'object' && link.target.id === node.id)) {
        connectedNodes.add(typeof link.source === 'object' ? link.source.id : link.source);
        connectedLinks.add(`${link.source}-${link.target}`);
      }
    });
    
    setHighlightedNodes(connectedNodes);
    setHighlightedLinks(connectedLinks);
  };
  
  // Zoom to fit function
  const zoomToFit = (duration: number = 1000) => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(duration);
    }
  };
  
  // Zoom to fit on initial load and when filters change
  useEffect(() => {
    if (graphData.nodes.length > 0 && fgRef.current) {
      zoomToFit();
    }
  }, [graphData]);

  return (
    <div className="relative w-full h-full bg-gray-900" ref={containerRef}>
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph3D
          ref={fgRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#111827"
          nodeLabel={node => {
            const n = node as GraphNode;
            return n.type === 'employee' 
              ? `${n.name} (${n.role})\n${n.department}\nWork: ${n.workIntensity}/10\nCollab: ${n.collaborationIntensity}/10` 
              : `Department: ${n.name}`;
          }}
          nodeColor={node => {
            const n = node as GraphNode;
            const isHighlighted = !highlightedNodes.size || highlightedNodes.has(n.id);
            return isHighlighted ? n.color : `rgba(100, 100, 100, 0.3)`;
          }}
          nodeOpacity={0.9}
          linkOpacity={link => {
            if (!highlightedLinks.size) return 0.5;
            const l = link as GraphLink;
            const linkId = `${l.source}-${l.target}`;
            return highlightedLinks.has(linkId) ? 0.8 : 0.1;
          }}
          nodeVal={node => (node as GraphNode).val}
          nodeResolution={8} // Higher polygon count for smoother spheres
          linkColor={link => (link as GraphLink).color}
          linkWidth={link => (link as GraphLink).width}
          linkDirectionalParticles={link => (link as GraphLink).type === 'collaboration' ? 2 : 0}
          linkDirectionalParticleSpeed={0.004}
          onNodeClick={node => handleNodeClick(node as GraphNode)}
          onBackgroundClick={handleBackgroundClick}
          onNodeHover={node => handleNodeHover(node as GraphNode)}
          nodeThreeObject={node => {
            const n = node as GraphNode;
            if (n.type === 'department') {
              // Create text sprite for departments
              const sprite = new SpriteText(n.name);
              sprite.color = 'white';
              sprite.textHeight = 4;
              sprite.backgroundColor = n.color;
              sprite.padding = 2;
              sprite.borderRadius = 2;
              return sprite;
            }
            return null; // Use default sphere for employees
          }}
          nodeThreeObjectExtend={node => (node as GraphNode).type === 'department'}
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      )}
      
      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 space-y-2">
        {/* Department filters */}
        <div className="bg-black/50 rounded-lg p-2">
          <div>
            <span className="text-xs text-white mr-2">Department:</span>
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
                style={{ borderLeft: `3px solid ${departmentColors[dept] || defaultColor}` }}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
        
        {/* Role filters */}
        <div className="bg-black/50 rounded-lg p-2">
          <div>
            <span className="text-xs text-white mr-2">Role:</span>
            <button
              className={`px-3 py-1 text-xs rounded-md mr-2 ${
                roleFilter === null ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setRoleFilter(null)}
            >
              All
            </button>
            
            {uniqueRoles.map(role => (
              <button
                key={role}
                className={`px-3 py-1 text-xs rounded-md mr-2 mb-1 ${
                  roleFilter === role ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => setRoleFilter(role)}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
        
        {/* Relationship visibility toggles */}
        <div className="bg-black/50 rounded-lg p-2">
          <div className="flex flex-col space-y-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showHierarchyLinks}
                onChange={() => setShowHierarchyLinks(!showHierarchyLinks)}
                className="form-checkbox h-3 w-3 text-blue-600 rounded"
              />
              <span className="ml-2 text-xs text-white">Hierarchy Links</span>
            </label>
            
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showCollaborationLinks}
                onChange={() => setShowCollaborationLinks(!showCollaborationLinks)}
                className="form-checkbox h-3 w-3 text-blue-600 rounded"
              />
              <span className="ml-2 text-xs text-white">Collaboration Links</span>
            </label>
          </div>
        </div>
      </div>
      
      {/* Search */}
      <div className="absolute top-4 right-4 bg-black/50 rounded-lg p-2 z-10">
        <input
          type="text"
          placeholder="Search employees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-1 text-xs rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-400 w-full"
        />
      </div>
      
      {/* Camera controls */}
      <div className="absolute bottom-4 right-4 bg-black/50 rounded-lg p-2 z-10">
        <div className="flex space-x-2">
          <button
            className="px-3 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
            onClick={() => zoomToFit()}
          >
            Reset View
          </button>
        </div>
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black/50 rounded-lg p-2 z-10">
        <div className="text-xs text-white">
          <div className="flex items-center mb-1">
            <div className="w-3 h-3 mr-2 rounded-full bg-white opacity-80"></div>
            <span>Hierarchy Relationship</span>
          </div>
          <div className="flex items-center mb-1">
            <div className="w-3 h-3 mr-2 rounded-full bg-indigo-500"></div>
            <span>Collaboration</span>
          </div>
          <div className="flex items-center mb-1">
            <span>Node Size ∝ Work+Collaboration</span>
          </div>
          <div className="flex items-center">
            <span>Node Brightness ∝ Activity</span>
          </div>
        </div>
      </div>
      
      {/* Selected node details */}
      {selectedNode && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 bg-black/70 text-white p-4 rounded-lg shadow-lg max-w-xs z-20">
          {selectedNode.type === 'department' ? (
            <>
              <h3 className="text-lg font-bold mb-2">{selectedNode.name} Department</h3>
              <p className="text-sm">Department information...</p>
              <button 
                className="mt-3 text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded"
                onClick={() => window.open(`/department/${selectedNode.id.replace('dept-', '')}`, '_blank')}
              >
                View Department Details
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold mb-2">{selectedNode.name}</h3>
              <p className="text-sm mb-1">Role: {selectedNode.role}</p>
              <p className="text-sm mb-1">Department: {selectedNode.department}</p>
              <div className="mb-2">
                <div className="text-xs text-gray-300 mb-1">Work Intensity</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-400 h-2 rounded-full" 
                    style={{ width: `${(selectedNode.workIntensity || 0) * 10}%` }}
                  ></div>
                </div>
              </div>
              <div className="mb-2">
                <div className="text-xs text-gray-300 mb-1">Collaboration</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-purple-400 h-2 rounded-full" 
                    style={{ width: `${(selectedNode.collaborationIntensity || 0) * 10}%` }}
                  ></div>
                </div>
              </div>
              <button 
                className="mt-3 text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded"
                onClick={() => window.open(`/employee/${selectedNode.id}`, '_blank')}
              >
                View Full Profile
              </button>
            </>
          )}
          <button 
            className="mt-2 text-xs bg-gray-600 hover:bg-gray-700 text-white py-1 px-3 rounded w-full"
            onClick={() => setSelectedNode(null)}
          >
            Close
          </button>
        </div>
      )}
      
      {/* Instructions */}
      <div className="absolute bottom-16 left-4 bg-black/50 text-white p-2 rounded-lg text-xs z-10">
        <p>Left-click + drag to rotate | Right-click + drag to pan | Scroll to zoom</p>
        <p>Click node for details | Hover to highlight connections</p>
      </div>
    </div>
  );
};

export default OrgGalaxy; 