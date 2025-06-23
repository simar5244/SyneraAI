import React, { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  CircularProgress, 
  Alert, 
  Card, 
  CardContent, 
  Grid,
  Chip,
  Divider,
  LinearProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import InfoIcon from '@mui/icons-material/Info';

interface Employee {
  email: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  role?: string;
  department?: string;
  successorAnalysis?: {
    top_successors: SuccessorCandidate[];
    last_updated: string;
    analysis_version: string;
  };
}

interface SuccessorCandidate {
  candidate_email: string;
  candidate_name: string;
  candidate_title?: string;
  successor_score: number;
  stability_score: number;
  competency_score: number;
  complexity_score: number;
  cognitive_score: number;
  velocity_score: number;
  explanation?: string;
  shared_tools?: string[];
}

interface FactorScore {
  name: string;
  score: number;
  color: string;
}

const SuccessorSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [successors, setSuccessors] = useState<SuccessorCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  // Function to search for an employee by email
  const searchEmployee = async (email: string) => {
    if (!email) return;
    
    setLoading(true);
    setSearchError('');
    setEmployee(null);
    setSuccessors([]);
    
    try {
      const response = await fetch(`/api/employee?email=${encodeURIComponent(email)}`);
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.employee) {
        setEmployee(data.employee);
        
        // Check if there are cached successor results
        if (data.employee.successorAnalysis?.top_successors?.length > 0) {
          setSuccessors(data.employee.successorAnalysis.top_successors);
        } else {
          // Fetch successors if no cached results
          await fetchSuccessors(data.employee.email);
        }
      } else {
        setSearchError('No employee found with that email');
      }
    } catch (error) {
      console.error('Error searching for employee:', error);
      setSearchError(`Failed to search for employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch successors for an employee
  const fetchSuccessors = async (email: string) => {
    if (!email) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`/api/succession?email=${encodeURIComponent(email)}`);
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.successors) {
        setSuccessors(data.successors);
      } else {
        setSearchError('No successors found for this employee');
      }
    } catch (error) {
      console.error('Error fetching successors:', error);
      setSearchError(`Failed to fetch successors: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh successor analysis
  const refreshAnalysis = async () => {
    if (!employee?.email) return;
    
    setRefreshing(true);
    setRefreshSuccess(false);
    setRefreshError('');
    
    try {
      const response = await fetch('/api/succession/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: employee.email }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setRefreshSuccess(true);
        
        // Update successors with the refreshed data
        if (data.successorAnalysis?.top_successors?.length > 0) {
          setSuccessors(data.successorAnalysis.top_successors);
        } else {
          // Fallback to fetching successors if no data returned
          await fetchSuccessors(employee.email);
        }
      } else {
        setRefreshError(data.error || 'Failed to refresh analysis');
      }
    } catch (error) {
      console.error('Error refreshing analysis:', error);
      setRefreshError(`Failed to refresh analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRefreshing(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      if (term.includes('@')) {
        searchEmployee(term);
      }
    }, 500),
    []
  );

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value);
  };

  // Handle search form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm) {
      searchEmployee(searchTerm);
    }
  };

  // Format factor scores for display
  const getFactorScores = (successor: SuccessorCandidate): FactorScore[] => {
    return [
      { 
        name: 'Competency', 
        score: successor.competency_score, 
        color: getScoreColor(successor.competency_score) 
      },
      { 
        name: 'Stability', 
        score: successor.stability_score, 
        color: getScoreColor(successor.stability_score) 
      },
      { 
        name: 'Complexity', 
        score: successor.complexity_score, 
        color: getScoreColor(successor.complexity_score) 
      },
      { 
        name: 'Cognitive', 
        score: successor.cognitive_score, 
        color: getScoreColor(successor.cognitive_score) 
      },
      { 
        name: 'Velocity', 
        score: successor.velocity_score, 
        color: getScoreColor(successor.velocity_score) 
      },
    ];
  };

  // Get color based on score
  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return '#4caf50'; // Green
    if (score >= 0.6) return '#8bc34a'; // Light Green
    if (score >= 0.4) return '#ffc107'; // Amber
    if (score >= 0.2) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  // Get readiness label based on score
  const getReadinessLabel = (score: number, competencyScore: number): string => {
    if (competencyScore < 0.6 || score < 0.6) {
      return competencyScore < 0.4 || score < 0.4 ? 
        "24+ months" : "12-24 months";
    } else if (competencyScore < 0.7 || score < 0.7) {
      return "6-12 months";
    }
    return "Ready Now";
  };

  // Get readiness color based on label
  const getReadinessColor = (label: string): string => {
    switch (label) {
      case 'Ready Now': return '#4caf50';
      case '6-12 months': return '#8bc34a';
      case '12-24 months': return '#ffc107';
      case '24+ months': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Successor Identification
      </Typography>
      
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', mb: 3, gap: 1 }}>
          <TextField
            fullWidth
            label="Search by Email"
            variant="outlined"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Enter employee email"
            InputProps={{
              startAdornment: <PersonSearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            helperText="Enter a complete email address to search"
          />
          <Button 
            type="submit" 
            variant="contained" 
            disabled={loading || !searchTerm}
            sx={{ minWidth: 100 }}
          >
            Search
          </Button>
        </Box>
      </form>
      
      {searchError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {searchError}
        </Alert>
      )}
      
      {loading && <LinearProgress sx={{ mb: 3 }} />}
      
      {employee && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" component="h2">
                {employee.firstName} {employee.lastName}
              </Typography>
              
              <Tooltip title="Refresh successor analysis">
                <IconButton 
                  onClick={refreshAnalysis} 
                  disabled={refreshing}
                  color="primary"
                >
                  {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
                </IconButton>
              </Tooltip>
            </Box>
            
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {employee.email}
            </Typography>
            
            <Typography variant="body2" gutterBottom>
              {employee.jobTitle || employee.role || 'No title'}
              {employee.department && ` • ${employee.department}`}
            </Typography>
            
            {refreshSuccess && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Successor analysis refreshed successfully
              </Alert>
            )}
            
            {refreshError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {refreshError}
              </Alert>
            )}
            
            {employee.successorAnalysis?.last_updated && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Last analysis: {new Date(employee.successorAnalysis.last_updated).toLocaleString()}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}
      
      {successors.length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>
            Top Successor Candidates
          </Typography>
          
          <Grid container spacing={3}>
            {successors.map((successor, index) => {
              const factorScores = getFactorScores(successor);
              const readinessLabel = getReadinessLabel(successor.successor_score, successor.competency_score);
              const readinessColor = getReadinessColor(readinessLabel);
              
              return (
                <Grid item xs={12} md={6} key={successor.candidate_email || index}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="h6" component="h3">
                            {successor.candidate_name}
                          </Typography>
                          
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {successor.candidate_email}
                          </Typography>
                          
                          {successor.candidate_title && (
                            <Typography variant="body2" gutterBottom>
                              {successor.candidate_title}
                            </Typography>
                          )}
                        </Box>
                        
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                            {(successor.successor_score * 100).toFixed(0)}%
                          </Typography>
                          
                          <Chip 
                            label={readinessLabel}
                            sx={{ 
                              bgcolor: readinessColor,
                              color: 'white',
                              fontWeight: 'bold'
                            }}
                          />
                        </Box>
                      </Box>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Typography variant="subtitle2" gutterBottom>
                        Factor Scores
                      </Typography>
                      
                      <Grid container spacing={1} sx={{ mb: 2 }}>
                        {factorScores.map((factor) => (
                          <Grid item xs={6} key={factor.name}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                              <Typography variant="body2" sx={{ minWidth: 100 }}>
                                {factor.name}:
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={factor.score * 100}
                                sx={{
                                  flexGrow: 1,
                                  height: 8,
                                  borderRadius: 4,
                                  bgcolor: 'rgba(0,0,0,0.1)',
                                  '& .MuiLinearProgress-bar': {
                                    bgcolor: factor.color,
                                  },
                                }}
                              />
                              <Typography variant="body2" sx={{ ml: 1, minWidth: 40 }}>
                                {(factor.score * 100).toFixed(0)}%
                              </Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                      
                      {successor.shared_tools && successor.shared_tools.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Shared Tools & Skills
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {successor.shared_tools.slice(0, 5).map((tool, i) => (
                              <Chip key={i} label={tool} size="small" />
                            ))}
                            {successor.shared_tools.length > 5 && (
                              <Tooltip title={successor.shared_tools.slice(5).join(', ')}>
                                <Chip 
                                  label={`+${successor.shared_tools.length - 5} more`} 
                                  size="small"
                                  icon={<InfoIcon />}
                                />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      )}
                      
                      {successor.explanation && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Match Analysis
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {successor.explanation}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}
      
      {employee && successors.length === 0 && !loading && (
        <Alert severity="info">
          No successor candidates found for this employee. Try refreshing the analysis.
        </Alert>
      )}
    </Box>
  );
};

export default SuccessorSearch;
