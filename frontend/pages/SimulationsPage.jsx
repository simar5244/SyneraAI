import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Container, 
  Dialog,
  DialogContent, 
  DialogTitle,
  IconButton,
  Paper, 
  Tab, 
  Tabs, 
  Typography, 
  Grid,
  Card,
  CardActionArea,
  CardContent,
  CardActions,
  Chip,
  Divider,
  Menu,
  MenuItem,
  Stack,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate, useParams } from 'react-router-dom';
import { simulationService } from '../services/simulationService';
import SimulationCreator from '../components/SimulationCreator';
import SimulationResults from '../components/SimulationResults';

const SimulationsPage = () => {
  const navigate = useNavigate();
  const { resultId } = useParams();
  
  const [activeTab, setActiveTab] = useState(0);
  const [scenarios, setScenarios] = useState([]);
  const [results, setResults] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);
  
  // Load data based on active tab
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      
      try {
        if (activeTab === 0) {
          // Load scenarios
          const scenariosData = await simulationService.getSimulationScenarios({ is_template: false });
          setScenarios(scenariosData);
        } else if (activeTab === 1) {
          // Load results
          const resultsData = await simulationService.getSimulationResults();
          setResults(resultsData);
        } else if (activeTab === 2) {
          // Load templates
          const templatesData = await simulationService.getSimulationScenarios({ is_template: true });
          setTemplates(templatesData);
        }
      } catch (err) {
        setError(`Error loading data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [activeTab]);
  
  // Check if we should open a result view on initial load
  useEffect(() => {
    if (resultId) {
      setSelectedResult(resultId);
      setResultDialogOpen(true);
    }
  }, [resultId]);
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  const handleCreateDialogOpen = () => {
    setCreateDialogOpen(true);
  };
  
  const handleCreateDialogClose = () => {
    setCreateDialogOpen(false);
  };
  
  const handleResultDialogOpen = (resultId) => {
    setSelectedResult(resultId);
    setResultDialogOpen(true);
    // Update the URL without refreshing the page
    navigate(`/simulations/results/${resultId}`, { replace: true });
  };
  
  const handleResultDialogClose = () => {
    setResultDialogOpen(false);
    setSelectedResult(null);
    // Update the URL without refreshing the page
    navigate('/simulations', { replace: true });
  };
  
  const handleMenuOpen = (event, scenario) => {
    setAnchorEl(event.currentTarget);
    setSelectedScenario(scenario);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedScenario(null);
  };
  
  const handleRunSimulation = async (scenario) => {
    try {
      setLoading(true);
      const result = await simulationService.runSimulation(scenario.id);
      // Refresh results and open the result view
      const results = await simulationService.getSimulationResults();
      setResults(results);
      handleResultDialogOpen(result.id);
    } catch (err) {
      setError(`Error running simulation: ${err.message}`);
    } finally {
      setLoading(false);
      handleMenuClose();
    }
  };
  
  const handleDuplicateScenario = async (scenario) => {
    try {
      setLoading(true);
      // Create a copy with a new name
      const newScenario = {
        ...scenario,
        id: undefined, // Remove ID to create a new one
        name: `Copy of ${scenario.name}`,
        created_at: undefined // This will be set on the server
      };
      
      await simulationService.createSimulation(newScenario);
      
      // Refresh the scenarios list
      const scenariosData = await simulationService.getSimulationScenarios({ is_template: false });
      setScenarios(scenariosData);
    } catch (err) {
      setError(`Error duplicating scenario: ${err.message}`);
    } finally {
      setLoading(false);
      handleMenuClose();
    }
  };
  
  const handleDeleteScenario = async (scenario) => {
    try {
      setLoading(true);
      await simulationService.deleteSimulation(scenario.id);
      
      // Refresh the scenarios list
      if (activeTab === 0) {
        const scenariosData = await simulationService.getSimulationScenarios({ is_template: false });
        setScenarios(scenariosData);
      } else if (activeTab === 2) {
        const templatesData = await simulationService.getSimulationScenarios({ is_template: true });
        setTemplates(templatesData);
      }
    } catch (err) {
      setError(`Error deleting scenario: ${err.message}`);
    } finally {
      setLoading(false);
      handleMenuClose();
    }
  };
  
  const handleSimulationCreated = async (newScenario) => {
    // Close the create dialog
    handleCreateDialogClose();
    
    // Refresh the scenarios list
    try {
      const scenariosData = await simulationService.getSimulationScenarios({ is_template: false });
      setScenarios(scenariosData);
      
      if (newScenario.is_template) {
        const templatesData = await simulationService.getSimulationScenarios({ is_template: true });
        setTemplates(templatesData);
      }
    } catch (err) {
      setError(`Error refreshing data: ${err.message}`);
    }
  };
  
  const getSimulationTypeChip = (type) => {
    const types = {
      attrition: { label: 'Attrition', color: 'error' },
      reorganization: { label: 'Reorganization', color: 'primary' },
      growth: { label: 'Growth', color: 'success' },
      cost_reduction: { label: 'Cost Reduction', color: 'warning' }
    };
    
    const config = types[type] || { label: type, color: 'default' };
    
    return (
      <Chip 
        label={config.label} 
        color={config.color} 
        size="small" 
        sx={{ textTransform: 'capitalize' }} 
      />
    );
  };
  
  const renderScenarios = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Simulation Scenarios</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={handleCreateDialogOpen}
        >
          New Simulation
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {scenarios.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Scenarios Found
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Create a new simulation scenario to get started.
          </Typography>
          <Button 
            variant="outlined" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={handleCreateDialogOpen}
          >
            Create Simulation
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {scenarios.map((scenario) => (
            <Grid item xs={12} sm={6} md={4} key={scenario.id}>
              <Card>
                <CardActionArea onClick={() => {/* View scenario details */}}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="h6" noWrap sx={{ width: '80%' }}>
                        {scenario.name}
                      </Typography>
                      <IconButton 
                        aria-label="scenario menu" 
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuOpen(e, scenario);
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                    
                    <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>
                      {new Date(scenario.created_at).toLocaleDateString()}
                    </Typography>
                    
                    {getSimulationTypeChip(scenario.type)}
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                      {scenario.description || 'No description provided'}
                    </Typography>
                  </CardContent>
                </CardActionArea>
                <Divider />
                <CardActions>
                  <Button 
                    startIcon={<PlayArrowIcon />} 
                    color="primary"
                    onClick={() => handleRunSimulation(scenario)}
                  >
                    Run Simulation
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleRunSimulation(selectedScenario)}>
          <PlayArrowIcon fontSize="small" sx={{ mr: 1 }} />
          Run Simulation
        </MenuItem>
        <MenuItem onClick={() => handleDuplicateScenario(selectedScenario)}>
          <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
          Duplicate
        </MenuItem>
        <MenuItem onClick={() => handleDeleteScenario(selectedScenario)}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
  
  const renderResults = () => (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Simulation Results</Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {results.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Results Found
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Run a simulation to see results here.
          </Typography>
          <Button 
            variant="outlined" 
            color="primary" 
            onClick={() => setActiveTab(0)}
          >
            View Scenarios
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {results.map((result) => (
            <Grid item xs={12} sm={6} key={result.id}>
              <Card>
                <CardActionArea onClick={() => handleResultDialogOpen(result.id)}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {result.scenario_name || `Result ${result.id}`}
                    </Typography>
                    
                    <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>
                      {new Date(result.created_at).toLocaleDateString()} {new Date(result.created_at).toLocaleTimeString()}
                    </Typography>
                    
                    <Grid container spacing={1} sx={{ mb: 2 }}>
                      <Grid item>
                        {getSimulationTypeChip(result.simulation_type || 'unknown')}
                      </Grid>
                    </Grid>
                    
                    <Stack spacing={1} direction="row" sx={{ mt: 1 }}>
                      <Chip 
                        label={`Overall: ${(result.impact_scores?.overall || 0) > 0 ? '+' : ''}${((result.impact_scores?.overall || 0) * 100).toFixed(0)}%`} 
                        color={(result.impact_scores?.overall || 0) > 0 ? 'success' : 'error'}
                        size="small"
                      />
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
  
  const renderTemplates = () => (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Template Library</Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {templates.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Templates Found
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Save scenarios as templates to reuse them later.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {templates.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="h6" noWrap sx={{ width: '80%' }}>
                      {template.name}
                    </Typography>
                    <IconButton 
                      aria-label="template menu" 
                      size="small"
                      onClick={(e) => handleMenuOpen(e, template)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                    <Chip label="Template" color="info" size="small" sx={{ mr: 1 }} />
                    {getSimulationTypeChip(template.type)}
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {template.description || 'No description provided'}
                  </Typography>
                </CardContent>
                <Divider />
                <CardActions>
                  <Button 
                    startIcon={<ContentCopyIcon />} 
                    color="primary"
                    onClick={() => handleDuplicateScenario(template)}
                  >
                    Use Template
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
  
  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 5 }}>
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Scenarios" />
          <Tab label="Results" />
          <Tab label="Templates" />
        </Tabs>
      </Paper>
      
      <Box sx={{ py: 2 }}>
        {activeTab === 0 && renderScenarios()}
        {activeTab === 1 && renderResults()}
        {activeTab === 2 && renderTemplates()}
      </Box>
      
      {/* Create Simulation Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={handleCreateDialogClose}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Create New Simulation
            <IconButton edge="end" onClick={handleCreateDialogClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <SimulationCreator onSimulationCreated={handleSimulationCreated} />
        </DialogContent>
      </Dialog>
      
      {/* Simulation Results Dialog */}
      <Dialog 
        open={resultDialogOpen} 
        onClose={handleResultDialogClose}
        fullScreen
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Simulation Results
            <IconButton edge="end" onClick={handleResultDialogClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedResult && <SimulationResults simulationId={selectedResult} />}
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default SimulationsPage; 