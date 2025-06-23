import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useResizeObserver } from './hooks/useResizeObserver';
import { NodeMetadata, OrgNode, NodeConnection } from './types';
import { Button, Dialog, DialogContent, DialogTitle, TextField, IconButton, Box, Typography, Paper, Slider, Grid } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import EmojiPeopleIcon from '@mui/icons-material/EmojiPeople';
import BusinessIcon from '@mui/icons-material/Business';
import { useTheme } from '@mui/material/styles';

interface OrgChartProps {
  nodes: OrgNode[];
  connections: NodeConnection[];
  onNodeAdd?: (node: Partial<OrgNode>) => void;
  onNodeUpdate?: (node: OrgNode) => void;
  onNodeDelete?: (id: number) => void;
  onConnectionAdd?: (connection: Partial<NodeConnection>) => void;
  onConnectionDelete?: (id: number) => void;
  readOnly?: boolean;
}

const NODE_TYPES = {
  PERSON: 'person',
  DEPARTMENT: 'department',
  ROLE: 'role'
};

const NODE_COLORS = {
  [NODE_TYPES.PERSON]: '#4285F4',
  [NODE_TYPES.DEPARTMENT]: '#EA4335',
  [NODE_TYPES.ROLE]: '#34A853'
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

export const OrgChart: React.FC<OrgChartProps> = ({
  nodes,
  connections,
  onNodeAdd,
  onNodeUpdate,
  onNodeDelete,
  onConnectionAdd,
  onConnectionDelete,
  readOnly = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dimensions = useResizeObserver(wrapperRef);
  const theme = useTheme();
  
  // State for interactive features
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [newNodePosition, setNewNodePosition] = useState({ x: 0, y: 0 });
  const [connectionMode, setConnectionMode] = useState(false);
  const [sourceNode, setSourceNode] = useState<OrgNode | null>(null);
  const [zoom, setZoom] = useState<d3.ZoomBehavior<Element, unknown> | null>(null);
  const [isCreatingNode, setIsCreatingNode] = useState(false);
  const [newNodeType, setNewNodeType] = useState(NODE_TYPES.PERSON);
  const [nodeForm, setNodeForm] = useState<Partial<NodeMetadata>>({
    name: '',
    role: '',
    department: '',
    skill_level: 5,
    workload_capacity: 100,
  });

  // Handle zoom behavior
  useEffect(() => {
    if (!svgRef.current || !dimensions) return;

    const svg = d3.select(svgRef.current);
    
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        const transform = event.transform;
        d3.select(svgRef.current).select('g').attr('transform', transform.toString());
      });

    svg.call(zoomBehavior);
    setZoom(zoomBehavior);

    // Center the view
    const initialScale = 0.8;
    const initialTranslate = [dimensions.width / 2, dimensions.height / 2];
    zoomBehavior.transform(
      svg, 
      d3.zoomIdentity
        .translate(initialTranslate[0], initialTranslate[1])
        .scale(initialScale)
    );

    return () => {
      svg.on('.zoom', null);
    };
  }, [dimensions]);

  // Create a simulation for node positioning
  const simulation = useRef<d3.Simulation<OrgNode, NodeConnection> | null>(null);

  // Draw the chart
  useEffect(() => {
    if (!svgRef.current || !dimensions || !zoom || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select('g');

    // Clear previous elements
    g.selectAll('.link').remove();
    g.selectAll('.node').remove();

    // Create links
    const links = g
      .selectAll('.link')
      .data(connections)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrowhead)');

    // Create nodes
    const nodeElements = g
      .selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.position.x}, ${d.position.y})`)
      .call(d3.drag<SVGGElement, OrgNode>()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded)
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        handleNodeClick(d);
      });

    // Add node rectangle
    nodeElements
      .append('rect')
      .attr('width', NODE_WIDTH)
      .attr('height', NODE_HEIGHT)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('fill', d => NODE_COLORS[d.node_type] || NODE_COLORS[NODE_TYPES.PERSON])
      .attr('stroke', '#333')
      .attr('stroke-width', d => d.workload > 100 ? 3 : 1)
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke-width', 3)
          .attr('stroke', theme.palette.secondary.main);
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('stroke-width', d.workload > 100 ? 3 : 1)
          .attr('stroke', '#333');
      });

    // Add text for node name
    nodeElements
      .append('text')
      .attr('x', NODE_WIDTH / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .text(d => d.metadata.name || 'Unnamed');

    // Add text for role
    nodeElements
      .append('text')
      .attr('x', NODE_WIDTH / 2)
      .attr('y', 45)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .text(d => d.metadata.role || '');

    // Add workload indicator
    nodeElements
      .append('text')
      .attr('x', NODE_WIDTH / 2)
      .attr('y', 65)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .text(d => `Workload: ${Math.round(d.workload)}`);

    // Add delete button if not in read-only mode
    if (!readOnly) {
      nodeElements
        .append('circle')
        .attr('cx', NODE_WIDTH)
        .attr('cy', 0)
        .attr('r', 10)
        .attr('fill', 'red')
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('click', (event, d) => {
          event.stopPropagation();
          if (onNodeDelete) onNodeDelete(d.id);
        });

      nodeElements
        .append('text')
        .attr('x', NODE_WIDTH)
        .attr('y', 4)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '14px')
        .text('×')
        .style('cursor', 'pointer')
        .on('click', (event, d) => {
          event.stopPropagation();
          if (onNodeDelete) onNodeDelete(d.id);
        });
    }

    // Update link positions
    function updateLinkPositions() {
      links.attr('d', d => {
        const source = nodes.find(n => n.id === d.source_id);
        const target = nodes.find(n => n.id === d.target_id);
        if (!source || !target) return '';

        const sx = source.position.x + NODE_WIDTH / 2;
        const sy = source.position.y + NODE_HEIGHT / 2;
        const tx = target.position.x + NODE_WIDTH / 2;
        const ty = target.position.y + NODE_HEIGHT / 2;

        return `M${sx},${sy} C${(sx + tx) / 2},${sy} ${(sx + tx) / 2},${ty} ${tx},${ty}`;
      });
    }
    
    updateLinkPositions();

    // Set up simulation
    if (!simulation.current) {
      simulation.current = d3.forceSimulation<OrgNode, NodeConnection>(nodes)
        .force('link', d3.forceLink<OrgNode, NodeConnection>()
          .id(d => d.id.toString())
          .links(connections.map(c => ({ 
            source: c.source_id.toString(), 
            target: c.target_id.toString(), 
            ...c 
          })))
          .distance(200)
        )
        .force('charge', d3.forceManyBody().strength(-500))
        .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
        .force('collision', d3.forceCollide().radius(NODE_WIDTH))
        .on('tick', () => {
          nodeElements.attr('transform', d => `translate(${d.position.x}, ${d.position.y})`);
          updateLinkPositions();
        });
    } else {
      // Update the simulation with new data
      simulation.current.nodes(nodes);
      const linkForce = simulation.current.force('link') as d3.ForceLink<OrgNode, NodeConnection>;
      if (linkForce) {
        linkForce.links(connections.map(c => ({ 
          source: c.source_id.toString(), 
          target: c.target_id.toString(), 
          ...c 
        })));
      }
      simulation.current.alpha(0.3).restart();
    }

    // Drag functions
    function dragStarted(event: any, d: OrgNode) {
      if (readOnly) return;
      
      if (connectionMode && sourceNode === null) {
        setSourceNode(d);
        return;
      }
      
      if (!event.active) simulation.current?.alphaTarget(0.3).restart();
      d.fx = d.position.x;
      d.fy = d.position.y;
    }

    function dragged(event: any, d: OrgNode) {
      if (readOnly) return;
      if (connectionMode && sourceNode !== null) return;

      d.fx = event.x;
      d.fy = event.y;
      d.position.x = event.x;
      d.position.y = event.y;
    }

    function dragEnded(event: any, d: OrgNode) {
      if (readOnly) return;
      
      if (connectionMode && sourceNode !== null && sourceNode.id !== d.id) {
        if (onConnectionAdd) {
          onConnectionAdd({
            source_id: sourceNode.id,
            target_id: d.id,
            connection_type: 'reports_to',
            workload_impact: 10.0
          });
        }
        setConnectionMode(false);
        setSourceNode(null);
        return;
      }
      
      if (!event.active) simulation.current?.alphaTarget(0);
      d.fx = null;
      d.fy = null;
      
      if (onNodeUpdate) {
        onNodeUpdate(d);
      }
    }

    // Handle background click to add a new node
    if (!readOnly) {
      svg.on('click', function(event) {
        if (isCreatingNode) {
          const [x, y] = d3.pointer(event);
          const transform = d3.zoomTransform(svg.node() as Element);
          
          // Convert from screen coordinates to chart coordinates
          const chartX = (x - transform.x) / transform.k;
          const chartY = (y - transform.y) / transform.k;
          
          setNewNodePosition({ x: chartX - NODE_WIDTH / 2, y: chartY - NODE_HEIGHT / 2 });
          setNodeDialogOpen(true);
        }
      });
    }

  }, [nodes, connections, dimensions, zoom, readOnly, connectionMode, sourceNode, isCreatingNode, onNodeUpdate, onNodeDelete, onConnectionAdd, theme]);

  // Handle node click
  const handleNodeClick = (node: OrgNode) => {
    if (readOnly) return;
    
    if (connectionMode && sourceNode !== null) {
      if (sourceNode.id !== node.id) {
        if (onConnectionAdd) {
          onConnectionAdd({
            source_id: sourceNode.id,
            target_id: node.id,
            connection_type: 'reports_to',
            workload_impact: 10.0
          });
        }
      }
      setConnectionMode(false);
      setSourceNode(null);
      return;
    }
    
    setEditingNode(node);
    setNodeForm({
      name: node.metadata.name || '',
      role: node.metadata.role || '',
      department: node.metadata.department || '',
      skill_level: node.metadata.skill_level || 5,
      workload_capacity: node.metadata.workload_capacity || 100,
    });
    setNodeDialogOpen(true);
  };

  // Toggle connection mode
  const toggleConnectionMode = () => {
    setConnectionMode(!connectionMode);
    if (connectionMode) {
      setSourceNode(null);
    }
  };

  // Toggle adding a new node
  const toggleAddingNode = (type: string) => {
    setIsCreatingNode(!isCreatingNode);
    setNewNodeType(type);
    
    // Reset form
    setNodeForm({
      name: '',
      role: '',
      department: '',
      skill_level: 5,
      workload_capacity: 100,
    });
  };

  // Handle node form change
  const handleNodeFormChange = (field: string, value: any) => {
    setNodeForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Submit node form
  const handleNodeFormSubmit = () => {
    if (editingNode) {
      // Update existing node
      if (onNodeUpdate) {
        onNodeUpdate({
          ...editingNode,
          metadata: {
            ...editingNode.metadata,
            ...nodeForm
          }
        });
      }
    } else {
      // Create new node
      if (onNodeAdd) {
        onNodeAdd({
          node_type: newNodeType,
          position: newNodePosition,
          metadata: nodeForm as NodeMetadata
        });
      }
    }
    
    setNodeDialogOpen(false);
    setEditingNode(null);
    setIsCreatingNode(false);
  };

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg ref={svgRef} width="100%" height="100%">
        <defs>
          <marker
            id="arrowhead"
            viewBox="0 -5 10 10"
            refX="8"
            refY="0"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="#999" />
          </marker>
        </defs>
        <g />
      </svg>

      {!readOnly && (
        <Paper 
          elevation={3} 
          sx={{ 
            position: 'absolute', 
            top: 20, 
            right: 20, 
            padding: 2,
            zIndex: 1000
          }}
        >
          <Typography variant="h6" gutterBottom>
            Tools
          </Typography>
          
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <Button
                variant={connectionMode ? "contained" : "outlined"}
                color="secondary"
                fullWidth
                startIcon={<AccountTreeIcon />}
                onClick={toggleConnectionMode}
              >
                {connectionMode ? "Cancel Connection" : "Create Connection"}
              </Button>
            </Grid>
            
            <Grid item xs={12}>
              <Button
                variant={isCreatingNode && newNodeType === NODE_TYPES.PERSON ? "contained" : "outlined"}
                color="primary"
                fullWidth
                startIcon={<EmojiPeopleIcon />}
                onClick={() => toggleAddingNode(NODE_TYPES.PERSON)}
              >
                Add Person
              </Button>
            </Grid>
            
            <Grid item xs={12}>
              <Button
                variant={isCreatingNode && newNodeType === NODE_TYPES.DEPARTMENT ? "contained" : "outlined"}
                color="primary"
                fullWidth
                startIcon={<BusinessIcon />}
                onClick={() => toggleAddingNode(NODE_TYPES.DEPARTMENT)}
              >
                Add Department
              </Button>
            </Grid>
            
            <Grid item xs={12}>
              <Typography id="zoom-slider" gutterBottom>
                Zoom
              </Typography>
              <Slider
                aria-labelledby="zoom-slider"
                min={10}
                max={200}
                defaultValue={100}
                valueLabelDisplay="auto"
                onChange={(_, value) => {
                  if (zoom && svgRef.current) {
                    const newScale = (value as number) / 100;
                    const svg = d3.select(svgRef.current);
                    const currentTransform = d3.zoomTransform(svg.node() as Element);
                    const newTransform = d3.zoomIdentity
                      .translate(currentTransform.x, currentTransform.y)
                      .scale(newScale);
                    zoom.transform(svg, newTransform);
                  }
                }}
              />
            </Grid>
          </Grid>

          {connectionMode && sourceNode && (
            <Box mt={2} p={1} bgcolor="info.main" color="info.contrastText" borderRadius={1}>
              <Typography variant="body2">
                Select a target node to create a connection from{' '}
                <strong>{sourceNode.metadata.name}</strong>
              </Typography>
            </Box>
          )}

          {isCreatingNode && (
            <Box mt={2} p={1} bgcolor="info.main" color="info.contrastText" borderRadius={1}>
              <Typography variant="body2">
                Click anywhere on the chart to place a new {newNodeType}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      <Dialog open={nodeDialogOpen} onClose={() => setNodeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingNode ? `Edit ${editingNode.metadata.name}` : `Add New ${newNodeType}`}
          <IconButton
            aria-label="close"
            onClick={() => setNodeDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }} noValidate autoComplete="off">
            <TextField
              label="Name"
              fullWidth
              margin="normal"
              value={nodeForm.name}
              onChange={(e) => handleNodeFormChange('name', e.target.value)}
            />
            <TextField
              label="Role"
              fullWidth
              margin="normal"
              value={nodeForm.role}
              onChange={(e) => handleNodeFormChange('role', e.target.value)}
            />
            <TextField
              label="Department"
              fullWidth
              margin="normal"
              value={nodeForm.department}
              onChange={(e) => handleNodeFormChange('department', e.target.value)}
            />
            
            <Typography id="skill-level-slider" gutterBottom sx={{ mt: 2 }}>
              Skill Level: {nodeForm.skill_level}
            </Typography>
            <Slider
              aria-labelledby="skill-level-slider"
              min={1}
              max={10}
              step={1}
              marks
              value={nodeForm.skill_level || 5}
              onChange={(_, value) => handleNodeFormChange('skill_level', value as number)}
            />
            
            <Typography id="workload-capacity-slider" gutterBottom sx={{ mt: 2 }}>
              Workload Capacity: {nodeForm.workload_capacity}
            </Typography>
            <Slider
              aria-labelledby="workload-capacity-slider"
              min={0}
              max={200}
              step={10}
              value={nodeForm.workload_capacity || 100}
              onChange={(_, value) => handleNodeFormChange('workload_capacity', value as number)}
            />
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setNodeDialogOpen(false)} sx={{ mr: 1 }}>
                Cancel
              </Button>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleNodeFormSubmit}
                disabled={!nodeForm.name}
              >
                {editingNode ? 'Update' : 'Add'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Hook for detecting resize
export function useResizeObserver(ref: React.RefObject<HTMLElement>) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const observeTarget = ref.current;
    if (!observeTarget) return;

    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      });
    });

    resizeObserver.observe(observeTarget);
    return () => {
      resizeObserver.unobserve(observeTarget);
    };
  }, [ref]);

  return dimensions;
} 