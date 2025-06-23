'use client';

import React, { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import { Employee, Department, ValueToken } from '@/types/organization';
import { getEmployees, getDepartments, getValueTokens } from '@/lib/dataProvider';
import ForceGraph3D from 'react-force-graph-3d';

// Dynamically import react-three-fiber components with SSR disabled
const Canvas = dynamic(() => import('@react-three/fiber').then(mod => mod.Canvas), { ssr: false });
const OrbitControls = dynamic(() => import('@react-three/drei').then(mod => mod.OrbitControls), { ssr: false });
const Text = dynamic(() => import('@react-three/drei').then(mod => mod.Text), { ssr: false });
const Stars = dynamic(() => import('@react-three/drei').then(mod => mod.Stars), { ssr: false });

// Colors for different departments
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

// Type for connection between employees
interface Connection {
  source: string;
  target: string;
}

// Employee node component
const EmployeeNode: React.FC<{
  employee: {
    id: string;
    name: string;
    position?: string;
    department?: string;
    managerId?: string;
    level: number;
    color?: string;
    email?: string;
    phone?: string;
    hireDate?: string;
    skills?: string[];
  };
  position: [number, number, number];
  selected: boolean;
  hovered: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}> = ({ employee, position, selected, hovered, onClick, onHover, onLeave }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = employee.color || departmentColors[employee.department || 'default'];
  
  const scale = selected ? 1.3 : hovered ? 1.1 : 1;
  const emissiveIntensity = selected ? 0.7 : hovered ? 0.5 : 0.2;

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={onHover}
        onPointerOut={onLeave}
        scale={scale}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={emissiveIntensity} 
          roughness={0.4} 
        />
      </mesh>
      {(hovered || selected) && (
        <Text
          position={[0, 1.5, 0]}
          fontSize={0.5}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {employee.name}
        </Text>
      )}
    </group>
  );
};

// Connection line between employees
const ConnectionLine: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  opacity: number;
}> = ({ start, end, opacity }) => {
  const points = [
    new THREE.Vector3(...start),
    new THREE.Vector3(...end)
  ];
  
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  
  return (
    <primitive object={new THREE.Line(
      lineGeometry,
      new THREE.LineBasicMaterial({ color: '#8888ff', transparent: true, opacity: opacity })
    )} />
  );
};

// Main galaxy visualization
const GalaxyVisualization: React.FC<{
  employees: Array<{
    id: string;
    name: string;
    position?: string;
    department?: string;
    managerId?: string;
    level: number;
    color?: string;
    email?: string;
    phone?: string;
    hireDate?: string;
    skills?: string[];
  }>;
  connections: Connection[];
  selectedDepartment: string | null;
  selectedEmployee: string | null;
  setSelectedEmployee: (id: string | null) => void;
  searchName: string;
}> = ({ employees, connections, selectedDepartment, selectedEmployee, setSelectedEmployee, searchName }) => {
  const [hoveredEmployee, setHoveredEmployee] = useState<string | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  
  // Filter employees by department and search name
  const filteredEmployees = employees.filter(employee => {
    // Department filter
    if (selectedDepartment && employee.department !== selectedDepartment) {
      return false;
    }
    
    // Name search
    if (searchName && !employee.name.toLowerCase().includes(searchName.toLowerCase())) {
      return false;
    }
    
    return true;
  });
  
  // Filter connections based on filtered employees
  const filteredConnections = connections.filter(conn => {
    return filteredEmployees.some(emp => emp.id === conn.source) && 
           filteredEmployees.some(emp => emp.id === conn.target);
  });
  
  // Calculate positions for each employee in 3D space
  const employeePositions = filteredEmployees.reduce<Record<string, [number, number, number]>>((acc, employee) => {
    // Position calculation based on organizational level and a bit of randomness
    const radius = 5 + employee.level * 5;
    const segment = filteredEmployees.filter(e => e.level === employee.level).length;
    const index = filteredEmployees.filter(e => e.level === employee.level).findIndex(e => e.id === employee.id);
    const angle = (index / Math.max(segment, 1)) * Math.PI * 2;
    
    // Use spherical coordinates for a galaxy-like structure
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    const y = (employee.level - 1) * -3; // Lower levels are higher up
    
    acc[employee.id] = [x, y, z];
    return acc;
  }, {});
  
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <Stars radius={100} depth={50} count={5000} factor={4} />
      
      {/* Render connections */}
      {filteredConnections.map((connection) => {
        const startPos = employeePositions[connection.source];
        const endPos = employeePositions[connection.target];
        
        if (!startPos || !endPos) return null;
        
        const connectionId = `${connection.source}-${connection.target}`;
        const isHovered = hoveredConnection === connectionId;
        
        return (
          <ConnectionLine 
            key={connectionId}
            start={startPos}
            end={endPos}
            opacity={isHovered ? 1 : 0.3}
          />
        );
      })}
      
      {/* Render employee nodes */}
      {filteredEmployees.map((employee) => {
        const position = employeePositions[employee.id];
        if (!position) return null;
        
        return (
          <EmployeeNode
            key={employee.id}
            employee={employee}
            position={position}
            selected={selectedEmployee === employee.id}
            hovered={hoveredEmployee === employee.id}
            onClick={() => setSelectedEmployee(employee.id === selectedEmployee ? null : employee.id)}
            onHover={() => setHoveredEmployee(employee.id)}
            onLeave={() => setHoveredEmployee(null)}
          />
        );
      })}
      
      <OrbitControls enableZoom={true} enablePan={true} />
    </>
  );
};

// Employee Detail Panel
const EmployeeDetailPanel: React.FC<{
  employee: {
    id: string;
    name: string;
    position?: string;
    department?: string;
    managerId?: string;
    level: number;
    color?: string;
    email?: string;
    phone?: string;
    hireDate?: string;
    skills?: string[];
  } | null;
  onClose: () => void;
}> = ({ employee, onClose }) => {
  if (!employee) return null;
  
  return (
    <div className="fixed right-0 top-0 w-80 h-full bg-gray-900 border-l border-gray-700 p-4 overflow-y-auto shadow-xl z-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">{employee.name}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>
      
      <div className="space-y-4">
        <div className="p-3 bg-gray-800 rounded-lg">
          <h3 className="text-sm text-gray-400 mb-1">Position</h3>
          <p className="text-white">{employee.position || 'Not specified'}</p>
        </div>
        
        <div className="p-3 bg-gray-800 rounded-lg">
          <h3 className="text-sm text-gray-400 mb-1">Department</h3>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: departmentColors[employee.department || 'default'] }} />
            <p className="text-white">{employee.department || 'Not specified'}</p>
          </div>
        </div>
        
        {employee.email && (
          <div className="p-3 bg-gray-800 rounded-lg">
            <h3 className="text-sm text-gray-400 mb-1">Email</h3>
            <p className="text-white">{employee.email}</p>
          </div>
        )}
        
        {employee.phone && (
          <div className="p-3 bg-gray-800 rounded-lg">
            <h3 className="text-sm text-gray-400 mb-1">Phone</h3>
            <p className="text-white">{employee.phone}</p>
          </div>
        )}
        
        {employee.hireDate && (
          <div className="p-3 bg-gray-800 rounded-lg">
            <h3 className="text-sm text-gray-400 mb-1">Hire Date</h3>
            <p className="text-white">{employee.hireDate}</p>
          </div>
        )}
        
        {employee.skills && employee.skills.length > 0 && (
          <div className="p-3 bg-gray-800 rounded-lg">
            <h3 className="text-sm text-gray-400 mb-1">Skills</h3>
            <div className="flex flex-wrap gap-1">
              {employee.skills.map((skill, index) => (
                <span key={index} className="px-2 py-1 bg-blue-900 text-blue-100 text-xs rounded">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Filter Panel Component
const FilterPanel: React.FC<{
  departments: string[];
  selectedDepartment: string | null;
  setSelectedDepartment: (dept: string | null) => void;
  searchName: string;
  setSearchName: (name: string) => void;
}> = ({ departments, selectedDepartment, setSelectedDepartment, searchName, setSearchName }) => {
  return (
    <div className="absolute top-4 left-4 bg-gray-900 p-4 rounded-lg border border-gray-700 z-10 w-64">
      <h3 className="text-white font-medium mb-2">Filters</h3>
      
      <div className="mb-3">
        <label className="block text-sm text-gray-400 mb-1">Department</label>
        <select 
          className="w-full bg-gray-800 text-white rounded p-2 border border-gray-700"
          value={selectedDepartment || ''}
          onChange={(e) => setSelectedDepartment(e.target.value || null)}
        >
          <option value="">All Departments</option>
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>
      
      <div className="mb-3">
        <label className="block text-sm text-gray-400 mb-1">Search by Name</label>
        <input 
          type="text" 
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="w-full bg-gray-800 text-white rounded p-2 border border-gray-700"
          placeholder="Enter name..."
        />
      </div>
      
      <button 
        onClick={() => {
          setSelectedDepartment(null);
          setSearchName('');
        }}
        className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition-colors"
      >
        Reset Filters
      </button>
    </div>
  );
};

interface Node {
  id: string;
  name: string;
  group: string;
  val: number;
  color?: string;
  data: any;
  type: 'employee' | 'department';
  x?: number;
  y?: number;
  z?: number;
}

interface Link {
  source: string;
  target: string;
  value: number;
  type: 'manager' | 'department' | 'collaboration';
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

// Default color for departments without a specific color
const defaultColor = '#9ca3af';

interface GalaxyViewProps {
  onSearch?: (query: string) => void;
  onDepartmentFilter?: (department: string) => void;
}

export default function GalaxyView({ onSearch, onDepartmentFilter }: GalaxyViewProps) {
  const [employees, setEmployees] = useState<Array<{
    id: string;
    name: string;
    position?: string;
    department?: string;
    managerId?: string;
    level: number;
    color?: string;
    email?: string;
    phone?: string;
    hireDate?: string;
    skills?: string[];
  }>>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');
  const [isClient, setIsClient] = useState(false);
  
  // Set client-side rendering flag
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    const loadData = async () => {
      const fetchedEmployees = await getEmployees();
      const fetchedDepartments = await getDepartments();
      const valueTokens = await getValueTokens();
      
      // Set departments list
      const deptNames = fetchedDepartments.map(dept => dept.name);
      setDepartments(deptNames);
      
      // Set employees with color based on department
      const coloredEmployees = fetchedEmployees.map(emp => ({
        ...emp,
        color: departmentColors[emp.department || 'default']
      }));
      setEmployees(coloredEmployees);
      
      // Create connections based on manager relationships
      const managerConnections = fetchedEmployees
        .filter(emp => emp.managerId)
        .map(emp => ({
          source: emp.managerId as string,
          target: emp.id
        }));
      setConnections(managerConnections);
    };
    
    loadData();
  }, []);
  
  // Get the selected employee object
  const selectedEmployeeObj = selectedEmployee ? 
    employees.find(emp => emp.id === selectedEmployee) || null : null;
  
  // If we're not on the client yet, return a loading state
  if (!isClient) {
    return <div className="w-full h-screen flex items-center justify-center">Loading 3D visualization...</div>;
  }
  
  return (
    <div className="w-full h-screen flex flex-col">
      <div className="flex-none p-4 bg-gray-900">
        <FilterPanel 
          departments={departments}
          selectedDepartment={selectedDepartment}
          setSelectedDepartment={setSelectedDepartment}
          searchName={searchName}
          setSearchName={setSearchName}
        />
      </div>
      
      <div className="flex-grow relative">
        <Canvas
          camera={{ position: [0, 0, 50], fov: 60 }}
          style={{ background: '#111' }}
        >
          <GalaxyVisualization 
            employees={employees}
            connections={connections}
            selectedDepartment={selectedDepartment}
            selectedEmployee={selectedEmployee}
            setSelectedEmployee={setSelectedEmployee}
            searchName={searchName}
          />
        </Canvas>
        
        {selectedEmployeeObj && (
          <div className="absolute top-4 right-4 w-72">
            <EmployeeDetailPanel 
              employee={selectedEmployeeObj} 
              onClose={() => setSelectedEmployee(null)} 
            />
          </div>
        )}
      </div>
    </div>
  );
} 