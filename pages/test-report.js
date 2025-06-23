import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button, Box, Container, Typography, CircularProgress, Paper, TextField, Grid } from '@mui/material';

// Import the ReportRenderer component dynamically to avoid SSR issues with charts
const ReportRenderer = dynamic(() => import('@/components/ReportRenderer'), { ssr: false });

export default function TestReportPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [claudeResponse, setClaudeResponse] = useState('');
  const [useCustomResponse, setUseCustomResponse] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    requestSent: false,
    responseReceived: false,
    responseStatus: null,
    responseTime: null,
    contentLength: 0,
    visualizationsCount: 0,
    hasTitle: false,
    hasContent: false,
    errors: []
  });

  // Function to generate a report using our test API
  const generateTestReport = async () => {
    setIsLoading(true);
    setError(null);
    setReport(null);
    
    // Update debug info for request
    setDebugInfo({
      ...debugInfo,
      requestSent: true,
      responseReceived: false,
      responseStatus: null,
      responseTime: null,
      startTime: Date.now(),
      errors: []
    });
    
    try {
      // Prepare request body
      const requestBody = {
        reportTopic: "Employee Analysis for Company10",
        company: "Company10",
        wordCount: 500,
        targetAudience: "Executive Leadership",
        timeframe: "Current quarter",
        includeVisuals: true,
        deliveryFormat: "Web"
      };
      
      // Add Claude response if provided
      if (useCustomResponse && claudeResponse.trim()) {
        requestBody.claudeResponse = { response: claudeResponse };
      }
      
      // Call our test API endpoint
      const response = await fetch('/api/test-report-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      // Calculate response time
      const responseTime = Date.now() - debugInfo.startTime;
      
      // Update debug info for response received
      setDebugInfo(prevState => ({
        ...prevState,
        responseReceived: true,
        responseStatus: response.status,
        responseTime: responseTime + 'ms',
      }));
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update debug info with content details
      setDebugInfo(prevState => ({
        ...prevState,
        contentLength: data.content ? data.content.length : 0,
        visualizationsCount: data.visualizations ? data.visualizations.length : 0,
        hasTitle: !!data.title,
        hasContent: !!data.content,
        fullResponse: JSON.stringify(data, null, 2)
      }));
      
      // Validate the response data
      const validationErrors = [];
      
      if (!data.title) {
        validationErrors.push("Missing report title");
      }
      
      if (!data.content) {
        validationErrors.push("Missing report content");
      } else if (data.content.length < 100) {
        validationErrors.push("Report content too short (less than 100 chars)");
      }
      
      if (!data.visualizations || data.visualizations.length === 0) {
        validationErrors.push("No visualizations provided");
      } else {
        // Check for visualization data issues
        data.visualizations.forEach((viz, index) => {
          if (!viz.type) {
            validationErrors.push(`Visualization ${index+1} missing type`);
          }
          if (!viz.data) {
            validationErrors.push(`Visualization ${index+1} missing data`);
          } else {
            if (!viz.data.labels || !Array.isArray(viz.data.labels)) {
              validationErrors.push(`Visualization ${index+1} has invalid labels`);
            }
            if (!viz.data.datasets || !Array.isArray(viz.data.datasets)) {
              validationErrors.push(`Visualization ${index+1} has invalid datasets`);
            } else {
              viz.data.datasets.forEach((dataset, datasetIndex) => {
                if (!dataset.data || !Array.isArray(dataset.data)) {
                  validationErrors.push(`Visualization ${index+1}, dataset ${datasetIndex+1} has invalid data`);
                }
              });
            }
          }
        });
      }
      
      // Update debug info with validation errors
      if (validationErrors.length > 0) {
        setDebugInfo(prevState => ({
          ...prevState,
          errors: validationErrors
        }));
      }
      
      // Set the report data for rendering
      setReport(data);
      
    } catch (err) {
      console.error("Error generating test report:", err);
      setError(err.message || "Failed to generate report");
      
      // Update debug info with error
      setDebugInfo(prevState => ({
        ...prevState,
        errors: [...prevState.errors, err.message || "Unknown error"]
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Claude response textarea changes
  const handleClaudeResponseChange = (e) => {
    setClaudeResponse(e.target.value);
    setUseCustomResponse(e.target.value.trim() !== '');
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Report Generation Debug Page
      </Typography>
      
      {/* Claude response input */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Custom Claude Response (Optional)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Paste a Claude query response here to use for testing, or leave empty to use the default sample response.
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={6}
          variant="outlined"
          placeholder="Paste Claude query response here..."
          value={claudeResponse}
          onChange={handleClaudeResponseChange}
          sx={{ mb: 2 }}
        />
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
            Status:
          </Typography>
          <Typography variant="body2" color={useCustomResponse ? "success.main" : "info.main"}>
            {useCustomResponse ? "Using custom Claude response" : "Using default sample response"}
          </Typography>
        </Box>
      </Paper>
      
      <Box sx={{ mb: 4 }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={generateTestReport}
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Generate Test Report'}
        </Button>
      </Box>
      
      {/* Debug information panel */}
      <Paper sx={{ p: 2, mb: 4, bgcolor: '#f5f5f5' }}>
        <Typography variant="h6" gutterBottom>Debug Information</Typography>
        <Box component="pre" sx={{ overflow: 'auto', fontSize: '0.8rem' }}>
          {JSON.stringify({
            requestSent: debugInfo.requestSent,
            responseReceived: debugInfo.responseReceived,
            responseStatus: debugInfo.responseStatus,
            responseTime: debugInfo.responseTime,
            contentLength: debugInfo.contentLength,
            visualizationsCount: debugInfo.visualizationsCount,
            hasTitle: debugInfo.hasTitle,
            hasContent: debugInfo.hasContent,
            errors: debugInfo.errors
          }, null, 2)}
        </Box>
        
        {debugInfo.errors && debugInfo.errors.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
            <Typography variant="subtitle1" color="error">Validation Errors:</Typography>
            <ul>
              {debugInfo.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </Box>
        )}
      </Paper>
      
      {/* Error message */}
      {error && (
        <Box sx={{ mb: 4, p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}
      
      {/* Report preview */}
      {report && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Report Preview
          </Typography>
          <Paper sx={{ p: 3 }}>
            <ReportRenderer
              title={report.title}
              content={report.content}
              charts={report.visualizations || report.charts}
            />
          </Paper>
        </Box>
      )}
      
      {/* Full response data for debugging */}
      {report && (
        <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
          <Typography variant="h6" gutterBottom>Full Response Data</Typography>
          <Box sx={{ mt: 2 }}>
            <details>
              <summary>Click to expand/collapse</summary>
              <Box component="pre" sx={{ overflow: 'auto', fontSize: '0.8rem' }}>
                {debugInfo.fullResponse}
              </Box>
            </details>
          </Box>
        </Paper>
      )}
    </Container>
  );
} 