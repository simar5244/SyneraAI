import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  useTheme,
  ThemeProvider,
  createTheme,
  CssBaseline
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business';
import SimulationIcon from '@mui/icons-material/CompareArrows';
import HelpIcon from '@mui/icons-material/Help';
import { LayoutManager } from './layout_manager';
import { SimulationPage } from './simulation_page';

// Create custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Dashboard component (placeholder)
const Dashboard = () => (
  <Container sx={{ mt: 4 }}>
    <Typography variant="h4" component="h1" gutterBottom>
      Organization Simulation AI Dashboard
    </Typography>
    <Typography variant="body1" paragraph>
      Welcome to the Organization Simulation Dashboard. This application helps you visualize, manage, and optimize your organization structure.
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 4 }}>
      <Box 
        component={Link} 
        to="/layouts" 
        sx={{ 
          width: 300, 
          height: 200, 
          bgcolor: 'primary.main', 
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          textDecoration: 'none',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'scale(1.03)',
          }
        }}
      >
        <BusinessIcon sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h6">Organization Layouts</Typography>
      </Box>
      
      <Box 
        component={Link} 
        to="/simulation" 
        sx={{ 
          width: 300, 
          height: 200, 
          bgcolor: 'secondary.main', 
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          textDecoration: 'none',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'scale(1.03)',
          }
        }}
      >
        <SimulationIcon sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h6">Run Simulations</Typography>
      </Box>
    </Box>
  </Container>
);

// Help component (placeholder)
const Help = () => (
  <Container sx={{ mt: 4 }}>
    <Typography variant="h4" component="h1" gutterBottom>
      Help & Documentation
    </Typography>
    <Typography variant="h6" gutterBottom>
      Getting Started
    </Typography>
    <Typography variant="body1" paragraph>
      Welcome to the Organization Simulation application. This tool helps you design, visualize, and optimize your organization structure through interactive charts and AI-powered simulations.
    </Typography>
    
    <Typography variant="h6" gutterBottom>
      Organization Layouts
    </Typography>
    <Typography variant="body1" paragraph>
      The Organization Layouts section allows you to create and manage different organizational structures. You can add departments, roles, and people, and establish reporting relationships between them.
    </Typography>
    <Typography variant="body1" paragraph>
      Each node in the organization chart represents either a department, role, or person. You can drag nodes to reposition them, and use the toolbar on the right to add new nodes or create connections between existing ones.
    </Typography>
    
    <Typography variant="h6" gutterBottom>
      Simulations
    </Typography>
    <Typography variant="body1" paragraph>
      The Simulations section allows you to test changes to your organization structure before implementing them. You can add, remove, or modify nodes and connections, and then run a simulation to see how these changes would affect workload distribution and team dynamics.
    </Typography>
    <Typography variant="body1" paragraph>
      After running a simulation, you'll see an impact score that indicates the level of disruption the changes would cause. If you're satisfied with the simulation results, you can apply the changes to your organization.
    </Typography>
    
    <Typography variant="h6" gutterBottom>
      Tips for Optimal Organization Design
    </Typography>
    <ul>
      <li>
        <Typography variant="body1">Keep reporting lines clear and avoid creating loops in the hierarchy.</Typography>
      </li>
      <li>
        <Typography variant="body1">Balance workload across team members based on their skill level and capacity.</Typography>
      </li>
      <li>
        <Typography variant="body1">Use the optimization suggestions to identify potential improvements to your structure.</Typography>
      </li>
      <li>
        <Typography variant="body1">Run simulations before making major organizational changes to anticipate their impact.</Typography>
      </li>
    </ul>
  </Container>
);

export default function App() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex' }}>
          <AppBar position="fixed">
            <Toolbar>
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={toggleDrawer}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" noWrap component="div">
                Org-Sim AI
              </Typography>
            </Toolbar>
          </AppBar>
          
          {/* Navigation Drawer */}
          <Drawer
            variant="temporary"
            open={drawerOpen}
            onClose={toggleDrawer}
            sx={{
              width: 240,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: 240,
                boxSizing: 'border-box',
              },
            }}
          >
            <Toolbar />
            <Box sx={{ overflow: 'auto' }}>
              <List>
                <ListItem button component={Link} to="/" onClick={toggleDrawer}>
                  <ListItemIcon>
                    <DashboardIcon />
                  </ListItemIcon>
                  <ListItemText primary="Dashboard" />
                </ListItem>
                <ListItem button component={Link} to="/layouts" onClick={toggleDrawer}>
                  <ListItemIcon>
                    <BusinessIcon />
                  </ListItemIcon>
                  <ListItemText primary="Organization Layouts" />
                </ListItem>
                <ListItem button component={Link} to="/simulation" onClick={toggleDrawer}>
                  <ListItemIcon>
                    <SimulationIcon />
                  </ListItemIcon>
                  <ListItemText primary="Simulation" />
                </ListItem>
              </List>
              <Divider />
              <List>
                <ListItem button component={Link} to="/help" onClick={toggleDrawer}>
                  <ListItemIcon>
                    <HelpIcon />
                  </ListItemIcon>
                  <ListItemText primary="Help & Documentation" />
                </ListItem>
              </List>
            </Box>
          </Drawer>
          
          {/* Main Content */}
          <Box component="main" sx={{ flexGrow: 1, p: 0 }}>
            <Toolbar /> {/* This empty toolbar creates space below the AppBar */}
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/layouts" element={<LayoutManager />} />
              <Route path="/simulation" element={<SimulationPage />} />
              <Route path="/help" element={<Help />} />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
} 