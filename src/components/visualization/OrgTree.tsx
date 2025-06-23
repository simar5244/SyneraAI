'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Employee } from '@/types/organization';
import { getEmployees, getDepartments, buildEmployeeHierarchy } from '@/lib/dataProvider';

interface TreeEmployee extends Employee {
  children?: TreeEmployee[];
}

interface OrgTreeProps {
  data?: {
    employees: Employee[];
    connections: { source: string; target: string }[];
  };
  onEmployeeSelect?: (employee: Employee | null) => void;
}

// Department colors
const departmentColors: Record<string, string> = {
  'Executive': '#FF5733',
  'Engineering': '#33A8FF',
  'Marketing': '#6DFF33',
  'Sales': '#F333FF',
  'HR': '#FF33A8',
  'Finance': '#33FFC4',
  'Operations': '#FEFF33',
  'Product': '#B533FF',
  'Customer Support': '#FF33DD',
  'Research': '#33FFBD',
  'default': '#FFFFFF'
};

interface TreeNode {
  id: string;
  name: string;
  title?: string;
  children?: TreeNode[];
  data?: any;
  _children?: TreeNode[]; // Collapsed nodes
}

const buildHierarchy = (
  employees: Employee[],
  connections: { source: string; target: string }[]
): TreeEmployee[] => {
  // Create a map of employees by ID for quick lookup
  const employeeMap = new Map<string, TreeEmployee>();
  
  // Convert flat employee list to map
  employees.forEach(employee => {
    employeeMap.set(employee.id, { ...employee, children: [] });
  });
  
  // Use connections to build parent-child relationships
  connections.forEach(({ source, target }) => {
    const parent = employeeMap.get(source);
    const child = employeeMap.get(target);
    
    if (parent && child) {
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(child);
    }
  });
  
  // Find root nodes (employees without managers)
  const rootNodes: TreeEmployee[] = [];
  employeeMap.forEach(employee => {
    const isChildNode = connections.some(conn => conn.target === employee.id);
    if (!isChildNode) {
      rootNodes.push(employee);
    }
  });
  
  return rootNodes;
};

const OrgTree: React.FC<OrgTreeProps> = ({ data, onEmployeeSelect }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; employee: Employee | null }>({
    visible: false,
    x: 0,
    y: 0,
    employee: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });
  
  // Load organization data
  useEffect(() => {
    const loadOrgData = async () => {
      try {
        setLoading(true);
        
        // In a real application, this would come from an API
        // For demo purposes, we'll load the data from a service
        const orgData = await fetchOrganizationStructure();
        
        if (!orgData || !orgData.employees) {
          throw new Error('Invalid organization data');
        }
        
        // Build the tree from flat employee data
        const hierarchy = buildHierarchy(orgData.employees, orgData.connections);
        
        // Map the first root node as the tree data (assuming a single root, like CEO)
        if (hierarchy.length > 0) {
          setTreeData(transformEmployeeNode(hierarchy[0]));
        }
      } catch (error) {
        console.error('Error loading organization data:', error);
        setError('Failed to load organization data');
      } finally {
        setLoading(false);
      }
    };

    loadOrgData();
  }, [transformEmployeeNode]);

  // Transform employee data to tree node format
  const transformEmployeeNode = useCallback((employee: any): TreeNode => {
    return {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      title: employee.position,
      data: employee,
      children: employee.children ? employee.children.map(transformEmployeeNode) : undefined
    };
  }, []);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: Math.max(containerRef.current.clientHeight, 800)
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Render the organization tree
  useEffect(() => {
    if (!treeData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 50, right: 120, bottom: 50, left: 120 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // Create a tree layout
    const treeLayout = d3.tree<TreeNode>().size([height, width]);

    // Create a hierarchy from the root data
    const root = d3.hierarchy(treeData);
    
    // Assign x, y positions through the tree layout
    const treeData2 = treeLayout(root);
    
    // Create a group for the tree
    const g = svg
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add links between nodes
    g.selectAll(".link")
      .data(treeData2.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d3.linkHorizontal<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
        .x(d => d.y)
        .y(d => d.x)
      )
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1.5);

    // Create nodes
    const node = g
      .selectAll(".node")
      .data(treeData2.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .on("click", (event, d) => {
        // Handle node click - show employee details
        if (d.data.data) {
          setSelectedEmployee(d.data.data.id);
        }
      });

    // Add circles to nodes
    node
      .append("circle")
      .attr("r", 5)
      .attr("fill", d => d.data.children || d.data._children ? "#3b82f6" : "#10b981")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Add labels to nodes
    node
      .append("text")
      .attr("dy", ".35em")
      .attr("x", d => d.children ? -10 : 10)
      .attr("text-anchor", d => d.children ? "end" : "start")
      .text(d => d.data.name)
      .attr("fill", "#374151")
      .attr("font-size", "12px");

    // Add titles (positions) below names
    node
      .append("text")
      .attr("dy", "1.5em")
      .attr("x", d => d.children ? -10 : 10)
      .attr("text-anchor", d => d.children ? "end" : "start")
      .text(d => d.data.title || "")
      .attr("fill", "#6b7280")
      .attr("font-size", "10px");

  }, [treeData, dimensions, transformEmployeeNode]);

  // Find the selected employee details from the original data
  const selectedEmployeeDetails = React.useMemo(() => {
    if (!selectedEmployee || !treeData) return null;
    
    // Function to find node by ID in the hierarchy
    const findNodeById = (node: TreeNode | d3.HierarchyNode<TreeNode>, id: string): TreeNode | null => {
      if (!node) return null; // Add null check for safety
      
      const currentNodeData = (node as d3.HierarchyNode<TreeNode>).data || node as TreeNode;
      if (currentNodeData.id === id) return currentNodeData;

      const children = (node as d3.HierarchyNode<TreeNode>).children || (node as TreeNode).children;
      if (!children) return null;
      
      for (const child of children) {
        const found = findNodeById(child, id);
        if (found) return found;
      }
      return null;
    };

    const hierarchyRoot = d3.hierarchy(treeData); 
    const node = findNodeById(hierarchyRoot, selectedEmployee);
    return node ? node : null; // Return the found TreeNode data
    
  }, [selectedEmployee, treeData]);

  // Handle employee selection
  const closeEmployeeDetails = () => {
    setSelectedEmployee(null);
  };

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col">
      {loading && (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading organization data...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-red-600">
            <p className="text-xl font-bold">Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}
      
      {!loading && !error && (
        <>
          <div className="flex-grow overflow-auto relative">
            <svg ref={svgRef} className="w-full h-full"></svg>
          </div>
          
          {selectedEmployee && (
            <div className="absolute right-8 top-8 bg-white p-6 rounded-lg shadow-lg border border-gray-200 w-80">
              <button 
                onClick={closeEmployeeDetails}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
              
              {selectedEmployeeDetails && (
                <>
                  <h3 className="text-xl font-semibold mb-2">{selectedEmployeeDetails.name}</h3>
                  <p className="text-gray-400 mb-4">{selectedEmployeeDetails.title}</p>
                  <p className="text-gray-500 mb-1">Department: {selectedEmployeeDetails.data?.department}</p>
                  <p className="text-gray-500 mb-4">Email: {selectedEmployeeDetails.data?.email}</p>
                  
                  <h4 className="font-semibold mb-2 text-gray-300">Skills:</h4>
                  {selectedEmployeeDetails.data?.skills && selectedEmployeeDetails.data.skills.length > 0 ? (
                    <ul className="list-disc list-inside text-gray-400">
                      {selectedEmployeeDetails.data.skills.map((skill: string, index: number) => (
                        <li key={index}>{skill}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">No skills listed</p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OrgTree; 