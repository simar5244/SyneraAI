import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Button, 
  TextField, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Grid,
  List,
  ListItem,
  ListItemText, 
  ListItemSecondaryAction,
  IconButton,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
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
  
  createLayout: async (data: {name: string, description?: string}): Promise<ApiResponse<Layout>> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      status: 'success',
      data: { 
        id: Math.floor(Math.random() * 1000), 
        name: data.name, 
        description: data.description, 
        created_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      }
    };
  },
  
  updateLayout: async (id: number, data: {name?: string, description?: string}): Promise<ApiResponse<Layout>> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      status: 'success',
      data: { 
        id, 
        name: data.name || 'Updated Layout', 
        description: data.description, 
        created_at: '2023-01-01', 
        updated_at: new Date().toISOString() 
      }
    };
  },
  
  deleteLayout: async (id: number): Promise<ApiResponse<{success: boolean}>> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      status: 'success',
      data: { success: true }
    };
  },
  
  addNode: async (layoutId: number, node: Partial<OrgNode>): Promise<ApiResponse<OrgNode>> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      status: 'success',
      data: {
        id: Math.floor(Math.random() * 1000),
        node_type: node.node_type || 'person',
        position: node.position || { x: 0, y: 0 },
        metadata: node.metadata || { 
          name: 'New Node', 
          role: '', 
          department: '', 
          skill_level: 5, 
          workload_capacity: 100 
        },
        workload: 50,
      }
    };
  },
  
  updateNode: async (layoutId: number, node: OrgNode): Promise<ApiResponse<OrgNode>> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      status: 'success',
      data: node
    };
  },
  
  deleteNode: async (layoutId: number, nodeId: number): Promise<ApiResponse<{success: boolean}>> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      status: 'success',
      data: { success: true }
    };
  },
  
  addConnection: async (layoutId: number, connection: Partial<NodeConnection>): Promise<ApiResponse<NodeConnection>> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      status: 'success',
      data: {
        id: Math.floor(Math.random() * 1000),
        source_id: connection.source_id || 0,
        target_id: connection.target_id || 0,
        connection_type: connection.connection_type || 'reports_to',
        workload_impact: connection.workload_impact || 10,
      }
    };
  },
  
  deleteConnection: async (layoutId: number, connectionId: number): Promise<ApiResponse<{success: boolean}>> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      status: 'success',
      data: { success: true }
    };
  },
  
  simulateChanges: async (layoutId: number, changes: SimulationChange): Promise<ApiResponse<{nodes: OrgNode[], connections: NodeConnection[], impact_score: number}>> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      status: 'success',
      data: {
        nodes: [],  // This would be filled with the updated nodes after simulation
        connections: [],  // This would be filled with the updated connections after simulation
        impact_score: Math.random() * 100, // Simulation impact score
      }
    };
  },
  
  getOptimizationSuggestions: async (layoutId: number): Promise<ApiResponse<{suggestions: string[]}>> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      status: 'success',
      data: {
        suggestions: [
          "Redistribute workload from Jane Smith (115%) to Mike Johnson (75%)",
          "Consider adding another team member to Engineering department",
          "Reorganize reporting structure to reduce management overhead"
        ]
      }
    };
  }
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`layout-tabpanel-${index}`}
      aria-labelledby={`layout-tab-${index}`}
      {...other}
      style={{ height: 'calc(100% - 48px)', overflow: 'auto' }}
    >
      {value === index && children}
    </div>
  );
}

export function LayoutManager() {
  // State
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<Layout | null>(null);
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [connections, setConnections] = useState<NodeConnection[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [newLayoutDescription, setNewLayoutDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [notification, setNotification] = useState<{open: boolean, message: string, severity: 'success' | 'error'}>({
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
      setSelectedLayout(response.data.layout);
      setNodes(response.data.nodes);
      setConnections(response.data.connections);
      setTabValue(1); // Switch to the edit tab
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
  const handleLayoutSelect = (layout: Layout) => {
    fetchLayoutDetails(layout.id);
  };

  // Create new layout
  const handleCreateLayout = async () => {
    if (!newLayoutName.trim()) return;
    
    setLoading(true);
    try {
      const response = await api.createLayout({
        name: newLayoutName,
        description: newLayoutDescription
      });
      
      setLayouts([...layouts, response.data]);
      setCreateDialogOpen(false);
      setNewLayoutName('');
      setNewLayoutDescription('');
      setNotification({
        open: true,
        message: 'Layout created successfully',
        severity: 'success'
      });
      
      // Automatically select the new layout
      handleLayoutSelect(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error creating layout:', error);
      setNotification({
        open: true,
        message: 'Failed to create layout',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  // Update existing layout
  const handleUpdateLayout = async () => {
    if (!selectedLayout || !newLayoutName.trim()) return;
    
    setLoading(true);
    try {
      const response = await api.updateLayout(selectedLayout.id, {
        name: newLayoutName,
        description: newLayoutDescription
      });
      
      const updatedLayouts = layouts.map(l => 
        l.id === selectedLayout.id ? response.data : l
      );
      
      setLayouts(updatedLayouts);
      setSelectedLayout(response.data);
      setEditDialogOpen(false);
      setNotification({
        open: true,
        message: 'Layout updated successfully',
        severity: 'success'
      });
      setLoading(false);
    } catch (error) {
      console.error('Error updating layout:', error);
      setNotification({
        open: true,
        message: 'Failed to update layout',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  // Delete layout
  const handleDeleteLayout = async () => {
    if (!selectedLayout) return;
    
    setLoading(true);
    try {
      await api.deleteLayout(selectedLayout.id);
      
      const filteredLayouts = layouts.filter(l => l.id !== selectedLayout.id);
      setLayouts(filteredLayouts);
      setSelectedLayout(null);
      setNodes([]);
      setConnections([]);
      setDeleteDialogOpen(false);
      setTabValue(0); // Switch back to layouts list
      setNotification({
        open: true,
        message: 'Layout deleted successfully',
        severity: 'success'
      });
      setLoading(false);
    } catch (error) {
      console.error('Error deleting layout:', error);
      setNotification({
        open: true,
        message: 'Failed to delete layout',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  // Handle node operations
  const handleAddNode = async (node: Partial<OrgNode>) => {
    if (!selectedLayout) return;
    
    setLoading(true);
    try {
      const response = await api.addNode(selectedLayout.id, node);
      setNodes([...nodes, response.data]);
      setNotification({
        open: true,
        message: 'Node added successfully',
        severity: 'success'
      });
      setLoading(false);
    } catch (error) {
      console.error('Error adding node:', error);
      setNotification({
        open: true,
        message: 'Failed to add node',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  const handleUpdateNode = async (node: OrgNode) => {
    if (!selectedLayout) return;
    
    setLoading(true);
    try {
      const response = await api.updateNode(selectedLayout.id, node);
      const updatedNodes = nodes.map(n => n.id === node.id ? response.data : n);
      setNodes(updatedNodes);
      setLoading(false);
    } catch (error) {
      console.error('Error updating node:', error);
      setNotification({
        open: true,
        message: 'Failed to update node',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  const handleDeleteNode = async (nodeId: number) => {
    if (!selectedLayout) return;
    
    setLoading(true);
    try {
      await api.deleteNode(selectedLayout.id, nodeId);
      
      // Remove the node
      const updatedNodes = nodes.filter(n => n.id !== nodeId);
      setNodes(updatedNodes);
      
      // Remove any connections to/from this node
      const updatedConnections = connections.filter(
        c => c.source_id !== nodeId && c.target_id !== nodeId
      );
      setConnections(updatedConnections);
      
      setLoading(false);
    } catch (error) {
      console.error('Error deleting node:', error);
      setNotification({
        open: true,
        message: 'Failed to delete node',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  // Handle connection operations
  const handleAddConnection = async (connection: Partial<NodeConnection>) => {
    if (!selectedLayout) return;
    
    setLoading(true);
    try {
      const response = await api.addConnection(selectedLayout.id, connection);
      setConnections([...connections, response.data]);
      setLoading(false);
    } catch (error) {
      console.error('Error adding connection:', error);
      setNotification({
        open: true,
        message: 'Failed to add connection',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  const handleDeleteConnection = async (connectionId: number) => {
    if (!selectedLayout) return;
    
    setLoading(true);
    try {
      await api.deleteConnection(selectedLayout.id, connectionId);
      const updatedConnections = connections.filter(c => c.id !== connectionId);
      setConnections(updatedConnections);
      setLoading(false);
    } catch (error) {
      console.error('Error deleting connection:', error);
      setNotification({
        open: true,
        message: 'Failed to delete connection',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  // Get optimization suggestions
  const handleGetOptimizationSuggestions = async () => {
    if (!selectedLayout) return;
    
    setLoading(true);
    try {
      const response = await api.getOptimizationSuggestions(selectedLayout.id);
      setOptimizationSuggestions(response.data.suggestions);
      setShowSuggestions(true);
      setLoading(false);
    } catch (error) {
      console.error('Error getting optimization suggestions:', error);
      setNotification({
        open: true,
        message: 'Failed to get optimization suggestions',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  // Handle UI interactions
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEditClick = (layout: Layout) => {
    setSelectedLayout(layout);
    setNewLayoutName(layout.name);
    setNewLayoutDescription(layout.description || '');
    setEditDialogOpen(true);
  };

  const handleCloseNotification = () => {
    setNotification({...notification, open: false});
  };

  return (
    <Container maxWidth={false} sx={{ height: 'calc(100vh - 64px)', padding: 2 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Layouts" />
          {selectedLayout && <Tab label={`Edit: ${selectedLayout.name}`} />}
        </Tabs>
      </Box>
      
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h1">Organization Layouts</Typography>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            New Layout
          </Button>
        </Box>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List>
            {layouts.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body1">
                  No layouts found. Create a new layout to get started.
                </Typography>
              </Paper>
            ) : (
              layouts.map(layout => (
                <Paper key={layout.id} sx={{ mb: 2, overflow: 'hidden' }}>
                  <ListItem button onClick={() => handleLayoutSelect(layout)}>
                    <ListItemText 
                      primary={layout.name} 
                      secondary={
                        <>
                          {layout.description && <span>{layout.description}<br/></span>}
                          <span>Created: {new Date(layout.created_at).toLocaleDateString()}</span>
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleEditClick(layout)}>
                        <EditIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Paper>
              ))
            )}
          </List>
        )}
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        {selectedLayout && (
          <>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h5" component="h1">{selectedLayout.name}</Typography>
              <Box>
                <Button 
                  variant="outlined" 
                  color="secondary" 
                  startIcon={<AutoFixHighIcon />}
                  onClick={handleGetOptimizationSuggestions}
                  sx={{ mr: 2 }}
                >
                  Get Optimization Suggestions
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete Layout
                </Button>
              </Box>
            </Box>
            
            {showSuggestions && (
              <Paper sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">Optimization Suggestions</Typography>
                  <IconButton onClick={() => setShowSuggestions(false)}>
                    <CloseIcon />
                  </IconButton>
                </Box>
                <List>
                  {optimizationSuggestions.map((suggestion, index) => (
                    <ListItem key={index}>
                      <ListItemText primary={suggestion} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ height: 'calc(100% - 60px)' }}>
                <OrgChart 
                  nodes={nodes}
                  connections={connections}
                  onNodeAdd={handleAddNode}
                  onNodeUpdate={handleUpdateNode}
                  onNodeDelete={handleDeleteNode}
                  onConnectionAdd={handleAddConnection}
                  onConnectionDelete={handleDeleteConnection}
                />
              </Box>
            )}
          </>
        )}
      </TabPanel>
      
      {/* Create Layout Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>Create New Layout</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Layout Name"
            fullWidth
            value={newLayoutName}
            onChange={(e) => setNewLayoutName(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Description (Optional)"
            fullWidth
            multiline
            rows={4}
            value={newLayoutDescription}
            onChange={(e) => setNewLayoutDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateLayout} 
            variant="contained" 
            color="primary"
            disabled={!newLayoutName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Edit Layout Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Layout</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Layout Name"
            fullWidth
            value={newLayoutName}
            onChange={(e) => setNewLayoutName(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Description (Optional)"
            fullWidth
            multiline
            rows={4}
            value={newLayoutDescription}
            onChange={(e) => setNewLayoutDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUpdateLayout} 
            variant="contained" 
            color="primary"
            disabled={!newLayoutName.trim()}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Layout Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Layout</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the layout "{selectedLayout?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteLayout} 
            variant="contained" 
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
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