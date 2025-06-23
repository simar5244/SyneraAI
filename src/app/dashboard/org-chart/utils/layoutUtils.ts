/**
 * Organizational Chart Layout Utilities
 * 
 * This file contains utilities for automatically laying out nodes in an organizational chart.
 * We use a custom hierarchical layout algorithm to position nodes based on their reporting relationships.
 */

import type { Node, Edge } from 'reactflow';

// Constants for layout calculations
const LEVEL_HEIGHT = 180;
const NODE_WIDTH = 200;
const NODE_PADDING = 60;

// Interface for node data
interface Node {
  id: string;
  position: { x: number; y: number };
  [key: string]: any;
}

// Interface for edge data
interface Edge {
  id: string;
  source: string;
  target: string;
  [key: string]: any;
}

/**
 * Applies a hierarchical layout to organization chart nodes
 * 
 * @param nodes The nodes to layout
 * @param edges The connections between nodes
 * @returns Nodes with updated positions based on hierarchy
 */
export function applyHierarchicalLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (!nodes.length) return [];
  
  // Build the graph structure from edges
  const graph: Record<string, string[]> = {};
  const parentMap: Record<string, string> = {};
  
  // Initialize graph with all nodes
  nodes.forEach(node => {
    graph[node.id] = [];
  });
  
  // Fill graph with connections
  edges.forEach(edge => {
    const { source, target } = edge;
    // Add child to parent's list
    if (graph[source]) {
      graph[source].push(target);
    }
    // Track parent for each node
    parentMap[target] = source;
  });
  
  // Find root nodes (nodes without parents)
  const rootNodes = nodes.filter(node => !parentMap[node.id]).map(node => node.id);
  
  // Calculate levels for each node
  const levels: Record<string, number> = {};
  
  // Assign level 0 to root nodes
  rootNodes.forEach(nodeId => {
    levels[nodeId] = 0;
  });
  
  // Do a breadth-first traversal to assign levels to all nodes
  const queue = [...rootNodes];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const children = graph[nodeId] || [];
    
    children.forEach(childId => {
      levels[childId] = levels[nodeId] + 1;
      queue.push(childId);
    });
  }
  
  // Group nodes by level
  const nodesByLevel: Record<number, string[]> = {};
  Object.keys(levels).forEach(nodeId => {
    const level = levels[nodeId];
    if (!nodesByLevel[level]) {
      nodesByLevel[level] = [];
    }
    nodesByLevel[level].push(nodeId);
  });
  
  // Get the maximum level
  const maxLevel = Math.max(...Object.keys(nodesByLevel).map(Number));
  
  // Position nodes by level
  const positionedNodes = [...nodes];
  
  // Process each level
  for (let level = 0; level <= maxLevel; level++) {
    const nodesInLevel = nodesByLevel[level] || [];
    const totalWidth = nodesInLevel.length * NODE_WIDTH + (nodesInLevel.length - 1) * NODE_PADDING;
    let startX = -totalWidth / 2;
    
    // Position each node in this level
    nodesInLevel.forEach(nodeId => {
      const nodeIndex = positionedNodes.findIndex(n => n.id === nodeId);
      if (nodeIndex !== -1) {
        positionedNodes[nodeIndex] = {
          ...positionedNodes[nodeIndex],
          position: {
            x: startX + (NODE_WIDTH / 2),
            y: level * LEVEL_HEIGHT
          }
        };
        
        // Update startX for the next node
        startX += NODE_WIDTH + NODE_PADDING;
      }
    });
  }
  
  // Optional: Second pass to center children under their parent
  for (let level = maxLevel; level > 0; level--) {
    const nodesInLevel = nodesByLevel[level] || [];
    
    // Group children by parent
    const childrenByParent: Record<string, string[]> = {};
    nodesInLevel.forEach(nodeId => {
      const parentId = parentMap[nodeId];
      if (!childrenByParent[parentId]) {
        childrenByParent[parentId] = [];
      }
      childrenByParent[parentId].push(nodeId);
    });
    
    // Center children under each parent
    Object.keys(childrenByParent).forEach(parentId => {
      const children = childrenByParent[parentId];
      if (children.length > 1) {
        const childPositions = children.map(childId => {
          const node = positionedNodes.find(n => n.id === childId);
          return node ? node.position.x : 0;
        });
        
        const leftmostChild = Math.min(...childPositions);
        const rightmostChild = Math.max(...childPositions);
        const parentCenterX = (leftmostChild + rightmostChild) / 2;
        
        // Find the parent node and update its position to be centered over its children
        const parentIndex = positionedNodes.findIndex(n => n.id === parentId);
        if (parentIndex !== -1) {
          positionedNodes[parentIndex] = {
            ...positionedNodes[parentIndex],
            position: {
              x: parentCenterX,
              y: positionedNodes[parentIndex].position.y
            }
          };
        }
      }
    });
  }
  
  return positionedNodes;
}

/**
 * Adjusts layout to accommodate a newly added node
 */
export function adjustLayoutForNewNode(
  nodes: Node[], 
  edges: Edge[], 
  newNodeId: string
): Node[] {
  // Apply full hierarchical layout since it's simplest for consistent results
  return applyHierarchicalLayout(nodes, edges);
}

/**
 * Handles removing a node by recalculating layout
 */
export function handleNodeRemoval(
  nodes: Node[], 
  edges: Edge[], 
  removedNodeId: string
): Node[] {
  // Filter out the removed node and all its edges
  const updatedNodes = nodes.filter(node => node.id !== removedNodeId);
  const updatedEdges = edges.filter(
    edge => edge.source !== removedNodeId && edge.target !== removedNodeId
  );
  
  // Recalculate layout
  return applyHierarchicalLayout(updatedNodes, updatedEdges);
}

/**
 * Center and optimize the layout to fit the available space better
 */
export const optimizeLayout = (nodes: Node[]): Node[] => {
  if (nodes.length === 0) return nodes;
  
  // Find the bounds of the layout
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  nodes.forEach(node => {
    minX = Math.min(minX, node.position.x);
    maxX = Math.max(maxX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxY = Math.max(maxY, node.position.y);
  });
  
  // Calculate the center offset
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  // Create a new array of nodes with adjusted positions
  return nodes.map(node => ({
    ...node,
    position: {
      x: node.position.x - centerX,
      y: node.position.y - centerY
    }
  }));
};

/**
 * Creates API routes to support the org chart
 * 
 * Implement in /pages/api/organization/hierarchy.js:
 * 
 * ```js
 * import { MongoClient } from 'mongodb';
 * 
 * export default async function handler(req, res) {
 *   if (req.method !== 'GET') {
 *     return res.status(405).json({ message: 'Method not allowed' });
 *   }
 * 
 *   try {
 *     const uri = process.env.MONGODB_URI;
 *     const client = new MongoClient(uri);
 *     
 *     await client.connect();
 *     const db = client.db(process.env.MONGODB_DATABASE || "org_sim_db");
 *     
 *     // Query for all employees
 *     const employees = await db.collection("merged_output").find({}, {
 *       projection: {
 *         _id: 0,
 *         email: 1,
 *         firstName: 1,
 *         lastName: 1,
 *         jobTitle: 1,
 *         department: 1,
 *         avatar: 1,
 *         reportsTo: 1,
 *         attritionAssessment: 1,
 *         workSetting: 1
 *       }
 *     }).toArray();
 *     
 *     await client.close();
 *     
 *     return res.status(200).json(employees);
 *   } catch (error) {
 *     console.error('Error fetching organization data:', error);
 *     return res.status(500).json({ 
 *       message: 'Failed to fetch organization data',
 *       error: error.message
 *     });
 *   }
 * }
 * ```
 * 
 * And in /pages/api/organization/reporting.js:
 * 
 * ```js
 * import { MongoClient } from 'mongodb';
 * 
 * export default async function handler(req, res) {
 *   if (req.method !== 'PUT') {
 *     return res.status(405).json({ message: 'Method not allowed' });
 *   }
 * 
 *   try {
 *     const { employeeEmail, managerEmail } = req.body;
 *     
 *     if (!employeeEmail) {
 *       return res.status(400).json({ message: 'Employee email is required' });
 *     }
 *     
 *     const uri = process.env.MONGODB_URI;
 *     const client = new MongoClient(uri);
 *     
 *     await client.connect();
 *     const db = client.db(process.env.MONGODB_DATABASE || "org_sim_db");
 *     
 *     // Find the manager to get their name
 *     let managerInfo = null;
 *     if (managerEmail) {
 *       const manager = await db.collection("merged_output").findOne(
 *         { email: managerEmail },
 *         { projection: { _id: 0, firstName: 1, lastName: 1 } }
 *       );
 *       
 *       if (manager) {
 *         managerInfo = {
 *           email: managerEmail,
 *           name: `${manager.firstName || ''} ${manager.lastName || ''}`.trim()
 *         };
 *       }
 *     }
 *     
 *     // Update the employee's reportsTo field
 *     await db.collection("merged_output").updateOne(
 *       { email: employeeEmail },
 *       { $set: { reportsTo: managerInfo } }
 *     );
 *     
 *     // Also update in users collection if needed
 *     await db.collection("users").updateOne(
 *       { email: employeeEmail },
 *       { $set: { reportsTo: managerInfo } }
 *     );
 *     
 *     await client.close();
 *     
 *     return res.status(200).json({ 
 *       message: 'Reporting structure updated successfully' 
 *     });
 *   } catch (error) {
 *     console.error('Error updating reporting structure:', error);
 *     return res.status(500).json({ 
 *       message: 'Failed to update reporting structure',
 *       error: error.message
 *     });
 *   }
 * }
 * ```
 */
