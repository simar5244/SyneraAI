import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  CircularProgress, 
  Container, 
  FormControl, 
  Grid, 
  InputLabel, 
  MenuItem, 
  Select, 
  Slider, 
  Stack, 
  TextField, 
  Typography,
  Checkbox,
  FormControlLabel,
  Divider,
  Alert
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { simulationService } from '../services/simulationService';
import { departmentService } from '../services/departmentService';

const SimulationCreator = ({ onSimulationCreated }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [simulationTypes, setSimulationTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  
  const [simulation, setSimulation] = useState({
    name: '',
    description: '',
    type: '',
    is_template: false,
    parameters: {}
  });
  
  // Load simulation types and departments on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const typesResponse = await simulationService.getSimulationTypes();
        setSimulationTypes(typesResponse);
        
        const deptsResponse = await departmentService.getDepartments();
        setDepartments(deptsResponse);
      } catch (err) {
        setError('Error loading data: ' + err.message);
      }
    };
    
    loadData();
  }, []);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'type') {
      // Reset parameters when simulation type changes
      setSimulation({
        ...simulation,
        type: value,
        parameters: getDefaultParameters(value)
      });
    } else {
      setSimulation({
        ...simulation,
        [name]: value
      });
    }
  };
  
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setSimulation({
      ...simulation,
      [name]: checked
    });
  };
  
  const handleParameterChange = (e) => {
    const { name, value } = e.target;
    setSimulation({
      ...simulation,
      parameters: {
        ...simulation.parameters,
        [name]: value
      }
    });
  };
  
  const handleSliderChange = (name, value) => {
    setSimulation({
      ...simulation,
      parameters: {
        ...simulation.parameters,
        [name]: value
      }
    });
  };
  
  const handleDepartmentSelection = (deptId, isSelected) => {
    const currentDepts = simulation.parameters.affected_departments || [];
    const updatedDepts = isSelected 
      ? [...currentDepts, deptId]
      : currentDepts.filter(id => id !== deptId);
    
    setSimulation({
      ...simulation,
      parameters: {
        ...simulation.parameters,
        affected_departments: updatedDepts
      }
    });
  };
  
  const getDefaultParameters = (simulationType) => {
    switch (simulationType) {
      case 'attrition':
        return {
          target_rate: 0.15,
          time_period: 12,
          risk_threshold: 0.6,
          affected_departments: [],
          avg_replacement_cost: 50000
        };
      case 'reorganization':
        return {
          target_departments: [],
          affected_employees: [],
          expected_alignment_improvement: 0.2,
          expected_efficiency_gain: 0.15
        };
      case 'growth':
        return {
          growth_rate: 0.2,
          time_period: 12,
          target_departments: [],
          hiring_pace: 'moderate',
          avg_ramp_time: 3,
          avg_cost_per_hire: 10000
        };
      case 'cost_reduction':
        return {
          target_reduction: 0.1,
          affected_departments: [],
          reduction_strategies: ['operational'],
          headcount_reduction: 0.0
        };
      default:
        return {};
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await simulationService.createSimulation(simulation);
      if (onSimulationCreated) {
        onSimulationCreated(response);
      }
    } catch (err) {
      setError('Failed to create simulation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const renderParameters = () => {
    switch (simulation.type) {
      case 'attrition':
        return renderAttritionParameters();
      case 'reorganization':
        return renderReorganizationParameters();
      case 'growth':
        return renderGrowthParameters();
      case 'cost_reduction':
        return renderCostReductionParameters();
      default:
        return <Typography>Select a simulation type to configure parameters</Typography>;
    }
  };
  
  const renderAttritionParameters = () => (
    <Stack spacing={3}>
      <Typography variant="h6">Attrition Parameters</Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>
            Projected attrition rate: {simulation.parameters.target_rate * 100}%
          </Typography>
          <Slider
            value={simulation.parameters.target_rate}
            min={0.01}
            max={0.5}
            step={0.01}
            onChange={(e, value) => handleSliderChange('target_rate', value)}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Time Period (months)"
            name="time_period"
            type="number"
            value={simulation.parameters.time_period}
            onChange={handleParameterChange}
            inputProps={{ min: 1, max: 36 }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>
            Risk Threshold: {simulation.parameters.risk_threshold * 100}%
          </Typography>
          <Slider
            value={simulation.parameters.risk_threshold}
            min={0.1}
            max={0.9}
            step={0.05}
            onChange={(e, value) => handleSliderChange('risk_threshold', value)}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Average Replacement Cost"
            name="avg_replacement_cost"
            type="number"
            value={simulation.parameters.avg_replacement_cost}
            onChange={handleParameterChange}
            inputProps={{ min: 10000, step: 5000 }}
          />
        </Grid>
      </Grid>
      
      <Divider />
      
      <Typography variant="subtitle1">Affected Departments</Typography>
      <Grid container spacing={1}>
        {departments.map(dept => (
          <Grid item xs={6} md={4} key={dept.id}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={(simulation.parameters.affected_departments || []).includes(dept.id)}
                  onChange={(e) => handleDepartmentSelection(dept.id, e.target.checked)}
                />
              }
              label={dept.name}
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
  
  const renderGrowthParameters = () => (
    <Stack spacing={3}>
      <Typography variant="h6">Growth Parameters</Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>
            Growth Rate: {simulation.parameters.growth_rate * 100}%
          </Typography>
          <Slider
            value={simulation.parameters.growth_rate}
            min={0.05}
            max={0.5}
            step={0.05}
            onChange={(e, value) => handleSliderChange('growth_rate', value)}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Time Period (months)"
            name="time_period"
            type="number"
            value={simulation.parameters.time_period}
            onChange={handleParameterChange}
            inputProps={{ min: 1, max: 36 }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Hiring Pace</InputLabel>
            <Select
              name="hiring_pace"
              value={simulation.parameters.hiring_pace}
              label="Hiring Pace"
              onChange={handleParameterChange}
            >
              <MenuItem value="slow">Slow</MenuItem>
              <MenuItem value="moderate">Moderate</MenuItem>
              <MenuItem value="aggressive">Aggressive</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Average Ramp Time (months)"
            name="avg_ramp_time"
            type="number"
            value={simulation.parameters.avg_ramp_time}
            onChange={handleParameterChange}
            inputProps={{ min: 1, max: 12 }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Average Cost Per Hire"
            name="avg_cost_per_hire"
            type="number"
            value={simulation.parameters.avg_cost_per_hire}
            onChange={handleParameterChange}
            inputProps={{ min: 5000, step: 1000 }}
          />
        </Grid>
      </Grid>
      
      <Divider />
      
      <Typography variant="subtitle1">Target Departments for Growth</Typography>
      <Grid container spacing={1}>
        {departments.map(dept => (
          <Grid item xs={6} md={4} key={dept.id}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={(simulation.parameters.target_departments || []).includes(dept.id)}
                  onChange={(e) => handleDepartmentSelection(dept.id, e.target.checked)}
                />
              }
              label={dept.name}
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
  
  const renderReorganizationParameters = () => (
    <Stack spacing={3}>
      <Typography variant="h6">Reorganization Parameters</Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>
            Expected Alignment Improvement: {simulation.parameters.expected_alignment_improvement * 100}%
          </Typography>
          <Slider
            value={simulation.parameters.expected_alignment_improvement}
            min={0.1}
            max={0.5}
            step={0.05}
            onChange={(e, value) => handleSliderChange('expected_alignment_improvement', value)}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>
            Expected Efficiency Gain: {simulation.parameters.expected_efficiency_gain * 100}%
          </Typography>
          <Slider
            value={simulation.parameters.expected_efficiency_gain}
            min={0.05}
            max={0.5}
            step={0.05}
            onChange={(e, value) => handleSliderChange('expected_efficiency_gain', value)}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
          />
        </Grid>
      </Grid>
      
      <Divider />
      
      <Typography variant="subtitle1">Target Departments</Typography>
      <Grid container spacing={1}>
        {departments.map(dept => (
          <Grid item xs={6} md={4} key={dept.id}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={(simulation.parameters.target_departments || []).includes(dept.id)}
                  onChange={(e) => handleDepartmentSelection(dept.id, e.target.checked)}
                />
              }
              label={dept.name}
            />
          </Grid>
        ))}
      </Grid>
      
      <Alert severity="info">
        Note: Detailed reporting line changes can be made in the next step after creating the simulation.
      </Alert>
    </Stack>
  );
  
  const renderCostReductionParameters = () => (
    <Stack spacing={3}>
      <Typography variant="h6">Cost Reduction Parameters</Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>
            Target Reduction: {simulation.parameters.target_reduction * 100}%
          </Typography>
          <Slider
            value={simulation.parameters.target_reduction}
            min={0.05}
            max={0.3}
            step={0.05}
            onChange={(e, value) => handleSliderChange('target_reduction', value)}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>
            Headcount Reduction: {simulation.parameters.headcount_reduction * 100}%
          </Typography>
          <Slider
            value={simulation.parameters.headcount_reduction}
            min={0}
            max={0.2}
            step={0.01}
            onChange={(e, value) => handleSliderChange('headcount_reduction', value)}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
          />
        </Grid>
      </Grid>
      
      <Typography variant="subtitle1">Reduction Strategies</Typography>
      <Grid container spacing={1}>
        <Grid item xs={6}>
          <FormControlLabel
            control={
              <Checkbox
                checked={(simulation.parameters.reduction_strategies || []).includes('headcount')}
                onChange={(e) => {
                  const strategies = [...(simulation.parameters.reduction_strategies || [])];
                  if (e.target.checked) {
                    strategies.push('headcount');
                  } else {
                    const index = strategies.indexOf('headcount');
                    if (index > -1) strategies.splice(index, 1);
                  }
                  handleSliderChange('reduction_strategies', strategies);
                }}
              />
            }
            label="Headcount Reduction"
          />
        </Grid>
        <Grid item xs={6}>
          <FormControlLabel
            control={
              <Checkbox
                checked={(simulation.parameters.reduction_strategies || []).includes('operational')}
                onChange={(e) => {
                  const strategies = [...(simulation.parameters.reduction_strategies || [])];
                  if (e.target.checked) {
                    strategies.push('operational');
                  } else {
                    const index = strategies.indexOf('operational');
                    if (index > -1) strategies.splice(index, 1);
                  }
                  handleSliderChange('reduction_strategies', strategies);
                }}
              />
            }
            label="Operational Costs"
          />
        </Grid>
      </Grid>
      
      <Divider />
      
      <Typography variant="subtitle1">Affected Departments</Typography>
      <Grid container spacing={1}>
        {departments.map(dept => (
          <Grid item xs={6} md={4} key={dept.id}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={(simulation.parameters.affected_departments || []).includes(dept.id)}
                  onChange={(e) => handleDepartmentSelection(dept.id, e.target.checked)}
                />
              }
              label={dept.name}
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
  
  return (
    <Container maxWidth="lg">
      <Card>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            Create New Simulation
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField
                    required
                    fullWidth
                    label="Simulation Name"
                    name="name"
                    value={simulation.name}
                    onChange={handleChange}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth required>
                    <InputLabel>Simulation Type</InputLabel>
                    <Select
                      name="type"
                      value={simulation.type}
                      label="Simulation Type"
                      onChange={handleChange}
                    >
                      {simulationTypes.map(type => (
                        <MenuItem key={type.id} value={type.id}>
                          {type.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    name="description"
                    value={simulation.description}
                    onChange={handleChange}
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
              
              <FormControlLabel
                control={
                  <Checkbox
                    name="is_template"
                    checked={simulation.is_template}
                    onChange={handleCheckboxChange}
                  />
                }
                label="Save as reusable template"
              />
              
              <Divider />
              
              <Box sx={{ mt: 2 }}>
                {renderParameters()}
              </Box>
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={loading || !simulation.name || !simulation.type}
                  startIcon={loading && <CircularProgress size={20} />}
                >
                  {loading ? 'Creating...' : 'Create Simulation'}
                </Button>
              </Box>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
};

export default SimulationCreator; 