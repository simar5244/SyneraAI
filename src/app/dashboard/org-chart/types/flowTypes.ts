import { NodeTypes, EdgeTypes } from 'reactflow';
import EmployeeNode from '../components/EmployeeNode';
import CustomNode from '../components/CustomNode';
import CustomEdge from '../components/CustomEdge';

// Define node types for the org chart
export const nodeTypes: NodeTypes = {
  employee: EmployeeNode,
  customNode: CustomNode,
} as const;

// Define edge types for the org chart
export const edgeTypes: EdgeTypes = {
  customEdge: CustomEdge,
} as const;
