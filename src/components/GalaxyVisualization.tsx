import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';

interface Node {
  id: string;
  type: 'department' | 'employee';
  name: string;
  department?: string;
  role?: string;
  size?: number;
  color?: string;
}

interface Link {
  source: string;
  target: string;
  type: 'hierarchy' | 'collaboration';
  project?: string;
  value?: number;
}

interface GalaxyData {
  nodes: Node[];
  links: Link[];
}

interface NodePosition {
  [key: string]: THREE.Vector3;
}

// Simple HTML tooltip using DOM elements positioned by three.js
interface HtmlTooltipProps {
  children: React.ReactNode;
  position: THREE.Vector3;
}

const HtmlTooltip: React.FC<HtmlTooltipProps> = ({ children, position }) => {
  const { camera, size } = useThree();
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    if (!position) return;
    
    // Project 3D position to 2D screen space
    const vector = new THREE.Vector3(position.x, position.y, position.z);
    vector.project(camera);
    
    // Convert to normalized device coordinates
    const x = (vector.x * 0.5 + 0.5) * size.width;
    const y = (vector.y * -0.5 + 0.5) * size.height;
    
    setTooltipPos({ x, y });
  }, [position, camera, size]);
  
  return (
    <div
      style={{
        position: 'absolute',
        top: tooltipPos.y,
        left: tooltipPos.x,
        transform: 'translate(-50%, -100%)',
        padding: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        borderRadius: '4px',
        fontSize: '14px',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {children}
    </div>
  );
};

// Stars background component
const Stars = () => {
  const starsRef = useRef<THREE.Points>(null);
  const starsCount = 2000;
  
  // Create stars geometry
  const positions = new Float32Array(starsCount * 3);
  const sizes = new Float32Array(starsCount);
  
  for (let i = 0; i < starsCount; i++) {
    const i3 = i * 3;
    // Random positions in a sphere
    const radius = 100 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    
    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);
    
    sizes[i] = Math.random() * 2;
  }
  
  const starsGeometry = new THREE.BufferGeometry();
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  const starsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.1,
    transparent: true,
    sizeAttenuation: true,
    depthWrite: false,
  });
  
  useFrame(() => {
    if (starsRef.current) {
      starsRef.current.rotation.y += 0.0001;
    }
  });
  
  return (
    <points ref={starsRef} geometry={starsGeometry} material={starsMaterial} />
  );
};

const NodeObject: React.FC<{
  position: THREE.Vector3;
  node: Node;
  onClick: () => void;
  onHover: (hover: boolean) => void;
}> = ({ position, node, onClick, onHover }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { type, name, size = type === 'department' ? 3 : 0.8, 
          color = type === 'department' ? '#ffa500' : '#4a9eff' } = node;
  
  const [hovered, setHovered] = useState(false);

  const { scale } = useSpring({
    scale: hovered ? 1.2 : 1,
    config: { tension: 300, friction: 10 },
  });

  // Add glow effect
  const glowIntensity = type === 'department' ? 1.0 : 0.4;
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += type === 'department' ? 0.005 : 0.01;
    }
  });

  return (
    <>
      <animated.group position={position} scale={scale}>
        <mesh
          ref={meshRef}
          onClick={onClick}
          onPointerOver={() => {
            setHovered(true);
            onHover(true);
          }}
          onPointerOut={() => {
            setHovered(false);
            onHover(false);
          }}
        >
          <sphereGeometry args={[size, 32, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={glowIntensity}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
        
        {/* Add a glow effect for departments */}
        {type === 'department' && (
          <mesh>
            <sphereGeometry args={[size * 1.2, 32, 32]} />
            <meshStandardMaterial
              color={color}
              transparent={true}
              opacity={0.15}
              roughness={1}
              emissive={color}
              emissiveIntensity={0.5}
            />
          </mesh>
        )}
      </animated.group>
      
      {/* Tooltip for hover data */}
      {hovered && (
        <HtmlTooltip position={position}>
          <div className="font-bold">{name}</div>
          {node.type === 'employee' && node.department && (
            <div className="text-xs">{node.department}</div>
          )}
        </HtmlTooltip>
      )}
    </>
  );
};

const LinkObject: React.FC<{
  start: THREE.Vector3;
  end: THREE.Vector3;
  link: Link;
  onClick: () => void;
}> = ({ start, end, link, onClick }) => {
  const [hovered, setHovered] = useState(false);
  
  const points = [start, end];
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  
  const color = link.type === 'hierarchy' ? '#ff9500' : '#4a9eff';
  const opacity = hovered ? 0.8 : 0.3;
  const lineWidth = hovered ? 2 : 1;
  
  // Create a cylinder for better interaction with the link
  const direction = new THREE.Vector3().subVectors(end, start);
  const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const distance = start.distanceTo(end);
  
  // Calculate rotation to align cylinder with the direction
  const arrowHelper = new THREE.ArrowHelper(direction.clone().normalize(), start);
  const rotation = new THREE.Euler().setFromQuaternion(arrowHelper.quaternion);
  
  return (
    <group>
      {/* Visible line */}
      <primitive object={new THREE.Line(
        lineGeometry,
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity,
          linewidth: lineWidth
        })
      )} onClick={onClick} />
      
      {/* Invisible cylinder for better mouse interaction */}
      <mesh 
        position={midPoint}
        rotation={rotation}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={onClick}
        visible={false}
      >
        <cylinderGeometry args={[0.1, 0.1, distance, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {/* Show project name on hover for collaboration links */}
      {hovered && link.type === 'collaboration' && link.project && (
        <HtmlTooltip position={midPoint}>
          <div className="bg-black/80 text-white p-2 rounded text-sm">
            {link.project}
          </div>
        </HtmlTooltip>
      )}
    </group>
  );
};

interface GalaxyProps {
  onSearch?: (query: string) => void;
  onDepartmentFilter?: (department: string) => void;
}

export const GalaxyVisualization: React.FC<GalaxyProps> = ({ 
  onSearch, 
  onDepartmentFilter 
}) => {
  const [data, setData] = useState<GalaxyData | null>(null);
  const [nodePositions, setNodePositions] = useState<NodePosition>({});
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    // Fetch data from your API
    setLoading(true);
    fetch('http://localhost:8000/api/galaxy/data')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch galaxy data');
        }
        return res.json();
      })
      .then((data: GalaxyData) => {
        setData(data);
        calculateNodePositions(data);
        
        // Extract unique departments
        const depts = data.nodes
          .filter(n => n.type === 'department')
          .map(n => n.name);
        setDepartments(depts);
        
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching galaxy data:', error);
        setError(error.message);
        setLoading(false);
      });
  }, []);

  const calculateNodePositions = (data: GalaxyData) => {
    const positions: NodePosition = {};
    const departments = data.nodes.filter((n) => n.type === 'department');
    const radius = 30; // Larger radius for more spread
    
    // Position departments in a circle on the galactic plane
    departments.forEach((dept, i) => {
      const angle = (i / departments.length) * Math.PI * 2;
      const deptRadius = radius * (0.8 + Math.random() * 0.4); // Vary the radius slightly
      positions[dept.id] = new THREE.Vector3(
        Math.cos(angle) * deptRadius,
        (Math.random() - 0.5) * 5, // Slight variation in height
        Math.sin(angle) * deptRadius
      );
    });
    
    // Position employees around their departments in a spiral pattern
    data.nodes
      .filter((n) => n.type === 'employee')
      .forEach((emp) => {
        if (emp.department) {
          const deptId = `dept_${emp.department}`;
          if (positions[deptId]) {
            const deptPos = positions[deptId];
            
            // Create a spiral pattern
            const spiralRadius = 3 + Math.random() * 5;
            const spiralAngle = Math.random() * Math.PI * 4;
            const heightVariation = (Math.random() - 0.5) * 3;
            
            positions[emp.id] = new THREE.Vector3(
              deptPos.x + Math.cos(spiralAngle) * spiralRadius,
              deptPos.y + heightVariation,
              deptPos.z + Math.sin(spiralAngle) * spiralRadius
            );
          }
        }
      });
    
    setNodePositions(positions);
  };

  const handleSearch = () => {
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery);
    }
  };

  const handleDepartmentFilter = (dept: string) => {
    setSelectedDepartment(dept === selectedDepartment ? null : dept);
    if (onDepartmentFilter) {
      onDepartmentFilter(dept);
    }
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
    
    // If entering full screen, request browser full screen
    if (!isFullScreen) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      }
    } else {
      // Exit full screen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-white text-xl">Loading Galaxy Data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-red-500 text-xl">Error: {error}</div>
      </div>
    );
  }

  if (!isFullScreen) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md text-center">
          <h2 className="text-white text-2xl font-bold mb-4">Organization Galaxy Visualization</h2>
          <p className="text-gray-300 mb-6">
            Explore your organization as a 3D galaxy with departments as suns and employees as planets.
          </p>
          <button
            onClick={toggleFullScreen}
            className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg shadow transition duration-300 text-lg font-semibold"
          >
            Enter Full Screen View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative bg-black">
      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 30, 60], fov: 60 }}>
        <color attach="background" args={['#000']} />
        <ambientLight intensity={0.2} />
        <Stars />
        
        {/* Add a dim central light to illuminate the galaxy */}
        <pointLight position={[0, 0, 0]} intensity={2} distance={100} color="#ffffff" />
        
        <OrbitControls 
          enableDamping={true}
          dampingFactor={0.05}
          rotateSpeed={0.5}
          maxDistance={100}
          minDistance={10}
        />
        
        <Suspense fallback={null}>
          {data?.nodes.map((node) => (
            nodePositions[node.id] && (
              <NodeObject
                key={node.id}
                position={nodePositions[node.id]}
                node={node}
                onClick={() => setSelectedNode(node)}
                onHover={() => {}}
              />
            )
          ))}

          {data?.links.map((link, i) => (
            nodePositions[link.source] && nodePositions[link.target] && (
              <LinkObject
                key={i}
                start={nodePositions[link.source]}
                end={nodePositions[link.target]}
                link={link}
                onClick={() => setSelectedLink(link)}
              />
            )
          ))}
        </Suspense>
      </Canvas>

      {/* UI Controls - Positioned Absolutely */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-4">
        <button
          onClick={toggleFullScreen}
          className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Exit Full Screen
        </button>
        
        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-gray-800 text-white px-4 py-2 rounded w-64"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500"
          >
            Search
          </button>
        </div>
        
        {/* Department Filters */}
        <div className="bg-gray-800 rounded p-2">
          <div className="text-white font-bold mb-2">Filter by Department</div>
          <div className="flex flex-wrap gap-2">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => handleDepartmentFilter(dept)}
                className={`px-3 py-1 rounded text-sm ${
                  selectedDepartment === dept 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-200'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="absolute top-4 right-4 bg-gray-900/90 text-white p-4 rounded-lg shadow-lg max-w-md">
          <h3 className="text-xl font-bold mb-2">{selectedNode.name}</h3>
          <div className="mb-4">
            <div className="text-gray-300">Type: {selectedNode.type}</div>
            {selectedNode.department && (
              <div className="text-gray-300">Department: {selectedNode.department}</div>
            )}
            {selectedNode.role && (
              <div className="text-gray-300">Role: {selectedNode.role}</div>
            )}
          </div>
          <button
            onClick={() => setSelectedNode(null)}
            className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      )}
      
      {/* Project Collaboration Details */}
      {selectedLink && selectedLink.type === 'collaboration' && (
        <div className="absolute bottom-4 right-4 bg-gray-900/90 text-white p-4 rounded-lg shadow-lg">
          <h3 className="text-lg font-bold mb-2">Project Collaboration</h3>
          {selectedLink.project && (
            <div className="mb-4">
              <div className="text-gray-300">Project: {selectedLink.project}</div>
            </div>
          )}
          <button
            onClick={() => setSelectedLink(null)}
            className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}; 