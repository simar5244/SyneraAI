declare module '@react-three/fiber' {
  import { ReactNode } from 'react';
  import * as THREE from 'three';

  export interface CanvasProps {
    children?: ReactNode;
    camera?: Record<string, any>;
    style?: React.CSSProperties;
    className?: string;
    gl?: Record<string, any>;
    shadows?: boolean;
    linear?: boolean;
    flat?: boolean;
    orthographic?: boolean;
    frameloop?: 'always' | 'demand' | 'never';
    performance?: Record<string, any>;
    raycaster?: Record<string, any>;
    onCreated?: (state: any) => void;
    onPointerMissed?: (event: MouseEvent) => void;
    events?: Record<string, any>;
    eventSource?: any;
    eventPrefix?: string;
    dpr?: number | [number, number];
    resize?: Record<string, any>;
  }

  export interface ThreeEvent<T> extends MouseEvent {
    intersections: Array<{
      object: THREE.Object3D;
      point: THREE.Vector3;
      normal: THREE.Vector3;
      distance: number;
      uv: THREE.Vector2;
    }>;
    object: THREE.Object3D;
    eventObject: THREE.Object3D;
    unprojectedPoint: THREE.Vector3;
    ray: THREE.Ray;
    camera: THREE.Camera;
    stopPropagation: () => void;
    sourceEvent: T;
    delta: number;
    nativeEvent: T;
  }

  export function Canvas(props: CanvasProps): JSX.Element;
  export function useFrame(callback: (state: any, delta: number) => void, renderPriority?: number): void;
  export function useThree(): {
    gl: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;
    clock: THREE.Clock;
    size: { width: number; height: number };
    viewport: { width: number; height: number; factor: number };
    setSize: (width: number, height: number) => void;
    setDpr: (dpr: number) => void;
    pointer: THREE.Vector2;
    onPointerMissed: (event: MouseEvent) => void;
  };
}

declare module '@react-three/drei' {
  import { ReactNode } from 'react';
  import * as THREE from 'three';

  export interface OrbitControlsProps {
    makeDefault?: boolean;
    camera?: THREE.Camera;
    enableDamping?: boolean;
    dampingFactor?: number;
    enableZoom?: boolean;
    enableRotate?: boolean;
    enablePan?: boolean;
    minDistance?: number;
    maxDistance?: number;
    minPolarAngle?: number;
    maxPolarAngle?: number;
    minAzimuthAngle?: number;
    maxAzimuthAngle?: number;
    target?: [number, number, number];
    zoomSpeed?: number;
    panSpeed?: number;
    rotateSpeed?: number;
    screenSpacePanning?: boolean;
    onChange?: (e?: THREE.Event) => void;
    onStart?: (e?: THREE.Event) => void;
    onEnd?: (e?: THREE.Event) => void;
  }

  export interface TextProps {
    children: ReactNode;
    color?: string;
    fontSize?: number;
    maxWidth?: number;
    lineHeight?: number;
    letterSpacing?: number;
    textAlign?: 'left' | 'right' | 'center' | 'justify';
    font?: string;
    anchorX?: 'left' | 'center' | 'right' | number;
    anchorY?: 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom' | number;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number | [number, number, number];
    characters?: string;
    material?: THREE.Material;
    onPointerOver?: (e: any) => void;
    onPointerOut?: (e: any) => void;
    onClick?: (e: any) => void;
  }

  export interface StarsProps {
    radius?: number;
    depth?: number;
    count?: number;
    factor?: number;
    saturation?: number;
    fade?: boolean;
    speed?: number;
  }

  export function OrbitControls(props: OrbitControlsProps): JSX.Element;
  export function Text(props: TextProps): JSX.Element;
  export function Stars(props: StarsProps): JSX.Element;
}

// JSX Intrinsic Elements for Three.js
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Basic Three.js elements
      group: any;
      mesh: any;
      scene: any;
      points: any;
      line: any;
      lineSegments: any;
      
      // Geometries
      boxGeometry: any;
      sphereGeometry: any;
      planeGeometry: any;
      torusGeometry: any;
      
      // Materials
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      meshPhongMaterial: any;
      meshLambertMaterial: any;
      meshNormalMaterial: any;
      pointsMaterial: any;
      lineBasicMaterial: any;

      // Lights
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
      spotLight: any;
      hemisphereLight: any;
    }
  }
} 