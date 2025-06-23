'use client';
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bar, Line, Pie, Doughnut, PolarArea, Radar, Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale
} from 'chart.js';
import { FaEdit, FaTimes, FaPaperPlane, FaSpinner, FaCheck, FaDownload, FaFilePdf, FaFileWord, FaSearch, FaHistory, FaComments, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'sonner';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale
);

interface ChartConfig {
  type: string;
  title: string;
  description?: string;
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string | string[];
      borderColor?: string;
      borderWidth?: number;
      fill?: boolean;
      tension?: number;
    }[];
  };
  options?: any;
}

interface ReportRendererProps {
  title: string;
  content: string;
  charts?: ChartConfig[];
  visualizations?: ChartConfig[]; // Support both naming conventions
  onRenderComplete?: () => void;
  reportId?: string;
  originalUserInput?: string;
  onExport?: (format: string) => void;
  onSave?: () => void;
  onClose?: () => void;
}

const ReportRenderer: React.FC<ReportRendererProps> = ({ 
  title, 
  content, 
  charts, 
  visualizations, 
  onRenderComplete,
  reportId,
  originalUserInput,
  onExport,
  onSave,
  onClose
}) => {
  // State for suggest edits feature
  const [editMessage, setEditMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // State for tracking changes to the report
  const [currentTitle, setCurrentTitle] = useState(title);
  const [currentContent, setCurrentContent] = useState(content);
  const [currentVisualizations, setCurrentVisualizations] = useState(charts || visualizations || []);
  
  // State for highlighting recent changes
  const [recentEdits, setRecentEdits] = useState<{textEdits: {targetContent: string, replacementContent: string}[], newVisualization: boolean}>(
    {textEdits: [], newVisualization: false}
  );
  const [showEditHighlight, setShowEditHighlight] = useState(false);
  
  // State for UI controls
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [manualEditContent, setManualEditContent] = useState(content);
  const [showEditToolbar, setShowEditToolbar] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  
  // Refs for auto-scrolling and focusing
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const manualEditRef = useRef<HTMLTextAreaElement>(null);
  
  // Use either charts or visualizations prop, with charts taking precedence
  const chartConfigs = currentVisualizations;
  
  // Call onRenderComplete when component mounts
  useEffect(() => {
    if (onRenderComplete) {
      onRenderComplete();
    }
  }, [onRenderComplete]);
  
  // Update state when props change
  useEffect(() => {
    setCurrentTitle(title);
    setCurrentContent(content);
    setManualEditContent(content);
    setCurrentVisualizations(charts || visualizations || []);
  }, [title, content, charts, visualizations]);
  
  // Handle saving manual edits
  const handleSaveManualEdits = () => {
    setCurrentContent(manualEditContent);
    setIsManualEditing(false);
    
    // Show a highlight effect on the entire content
    setRecentEdits({
      textEdits: [{
        targetContent: content,
        replacementContent: manualEditContent
      }],
      newVisualization: false
    });
    setShowEditHighlight(true);
    
    // Auto-hide the highlight after 5 seconds
    setTimeout(() => {
      setShowEditHighlight(false);
    }, 5000);
  };
  
  // Function to clean up LLM-generated content
  const cleanLLMContent = (content: string): string => {
    if (!content) return '';
    
    let cleanedContent = content;
    
    // Remove markdown formatting
    cleanedContent = cleanedContent
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1') // Remove bold+italic
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/##+ (.+)$/gm, '$1') // Remove heading marks
      .replace(/BITCHHHH#/g, '') // Remove inappropriate markers
      .replace(/\*\*([^*]+):\*\*/g, '$1:') // Remove formatting from field names
      .replace(/\n{3,}/g, '\n\n'); // Replace excessive newlines
    
    return cleanedContent;
  };
  
  // Set initial manualEditContent to clean version when entering edit mode
  useEffect(() => {
    if (isManualEditing) {
      setManualEditContent(cleanLLMContent(currentContent));
    }
  }, [isManualEditing]);
  
  // Auto-scroll chat to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversationHistory, isSubmitting]);

  // Check if content is valid
  const hasValidContent = currentContent && currentContent.trim().length > 0;
  
  // Process content to remove duplicate headers that match the title
  const processContent = (content: string): string => {
    if (!content) return '';
    
    // First, clean up the content by removing all markdown formatting
    let cleanedContent = content
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1');
    
    // Remove all possible user input fields with any case variations
    const inputFields = [
      'Report Topic', 'REPORT TOPIC', 'report topic',
      'Company', 'COMPANY', 'company',
      'Target Audience', 'TARGET AUDIENCE', 'target audience',
      'Word Count', 'WORD COUNT', 'word count',
      'Timeframe', 'TIMEFRAME', 'timeframe',
      'Data Sources', 'DATA SOURCES', 'data sources',
      'Industry', 'INDUSTRY', 'industry',
      'Location', 'LOCATION', 'location',
      'Website', 'WEBSITE', 'website'
    ];
    
    // Create a pattern that matches any input field followed by a colon and text
    const inputFieldsPattern = new RegExp(
      `^\\s*(${inputFields.join('|')})\\s*:.*?$`, 'gmi'
    );
    
    cleanedContent = cleanedContent.replace(inputFieldsPattern, '');
    
    // Remove duplicate headings that match the main title
    // First, extract the exact title words to match against
    const titleWords = title.split(/\s+/).filter(word => word.length > 3);
    const titlePattern = titleWords.length > 1 
      ? new RegExp(`^\\s*#{1,3}\\s+.*?(${titleWords.slice(0, 3).join('|')}).*?$`, 'gmi')
      : new RegExp(`^\\s*#{1,3}\\s+.*?${title}.*?$`, 'gmi');
    
    // Find all heading matches
    const matches: string[] = [];
    let match;
    let matchCount = 0;
    
    // Reset the regex lastIndex
    titlePattern.lastIndex = 0;
    
    // Find all duplicate headings
    while ((match = titlePattern.exec(cleanedContent)) !== null) {
      matchCount++;
      // Keep the first match, remove others
      if (matchCount > 1) {
        matches.push(match[0]);
      }
    }
    
    // Remove all duplicate headings
    matches.forEach(matchText => {
      cleanedContent = cleanedContent.replace(matchText, '');
    });
    
    // Clean up any consecutive newlines
    cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n');
    
    return cleanedContent.trim();
  };

  const renderChart = (config: ChartConfig, index: number) => {
    // Validate chart config
    if (!config || !config.data || !config.data.labels || !config.data.datasets) {
      return (
        <div key={`chart-error-${index}`} className="mb-8 p-4 bg-red-50 rounded-lg text-red-600">
          <p>Error: Invalid chart configuration</p>
        </div>
      );
    }
    
    // Validate datasets have proper data
    const validDatasets = config.data.datasets.filter(dataset => 
      dataset && Array.isArray(dataset.data) && dataset.data.length > 0
    );
    
    if (validDatasets.length === 0) {
      return (
        <div key={`chart-error-${index}`} className="mb-8 p-4 bg-yellow-50 rounded-lg text-yellow-700">
          <p>Warning: Chart has no valid data to display</p>
          <p className="text-sm mt-1">{config.title}</p>
        </div>
      );
    }
    
    // Ensure all data values are numbers
    const enhancedDatasets = validDatasets.map(dataset => ({
      ...dataset,
      data: dataset.data.map(val => typeof val === 'string' ? parseFloat(val) || 0 : val)
    }));
    
    // Set default options for better chart appearance
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            boxWidth: 12,
            padding: 15,
            font: {
              size: 12
            }
          }
        },
        title: {
          display: true,
          text: config.title,
          font: {
            size: 16,
            weight: 'bold'
          },
          padding: {
            top: 10,
            bottom: 20
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          titleFont: {
            size: 14
          },
          bodyFont: {
            size: 13
          },
          padding: 10,
          caretSize: 6,
          displayColors: true
        }
      }
    };

    // Merge default options with any provided options
    const chartOptions = {
      ...defaultOptions,
      ...(config.options || {})
    };

    // Ensure datasets have proper styling
    const enhancedData = {
      ...config.data,
      datasets: enhancedDatasets.map(dataset => ({
        ...dataset,
        borderWidth: dataset.borderWidth || 1,
        borderColor: dataset.borderColor || (
          typeof dataset.backgroundColor === 'string' 
            ? dataset.backgroundColor 
            : '#ffffff'
        )
      }))
    };

    // Render the appropriate chart type
    let chartComponent;
    switch (config.type.toLowerCase()) {
      case 'bar':
        chartComponent = <Bar data={enhancedData} options={chartOptions} />;
        break;
      case 'line':
        chartComponent = <Line data={enhancedData} options={chartOptions} />;
        break;
      case 'pie':
        chartComponent = <Pie data={enhancedData} options={chartOptions} />;
        break;
      case 'doughnut':
        chartComponent = <Doughnut data={enhancedData} options={chartOptions} />;
        break;
      case 'polararea':
      case 'polar':
      case 'polar-area':
        chartComponent = <PolarArea data={enhancedData} options={chartOptions} />;
        break;
      case 'radar':
        chartComponent = <Radar data={enhancedData} options={chartOptions} />;
        break;
      case 'scatter':
        chartComponent = <Scatter data={enhancedData} options={chartOptions} />;
        break;
      default:
        chartComponent = <Bar data={enhancedData} options={chartOptions} />;
    }

    return (
      <div key={`chart-${index}`} className="mb-8">
        <div className="h-64 md:h-80 mb-3">
          {chartComponent}
        </div>
        {config.description && (
          <div className="text-sm text-gray-600 italic px-4">
            {config.description}
          </div>
        )}
      </div>
    );
  };

  const processedContent = processContent(currentContent);
  
  // Function to handle sending edit suggestions
  const handleSendEditSuggestion = async () => {
    if (!editMessage.trim()) return;
    
    setIsSubmitting(true);
    
    // Add user message to conversation history
    setConversationHistory(prev => [...prev, { role: 'user', content: editMessage }]);
    
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please log in.');
      }
      
      // Call the suggest-edits API
      const response = await fetch('/api/suggest-edits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: editMessage,
          reportId: reportId || new Date().getTime().toString(),
          reportContent: currentContent,
          reportTitle: currentTitle,
          visualizations: currentVisualizations,
          originalUserInput,
          conversationId,
          history: conversationHistory
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process edit suggestion');
      }
      
      const data = await response.json();
      
      // Save conversation ID for future messages
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
      
      // Update conversation history with AI response
      setConversationHistory(data.history);
      
      // Apply edits if any
      if (data.edits && data.edits.type !== 'none') {
        // Track recent edits for highlighting
        const newRecentEdits = {
          textEdits: [] as {targetContent: string, replacementContent: string}[],
          newVisualization: false
        };
        
        // Handle text edits
        if (data.edits.type === 'text_edit' && data.edits.textEdits && data.edits.textEdits.length > 0) {
          let updatedContent = currentContent;
          
          data.edits.textEdits.forEach((edit: { targetContent: string; replacementContent: string }) => {
            if (edit.targetContent && edit.replacementContent !== undefined) {
              // Store the edit for highlighting
              newRecentEdits.textEdits.push({
                targetContent: edit.targetContent,
                replacementContent: edit.replacementContent
              });
              
              // Apply the edit - empty string is valid for deletions
              updatedContent = updatedContent.replace(edit.targetContent, edit.replacementContent);
            }
          });
          
          // Update content with changes
          setCurrentContent(updatedContent);
        }
        
        // Handle new visualization
        if (data.edits.type === 'visualization' && data.edits.newVisualization) {
          // Check if the visualization has all required properties
          const viz = data.edits.newVisualization;
          if (viz.type && viz.data && viz.data.labels && viz.data.datasets) {
            // Ensure the visualization has proper formatting
            const formattedViz = {
              ...viz,
              title: viz.title || 'Generated Visualization',
              description: viz.description || '',
              data: {
                labels: Array.isArray(viz.data.labels) ? viz.data.labels : [],
                datasets: Array.isArray(viz.data.datasets) ? viz.data.datasets.map((dataset: any) => ({
                  label: dataset.label || 'Data',
                  data: Array.isArray(dataset.data) ? dataset.data : [],
                  backgroundColor: dataset.backgroundColor || '#8B5CF6',
                  borderColor: dataset.borderColor || '#7C3AED',
                  borderWidth: dataset.borderWidth || 1
                })) : []
              }
            };
            
            // Add the new visualization
            setCurrentVisualizations(prev => [...prev, formattedViz]);
            
            // Mark that we've added a new visualization
            newRecentEdits.newVisualization = true;
            
            // Scroll to visualizations section after a short delay
            setTimeout(() => {
              const visualizationsSection = document.querySelector('.report-container .mt-8');
              if (visualizationsSection) {
                visualizationsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 500);
          }
        }
        
        // Set recent edits for highlighting
        setRecentEdits(newRecentEdits);
        setShowEditHighlight(true);
        
        // Auto-hide the highlight after 5 seconds
        setTimeout(() => {
          setShowEditHighlight(false);
        }, 5000);
      }
      
      // Clear the input field
      setEditMessage('');
    } catch (error) {
      console.error('Error sending edit suggestion:', error);
      // Add error message to conversation
      setConversationHistory(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: `Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`
        }
      ]);
    } finally {
      setIsSubmitting(false);
      
      // Focus back on the input field
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }
  };
  
  // Handle input key press (for Enter to send)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendEditSuggestion();
    }
  };
  
  // Auto-resize textarea as user types
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditMessage(e.target.value);
    
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  // Add document exec commands for rich text editing
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    // Force focus back to the editable area
    const reportContent = document.querySelector('.report-content') as HTMLElement;
    if (reportContent) {
      reportContent.focus();
    }
  };

  // Detect if we're in edit mode from props
  const isInEditMode = !!onSave;
  
  // Show toolbar when editable content is selected
  useEffect(() => {
    if (isInEditMode) {
      const handleSelection = () => {
        const selection = window.getSelection();
        setShowEditToolbar(!!selection && selection.toString().length > 0);
      };
      
      document.addEventListener('selectionchange', handleSelection);
      return () => {
        document.removeEventListener('selectionchange', handleSelection);
      };
    }
    return undefined;
  }, [isInEditMode]);

  // Function to show a styled toast notification that matches the project creation style
  const showStyledToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const iconMap = {
      'success': <FaCheckCircle className="text-green-500 text-lg" />,
      'error': <FaTimes className="text-red-500 text-lg" />,
      'info': <FaCheck className="text-blue-500 text-lg" />
    };
    
    toast.custom(() => (
      <div className={`max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex justify-center items-center py-4 px-6 border ${
        type === 'success' ? 'border-green-100' : type === 'error' ? 'border-red-100' : 'border-blue-100'
      }`}>
        <div className="flex items-center justify-center">
          {iconMap[type]}
          <p className="ml-3 text-base font-medium text-gray-900">{message}</p>
        </div>
      </div>
    ), { duration: 3000, position: 'top-center' });
  };

  // Function to save the report directly to the database
  const saveReportToDatabase = async () => {
    if (!reportId) {
      showStyledToast("Error: Report ID is missing", "error");
      return;
    }
    
    try {
      // Create a request to save the report
      const response = await fetch('/api/saved-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'saveReport',
          reportData: {
            title: currentTitle,
            topic: '',
            content: currentContent,
            visualizations: currentVisualizations,
            createdAt: new Date().toISOString(),
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save report');
      }
      
      showStyledToast("Report saved successfully!", "success");
    } catch (error) {
      console.error('Error saving report:', error);
      showStyledToast("Failed to save report", "error");
    }
  };

  return (
    <>
      <div className="report-container" style={{ fontFamily: 'Times New Roman, serif', maxWidth: '800px', margin: '0 auto', padding: '40px 60px', backgroundColor: 'white', boxShadow: '0 0 10px rgba(0,0,0,0.1)', borderRadius: '4px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', marginBottom: '24px', color: 'black' }}>{currentTitle}</h1>
        
        {/* Rich Text Editor Toolbar (shown only in edit mode) */}
        {isInEditMode && (
          <div className="edit-toolbar" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '8px', 
            backgroundColor: '#f5f3ff', // Light purple background
            borderRadius: '4px',
            marginBottom: '12px',
            border: '1px solid #ddd6fe' // Light purple border
          }}>
            <button 
              onClick={() => execCommand('bold')}
              className="toolbar-btn"
              title="Bold"
              style={{ 
                margin: '0 4px', 
                padding: '4px 8px', 
                backgroundColor: 'white', 
                border: '1px solid #ddd6fe',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'black',
                height: '32px',
                minWidth: '32px'
              }}
            >
              <strong>B</strong>
            </button>
            <button 
              onClick={() => execCommand('italic')}
              className="toolbar-btn"
              title="Italic"
              style={{ 
                margin: '0 4px', 
                padding: '4px 8px', 
                backgroundColor: 'white', 
                border: '1px solid #ddd6fe',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'black',
                height: '32px',
                minWidth: '32px'
              }}
            >
              <em>I</em>
            </button>
            <button 
              onClick={() => execCommand('underline')}
              className="toolbar-btn"
              title="Underline"
              style={{ 
                margin: '0 4px', 
                padding: '4px 8px', 
                backgroundColor: 'white', 
                border: '1px solid #ddd6fe',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'black',
                height: '32px',
                minWidth: '32px'
              }}
            >
              <u>U</u>
            </button>
            <div style={{ width: '1px', height: '20px', backgroundColor: '#ddd6fe', margin: '0 8px' }}></div>
            
            {/* Font family dropdown */}
            <select
              onChange={(e) => execCommand('fontName', e.target.value)}
              style={{
                margin: '0 4px',
                padding: '4px 8px',
                backgroundColor: 'white',
                border: '1px solid #ddd6fe',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'black',
                height: '32px'
              }}
            >
              <option value="">Font</option>
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
            </select>
            
            {/* Font size dropdown */}
            <select
              onChange={(e) => execCommand('fontSize', e.target.value)}
              style={{
                margin: '0 4px',
                padding: '4px 8px',
                backgroundColor: 'white',
                border: '1px solid #ddd6fe',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'black',
                height: '32px'
              }}
            >
              <option value="">Size</option>
              <option value="1">8pt</option>
              <option value="2">10pt</option>
              <option value="3">12pt</option>
              <option value="4">14pt</option>
              <option value="5">18pt</option>
              <option value="6">24pt</option>
              <option value="7">36pt</option>
            </select>
          </div>
        )}
        
        {hasValidContent ? (
          <div 
            className="report-content" 
            style={{ 
              lineHeight: '1.6', 
              fontSize: '14px', 
              color: 'black',
              ...(isInEditMode ? {
                border: '1px solid #e2e8f0',
                padding: '12px',
                borderRadius: '4px',
                minHeight: '300px',
                outline: 'none'
              } : {})
            }}
          >
            {isManualEditing ? (
              /* Manual editing mode */
              <div className="manual-edit-container" style={{ position: 'relative' }}>
                <textarea
                  ref={manualEditRef}
                  value={manualEditContent}
                  onChange={(e) => setManualEditContent(e.target.value)}
                  className="w-full px-4 py-3 border border-purple-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                  style={{ 
                    minHeight: '400px', 
                    fontFamily: 'Times New Roman, serif',
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => setIsManualEditing(false)}
                    className="mr-2 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveManualEdits}
                    className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              /* View mode with rendered content */
              <>
                <div dangerouslySetInnerHTML={{ 
                  __html: (() => {
                    // Create a function to process the content properly
                    let htmlContent = processedContent;
                    
                    // First, handle duplicate headings by tracking which ones we've seen
                    const seenHeadings = new Set();
                    
                    // Replace headings with a function that checks for duplicates
                    htmlContent = htmlContent.replace(/^(#{1,3})\s+(.+)$/gm, (match, hashes, text) => {
                      // Create a normalized version of the heading for comparison
                      const normalizedHeading = text.toLowerCase().trim();
                      
                      // If this heading contains the title (case insensitive)
                      if (normalizedHeading.includes(currentTitle.toLowerCase()) || 
                          currentTitle.toLowerCase().includes(normalizedHeading)) {
                        // If we've seen this heading before, remove it
                        if (seenHeadings.has('title')) {
                          return '';
                        }
                        // Mark that we've seen a title heading
                        seenHeadings.add('title');
                      }
                      
                      // Convert the heading to HTML based on level
                      if (hashes === '#') {
                        return `<h2 style="font-size: 18px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">${text}</h2>`;
                      } else if (hashes === '##') {
                        return `<h3 style="font-size: 16px; font-weight: bold; margin-top: 16px; margin-bottom: 8px;">${text}</h3>`;
                      } else {
                        return `<h4 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 7px;">${text}</h4>`;
                      }
                    });
                    
                    // Remove all markdown formatting
                    htmlContent = htmlContent
                      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
                      .replace(/\*\*([^*]+)\*\*/g, '$1')
                      .replace(/\*([^*]+)\*/g, '$1');
                    
                    // Highlight recent text edits if any
                    if (showEditHighlight && recentEdits.textEdits.length > 0) {
                      recentEdits.textEdits.forEach(edit => {
                        if (edit.replacementContent) {
                          // Only highlight the replacement content, not the original
                          const highlightedReplacement = `<span class="edit-highlight" style="background-color: #e9d5ff; padding: 2px; border-radius: 2px; transition: background-color 0.5s ease;">${edit.replacementContent}</span>`;
                          htmlContent = htmlContent.replace(edit.replacementContent, highlightedReplacement);
                        }
                      });
                    }
                      
                    return htmlContent;
                  })()
                    // Format bullet points
                    .replace(/^\s*[\*\-]\s+(.+)$/gm, '<div style="margin-left: 20px; margin-bottom: 8px;">• $1</div>')
                    // Format paragraphs
                    .replace(/^(?!<h|<div|$)(.+)$/gm, '<p style="margin-bottom: 12px;">$1</p>')
                }} />
                
                {/* Notification for changes */}
                {showEditHighlight && (
                  <div className="edit-notification" style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    backgroundColor: '#e2f8e8', // Light green background
                    color: 'black',
                    padding: '10px 15px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    animation: 'fadeIn 0.3s ease-out',
                    maxWidth: '300px',
                    border: '1px solid #a7e3b5' // Green border
                  }}>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>
                      {recentEdits.textEdits.length > 0 && `${recentEdits.textEdits.length} text edit${recentEdits.textEdits.length !== 1 ? 's' : ''} applied`}
                      {recentEdits.textEdits.length > 0 && recentEdits.newVisualization && ' and '}
                      {recentEdits.newVisualization && 'new visualization added'}
                    </p>
                    <style jsx>{`
                      @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-20px); }
                        to { opacity: 1; transform: translateY(0); }
                      }
                    `}</style>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div style={{ backgroundColor: '#FEF2F2', padding: '16px', borderRadius: '4px', marginBottom: '24px', color: '#DC2626' }}>
            <p>Error: Report content is missing or empty.</p>
          </div>
        )}
        
        {currentVisualizations.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-6 text-black">Visualizations</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {currentVisualizations.map((config, index) => {
                const isNewVisualization = showEditHighlight && 
                                         recentEdits.newVisualization && 
                                         index === currentVisualizations.length - 1;
                
                return (
                  <div key={`chart-container-${index}`} 
                    className={isNewVisualization ? 'new-visualization-highlight' : ''}
                    style={isNewVisualization ? {
                      position: 'relative',
                      animation: 'pulse 2s infinite',
                      border: '2px solid #a7e3b5', // Green border
                      borderRadius: '8px',
                      padding: '8px',
                      boxShadow: '0 0 15px rgba(167, 227, 181, 0.5)' // Green shadow
                    } : {}}
                  >
                    {isNewVisualization && (
                      <div style={{
                        position: 'absolute',
                        top: '-12px',
                        right: '10px',
                        backgroundColor: '#e2f8e8', // Light green background
                        color: 'black',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        zIndex: 5,
                        border: '1px solid #a7e3b5' // Green border
                      }}>
                        New
                      </div>
                    )}
                    {renderChart(config, index)}
                    {isNewVisualization && (
                      <style jsx>{`
                        @keyframes pulse {
                          0% { box-shadow: 0 0 0 0 rgba(167, 227, 181, 0.7); }
                          70% { box-shadow: 0 0 0 10px rgba(167, 227, 181, 0); }
                          100% { box-shadow: 0 0 0 0 rgba(167, 227, 181, 0); }
                        }
                      `}</style>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ReportRenderer; 