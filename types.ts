export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeMetadata {
  name: string;
  role?: string;
  department?: string;
  skill_level: number;
  workload_capacity: number;
  attributes?: Record<string, any>;
}

export interface OrgNode {
  id: number;
  node_type: string;
  position: NodePosition;
  metadata: NodeMetadata;
  workload: number;
  depth?: number;
}

export interface NodeConnection {
  id: number;
  source_id: number;
  target_id: number;
  connection_type: string;
  workload_impact: number;
  metadata?: Record<string, any>;
}

export interface Layout {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface SimulationResult {
  layout_id: number;
  nodes: OrgNode[];
  connections: NodeConnection[];
  impact_score: number;
  created_at: string;
}

export interface SimulationChange {
  node_updates?: Partial<OrgNode>[];
  node_additions?: Partial<OrgNode>[];
  node_deletions?: number[];
  connection_additions?: Partial<NodeConnection>[];
  connection_deletions?: number[];
}

export interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
} 