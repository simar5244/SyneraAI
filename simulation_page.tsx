import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Button, 
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DoneIcon from '@mui/icons-material/Done';
import { OrgChart } from './org_chart_component';
import { Layout, OrgNode, NodeConnection, SimulationChange, ApiResponse } from './types';

// Simulated API calls - replace with actual API calls
const api = {
  getLayouts: async (): Promise<ApiResponse<Layout[]>> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      status: 'success',
      data: [
        { id: 1, name: 'Marketing Department', description: 'Marketing team structure', created_at: '2023-01-01', updated_at: '2023-01-15' },
        { id: 2, name: 'Engineering Team', description: 'Software engineering team organization', created_at: '2023-02-10', updated_at: '2023-02-20' },
      ]
    };
  },
  
  getLayout: async (id: number): Promise<ApiResponse<{layout: Layout, nodes: OrgNode[], connections: NodeConnection[]}>> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockNodes: OrgNode[] = [
      {
        id: 1,
        node_type: 'department',
        position: { x: 400, y: 100 },
        metadata: {
          name: 'Engineering',
          department: 'Engineering',
          skill_level: 10,
          workload_capacity: 150,
        },
        workload: 90,
      },
      {
        id: 2,
        node_type: 'person',
        position: { x: 200, y: 250 },
        metadata: {
          name: 'John Doe',
          role: 'Senior Developer',
          department: 'Engineering',
          skill_level: 9,
          workload_capacity: 100,
        },
        workload: 110,
      },
      {
        id: 3,
        node_type: 'person',
        position: { x: 400, y: 250 },
        metadata: {
          name: 'Jane Smith',
          role: 'Team Lead',
          department: 'Engineering',
          skill_level: 10,
          workload_capacity: 120,
        },
        workload: 115,
      },
      {
        id: 4,
        node_type: 'person',
        position: { x: 600, y: 250 },
        metadata: {
          name: 'Mike Johnson',
          role: 'Junior Developer',
          department: 'Engineering',
          skill_level: 6,
          workload_capacity: 90,
        },
        workload: 75,
      },
    ];
    
    const mockConnections: NodeConnection[] = [
      {
        id: 1,
        source_id: 1,
        target_id: 3,
        connection_type: 'reports_to',
        workload_impact: 10,
      },
      {
        id: 2,
        source_id: 3,
        target_id: 2,
        connection_type: 'reports_to',
        workload_impact: 15,
      },
      {
        id: 3,
        source_id: 3,
        target_id: 4,
        connection_type: 'reports_to',
        workload_impact: 20,
      },
    ];
    
    return {
      status: 'success',
      data: {
        layout: { id, name: id === 1 ? 'Marketing Department' : 'Engineering Team', description: 'Team organization', created_at: '2023-01-01', updated_at: '2023-01-15' },
        nodes: mockNodes,
        connections: mockConnections,
      }
    };
  },
  
  simulateChanges: async (layoutId: number, changes: SimulationChange): Promise<ApiResponse<{nodes: OrgNode[], connections: NodeConnection[], impact_score: number}>> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For demo purposes, we'll simulate the impact by changing workloads
    // Get the original layout first
    const originalLayout = await api.getLayout(layoutId);
    const originalNodes = originalLayout.data.nodes;
    const originalConnections = originalLayout.data.connections;
    
    // Create a copy and modify for simulation results
    const simulatedNodes = originalNodes.map(node => {
      // Apply any changes if the node is in the update list
      if (changes.node_updates && changes.node_updates.some(n => n.id === node.id)) {
        const updateNode = changes.node_updates.find(n => n.id === node.id);
        // Modify workload based on changes
        return {
          ...node,
          workload: Math.max(50, Math.min(130, node.workload + (Math.random() * 30 - 15))),
          metadata: {
            ...node.metadata,
            ...(updateNode?.metadata || {})
          }
        };
      }
      return {...node};
    });
    
    // Add any new nodes
    if (changes.node_additions) {
      changes.node_additions.forEach(node => {
        if (node.metadata && node.position && node.node_type) {
          simulatedNodes.push({
            id: Math.max(...originalNodes.map(n => n.id)) + Math.floor(Math.random() * 1000),
            node_type: node.node_type,
            position: node.position,
            metadata: node.metadata as any,
            workload: 50 + Math.random() * 30
          });
        }
      });
    }
    
    // Remove deleted nodes
    const filteredNodes = changes.node_deletions 
      ? simulatedNodes.filter(node => !changes.node_deletions?.includes(node.id))
      : simulatedNodes;
    
    // Handle connections
    let simulatedConnections = [...originalConnections];
    
    // Add any new connections
    if (changes.connection_additions) {
      changes.connection_additions.forEach(conn => {
        if (conn.source_id && conn.target_id) {
          simulatedConnections.push({
            id: Math.max(...originalConnections.map(c => c.id)) + Math.floor(Math.random() * 1000),
            source_id: conn.source_id,
            target_id: conn.target_id,
            connection_type: conn.connection_type || 'reports_to',
            workload_impact: conn.workload_impact || 10,
          });
        }
      });
    }
    
    // Remove deleted connections
    if (changes.connection_deletions) {
      simulatedConnections = simulatedConnections.filter(
        conn => !changes.connection_deletions?.includes(conn.id)
      );
    }
    
    // Also remove connections to deleted nodes
    if (changes.node_deletions) {
      simulatedConnections = simulatedConnections.filter(
        conn => !changes.node_deletions?.includes(conn.source_id) && 
               !changes.node_deletions?.includes(conn.target_id)
      );
    }
    
    // Calculate impact score (higher means more disruption)
    const impactScore = Math.floor(Math.random() * 100);
    
    return {
      status: 'success',
      data: {
        nodes: filteredNodes,
        connections: simulatedConnections,
        impact_score: impactScore
      }
    };
  },
  
  applyChanges: async (layoutId: number, changes: SimulationChange): Promise<ApiResponse<{layout: Layout, nodes: OrgNode[], connections: NodeConnection[]}>> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // In a real implementation, this would apply the changes to the actual layout
    // For demo purposes, we'll just return the simulated results
    const simulation = await api.simulateChanges(layoutId, changes);
    
    return {
      status: 'success',
      data: {
        layout: { 
          id: layoutId, 
          name: layoutId === 1 ? 'Marketing Department' : 'Engineering Team', 
          description: 'Team organization (Updated)', 
          created_at: '2023-01-01', 
          updated_at: new Date().toISOString() 
        },
        nodes: simulation.data.nodes,
        connections: simulation.data.connections
      }
    };
  }
};

export function SimulationPage() {
  // State
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<number | ''>('');
  const [originalLayout, setOriginalLayout] = useState<Layout | null>(null);
  const [originalNodes, setOriginalNodes] = useState<OrgNode[]>([]);
  const [originalConnections, setOriginalConnections] = useState<NodeConnection[]>([]);
  const [simulatedNodes, setSimulatedNodes] = useState<OrgNode[]>([]);
  const [simulatedConnections, setSimulatedConnections] = useState<NodeConnection[]>([]);
  const [impactScore, setImpactScore] = useState<number | null>(null);
  const [changes, setChanges] = useState<SimulationChange>({
    node_updates: [],
    node_additions: [],
    node_deletions: [],
    connection_additions: [],
    connection_deletions: []
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasSimulated, setHasSimulated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{open: boolean, message: string, severity: 'success' | 'error' | 'info'}>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Fetch layouts on component mount
  useEffect(() => {
    fetchLayouts();
  }, []);

  // Fetch layouts from API
  const fetchLayouts = async () => {
    setLoading(true);
    try {
      const response = await api.getLayouts();
      setLayouts(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching layouts:', error);
      setNotification({
        open: true,
        message: 'Failed to fetch layouts',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  // Fetch layout details
  const fetchLayoutDetails = async (layoutId: number) => {
    setLoading(true);
    try {
      const response = await api.getLayout(layoutId);
      setOriginalLayout(response.data.layout);
      setOriginalNodes(response.data.nodes);
      setOriginalConnections(response.data.connections);
      
      // Reset simulation
      setSimulatedNodes([]);
      setSimulatedConnections([]);
      setHasSimulated(false);
      setImpactScore(null);
      
      // Reset changes
      setChanges({
        node_updates: [],
        node_additions: [],
        node_deletions: [],
        connection_additions: [],
        connection_deletions: []
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching layout details:', error);
      setNotification({
        open: true,
        message: 'Failed to load layout details',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  // Handle layout selection
  const handleLayoutChange = (event: SelectChangeEvent<number | string>) => {
    const layoutId = event.target.value;
    setSelectedLayoutId(layoutId);
    
    if (typeof layoutId === 'number') {
      fetchLayoutDetails(layoutId);
    }
  };

  // Start the simulation
  const handleStartSimulation = () => {
    setIsSimulating(true);
    setNotification({
      open: true,
      message: 'Simulation mode activated. Make changes to the organization chart to see potential impacts.',
      severity: 'info'
    });
  };

  // Run the simulation
  const runSimulation = async () => {
    if (!originalLayout) return;
    
    setLoading(true);
    try {
      const response = await api.simulateChanges(originalLayout.id, changes);
      setSimulatedNodes(response.data.nodes);
      setSimulatedConnections(response.data.connections);
      setImpactScore(response.data.impact_score);
      setHasSimulated(true);
      setLoading(false);
      
      setNotification({
        open: true,
        message: 'Simulation completed successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error running simulation:', error);
      setNotification({
        open: true,
        message: 'Failed to run simulation',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  // Apply changes to the actual layout
  const applyChanges = async () => {
    if (!originalLayout) return;
    
    setLoading(true);
    try {
      const response = await api.applyChanges(originalLayout.id, changes);
      
      // Update the original layout with the applied changes
      setOriginalLayout(response.data.layout);
      setOriginalNodes(response.data.nodes);
      setOriginalConnections(response.data.connections);
      
      // Reset simulation state
      setSimulatedNodes([]);
      setSimulatedConnections([]);
      setHasSimulated(false);
      setIsSimulating(false);
      setImpactScore(null);
      
      // Clear changes
      setChanges({
        node_updates: [],
        node_additions: [],
        node_deletions: [],
        connection_additions: [],
        connection_deletions: []
      });
      
      setLoading(false);
      
      setNotification({
        open: true,
        message: 'Changes applied to organization successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error applying changes:', error);
      setNotification({
        open: true,
        message: 'Failed to apply changes',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  // Cancel simulation
  const cancelSimulation = () => {
    setIsSimulating(false);
    setHasSimulated(false);
    setSimulatedNodes([]);
    setSimulatedConnections([]);
    setImpactScore(null);
    
    // Clear changes
    setChanges({
      node_updates: [],
      node_additions: [],
      node_deletions: [],
      connection_additions: [],
      connection_deletions: []
    });
    
    setNotification({
      open: true,
      message: 'Simulation cancelled',
      severity: 'info'
    });
  };

  // Handle node operations in simulation mode
  const handleAddNode = (node: Partial<OrgNode>) => {
    if (!isSimulating) return;
    
    setChanges(prev => ({
      ...prev,
      node_additions: [...(prev.node_additions || []), node]
    }));
  };

  const handleUpdateNode = (node: OrgNode) => {
    if (!isSimulating) return;
    
    // Check if the node is already in the updates list
    const existingUpdateIndex = changes.node_updates?.findIndex(n => n.id === node.id);
    
    if (existingUpdateIndex !== undefined && existingUpdateIndex >= 0) {
      // Update existing entry
      const updatedChanges = {...changes};
      if (updatedChanges.node_updates) {
        updatedChanges.node_updates[existingUpdateIndex] = node;
        setChanges(updatedChanges);
      }
    } else {
      // Add new entry
      setChanges(prev => ({
        ...prev,
        node_updates: [...(prev.node_updates || []), node]
      }));
    }
  };

  const handleDeleteNode = (nodeId: number) => {
    if (!isSimulating) return;
    
    setChanges(prev => ({
      ...prev,
      node_deletions: [...(prev.node_deletions || []), nodeId]
    }));
  };

  // Handle connection operations in simulation mode
  const handleAddConnection = (connection: Partial<NodeConnection>) => {
    if (!isSimulating) return;
    
    setChanges(prev => ({
      ...prev,
      connection_additions: [...(prev.connection_additions || []), connection]
    }));
  };

  const handleDeleteConnection = (connectionId: number) => {
    if (!isSimulating) return;
    
    setChanges(prev => ({
      ...prev,
      connection_deletions: [...(prev.connection_deletions || []), connectionId]
    }));
  };

  // Handle close notification
  const handleCloseNotification = () => {
    setNotification({...notification, open: false});
  };

  // Helper to get impact score color
  const getImpactColor = (score: number) => {
    if (score < 30) return 'success';
    if (score < 70) return 'warning';
    return 'error';
  };

  return (
    <Container maxWidth={false} sx={{ height: 'calc(100vh - 64px)', padding: 2 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Organization Simulation
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Test potential changes to your organization structure and see their impact before applying them.
        </Typography>
      </Box>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="layout-select-label">Select Organization Layout</InputLabel>
              <Select
                labelId="layout-select-label"
                value={selectedLayoutId}
                onChange={handleLayoutChange}
                label="Select Organization Layout"
                disabled={isSimulating || loading}
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {layouts.map(layout => (
                  <MenuItem key={layout.id} value={layout.id}>
                    {layout.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              {!isSimulating ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleStartSimulation}
                  disabled={!originalLayout || loading}
                  startIcon={<CompareArrowsIcon />}
                >
                  Start Simulation
                </Button>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={cancelSimulation}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  {!hasSimulated ? (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={runSimulation}
                      disabled={loading}
                      startIcon={<VisibilityIcon />}
                    >
                      Run Simulation
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      color="success"
                      onClick={applyChanges}
                      disabled={loading}
                      startIcon={<DoneIcon />}
                    >
                      Apply Changes
                    </Button>
                  )}
                </>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
          <CircularProgress />
        </Box>
      ) : originalLayout ? (
        <Grid container spacing={3}>
          {/* Change summary */}
          {isSimulating && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Simulation Changes
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2">Node Updates: {changes.node_updates?.length || 0}</Typography>
                    <Typography variant="subtitle2">Node Additions: {changes.node_additions?.length || 0}</Typography>
                    <Typography variant="subtitle2">Node Deletions: {changes.node_deletions?.length || 0}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2">Connection Additions: {changes.connection_additions?.length || 0}</Typography>
                    <Typography variant="subtitle2">Connection Deletions: {changes.connection_deletions?.length || 0}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {impactScore !== null && (
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="subtitle2">Impact Score:</Typography>
                        <Chip 
                          label={`${impactScore}/100`} 
                          color={getImpactColor(impactScore)}
                          sx={{ fontSize: '1.1rem', padding: '20px 10px' }}
                        />
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          )}
          
          {/* Organization Chart */}
          <Grid item xs={12}>
            <Paper sx={{ height: 'calc(100vh - 320px)', p: 2 }}>
              {hasSimulated ? (
                <OrgChart 
                  nodes={simulatedNodes}
                  connections={simulatedConnections}
                  onNodeAdd={handleAddNode}
                  onNodeUpdate={handleUpdateNode}
                  onNodeDelete={handleDeleteNode}
                  onConnectionAdd={handleAddConnection}
                  onConnectionDelete={handleDeleteConnection}
                  readOnly={!isSimulating}
                />
              ) : (
                <OrgChart 
                  nodes={originalNodes}
                  connections={originalConnections}
                  onNodeAdd={handleAddNode}
                  onNodeUpdate={handleUpdateNode}
                  onNodeDelete={handleDeleteNode}
                  onConnectionAdd={handleAddConnection}
                  onConnectionDelete={handleDeleteConnection}
                  readOnly={!isSimulating}
                />
              )}
            </Paper>
          </Grid>
        </Grid>
      ) : (
        <Paper sx={{ p: 3, textAlign: 'center', mt: 5 }}>
          <Typography variant="body1">
            Please select an organization layout to start a simulation.
          </Typography>
        </Paper>
      )}
      
      {/* Notification Snackbar */}
      <Snackbar 
        open={notification.open} 
        autoHideDuration={6000} 
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
} 