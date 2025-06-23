declare module 'react-force-graph-3d' {
  import { Component } from 'react';
  import * as THREE from 'three';

  interface NodeObject {
    id: string;
    name?: string;
    group?: string;
    val?: number;
    color?: string;
    [key: string]: any;
  }

  interface LinkObject {
    source: string | NodeObject;
    target: string | NodeObject;
    value?: number;
    color?: string;
    [key: string]: any;
  }

  interface GraphData {
    nodes: NodeObject[];
    links: LinkObject[];
  }

  interface ForceGraph3DProps {
    // Data input
    graphData: GraphData;
    nodeId?: string;
    linkSource?: string;
    linkTarget?: string;

    // Node styling and behavior
    nodeColor?: string | ((node: NodeObject) => string);
    nodeVal?: number | ((node: NodeObject) => number);
    nodeLabel?: string | ((node: NodeObject) => string);
    nodeRelSize?: number;
    nodeOpacity?: number;
    nodeResolution?: number;
    nodeThreeObject?: (node: NodeObject) => THREE.Object3D | null;
    nodeThreeObjectExtend?: boolean;

    // Link styling and behavior
    linkColor?: string | ((link: LinkObject) => string);
    linkWidth?: number | ((link: LinkObject) => number);
    linkOpacity?: number;
    linkDirectionalArrowLength?: number;
    linkDirectionalArrowColor?: string | ((link: LinkObject) => string);
    linkDirectionalArrowRelPos?: number;
    linkDirectionalParticles?: number | ((link: LinkObject) => number);
    linkDirectionalParticleSpeed?: number | ((link: LinkObject) => number);
    linkDirectionalParticleColor?: string | ((link: LinkObject) => string);
    linkDirectionalParticleWidth?: number | ((link: LinkObject) => number);

    // Force engine configuration
    dagMode?: 'td' | 'bu' | 'lr' | 'rl' | 'radialout' | 'radialin';
    dagLevelDistance?: number;
    dagNodeFilter?: (node: NodeObject) => boolean;
    d3AlphaDecay?: number;
    d3VelocityDecay?: number;
    warmupTicks?: number;
    cooldownTicks?: number;
    cooldownTime?: number;

    // Rendering options
    backgroundColor?: string;
    showNavInfo?: boolean;
    enableNodeDrag?: boolean;
    enablePointerInteraction?: boolean;
    enableNavigationControls?: boolean;

    // Events
    onNodeClick?: (node: NodeObject, event: MouseEvent) => void;
    onNodeRightClick?: (node: NodeObject, event: MouseEvent) => void;
    onNodeHover?: (node: NodeObject | null, previousNode: NodeObject | null) => void;
    onNodeDrag?: (node: NodeObject, translate: { x: number, y: number, z: number }) => void;
    onNodeDragEnd?: (node: NodeObject) => void;
    onLinkClick?: (link: LinkObject, event: MouseEvent) => void;
    onLinkRightClick?: (link: LinkObject, event: MouseEvent) => void;
    onLinkHover?: (link: LinkObject | null, previousLink: LinkObject | null) => void;
    onBackgroundClick?: (event: MouseEvent) => void;
    onBackgroundRightClick?: (event: MouseEvent) => void;
    onEngineStop?: () => void;

    // Controls
    controlType?: 'trackball' | 'orbit' | 'fly';
    width?: number;
    height?: number;
  }

  export default class ForceGraph3D extends Component<ForceGraph3DProps> {
    // API methods
    updateGraph(props: Partial<ForceGraph3DProps>): void;
    refresh(): void;
    d3Force(forceName: string, forceInstance?: any): any;
    d3ReheatSimulation(): void;
    cameraPosition(position?: {x?: number, y?: number, z?: number}, lookAt?: {x?: number, y?: number, z?: number}, transitionMs?: number): this | {x: number, y: number, z: number};
    zoomToFit(duration?: number, padding?: number): void;
    pauseAnimation(): void;
    resumeAnimation(): void;
    getGraphBbox(): { x: [number, number], y: [number, number], z: [number, number] };
  }
} 