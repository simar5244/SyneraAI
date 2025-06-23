'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';

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

interface OrganizationalGalaxyProps {
  employees: Employee[];
}

const departmentColors: { [key: string]: number } = {
  'Engineering': 0x4285F4,  // Google Blue
  'Marketing': 0xEA4335,    // Google Red
  'Sales': 0xFBBC05,        // Google Yellow
  'HR': 0x34A853,           // Google Green
  'Finance': 0x8E44AD,      // Purple
  'Operations': 0xF39C12,   // Orange
  'Product': 0x16A085,      // Turquoise
  'Design': 0xE74C3C,       // Red
  'Research': 0x2980B9,     // Blue
};

const defaultColor = 0x9ca3af;

const OrganizationalGalaxy: React.FC<OrganizationalGalaxyProps> = ({ employees }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHierarchyLinks, setShowHierarchyLinks] = useState(true);
  const [showCollaborationLinks, setShowCollaborationLinks] = useState(true);
  
  // Three.js objects refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameIdRef = useRef<number | null>(null);
  
  // Track employee objects in the scene
  const employeeObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const hierarchyLinesRef = useRef<THREE.LineSegments | null>(null);
  const collaborationLinesRef = useRef<THREE.LineSegments | null>(null);

  // Calculate unique departments
  const uniqueDepartments = React.useMemo(() => {
    const departments = new Set<string>();
    employees.forEach(emp => departments.add(emp.department));
    return Array.from(departments).sort();
  }, [employees]);

  // Initialize the 3D scene
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Store a reference to the container element for cleanup
    const container = containerRef.current;
    
    // Initialize scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111827); // Dark background
    sceneRef.current = scene;
    
    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      60, 
      container.clientWidth / container.clientHeight, 
      0.1, 
      10000
    );
    camera.position.z = 800;
    cameraRef.current = camera;
    
    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Initialize CSS2D renderer for labels
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;
    
    // Initialize orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 100;
    controls.maxDistance = 1500;
    controlsRef.current = controls;
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Animation loop
    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !labelRendererRef.current || !controlsRef.current) return;
      
      controlsRef.current.update();
      
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      labelRendererRef.current.render(sceneRef.current, cameraRef.current);
      
      frameIdRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    // Raycaster for planet selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const handleMouseClick = (event: MouseEvent) => {
      if (!container || !cameraRef.current || !sceneRef.current) return;
      
      // Calculate mouse position in normalized device coordinates
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
      
      // Set the raycaster
      raycaster.setFromCamera(mouse, cameraRef.current);
      
      // Get intersected objects
      const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
      
      if (intersects.length > 0) {
        // Find the first intersected employee sphere
        for (const intersect of intersects) {
          if (intersect.object.userData.employeeId) {
            // Find the employee data
            const employeeId = intersect.object.userData.employeeId;
            const employee = employees.find(emp => emp.id === employeeId);
            
            if (employee) {
              setSelectedEmployee(employee);
              return;
            }
          }
        }
      }
      
      // If no employee is clicked, clear selection
      setSelectedEmployee(null);
    };
    
    container.addEventListener('click', handleMouseClick);
    
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current || !labelRendererRef.current) return;
      
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
      labelRendererRef.current.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
      }
      
      window.removeEventListener('resize', handleResize);
      
      container.removeEventListener('click', handleMouseClick);
      
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement);
      }
      
      if (labelRendererRef.current && container.contains(labelRendererRef.current.domElement)) {
        container.removeChild(labelRendererRef.current.domElement);
      }
    };
  }, [employees]);

  // Create or update the galaxy based on filtered employees
  useEffect(() => {
    if (!sceneRef.current || !employees || employees.length === 0) return;
    
    const scene = sceneRef.current;
    
    // Clear existing employee objects
    employeeObjectsRef.current.forEach(obj => {
      scene.remove(obj);
    });
    employeeObjectsRef.current.clear();
    
    // Remove existing lines
    if (hierarchyLinesRef.current) {
      scene.remove(hierarchyLinesRef.current);
      hierarchyLinesRef.current = null;
    }
    
    if (collaborationLinesRef.current) {
      scene.remove(collaborationLinesRef.current);
      collaborationLinesRef.current = null;
    }
    
    // Apply filters
    let filteredEmployees = [...employees];
    
    if (departmentFilter) {
      filteredEmployees = filteredEmployees.filter(emp => emp.department === departmentFilter);
    }
    
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filteredEmployees = filteredEmployees.filter(emp => 
        emp.name.toLowerCase().includes(lowerSearchTerm) ||
        emp.role.toLowerCase().includes(lowerSearchTerm) ||
        emp.department.toLowerCase().includes(lowerSearchTerm)
      );
    }
    
    // Create a hierarchical structure for positioning
    interface EmployeeNode {
      employee: Employee;
      children: EmployeeNode[];
      level: number;
      index: number;
      parent?: EmployeeNode;
      x: number;
      y: number;
      z: number;
    }
    
    // Build the hierarchy tree
    const employeeMap = new Map<string, EmployeeNode>();
    const rootNodes: EmployeeNode[] = [];
    
    filteredEmployees.forEach((emp, idx) => {
      employeeMap.set(emp.id, {
        employee: emp,
        children: [],
        level: 0,
        index: idx,
        x: 0,
        y: 0,
        z: 0
      });
    });
    
    employeeMap.forEach(node => {
      const emp = node.employee;
      
      if (!emp.managerId || !employeeMap.has(emp.managerId)) {
        rootNodes.push(node);
      } else {
        const managerNode = employeeMap.get(emp.managerId);
        if (managerNode) {
          managerNode.children.push(node);
          node.parent = managerNode;
        } else {
          rootNodes.push(node);
        }
      }
    });
    
    // Assign levels based on hierarchy
    const assignLevels = (node: EmployeeNode, level: number) => {
      node.level = level;
      node.children.forEach(child => assignLevels(child, level + 1));
    };
    
    rootNodes.forEach(node => assignLevels(node, 0));
    
    // Determine max level for spacing
    let maxLevel = 0;
    employeeMap.forEach(node => {
      maxLevel = Math.max(maxLevel, node.level);
    });
    
    // Position nodes in a spiral galaxy pattern
    const spiralSpacing = 150;
    const angularSpacing = 0.4;
    
    employeeMap.forEach((node, id) => {
      const level = node.level;
      const radius = (maxLevel - level + 0.5) * spiralSpacing;
      const angle = level * angularSpacing + node.index * 0.2;
      
      node.x = radius * Math.cos(angle);
      node.y = (level * 30) - ((maxLevel * 30) / 2); // Vertical spacing
      node.z = radius * Math.sin(angle);
    });
    
    // Create visual elements
    employeeMap.forEach((node, id) => {
      const emp = node.employee;
      
      // Create planet (sphere)
      const intensity = emp.workIntensity + emp.collaborationIntensity;
      const radius = 3 + Math.sqrt(intensity);
      
      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const material = new THREE.MeshPhongMaterial({
        color: departmentColors[emp.department] || defaultColor,
        emissive: departmentColors[emp.department] || defaultColor,
        emissiveIntensity: 0.2,
        shininess: 100
      });
      
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(node.x, node.y, node.z);
      sphere.userData.employeeId = id;
      
      scene.add(sphere);
      employeeObjectsRef.current.set(id, sphere);
      
      // Create employee label
      const labelDiv = document.createElement('div');
      labelDiv.className = 'label';
      labelDiv.textContent = emp.name;
      labelDiv.style.color = 'white';
      labelDiv.style.fontSize = '10px';
      labelDiv.style.textShadow = '0 0 3px black, 0 0 2px black';
      labelDiv.style.userSelect = 'none';
      
      const label = new CSS2DObject(labelDiv);
      label.position.set(0, radius + 1, 0);
      sphere.add(label);
    });
    
    // Create hierarchy lines
    if (showHierarchyLinks) {
      const hierarchyLinePositions: number[] = [];
      
      employeeMap.forEach(node => {
        if (node.parent) {
          hierarchyLinePositions.push(
            node.x, node.y, node.z,
            node.parent.x, node.parent.y, node.parent.z
          );
        }
      });
      
      const hierarchyLineGeometry = new THREE.BufferGeometry();
      hierarchyLineGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(hierarchyLinePositions, 3)
      );
      
      const hierarchyLineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
        linewidth: 1
      });
      
      const hierarchyLines = new THREE.LineSegments(hierarchyLineGeometry, hierarchyLineMaterial);
      scene.add(hierarchyLines);
      hierarchyLinesRef.current = hierarchyLines;
    }
    
    // Create collaboration lines
    if (showCollaborationLinks) {
      const collaborationLinePositions: number[] = [];
      
      employeeMap.forEach(node => {
        const emp = node.employee;
        
        emp.collaborators.forEach(collaboratorId => {
          if (employeeMap.has(collaboratorId)) {
            const collaboratorNode = employeeMap.get(collaboratorId)!;
            
            // Add lines only once per collaboration (use ID comparison to ensure uniqueness)
            if (emp.id < collaboratorId) {
              collaborationLinePositions.push(
                node.x, node.y, node.z,
                collaboratorNode.x, collaboratorNode.y, collaboratorNode.z
              );
            }
          }
        });
      });
      
      const collaborationLineGeometry = new THREE.BufferGeometry();
      collaborationLineGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(collaborationLinePositions, 3)
      );
      
      const collaborationLineMaterial = new THREE.LineBasicMaterial({
        color: 0x6366f1,
        transparent: true,
        opacity: 0.2,
        linewidth: 1
      });
      
      const collaborationLines = new THREE.LineSegments(collaborationLineGeometry, collaborationLineMaterial);
      scene.add(collaborationLines);
      collaborationLinesRef.current = collaborationLines;
    }
    
    // Position camera to view the galaxy
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 200, 800);
      controlsRef.current.update();
    }
    
  }, [employees, departmentFilter, searchTerm, showHierarchyLinks, showCollaborationLinks]);

  return (
    <div className="relative w-full h-full bg-gray-900" ref={containerRef}>
      {/* Department filters */}
      <div className="absolute top-4 left-4 bg-black/50 rounded-lg p-2 z-10">
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
            >
              {dept}
            </button>
          ))}
        </div>
      </div>
      
      {/* Relationship visibility toggles */}
      <div className="absolute top-16 left-4 bg-black/50 rounded-lg p-2 z-10">
        <div className="flex items-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showHierarchyLinks}
              onChange={() => setShowHierarchyLinks(!showHierarchyLinks)}
              className="form-checkbox h-3 w-3 text-blue-600 rounded"
            />
            <span className="ml-2 text-xs text-white">Hierarchy Lines</span>
          </label>
          
          <label className="flex items-center ml-4 cursor-pointer">
            <input
              type="checkbox"
              checked={showCollaborationLinks}
              onChange={() => setShowCollaborationLinks(!showCollaborationLinks)}
              className="form-checkbox h-3 w-3 text-blue-600 rounded"
            />
            <span className="ml-2 text-xs text-white">Collaboration Lines</span>
          </label>
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
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-black/50 rounded-lg p-2 z-10">
        <div className="text-xs text-white">
          <div className="flex items-center mb-1">
            <div className="w-3 h-3 rounded-full mr-2" style={{ background: 'rgba(255,255,255,0.3)' }}></div>
            <span>Hierarchy Relationship</span>
          </div>
          <div className="flex items-center mb-1">
            <div className="w-3 h-3 rounded-full mr-2" style={{ background: 'rgba(99,102,241,0.3)' }}></div>
            <span>Collaboration</span>
          </div>
          <div className="flex items-center mb-1">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span>Planet Size ∝ Work+Collaboration</span>
          </div>
        </div>
      </div>
      
      {/* Selected employee details */}
      {selectedEmployee && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 bg-black/70 text-white p-4 rounded-lg shadow-lg max-w-xs z-20">
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
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-2 rounded-lg text-xs z-10">
        <p>Left-click + drag to rotate | Right-click + drag to pan | Scroll to zoom | Click planet for details</p>
      </div>
    </div>
  );
};

export default OrganizationalGalaxy; 