/**
 * Utility functions for working with ReactFlow graph data
 */

/**
 * Get a node by its ID
 * @param nodes Array of nodes
 * @param id ID of the node to find
 * @returns The node with the specified ID or undefined
 */
export const getNodesById = (nodes: any[], id: string) => {
  return nodes.find(node => node.id === id);
};

/**
 * Get edges connected to a node
 * @param edges Array of edges
 * @param id ID of the node
 * @returns Array of edges connected to the specified node
 */
export const getEdgesById = (edges: any[], id: string) => {
  return edges.filter(edge => edge.source === id || edge.target === id);
};

/**
 * Create a simple graph builder function
 * @param nodes Array of node data objects
 * @param edges Array of edge data objects
 * @returns Object with nodes and edges in ReactFlow format
 */
export const buildGraph = (nodes: any[], edges: any[]) => {
  const flowNodes = nodes.map((node) => ({
    id: node.id || node.email,
    type: 'customNode',
    data: node,
    position: node.position || { x: 0, y: 0 },
  }));
  
  const flowEdges = edges.map((edge, index) => ({
    id: edge.id || `edge-${index}`,
    source: edge.source,
    target: edge.target,
    type: 'customEdge',
    data: edge.data || {},
  }));
  
  return {
    nodes: flowNodes,
    edges: flowEdges
  };
}; 