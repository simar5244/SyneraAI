import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Avatar, 
  Card,
  CardContent,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  IconButton
} from '@mui/material';
import { 
  PersonOutline, 
  Business, 
  CalendarToday, 
  WorkOutline, 
  AssignmentOutline,
  WarningAmber,
  CheckCircleOutline,
  DeleteOutline,
  Close as CloseIcon
} from '@mui/icons-material';
import ReactFlow, { 
  Controls, 
  Background,
  useNodesState,
  useEdgesState,
  MiniMap
} from 'reactflow';
import 'reactflow/dist/style.css';
import { orgSimulationService } from '../services/orgSimulationService';
import useAuth from '@/hooks/useAuth';

// Custom node component for employee visualization
const EmployeeNode = ({ data }) => {
  const stressColor = getStressLevelColor(data.stressLevel);
  
  return (
    <Card
      sx={{ 
        width: 200, 
        border: `2px solid ${stressColor}`,
        boxShadow: `0 0 8px ${stressColor}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'scale(1.05)',
          boxShadow: `0 0 12px ${stressColor}`
        }
      }}
    >
      <CardContent sx={{ p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Avatar 
            src={data.avatar || '/default-avatar.png'} 
            sx={{ width: 40, height: 40, mr: 1 }}
          />
          <Box>
            <Typography variant="subtitle1" noWrap>
              {data.name}
            </Typography>
            <Typography variant="caption" color="textSecondary" noWrap>
              {data.position}
            </Typography>
          </Box>
        </Box>
        
        <Divider sx={{ my: 1 }} />
        
        <Typography variant="caption" display="block" color="textSecondary">
          <Business fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
          {data.department}
        </Typography>
        
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Chip 
            label={`${data.totalHours}h`} 
            size="small" 
            sx={{ 
              bgcolor: stressColor,
              color: getTextColorForBackground(stressColor)
            }} 
          />
          <Typography variant="caption">
            {data.directReports.length > 0 ? `${data.directReports.length} reports` : 'No reports'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// Helper function to get color based on stress level
const getStressLevelColor = (stressLevel) => {
  switch(stressLevel) {
    case 'high_overload':
      return '#ff0000'; // Red
    case 'medium_overload':
      return '#ff4500'; // Deep Orange
    case 'low_overload':
      return '#ff8c00'; // Orange
    case 'slight_overload':
      return '#ffa500'; // Light Orange
    case 'high_underload':
      return '#0000ff'; // Deep Blue
    case 'underload':
      return '#4169e1'; // Blue
    case 'normal':
    default:
      return '#e0e0e0'; // Light Gray
  }
};

// Helper function to determine text color based on background color
const getTextColorForBackground = (backgroundColor) => {
  // Dark backgrounds need light text
  const darkColors = ['#ff0000', '#ff4500', '#ff8c00', '#0000ff', '#4169e1'];
  return darkColors.includes(backgroundColor) ? '#ffffff' : '#000000';
};

// Node types configuration for ReactFlow
const nodeTypes = {
  employee: EmployeeNode
};

const OrgSimulationPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orgData, setOrgData] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Selected employee for detailed view
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Dragging state
  const [draggedEmployee, setDraggedEmployee] = useState(null);
  const [dragTargetManager, setDragTargetManager] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  
  // Deletion simulation
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deletionSimulation, setDeletionSimulation] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Refs for ReactFlow instance
  const reactFlowInstance = useRef(null);
  
  // Access control - check if user has top management role
  const hasAccess = () => {
    const topManagementRoles = ['eco', 'top_mgmt_t1', 'top_mgmt_t2', 'top_mgmt_t3'];
    return user && topManagementRoles.includes(user.role);
  };
  
  // Load organization data
  useEffect(() => {
    const fetchOrgData = async () => {
      if (!hasAccess()) {
        setError('Access denied. Only top management can view this page.');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const data = await orgSimulationService.getOrgStructure();
        setOrgData(data);
        
        // Transform data for ReactFlow
        transformOrgDataToGraph(data);
        
      } catch (err) {
        setError(err.message || 'Failed to load organization data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrgData();
  }, []);
  
  // Transform organizational data to ReactFlow format
  const transformOrgDataToGraph = (data) => {
    if (!data || !data.org_structure) return;
    
    const orgStructure = data.org_structure;
    const flowNodes = [];
    const flowEdges = [];
    
    // Create nodes for each employee
    Object.values(orgStructure).forEach((employee, index) => {
      const node = {
        id: employee.id,
        type: 'employee',
        position: { x: 0, y: 0 }, // Position will be set by layout algorithm
        data: {
          id: employee.id,
          name: employee.name,
          position: employee.position,
          department: employee.department,
          departmentId: employee.department_id,
          skills: employee.skills,
          avatar: employee.avatar || null,
          hireDate: employee.hire_date,
          projects: employee.projects,
          totalHours: employee.total_hours,
          stressLevel: employee.stress_level,
          directReports: employee.direct_reports,
          managerId: employee.manager_id
        }
      };
      
      flowNodes.push(node);
      
      // Create edge from manager to employee
      if (employee.manager_id) {
        flowEdges.push({
          id: `e-${employee.manager_id}-${employee.id}`,
          source: employee.manager_id,
          target: employee.id,
          type: 'smoothstep'
        });
      }
    });
    
    // Apply automatic layout
    layoutNodes(flowNodes, flowEdges, data.roots);
    
    setNodes(flowNodes);
    setEdges(flowEdges);
  };
  
  // Simple hierarchical layout algorithm
  const layoutNodes = (nodes, edges, roots) => {
    const levels = {};
    const nodeMap = {};
    
    // Create map of nodes for quick access
    nodes.forEach(node => {
      nodeMap[node.id] = node;
    });
    
    // Recursive function to assign levels to nodes
    const assignLevels = (nodeId, level) => {
      if (!levels[level]) {
        levels[level] = [];
      }
      
      levels[level].push(nodeId);
      
      // Find all children of this node
      const children = edges
        .filter(edge => edge.source === nodeId)
        .map(edge => edge.target);
      
      // Assign next level to children
      children.forEach(childId => {
        assignLevels(childId, level + 1);
      });
    };
    
    // Start with root nodes
    roots.forEach(rootId => {
      assignLevels(rootId, 0);
    });
    
    // Calculate positions based on levels
    const levelHeight = 150;
    const nodeWidth = 220;
    const nodeSpacing = 20;
    
    // Position nodes at each level
    Object.keys(levels).forEach(level => {
      const nodesInLevel = levels[level];
      const levelWidth = nodesInLevel.length * (nodeWidth + nodeSpacing);
      const startX = -levelWidth / 2;
      
      nodesInLevel.forEach((nodeId, idx) => {
        const node = nodeMap[nodeId];
        if (node) {
          node.position = {
            x: startX + idx * (nodeWidth + nodeSpacing),
            y: level * levelHeight
          };
        }
      });
    });
  };
  
  // Handle node click to show details
  const handleNodeClick = (event, node) => {
    setSelectedEmployee(node.data);
    setDetailDialogOpen(true);
  };
  
  // Handle node drag to start reassignment
  const handleNodeDragStart = (event, node) => {
    setDraggedEmployee(node.data);
  };
  
  // Handle node drag over another node
  const handleNodeDragOver = (event, node) => {
    if (draggedEmployee && node.data.id !== draggedEmployee.id) {
      setDragTargetManager(node.data);
    }
  };
  
  // Handle node drag stop
  const handleNodeDragStop = async (event, node) => {
    if (draggedEmployee && dragTargetManager && draggedEmployee.id !== dragTargetManager.id) {
      try {
        const result = await orgSimulationService.simulateReallocation(
          draggedEmployee.id,
          dragTargetManager.id
        );
        
        setRecommendations(result.recommendations || []);
        setReassignDialogOpen(true);
      } catch (err) {
        setError(err.message || 'Failed to simulate reassignment');
      }
    }
    
    // Reset drag state
    setDraggedEmployee(null);
    setDragTargetManager(null);
  };
  
  // Handle reassignment confirmation
  const handleReassignConfirm = async () => {
    try {
      await orgSimulationService.updatePosition(
        draggedEmployee.id,
        dragTargetManager.id
      );
      
      // Refresh org chart
      const data = await orgSimulationService.getOrgStructure();
      setOrgData(data);
      transformOrgDataToGraph(data);
      
      setReassignDialogOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to update employee position');
    }
  };
  
  // Handle deletion simulation
  const handleSimulateDelete = async (employeeId) => {
    try {
      setEmployeeToDelete(selectedEmployee);
      setDetailDialogOpen(false);
      
      const simulation = await orgSimulationService.simulateDeletion(employeeId);
      setDeletionSimulation(simulation);
      setDeleteDialogOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to simulate deletion');
    }
  };
  
  // Render employee details dialog
  const renderEmployeeDetailsDialog = () => {
    if (!selectedEmployee) return null;
    
    return (
      <Dialog 
        open={detailDialogOpen} 
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
      >
        <DialogTitle>
          Employee Details
          <IconButton
            aria-label="close"
            onClick={() => setDetailDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
              <Avatar 
                src={selectedEmployee.avatar || '/default-avatar.png'} 
                sx={{ width: 100, height: 100, mx: 'auto', mb: 2 }}
              />
              <Typography variant="h6">{selectedEmployee.name}</Typography>
              <Typography variant="body1" color="textSecondary">
                {selectedEmployee.position}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {selectedEmployee.department}
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <Chip 
                  label={`Workload: ${selectedEmployee.totalHours}h`} 
                  size="small"
                  sx={{ 
                    bgcolor: getStressLevelColor(selectedEmployee.stressLevel),
                    color: getTextColorForBackground(getStressLevelColor(selectedEmployee.stressLevel)),
                    mb: 1
                  }} 
                />
              </Box>
              
              <Button 
                variant="outlined" 
                color="error" 
                startIcon={<DeleteOutline />}
                onClick={() => handleSimulateDelete(selectedEmployee.id)}
                sx={{ mt: 2 }}
              >
                Simulate Removal
              </Button>
            </Grid>
            
            <Grid item xs={12} md={8}>
              <Typography variant="subtitle1" gutterBottom>
                <CalendarToday fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                Start Date: {new Date(selectedEmployee.hireDate).toLocaleDateString()}
              </Typography>
              
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                <WorkOutline fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                Skills:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedEmployee.skills.map((skill, index) => (
                  <Chip key={index} label={skill} size="small" />
                ))}
              </Box>
              
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                <AssignmentOutline fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                Projects:
              </Typography>
              <List dense>
                {selectedEmployee.projects.map((project, index) => (
                  <ListItem key={index}>
                    <ListItemText 
                      primary={project.title} 
                      secondary={`${project.weekly_hours} hours/week`} 
                    />
                  </ListItem>
                ))}
                {selectedEmployee.projects.length === 0 && (
                  <ListItem>
                    <ListItemText primary="No active projects" />
                  </ListItem>
                )}
              </List>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>
    );
  };
  
  // Render reassignment dialog
  const renderReassignDialog = () => {
    if (!draggedEmployee || !dragTargetManager) return null;
    
    return (
      <Dialog 
        open={reassignDialogOpen} 
        onClose={() => setReassignDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Reassignment Analysis
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" gutterBottom>
            Move {draggedEmployee.name} to report to {dragTargetManager.name}?
          </Typography>
          
          <Box sx={{ my: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              AI Recommendations:
            </Typography>
            {recommendations.map((rec, index) => (
              <Alert 
                key={index} 
                severity={rec.type === 'positive' ? 'success' : 'warning'}
                icon={rec.type === 'positive' ? <CheckCircleOutline /> : <WarningAmber />}
                sx={{ mb: 1 }}
              >
                {rec.message}
              </Alert>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReassignDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleReassignConfirm}
          >
            Confirm Move
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  // Render deletion simulation dialog
  const renderDeleteSimulationDialog = () => {
    if (!employeeToDelete || !deletionSimulation) return null;
    
    return (
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Deletion Impact Analysis
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" gutterBottom>
            Impact of removing {employeeToDelete.name}:
          </Typography>
          
          {deletionSimulation.direct_reports.length > 0 && (
            <Box sx={{ my: 2 }}>
              <Alert severity="warning" sx={{ mb: 1 }}>
                This employee has {deletionSimulation.direct_reports.length} direct reports that will need reassignment.
              </Alert>
            </Box>
          )}
          
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            Project Redistributions:
          </Typography>
          <List dense>
            {deletionSimulation.project_redistributions.map((redist, index) => (
              <ListItem key={index}>
                <ListItemText 
                  primary={redist.project_title} 
                  secondary={`${redist.hours} hours/week → ${redist.assigned_to_name}`} 
                />
              </ListItem>
            ))}
            {deletionSimulation.project_redistributions.length === 0 && (
              <ListItem>
                <ListItemText primary="No projects to redistribute" />
              </ListItem>
            )}
          </List>
          
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            Team Workload Impact:
          </Typography>
          <List dense>
            {deletionSimulation.team_impact.map((impact, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <Box 
                    sx={{ 
                      width: 16, 
                      height: 16, 
                      borderRadius: '50%', 
                      bgcolor: getStressLevelColor(impact.stress_level) 
                    }} 
                  />
                </ListItemIcon>
                <ListItemText 
                  primary={`${impact.name} (${impact.current_hours}h → ${impact.new_total}h)`} 
                  secondary={`Adding ${impact.additional_hours} hours of work`} 
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  // If no access, show access denied message
  if (!hasAccess()) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" color="error">
          Access Denied
        </Typography>
        <Typography variant="body1">
          This page is only accessible to top management roles.
        </Typography>
      </Box>
    );
  }
  
  // Show loading state
  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Loading organization data...
        </Typography>
      </Box>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }
  
  return (
    <Box sx={{ height: 'calc(100vh - 100px)', p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Organization Simulation
      </Typography>
      
      <Paper sx={{ height: 'calc(100% - 40px)', p: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragOver={handleNodeDragOver}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
          onInit={(instance) => {
            reactFlowInstance.current = instance;
          }}
        >
          <Controls />
          <Background />
          <MiniMap 
            nodeColor={(node) => getStressLevelColor(node.data.stressLevel)}
            maskColor="rgba(255, 255, 255, 0.5)"
          />
        </ReactFlow>
      </Paper>
      
      {/* Legend */}
      <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: 16, height: 16, bgcolor: getStressLevelColor('high_overload'), mr: 1 }} />
          <Typography variant="caption">High Overload (20+ hrs)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: 16, height: 16, bgcolor: getStressLevelColor('medium_overload'), mr: 1 }} />
          <Typography variant="caption">Medium Overload (15+ hrs)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: 16, height: 16, bgcolor: getStressLevelColor('low_overload'), mr: 1 }} />
          <Typography variant="caption">Low Overload (10+ hrs)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: 16, height: 16, bgcolor: getStressLevelColor('normal'), mr: 1 }} />
          <Typography variant="caption">Normal Load</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: 16, height: 16, bgcolor: getStressLevelColor('underload'), mr: 1 }} />
          <Typography variant="caption">Underload</Typography>
        </Box>
      </Box>
      
      {/* Dialogs */}
      {renderEmployeeDetailsDialog()}
      {renderReassignDialog()}
      {renderDeleteSimulationDialog()}
    </Box>
  );
};

export default OrgSimulationPage; 