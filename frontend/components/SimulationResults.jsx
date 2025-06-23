import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  CircularProgress, 
  Container, 
  Divider, 
  Grid, 
  Paper, 
  Tab, 
  Tabs, 
  Typography,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Button
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { simulationService } from '../services/simulationService';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const SimulationResults = ({ simulationId }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Load simulation result
        const resultData = await simulationService.getSimulationResult(simulationId);
        setResult(resultData);
        
        // Load scenario details
        const scenarioData = await simulationService.getSimulationScenario(resultData.scenario_id);
        setScenario(scenarioData);
      } catch (err) {
        setError('Error loading simulation results: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (simulationId) {
      loadData();
    }
  }, [simulationId]);
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  const getImpactColor = (score) => {
    if (score > 0.1) return theme.palette.success.main;
    if (score < -0.1) return theme.palette.error.main;
    return theme.palette.warning.main;
  };
  
  const getImpactIcon = (score) => {
    if (score > 0.1) return <TrendingUpIcon color="success" />;
    if (score < -0.1) return <TrendingDownIcon color="error" />;
    return <WarningIcon color="warning" />;
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }
  
  if (!result || !scenario) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No simulation results found
      </Alert>
    );
  }
  
  const renderOverview = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h5" gutterBottom>
          {scenario.name} - Results Summary
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" paragraph>
          {scenario.description}
        </Typography>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Impact Scores</Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                  { subject: 'Morale', value: Math.abs(result.impact_scores.morale * 10) },
                  { subject: 'Productivity', value: Math.abs(result.impact_scores.productivity * 10) },
                  { subject: 'Cost', value: Math.abs(result.impact_scores.cost * 10) },
                  { subject: 'Risk', value: Math.abs(result.impact_scores.risk * 10) },
                ]}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} />
                  <Radar
                    name="Impact"
                    dataKey="value"
                    stroke={theme.palette.primary.main}
                    fill={theme.palette.primary.main}
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Key Metrics</Typography>
            <List>
              {Object.entries(result.metrics).map(([key, value]) => (
                <ListItem key={key}>
                  <ListItemText
                    primary={key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    secondary={typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LightbulbIcon sx={{ mr: 1 }} />
                Recommendations
              </Box>
            </Typography>
            <List>
              {result.recommendations.map((recommendation, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <CheckCircleIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary={recommendation} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
  
  const renderDepartmentImpacts = () => {
    const departmentData = Object.entries(result.department_impacts || {}).map(([id, data]) => ({
      id,
      name: id, // Ideally would be replaced with department name from lookup
      ...data
    }));
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom>
            Department Impacts
          </Typography>
        </Grid>
        
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={departmentData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      dataKey={scenario.type === 'attrition' ? 'percentage' : 'impact'} 
                      name={scenario.type === 'attrition' ? 'Attrition Risk (%)' : 'Impact Score'} 
                      fill={theme.palette.primary.main} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12}>
          <Grid container spacing={2}>
            {departmentData.map((dept) => (
              <Grid item xs={12} md={6} lg={4} key={dept.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {dept.name}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <List dense>
                      {Object.entries(dept).map(([key, value]) => {
                        if (key === 'id' || key === 'name') return null;
                        return (
                          <ListItem key={key}>
                            <ListItemText
                              primary={key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                              secondary={typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value}
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    );
  };
  
  const renderEmployeeImpacts = () => {
    // In a real app, this would include more detailed employee impact data
    // Here we're just showing a simplified view based on the simulation type
    
    const employeeData = Object.entries(result.employee_impacts || {}).map(([id, score]) => ({
      id,
      score: typeof score === 'number' ? score : 0
    }));
    
    const riskLevels = {
      high: employeeData.filter(e => e.score > 0.6).length,
      medium: employeeData.filter(e => e.score > 0.3 && e.score <= 0.6).length,
      low: employeeData.filter(e => e.score <= 0.3).length
    };
    
    const pieData = [
      { name: 'High Risk', value: riskLevels.high, color: theme.palette.error.main },
      { name: 'Medium Risk', value: riskLevels.medium, color: theme.palette.warning.main },
      { name: 'Low Risk', value: riskLevels.low, color: theme.palette.success.main }
    ].filter(item => item.value > 0);
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom>
            Employee Impact Analysis
          </Typography>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Risk Distribution</Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Employees']} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Summary</Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <Chip 
                      label="High Risk" 
                      sx={{ backgroundColor: theme.palette.error.main, color: 'white' }} 
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary={`${riskLevels.high} employees`} 
                    secondary={`${((riskLevels.high / employeeData.length) * 100).toFixed(1)}% of workforce`} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Chip 
                      label="Medium Risk" 
                      sx={{ backgroundColor: theme.palette.warning.main, color: 'white' }} 
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary={`${riskLevels.medium} employees`} 
                    secondary={`${((riskLevels.medium / employeeData.length) * 100).toFixed(1)}% of workforce`} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Chip 
                      label="Low Risk" 
                      sx={{ backgroundColor: theme.palette.success.main, color: 'white' }} 
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary={`${riskLevels.low} employees`} 
                    secondary={`${((riskLevels.low / employeeData.length) * 100).toFixed(1)}% of workforce`} 
                  />
                </ListItem>
              </List>
              
              <Box sx={{ mt: 2 }}>
                <Button variant="outlined" color="primary">
                  View Detailed Employee Report
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };
  
  const renderScenarioDetails = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h5" gutterBottom>
          Scenario Details
        </Typography>
      </Grid>
      
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6">Basic Information</Typography>
            <List>
              <ListItem>
                <ListItemText primary="Name" secondary={scenario.name} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Description" secondary={scenario.description} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Simulation Type" secondary={scenario.type} />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Created At" 
                  secondary={new Date(scenario.created_at).toLocaleString()} 
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6">Parameters</Typography>
            <List>
              {Object.entries(scenario.parameters).map(([key, value]) => {
                if (Array.isArray(value)) {
                  return (
                    <ListItem key={key}>
                      <ListItemText 
                        primary={key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} 
                        secondary={value.length > 0 ? value.join(', ') : 'None'} 
                      />
                    </ListItem>
                  );
                } else if (typeof value === 'object' && value !== null) {
                  return (
                    <ListItem key={key}>
                      <ListItemText 
                        primary={key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} 
                        secondary={JSON.stringify(value)} 
                      />
                    </ListItem>
                  );
                } else {
                  return (
                    <ListItem key={key}>
                      <ListItemText 
                        primary={key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} 
                        secondary={typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value} 
                      />
                    </ListItem>
                  );
                }
              })}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
  
  return (
    <Container maxWidth="lg">
      <Paper sx={{ mt: 3, mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Overview" />
          <Tab label="Department Impacts" />
          <Tab label="Employee Impacts" />
          <Tab label="Scenario Details" />
        </Tabs>
        
        <Box sx={{ p: 3 }}>
          {activeTab === 0 && renderOverview()}
          {activeTab === 1 && renderDepartmentImpacts()}
          {activeTab === 2 && renderEmployeeImpacts()}
          {activeTab === 3 && renderScenarioDetails()}
        </Box>
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, mb: 4 }}>
        <Button variant="outlined">
          Download Report
        </Button>
        <Button variant="contained" color="primary">
          Run New Simulation
        </Button>
      </Box>
    </Container>
  );
};

export default SimulationResults; 