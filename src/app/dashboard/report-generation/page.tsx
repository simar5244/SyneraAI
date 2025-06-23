'use client';
import React, { useState, useRef, useEffect } from 'react';
import { FaFileAlt, FaInfoCircle, FaBuilding, FaGlobe, FaSearch, FaCommentAlt, FaChartBar, FaUsers, FaFileWord, FaFilePdf, FaDownload, FaCheck, FaTimes, FaDatabase, FaHistory, FaEdit, FaPaperPlane, FaComments, FaSpinner, FaCalendarAlt } from 'react-icons/fa';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import ReportRenderer from '@/components/ReportRenderer';
import { toast } from 'sonner';
import { Bar, Line, Pie, Doughnut, PolarArea, Radar } from 'react-chartjs-2';
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

// Use dynamic import for the ReportRenderer component to address any SSR issues with Chart.js
const ReportRendererComponent = dynamic(
  () => import('../../../components/ReportRenderer'),
  { ssr: false }
);

export default function ReportGeneration() {
  // Add custom styles for the scrollbar
  React.useEffect(() => {
    // Add custom scrollbar styles
    const style = document.createElement('style');
    style.textContent = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 10px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 5px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #8B5CF6;
        border-radius: 5px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #7C3AED;
      }
      .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: #8B5CF6 #f1f1f1;
      }
      
      /* Add styles for contentEditable */
      .report-content[contenteditable="true"] {
        border: 1px dashed #8B5CF6;
        padding: 10px;
        min-height: 300px;
        outline: none;
      }
      .report-content[contenteditable="true"]:focus {
        border: 1px solid #8B5CF6;
        box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [formData, setFormData] = useState({
    reportTopic: '',
    company: '',
    location: '',
    website: '',
    additionalContext: '',
    wordCount: 1000,
    stakeholders: '',
    targetAudience: '',
    timeframe: '',
    deliveryFormat: 'pdf',
    includeVisuals: true,
    // Add new fields for scheduling
    scheduleReport: false,
    scheduleFrequency: 'weekly',
    scheduleCustomMinutes: 0,
    scheduleCustomHours: 0
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [queryResults, setQueryResults] = useState<any>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [prefetchedData, setPrefetchedData] = useState<any>(null);
  const [isDataApproved, setIsDataApproved] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Add state for chat interface
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{role: string, content: string}>>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [manualEditContent, setManualEditContent] = useState('');
  
  // Function to load conversation history for a specific report
  const loadConversationHistory = async (reportId: string) => {
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) return [];
      
      const response = await fetch(`/api/conversations?reportId=${reportId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.conversations || [];
    } catch (error) {
      console.error('Error loading conversation history:', error);
      return [];
    }
  };
  
  // Function to save conversation history for a specific report
  const saveConversationHistory = async (reportId: string, conversations: Array<{role: string, content: string}>) => {
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) return false;
      
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reportId,
          conversations
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error saving conversation history:', error);
      return false;
    }
  };
  
  // Effect to load conversation history when report changes
  useEffect(() => {
    const fetchConversationHistory = async () => {
      if (report?.reportId) {
        const history = await loadConversationHistory(report.reportId);
        setChatHistory(history);
      }
    };
    
    fetchConversationHistory();
  }, [report?.reportId]);
  
  // Effect to make report content editable when in edit mode
  useEffect(() => {
    if (isManualEditing) {
      const reportContent = document.querySelector('.report-content');
      if (reportContent) {
        reportContent.setAttribute('contenteditable', 'true');
        setTimeout(() => {
          (reportContent as HTMLElement).focus();
        }, 100);
      }
    } else {
      const reportContent = document.querySelector('.report-content');
      if (reportContent) {
        reportContent.removeAttribute('contenteditable');
      }
    }
  }, [isManualEditing]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Handle checkbox inputs
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      setFormData(prev => ({
        ...prev,
        [name]: checkbox.checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };
  
  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };
  
  // Function to clean up and format database query results for display
  const formatDatabaseResults = (rawResults: string): string => {
    if (!rawResults) return '';
    
    let formatted = rawResults
      // Remove markdown-style formatting
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1')     // Remove italic
      .replace(/^#+\s+(.+)$/gm, '$1')    // Remove heading markers
      .replace(/`([^`]+)`/g, '$1')       // Remove code ticks
      
      // Clean up LLM output artifacts
      .replace(/<+([^>]+)>+/g, '$1')     // Remove angle brackets
      .replace(/\[\[([^\]]+)\]\]/g, '$1') // Remove double brackets
      
      // Format actual data
      .replace(/^([\d\.]+\.\s+[A-Za-z\s]+:)/gm, '<strong>$1</strong>') // Format section headings as bold
      .replace(/(\w+:)\s+(\d[\d\.,]+)/g, '<strong>$1</strong> $2')     // Format metric labels
      .replace(/(\w+\s+Status:)/g, '<strong>$1</strong>');             // Format status labels
    
    return formatted;
  };
  
  const prefetchData = async () => {
    setIsPrefetching(true);
    setError(null);
    
    try {
      // First, fetch the data for user approval
      const response = await fetch('/api/report-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          operation: 'prefetch', // Specify the operation type
          predefinedPrompt: `Generate a comprehensive business report on the following topic: "${formData.reportTopic}".
Please include detailed information about:
1. Current status and overview
2. Key metrics and statistics
3. Trends and patterns
4. Challenges and opportunities
5. Recommendations and next steps

For a company named "${formData.company}" located in "${formData.location}".
Additional context: ${formData.additionalContext || "None provided"}
Target audience: ${formData.targetAudience || "General business"}
Stakeholders: ${formData.stakeholders || "Not specified"}
Timeframe: ${formData.timeframe || "Current"}

Please be extremely thorough and provide all available data including metrics, statistics, people details, project information, and performance indicators.
Include specific numbers, dates, status information, and detailed context that would be valuable for a professional business report.
Be as specific and data-rich as possible.

The report should be approximately ${formData.wordCount} words in length.

Important: Do not use any markdown formatting, asterisks, angle brackets, or other special formatting in your response. Provide clean, readable text only.
`
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data for report');
      }
      
      const data = await response.json();
      
      // Format the response for better display
      if (data.claudeResponse?.response) {
        data.claudeResponse.response = formatDatabaseResults(data.claudeResponse.response);
      }
      
      // Save prefetched data
      setPrefetchedData(data);
      setIsPrefetching(false);
      // Show data approval step
      setCurrentStep(5);
    } catch (error) {
      console.error('Error fetching data for report:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setIsPrefetching(false);
    }
  };
  
  const generateReport = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      console.log("Generating report with approved data");
      
      // Now generate the actual report with approved data
      const response = await fetch('/api/report-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          operation: 'generate', // Specify the operation type
          reportId: prefetchedData?.reportId, // Pass the same report ID for continuity
          approvedData: prefetchedData?.claudeResponse?.response,
          approvedWebContext: prefetchedData?.webContext,
          approvedWebData: prefetchedData?.webData,
          approvedDbSourceInfo: prefetchedData?.dbSourceInfo,
          extractedData: prefetchedData?.extractedData, // Pass the extracted data to avoid reprocessing
          customVisualizations: prefetchedData?.customVisualizations // Pass any custom visualizations if they exist
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }
      
      const data = await response.json();
      console.log("Report data received:", {
        title: data.title,
        contentLength: data.content?.length || 0,
        hasContent: Boolean(data.content),
        contentFirstChars: data.content ? data.content.substring(0, 50) : "MISSING",
        hasCharts: Boolean(data.charts?.length),
        chartsCount: data.charts?.length || 0,
        visualizationsCount: data.visualizations?.length || 0
      });
      
      // Ensure we have valid report data
      if (!data.content || data.content.trim() === '') {
        console.error("ERROR: Received empty report content from API");
        data.content = `# ${data.title || 'Generated Report'}\n\n## Error\n\nThe report content could not be generated properly. Please try again.`;
      }
      
      // Save the generated report and query results
      setReport(data);
      setQueryResults(data.queryResults || {});
      setIsGenerating(false);
      setCurrentStep(6); // Move to the final step to view the report
      
      // Log after state update for debugging
      setTimeout(() => {
        console.log("Report state after update:", {
          hasReport: Boolean(report),
          title: report?.title,
          contentLength: report?.content?.length || 0
        });
      }, 100);
    } catch (error) {
      console.error('Error generating report:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setIsGenerating(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentStep === 4) {
      // When submitting from step 4, we're prefetching data
      await prefetchData();
    } else if (currentStep === 5 && isDataApproved) {
      // When submitting from step 5 with approval, we're generating the report
      await generateReport();
    }
  };

  const approveData = () => {
    setIsDataApproved(true);
    generateReport();
  };

  const rejectData = () => {
    setPrefetchedData(null);
    setCurrentStep(1);
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
      .replace(/\n{3,}/g, '\n\n'); // Replace excessive newlines
    
    return cleanedContent;
  };

  // Handle saving manual edits
  const handleSaveManualEdits = () => {
    if (report) {
      // Get the current content from the editable div
      const reportContentElement = document.querySelector('.report-content');
      if (!reportContentElement) {
        toast.error('Could not find report content element');
        return;
      }
      
      // Get the HTML content from the editable div
      const updatedContent = reportContentElement.innerHTML;
      
      setReport({
        ...report,
        content: updatedContent
      });
      
      setIsManualEditing(false);
      // Show success toast
      toast.success("Report content updated successfully");
    }
  };

  // Add this new function for a better text editor experience
  const renderEditInterface = () => {
    return (
      <div className="edit-interface bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <FaEdit className="mr-2 text-purple-600" />
            Edit Report Content
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setIsManualEditing(false)}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors flex items-center"
            >
              <FaTimes className="mr-1 h-3.5 w-3.5" /> Cancel
            </button>
            <button
              onClick={handleSaveManualEdits}
              className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center"
            >
              <FaCheck className="mr-1 h-3.5 w-3.5" /> Save Changes
            </button>
          </div>
        </div>
        
        {/* Simple formatting toolbar */}
        <div className="bg-gray-50 p-2 rounded-t border border-gray-300 flex flex-wrap gap-1">
          <button
            onClick={() => {
              // Insert markdown bold
              const textarea = document.getElementById('report-editor') as HTMLTextAreaElement;
              if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selectedText = textarea.value.substring(start, end);
                const replacement = `**${selectedText}**`;
                setManualEditContent(
                  textarea.value.substring(0, start) + replacement + textarea.value.substring(end)
                );
                // Set selection after insertion
                setTimeout(() => {
                  textarea.focus();
                  textarea.setSelectionRange(start + 2, end + 2);
                }, 0);
              }
            }}
            className="p-1 rounded bg-white border border-gray-300 hover:bg-gray-100"
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => {
              // Insert markdown italic
              const textarea = document.getElementById('report-editor') as HTMLTextAreaElement;
              if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selectedText = textarea.value.substring(start, end);
                const replacement = `*${selectedText}*`;
                setManualEditContent(
                  textarea.value.substring(0, start) + replacement + textarea.value.substring(end)
                );
                // Set selection after insertion
                setTimeout(() => {
                  textarea.focus();
                  textarea.setSelectionRange(start + 1, end + 1);
                }, 0);
              }
            }}
            className="p-1 rounded bg-white border border-gray-300 hover:bg-gray-100"
            title="Italic"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => {
              // Insert markdown heading
              const textarea = document.getElementById('report-editor') as HTMLTextAreaElement;
              if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selectedText = textarea.value.substring(start, end);
                // Add heading at the beginning of the line
                const lineStart = textarea.value.substring(0, start).lastIndexOf("\n") + 1;
                const beforeText = textarea.value.substring(0, lineStart);
                const afterText = textarea.value.substring(lineStart);
                const replacement = `## ${afterText.substring(0, end - lineStart)}`;
                setManualEditContent(
                  beforeText + replacement + textarea.value.substring(end)
                );
              }
            }}
            className="p-1 px-2 rounded bg-white border border-gray-300 hover:bg-gray-100"
            title="Heading"
          >
            H
          </button>
          <button
            onClick={() => {
              // Insert bullet list
              const textarea = document.getElementById('report-editor') as HTMLTextAreaElement;
              if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                // Add bullet at the beginning of the line
                const lineStart = textarea.value.substring(0, start).lastIndexOf("\n") + 1;
                const beforeText = textarea.value.substring(0, lineStart);
                const afterText = textarea.value.substring(lineStart);
                const replacement = `- ${afterText.substring(0, end - lineStart)}`;
                setManualEditContent(
                  beforeText + replacement + textarea.value.substring(end)
                );
              }
            }}
            className="p-1 px-2 rounded bg-white border border-gray-300 hover:bg-gray-100"
            title="Bullet List"
          >
            •
          </button>
        </div>
        
        <textarea
          id="report-editor"
          value={manualEditContent}
          onChange={(e) => setManualEditContent(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-b focus:ring-purple-500 focus:border-purple-500 text-gray-800"
          style={{ 
            minHeight: '500px', 
            fontFamily: 'Times New Roman, serif',
            fontSize: '14px',
            lineHeight: '1.6'
          }}
        />
        
        <div className="text-sm text-gray-500 mt-2">
          <p>Use markdown formatting for better results: **bold**, *italic*, ## Heading, - List item</p>
        </div>
      </div>
    );
  };

  const renderReport = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6" ref={reportRef}>
        {report ? (
          <>
            {isManualEditing ? (
              renderEditInterface()
            ) : (
              <ReportRenderer 
                title={report.title || ''} 
                content={report.content || ''} 
                charts={report.charts || report.visualizations || []}
                reportId={prefetchedData?.reportId || report.reportId}
                originalUserInput={JSON.stringify(formData)}
                onRenderComplete={() => {
                  // Scroll to the report if needed
                  if (reportRef.current) {
                    reportRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              />
            )}
            
            {/* Custom report control buttons */}
            <div className="mt-8 p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                {/* Chat bar on left */}
                <div className="flex items-center w-1/2 max-w-md">
                  <div className="relative flex-1">
                    {isSendingChat ? (
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-purple-500 rounded-full animate-pulse"></div>
                    ) : (
                      <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    )}
                    <input
                      type="text"
                      placeholder="Suggest edits..."
                      className="pl-9 pr-12 w-full bg-white border border-gray-200 rounded-md py-2 text-sm text-black"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleChatSubmit(e);
                        }
                      }}
                      disabled={isSendingChat}
                    />
                    <button
                      className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full ${
                        isSendingChat || !chatMessage.trim() 
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                          : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                      }`}
                      onClick={handleChatSubmit}
                      disabled={isSendingChat || !chatMessage.trim()}
                    >
                      <FaPaperPlane className="h-3 w-3" />
                    </button>
                  </div>
                  
                  {/* Show conversation history button - placed next to the chat input */}
                  {chatHistory.length > 0 && (
                    <button
                      onClick={() => setShowConversation(!showConversation)}
                      className="ml-2 bg-purple-100 text-black hover:bg-purple-200 border-purple-200 border rounded-md px-3 py-1.5 text-sm flex items-center"
                      title="Show conversation history"
                    >
                      <FaComments className="mr-2 h-3.5 w-3.5" />
                      {showConversation ? 'Hide Chat' : 'Show Chat'}
                    </button>
                  )}
                </div>
                
                {/* Action buttons on right */}
                <div className="flex items-center space-x-2">
                  {/* 1. Edit button */}
                  <button
                    onClick={() => {
                      if (!isManualEditing) {
                        // Set content editable when entering edit mode
                        setIsManualEditing(true);
                      } else {
                        // Save changes when exiting edit mode
                        handleSaveManualEdits();
                      }
                    }}
                    className="bg-purple-100 text-black hover:bg-purple-200 border-purple-200 border rounded-md px-3 py-1.5 text-sm flex items-center"
                  >
                    <FaEdit className="mr-2 h-3.5 w-3.5" />
                    {isManualEditing ? 'Save Edits' : 'Edit'}
                  </button>
                  
                  {/* 2. Export dropdown button */}
                  <div className="relative inline-block">
                    <button
                      onClick={() => setShowExportOptions(!showExportOptions)}
                      className="bg-purple-100 text-black hover:bg-purple-200 border-purple-200 border rounded-md px-3 py-1.5 text-sm flex items-center"
                    >
                      <FaDownload className="mr-2 h-3.5 w-3.5" />
                      Export
                    </button>
                    
                    {showExportOptions && (
                      <div className="absolute bottom-full mb-2 right-0 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                        <div className="py-1" role="menu" aria-orientation="vertical">
                          <button 
                            onClick={() => {
                              exportReport('pdf');
                              setShowExportOptions(false);
                            }}
                            className="flex w-full items-center px-4 py-2 text-sm text-black hover:bg-gray-100"
                            role="menuitem"
                          >
                            <FaFilePdf className="mr-2 h-3.5 w-3.5 text-red-500" />
                            Export as PDF
                          </button>
                          <button 
                            onClick={() => {
                              exportReport('docx');
                              setShowExportOptions(false);
                            }}
                            className="flex w-full items-center px-4 py-2 text-sm text-black hover:bg-gray-100"
                            role="menuitem"
                          >
                            <FaFileWord className="mr-2 h-3.5 w-3.5 text-blue-500" />
                            Export as DOCX
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* 3. Save button */}
                  <button
                    onClick={saveReport}
                    className="bg-purple-100 text-black hover:bg-purple-200 border-purple-200 border rounded-md px-3 py-1.5 text-sm flex items-center"
                  >
                    <FaCheck className="mr-2 h-3.5 w-3.5" /> Save
                  </button>
                </div>
              </div>
              
              {/* Chat Messages (only show when showConversation is true) */}
              {showConversation && chatHistory.length > 0 && (
                <div className="border-t border-gray-200 p-4 bg-white mt-4 rounded-md">
                  <div className="bg-white max-h-[300px] overflow-y-auto">
                    {chatHistory.map((message, index) => (
                      <div 
                        key={index} 
                        className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
                      >
                        <div 
                          className={`inline-block max-w-[75%] rounded-lg px-4 py-2 ${
                            message.role === 'user' 
                              ? 'bg-purple-100 text-black rounded-br-none' 
                              : 'bg-gray-50 border border-gray-200 text-black rounded-bl-none'
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    ))}
                    {isSendingChat && (
                      <div className="text-left mb-4">
                        <div className="inline-flex items-center bg-gray-50 border border-gray-200 text-black rounded-lg px-4 py-2">
                          <FaSpinner className="animate-spin mr-2" />
                          <span>Processing...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-500">Report content not available</p>
          </div>
        )}
      </div>
    );
  };

  // Helper function to normalize PDF content for consistent formatting
  const normalizePdfContent = (content: string): string => {
    if (!content) return '';
    
    // Instead of adding bold styling to everything, we'll preserve only what should be bold
    // and add consistent formatting for the rest
    let cleanedContent = content
      // Replace markdown headings with properly formatted HTML headings
      .replace(/^# (.+)$/gm, '<h1 style="font-size: 18pt; font-weight: bold; margin: 16pt 0 8pt 0;">$1</h1>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size: 16pt; font-weight: bold; margin: 14pt 0 7pt 0;">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 style="font-size: 14pt; font-weight: bold; margin: 12pt 0 6pt 0;">$1</h3>')
      
      // Format bullets consistently
      .replace(/^\s*[\*\-]\s+(.+)$/gm, '<div style="margin: 4pt 0 4pt 12pt;">• $1</div>')
      
      // Handle bold and italic with proper styling - BUT PRESERVE CONTENT AS-IS
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<span style="font-weight: bold; font-style: italic;">$1</span>')
      .replace(/\*\*([^*]+)\*\*/g, '<span style="font-weight: bold;">$1</span>')
      .replace(/\*([^*]+)\*/g, '<span style="font-style: italic;">$1</span>')
      
      // Format regular paragraphs WITHOUT adding bold styling
      .replace(/^(?!<h|<div|<span|$)(.+)$/gm, '<p style="margin: 6pt 0; line-height: 1.5;">$1</p>')
      
      // Clean up excessive white space
      .replace(/\n{3,}/g, '\n\n');
    
    // Wrap the entire content in a div with consistent styling - no font-weight by default
    return `<div style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: black;">${cleanedContent}</div>`;
  };

  // Improved export function with better error handling and cleaner PDF formatting
  const exportReport = async (format: string) => {
    setIsExporting(format);
    try {
      // Get token from localStorage 
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required. Please log in.');
        return;
      }
      
      // Use the appropriate processing based on the format
      // For PDF, we use our normalized content
      // For DOCX, we use the original content which works perfectly
      const normalizedContent = format === 'pdf' 
        ? normalizePdfContent(report.content) 
        : report.content;
      
      // Call the API to export the report
      const response = await fetch('/api/report-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          operation: 'export',
          exportFormat: format,
          reportContent: normalizedContent,
          reportTitle: report.title,
          visualizations: report.charts || report.visualizations || [],
          reportId: prefetchedData?.reportId || report.reportId,
          // Add additional styling options for PDF
          pdfOptions: format === 'pdf' ? {
            fontFamily: 'Times New Roman',
            fontSize: '12pt',
            lineHeight: 1.5,
            preserveTextFormatting: true, // Important to preserve the text formatting
            margins: {
              top: '1in',
              bottom: '1in',
              left: '1in',
              right: '1in'
            },
            headerTemplate: `<div style="font-size: 10pt; text-align: center; width: 100%; font-family: Times New Roman;">${report.title || 'Generated Report'}</div>`,
            footerTemplate: `<div style="font-size: 10pt; text-align: center; width: 100%; font-family: Times New Roman;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`
          } : undefined
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to export report as ${format.toUpperCase()}`);
      }
      
      // Create a blob from the response and download it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${report.title || 'Report'}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Report exported as ${format.toUpperCase()} successfully`);
    } catch (error) {
      console.error(`Error exporting report as ${format}:`, error);
      toast.error(`Failed to export report as ${format.toUpperCase()}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(null);
    }
  };

  // Enhanced function to save the report to the database
  const saveReport = async () => {
    setIsExporting('save');
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication error. Please log in.');
        return false;
      }

      // First, check if the report has a valid ID
      const reportId = report.reportId || prefetchedData?.reportId || `report_${Date.now()}`;
      
      // Create a well-structured report object
      const reportData = {
        reportId: reportId,
        title: report.title || 'Untitled Report',
        content: report.content,
        visualizations: report.charts || report.visualizations || [],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          topic: formData.reportTopic,
          company: formData.company,
          wordCount: formData.wordCount,
          targetAudience: formData.targetAudience,
          timeframe: formData.timeframe,
          deliveryFormat: formData.deliveryFormat,
          includeVisuals: formData.includeVisuals
        }
      };

      // Call the API to save the report - using POST method with the correct endpoint
      const response = await fetch('/api/saved-reports', {
        method: 'POST', // Using POST for creating/updating reports
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          action: 'saveReport',
          reportId: reportId,
          reportData: reportData
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save report' }));
        throw new Error(errorData.error || 'Failed to save report');
      }
      
      const result = await response.json();
      
      toast.success("Report saved successfully", {
        description: "You can view this report in Your Reports section",
        action: {
          label: "View Reports",
          onClick: () => window.location.href = '/dashboard/your-reports'
        },
      });
      
      // Add a small delay before resetting the loading state
      setTimeout(() => {
        setIsExporting('');
      }, 500);
      
      return true;
    } catch (error) {
      console.error('Error saving report:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      toast.error("Failed to save report", {
        description: error instanceof Error ? error.message : 'Please try again'
      });
      
      // Reset loading state on error
      setTimeout(() => {
        setIsExporting('');
      }, 500);
      
      return false;
    }
  };
  
  // Add a function to close and redirect
  const closeReport = () => {
    // Redirect to report generation page
    window.location.href = '/dashboard/report-generation';
  };
  
  // Handle chat message submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isSendingChat) return;
    
    setIsSendingChat(true);
    
    // Add user message to chat history
    const userMessage = chatMessage;
    const updatedHistory = [...chatHistory, {role: 'user', content: userMessage}];
    setChatHistory(updatedHistory);
    setChatMessage('');
    
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please log in.');
      }
      
      // Get reportId
      const reportId = report?.reportId || prefetchedData?.reportId || `report_${Date.now()}`;
      
      // Send message to suggest-edits API instead of report-generation API
      console.log('Sending request to suggest-edits API with message:', userMessage);
      
      // Enhance the message with instructions to proceed without confirmation
      const enhancedMessage = `${userMessage}
      
IMPORTANT INSTRUCTION: Please proceed with the best interpretation of my request using the information available. 
Do not ask for confirmation or clarification - make your best judgment based on the context of the report.
If you're unsure about specifics, choose the most logical option that would improve the report.
Apply all changes directly to the current report that is being displayed.`;
      
      const requestBody = {
        message: enhancedMessage,
        reportId: reportId,
        reportContent: report.content || '',
        reportTitle: report.title || 'Untitled Report',
        visualizations: report.charts || report.visualizations || [],
        originalUserInput: JSON.stringify(formData),
        conversationId: reportId, // Use reportId as conversationId
        history: updatedHistory
      };
      
      console.log('Request body structure:', Object.keys(requestBody));
      console.log('Report content length:', (report.content || '').length);
      console.log('Visualizations count:', (report.charts || report.visualizations || []).length);
      
      const response = await fetch('/api/suggest-edits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to process edit suggestion' }));
        throw new Error(errorData.error || 'Failed to process edit suggestion');
      }
      
      const data = await response.json();
      
      // Debug the response from the suggest-edits API
      console.log('Response from suggest-edits API:', {
        hasResponse: Boolean(data.response),
        responseLength: data.response?.length || 0,
        hasEdits: Boolean(data.edits),
        editType: data.edits?.type || 'none',
        hasTextEdits: Boolean(data.edits?.textEdits?.length),
        textEditsCount: data.edits?.textEdits?.length || 0,
        hasNewVisualization: Boolean(data.edits?.newVisualization && data.edits.newVisualization.type !== 'none'),
        hasRemoveVisualization: Boolean(data.edits?.removeVisualization)
      });
      
      // If there are text edits, log them for debugging
      if (data.edits?.textEdits?.length > 0) {
        console.log('Text edits details:');
        data.edits.textEdits.forEach((edit: any, index: number) => {
          console.log(`Edit ${index + 1}:`);
          console.log('- Target content length:', edit.targetContent?.length || 0);
          console.log('- Replacement content length:', edit.replacementContent?.length || 0);
          console.log('- Target content (first 50 chars):', edit.targetContent?.substring(0, 50));
          console.log('- Replacement content (first 50 chars):', edit.replacementContent?.substring(0, 50));
        });
      }
      
      // Add assistant response to chat history
      const finalHistory = [...updatedHistory, {role: 'assistant', content: data.response || 'Sorry, I couldn\'t process that request.'}];
      setChatHistory(finalHistory);
      
      // Save the updated conversation history with the report ID
      await saveConversationHistory(reportId, finalHistory);
      
      // Apply edits if any
      // Special case: Check if response text mentions removing a visualization even if type is 'none'
      const responseText = data.response || '';
      const mentionsRemoval = responseText.toLowerCase().match(/(?:removed|deleted|eliminated)\s+(?:the|a)?\s+(?:chart|graph|visualization|diagram)/i);
      const mentionsSpecificVisualization = responseText.toLowerCase().match(/(?:removed|deleted|eliminated)\s+(?:the|a)?\s+(?:chart|graph|visualization|diagram)\s+(?:titled|called|named)?\s+["']([^"']+)["']/i);
      
      console.log('Response mentions removal:', Boolean(mentionsRemoval));
      console.log('Response mentions specific visualization:', mentionsSpecificVisualization ? mentionsSpecificVisualization[1] : 'none');
      
      // Track what changes were made for notifications
      let addedContent = false;
      let removedContent = false;
      let modifiedVisualizations = false;
      
      // Force visualization removal if mentioned in response but not in edits
      if (data.edits && data.edits.type === 'none' && mentionsRemoval) {
        console.log('Detected visualization removal in response text but not in edits, forcing removal operation');
        data.edits.type = 'remove_visualization';
        
        // If a specific visualization is mentioned, use it as the target
        if (mentionsSpecificVisualization && mentionsSpecificVisualization[1]) {
          data.edits.removeVisualization = mentionsSpecificVisualization[1];
          console.log('Setting removal target from response text:', data.edits.removeVisualization);
        }
      }
      
      if (data.edits && (data.edits.type !== 'none' || mentionsRemoval)) {
        // Track what changes were made for notifications
        let addedContent = false;
        let removedContent = false;
        let modifiedVisualizations = false;
        
                  // Handle text edits
          if (data.edits.type === 'text_edit' && data.edits.textEdits && data.edits.textEdits.length > 0) {
            let updatedContent = report.content;
            let editApplied = false;
            
            console.log('Attempting to apply text edits:', data.edits.textEdits);
            
            data.edits.textEdits.forEach((edit: { targetContent: string; replacementContent: string }) => {
              if (edit.targetContent && edit.replacementContent !== undefined) {
                // Debug logging
                console.log('Edit target exists in content:', updatedContent.includes(edit.targetContent));
                console.log('Target content length:', edit.targetContent.length);
                console.log('Replacement content length:', edit.replacementContent.length);
                
                // Check if content was added or removed
                if (edit.targetContent.length > edit.replacementContent.length) {
                  removedContent = true;
                } else if (edit.targetContent.length < edit.replacementContent.length) {
                  addedContent = true;
                }
                
                // Apply the edit - use a more reliable approach for replacement
                if (updatedContent.includes(edit.targetContent)) {
                  updatedContent = updatedContent.split(edit.targetContent).join(edit.replacementContent);
                  editApplied = true;
                  console.log('Edit applied successfully');
                } else {
                  // If exact match fails, try to find closest match
                  console.log('Exact match failed, attempting fuzzy match');
                  
                  // Try to find a close match by removing extra whitespace
                  const normalizedTarget = edit.targetContent.replace(/\s+/g, ' ').trim();
                  const normalizedContent = updatedContent.replace(/\s+/g, ' ');
                  
                  if (normalizedContent.includes(normalizedTarget)) {
                    // Find the position in the original content
                    const startPos = updatedContent.indexOf(normalizedTarget);
                    if (startPos >= 0) {
                      const endPos = startPos + normalizedTarget.length;
                      updatedContent = updatedContent.substring(0, startPos) + 
                                      edit.replacementContent + 
                                      updatedContent.substring(endPos);
                      editApplied = true;
                      console.log('Fuzzy match edit applied');
                    }
                  }
                }
              }
            });
            
            if (editApplied) {
              // Update report content
        setReport((prev: any) => ({
          ...prev,
                content: updatedContent
              }));
              
              // Notify LLM changes
              if (addedContent && removedContent) {
                toast.success("Content modified: parts added and removed.");
              } else if (addedContent) {
                toast.success("Content added to the report.");
              } else if (removedContent) {
                toast.success("Content removed from the report.");
              } else {
                toast.success("Content updated successfully.");
              }
            } else {
              console.error('Failed to apply edits - target content not found in report');
              toast.error("Failed to apply edits - target content not found in report");
            }
          }
        
                            // Handle visualization changes
          if (data.edits.type === 'visualization' || data.edits.type === 'remove_visualization') {
            console.log('Processing visualization edit:', data.edits);
            
            // Handle new visualization - apply directly without confirmation
            if (data.edits.newVisualization && data.edits.newVisualization.type !== 'none') {
              console.log('New visualization detected:', data.edits.newVisualization);
              modifiedVisualizations = true;
              
              // Add the new visualization to existing visualizations
              const updatedVisualizations = [
                ...(report.charts || report.visualizations || []),
                data.edits.newVisualization
              ];
              
              // Apply visualization changes directly instead of showing confirmation dialog
              setReport((prev: any) => ({
                ...prev,
                charts: updatedVisualizations,
                visualizations: updatedVisualizations
              }));
              
              // Show success notification
              toast.success("New visualization added to the report");
            } 
            // Handle visualization removal if specified
            else if (data.edits.removeVisualization) {
              console.log('Visualization removal detected:', data.edits.removeVisualization);
              const visualizationToRemove = data.edits.removeVisualization;
              const currentVisualizations = report.charts || report.visualizations || [];
              
              console.log('Current visualizations:', currentVisualizations);
              console.log('Visualization to remove:', visualizationToRemove);
              
              // Enhanced visualization removal with multiple strategies
              let updatedVisualizations = [...currentVisualizations];
              let removalSuccess = false;
              
              // Strategy 1: Remove by index
              if (typeof visualizationToRemove === 'number') {
                if (visualizationToRemove >= 0 && visualizationToRemove < currentVisualizations.length) {
                  updatedVisualizations = currentVisualizations.filter((_: any, index: number) => index !== visualizationToRemove);
                  removalSuccess = updatedVisualizations.length < currentVisualizations.length;
                  console.log('Removal by index result:', removalSuccess);
                }
              } 
              // Strategy 2: Remove by title (exact match)
              else if (typeof visualizationToRemove === 'string') {
                const beforeLength = updatedVisualizations.length;
                updatedVisualizations = currentVisualizations.filter((v: any) => 
                  v.title !== visualizationToRemove && 
                  v.title?.toLowerCase() !== visualizationToRemove.toLowerCase()
                );
                removalSuccess = updatedVisualizations.length < beforeLength;
                console.log('Removal by exact title result:', removalSuccess);
                
                // Strategy 3: Remove by partial title match if exact match failed
                if (!removalSuccess) {
                  const lowerCaseRemove = visualizationToRemove.toLowerCase();
                  updatedVisualizations = currentVisualizations.filter((v: any) => {
                    if (!v.title) return true;
                    const lowerCaseTitle = v.title.toLowerCase();
                    return !lowerCaseTitle.includes(lowerCaseRemove);
                  });
                  removalSuccess = updatedVisualizations.length < currentVisualizations.length;
                  console.log('Removal by partial title match result:', removalSuccess);
                }
              }
              // Strategy 4: If specific removal info not provided, remove the last visualization
              else if (currentVisualizations.length > 0) {
                updatedVisualizations = currentVisualizations.slice(0, -1);
                removalSuccess = true;
                console.log('Removed last visualization as fallback');
              }
              
              if (removalSuccess) {
                setReport((prev: any) => ({
                  ...prev,
                  charts: updatedVisualizations,
                  visualizations: updatedVisualizations
                }));
                
                toast.success("Visualization removed successfully");
              } else {
                // If all strategies failed, log available visualizations for debugging
                console.error("Failed to remove visualization - listing all available visualizations:");
                currentVisualizations.forEach((v: any, idx: number) => {
                  console.log(`Visualization ${idx}:`, v.title || 'Untitled', v.type);
                });
                
                toast.error("Failed to remove visualization - not found");
              }
            }
          }
      } else {
        // If no edits were made but the request was processed
        toast.success("No edits were applied.");
      }
      
    } catch (error) {
      console.error('Error processing chat message:', error);
      
      // Add error message to chat history
      const errorHistory = [...updatedHistory, {
        role: 'assistant', 
        content: `Error: ${error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}`
      }];
      
      setChatHistory(errorHistory);
      
      // Still save the conversation with the error
      const reportId = report?.reportId || prefetchedData?.reportId || `report_${Date.now()}`;
      await saveConversationHistory(reportId, errorHistory);
      
      toast.error("Failed to process your request", {
        description: error instanceof Error ? error.message : 'Please try again with a different question'
      });
    } finally {
      setIsSendingChat(false);
    }
  };

  // These functions are no longer needed as we apply visualization changes directly

  // This component is no longer needed as we apply visualization changes directly
  // Keeping a minimal implementation for compatibility
  const VisualizationEditDialog = () => {
    return null;
  };

  // In the render method, update the ReportRenderer component call

  // In the renderSteps function, update the final step to include the report actions and chat interface
  const renderSteps = () => {
    switch (currentStep) {
      // Previous steps remain unchanged
      case 1:
        return (
          <div className="space-y-6">
            <div className="bg-purple-50 rounded-lg p-4 mb-6 border border-purple-100">
              <h3 className="font-medium text-purple-800 mb-2 flex items-center">
                <FaInfoCircle className="mr-2" /> Report Topic & Scope
              </h3>
              <p className="text-sm text-gray-600">
                Define what you need a report on. Be specific to get the most relevant insights.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="reportTopic" className="block text-sm font-medium text-gray-700 mb-1">
                  What do you want a report on?
                </label>
                <textarea
                  id="reportTopic"
                  name="reportTopic"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                  placeholder="e.g., 'A comprehensive analysis of our current ongoing projects with focus on timeline delays and resource allocation'"
                  value={formData.reportTopic}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div>
                <label htmlFor="wordCount" className="block text-sm font-medium text-gray-700 mb-1">
                  Approximate word count
                </label>
                <input
                  type="number"
                  id="wordCount"
                  name="wordCount"
                  min={500}
                  max={5000}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                  value={formData.wordCount}
                  onChange={handleChange}
                />
                <p className="mt-1 text-sm text-gray-500">Recommended range: 500-5000 words</p>
              </div>
            </div>
            
            <div className="pt-4 flex justify-between">
              <div></div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Next Step
                </button>
              </div>
            </div>
          </div>
        );
      case 2:
        // ... existing code ...
      case 3:
        // ... existing code ...
      case 4:
        return (
          <div className="space-y-6">
            <div className="bg-purple-50 rounded-lg p-4 mb-6 border border-purple-100">
              <h3 className="font-medium text-purple-800 mb-2 flex items-center">
                <FaChartBar className="mr-2" /> Visualizations & Stakeholders
              </h3>
              <p className="text-sm text-gray-600">
                Specify your visualization preferences and who will be consuming this report.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex items-center h-5 mt-1">
                  <input
                    id="includeVisuals"
                    name="includeVisuals"
                    type="checkbox"
                    checked={formData.includeVisuals}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        includeVisuals: e.target.checked
                      }));
                    }}
                    className="focus:ring-purple-500 h-4 w-4 text-purple-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="includeVisuals" className="text-sm font-medium text-gray-700">
                    Include data visualizations (charts & graphs)
                  </label>
                  <p className="text-sm text-gray-500">
                    We'll automatically create appropriate visualizations based on the data using Chart.js
                  </p>
                </div>
              </div>
              
              <div>
                <label htmlFor="stakeholders" className="block text-sm font-medium text-gray-700 mb-1">
                  Who are the key stakeholders?
                </label>
                <textarea
                  id="stakeholders"
                  name="stakeholders"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                  placeholder="e.g., 'Board members, Project managers, Development team'"
                  value={formData.stakeholders}
                  onChange={handleChange}
                />
              </div>
              
              <div>
                <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700 mb-1">
                  Target audience expertise level
                </label>
                <select
                  id="targetAudience"
                  name="targetAudience"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                  value={formData.targetAudience}
                  onChange={handleChange}
                >
                  <option value="">Select an option</option>
                  <option value="technical">Technical (detailed, specialized terminology)</option>
                  <option value="business">Business (focus on impacts and outcomes)</option>
                  <option value="executive">Executive (high-level, strategic overview)</option>
                  <option value="mixed">Mixed audience (balanced approach)</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="timeframe" className="block text-sm font-medium text-gray-700 mb-1">
                  Report timeframe
                </label>
                <input
                  type="text"
                  id="timeframe"
                  name="timeframe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                  placeholder="e.g., 'Last quarter', 'YTD', 'Last 6 months'"
                  value={formData.timeframe}
                  onChange={handleChange}
                />
              </div>
              
              <div>
                <label htmlFor="deliveryFormat" className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred export format
                </label>
                <div className="flex space-x-4">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="format-pdf"
                      name="deliveryFormat"
                      value="pdf"
                      checked={formData.deliveryFormat === 'pdf'}
                      onChange={handleChange}
                      className="focus:ring-purple-500 h-4 w-4 text-purple-600 border-gray-300"
                    />
                    <label htmlFor="format-pdf" className="ml-2 text-sm text-gray-700">
                      PDF Document
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="format-docx"
                      name="deliveryFormat"
                      value="docx"
                      checked={formData.deliveryFormat === 'docx'}
                      onChange={handleChange}
                      className="focus:ring-purple-500 h-4 w-4 text-purple-600 border-gray-300"
                    />
                    <label htmlFor="format-docx" className="ml-2 text-sm text-gray-700">
                      Word Document (.docx)
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h3 className="text-lg text-gray-800 flex items-center gap-2 mb-4">
                  <FaCalendarAlt className="text-purple-600" />
                  Schedule Report
                </h3>
                
                <div className="mb-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="scheduleReport"
                      name="scheduleReport"
                      checked={formData.scheduleReport}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        scheduleReport: e.target.checked
                      }))}
                      className="focus:ring-purple-500 h-4 w-4 text-purple-600 border-gray-300 rounded"
                    />
                    <label htmlFor="scheduleReport" className="ml-3 text-sm font-medium text-gray-700">
                      Schedule this report to run automatically
                    </label>
                  </div>
                </div>
                
                {formData.scheduleReport && (
                  <div className="bg-purple-50 p-4 rounded-lg space-y-4">
                    <div className="mb-4">
                      <label htmlFor="scheduleFrequency" className="block text-sm font-medium text-gray-700 mb-1">
                        Frequency
                      </label>
                      <select
                        id="scheduleFrequency"
                        name="scheduleFrequency"
                        value={formData.scheduleFrequency}
                        onChange={handleChange}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base text-black border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-md"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annually">Annually</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    
                    {formData.scheduleFrequency === 'custom' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="scheduleCustomHours" className="block text-sm font-medium text-gray-700 mb-1">
                            Hours
                          </label>
                          <input
                            type="number"
                            id="scheduleCustomHours"
                            name="scheduleCustomHours"
                            min="0"
                            max="999"
                            value={formData.scheduleCustomHours}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-black focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="scheduleCustomMinutes" className="block text-sm font-medium text-gray-700 mb-1">
                            Minutes
                          </label>
                          <input
                            type="number"
                            id="scheduleCustomMinutes"
                            name="scheduleCustomMinutes"
                            min="0"
                            max="59"
                            value={formData.scheduleCustomMinutes}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-black focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center pt-2">
                      <FaInfoCircle className="text-purple-600 mr-2 flex-shrink-0" />
                      <p className="text-sm text-black">
                        {formData.scheduleFrequency === 'custom' 
                          ? `This report will run every ${formData.scheduleCustomHours || 0} hours and ${formData.scheduleCustomMinutes || 0} minutes.`
                          : `This report will run ${formData.scheduleFrequency}.`}
                        <br />
                        Reports will be genereated automatically and saved to your "Your Reports" page 
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={prevStep}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Previous
              </button>
              <div className="flex space-x-3">
                {formData.scheduleReport && (
                  <button
                    type="button"
                    onClick={handleScheduleReport}
                    disabled={isGenerating}
                    className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <FaCalendarAlt className="mr-2" /> Schedule Report
                      </>
                    )}
                  </button>
                )}
                {!formData.scheduleReport && (
                  <button
                    type="submit"
                    className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
                    disabled={isPrefetching}
                  >
                    {isPrefetching ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Fetching Data for Review
                      </>
                    ) : (
                      'Fetch Data for Review'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      case 5:
        // ... existing code ...
      case 6: // Final step - View Report
        return (
          <div className="bg-gray-100 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Generated Report</h2>
            
            {/* Report Actions - now handled directly in renderReport */}
            {/* Report Content */}
            {renderReport()}
            
            {/* Chat Interface for Report Modifications - already included in renderReport */}
          </div>
        );
      default:
        return null;
    }
  };

  // Add after handleSubmit function
  const handleScheduleReport = async () => {
    try {
      setIsGenerating(true);
      
      // Validate required fields
      if (!formData.reportTopic) {
        toast.error('Report topic is required');
        setIsGenerating(false);
        return;
      }
      
      if (formData.scheduleReport && !formData.scheduleFrequency) {
        toast.error('Schedule frequency is required');
        setIsGenerating(false);
        return;
      }
      
      console.log('Scheduling report with the following data:', formData);
      
      // For custom frequency, if minutes is 0, set it to 1 for testing
      let scheduleCustomMinutes = formData.scheduleCustomMinutes;
      if (formData.scheduleFrequency === 'custom' && (!scheduleCustomMinutes || scheduleCustomMinutes === 0)) {
        scheduleCustomMinutes = 1; // Set to 1 minute for testing
      }
      
      // Call the API to create a scheduled report
      const response = await fetch('/api/scheduled-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create',
          reportTopic: formData.reportTopic,
          company: formData.company,
          location: formData.location,
          website: formData.website,
          additionalContext: formData.additionalContext,
          wordCount: formData.wordCount,
          stakeholders: formData.stakeholders,
          targetAudience: formData.targetAudience,
          timeframe: formData.timeframe,
          deliveryFormat: formData.deliveryFormat,
          includeVisuals: formData.includeVisuals,
          scheduleFrequency: formData.scheduleFrequency,
          scheduleCustomMinutes: scheduleCustomMinutes,
          scheduleCustomHours: formData.scheduleCustomHours
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to schedule report');
      }
      
      const result = await response.json();
      console.log('Report scheduled successfully:', result);
      
      // Show a more detailed success message
      const frequencyText = formData.scheduleFrequency === 'custom' 
        ? `every ${formData.scheduleCustomHours || 0} hours and ${scheduleCustomMinutes || 1} minutes`
        : formData.scheduleFrequency;
      
      toast.success(
        `Report "${formData.reportTopic}" scheduled successfully!`, 
        { 
          description: `It will run ${frequencyText} and be saved to Your Reports page automatically. The first report will be generated shortly.`,
          duration: 5000
        }
      );
      
      // Reset form or navigate to reports page
      setTimeout(() => {
        window.location.href = '/dashboard/your-reports';
      }, 3000);
    } catch (error) {
      console.error('Error scheduling report:', error);
      toast.error(`Failed to schedule report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Add custom styles for the scrollbar */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #8B5CF6;
          border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #7C3AED;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #8B5CF6 #f1f1f1;
        }
        
        /* Add styles for contentEditable */
        .report-content[contenteditable="true"] {
          border: 1px dashed #8B5CF6;
          padding: 10px;
          min-height: 300px;
          outline: none;
        }
        .report-content[contenteditable="true"]:focus {
          border: 1px solid #8B5CF6;
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
        }
      `}</style>
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              <span className="text-purple-700">Report</span> Generation
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Generate custom reports based on organizational data
            </p>
          </div>
          <div className="flex space-x-3">
            <Link 
              href="/dashboard/your-reports" 
              className="flex items-center px-4 py-2 bg-white text-purple-600 border border-purple-600 rounded-md shadow-sm hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              <FaFileAlt className="mr-2" />
              Your Reports
            </Link>
            <button
              onClick={handleSubmit}
              disabled={isGenerating}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <FaChartBar className="mr-2" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>
        
        {!report ? (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8">
            <div className="mb-6 flex items-center">
              <div className="bg-purple-100 p-3 rounded-full mr-4">
                <FaFileAlt className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800">Report Configuration</h2>
            </div>
            
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <p className="flex items-center">
                  <FaInfoCircle className="inline-block mr-2" />
                  {error}
                </p>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="bg-purple-50 rounded-lg p-4 mb-6 border border-purple-100">
                    <h3 className="font-medium text-purple-800 mb-2 flex items-center">
                      <FaInfoCircle className="mr-2" /> Report Topic & Scope
                    </h3>
                    <p className="text-sm text-gray-600">
                      Define what you need a report on. Be specific to get the most relevant insights.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="reportTopic" className="block text-sm font-medium text-gray-700 mb-1">
                        What do you want a report on?
                      </label>
                      <textarea
                        id="reportTopic"
                        name="reportTopic"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                        placeholder="e.g., 'A comprehensive analysis of our current ongoing projects with focus on timeline delays and resource allocation'"
                        value={formData.reportTopic}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="wordCount" className="block text-sm font-medium text-gray-700 mb-1">
                        Approximate word count
                      </label>
                      <input
                        type="number"
                        id="wordCount"
                        name="wordCount"
                        min={500}
                        max={5000}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                        value={formData.wordCount}
                        onChange={handleChange}
                      />
                      <p className="mt-1 text-sm text-gray-500">Recommended range: 500-5000 words</p>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex justify-between">
                    <div></div>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={nextStep}
                        className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Next Step
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="bg-purple-50 rounded-lg p-4 mb-6 border border-purple-100">
                    <h3 className="font-medium text-purple-800 mb-2 flex items-center">
                      <FaBuilding className="mr-2" /> Organization Information
                    </h3>
                    <p className="text-sm text-gray-600">
                      We'll use this information to personalize your report and gather additional context.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        id="company"
                        name="company"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                        placeholder="Your organization's name"
                        value={formData.company}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        id="location"
                        name="location"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                        placeholder="City, Country"
                        value={formData.location}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
                        Company Website
                      </label>
                      <div className="flex items-center">
                        <input
                          type="url"
                          id="website"
                          name="website"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                          placeholder="https://your-company.com"
                          value={formData.website}
                          onChange={handleChange}
                          required
                        />
                        <div className="ml-2 text-gray-500" title="We'll crawl your website to gather additional context">
                          <FaSearch className="h-5 w-5" />
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">We'll analyze your website to gather additional context</p>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex justify-between">
                    <button
                      type="button"
                      onClick={prevStep}
                      className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={nextStep}
                      className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              )}
              
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="bg-purple-50 rounded-lg p-4 mb-6 border border-purple-100">
                    <h3 className="font-medium text-purple-800 mb-2 flex items-center">
                      <FaCommentAlt className="mr-2" /> Additional Context
                    </h3>
                    <p className="text-sm text-gray-600">
                      Provide any other information that would help generate a more accurate and relevant report.
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="additionalContext" className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Context
                    </label>
                    <textarea
                      id="additionalContext"
                      name="additionalContext"
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                      placeholder="Any specific challenges, history, or other relevant information you'd like included in the report"
                      value={formData.additionalContext}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div className="pt-4 flex justify-between">
                    <button
                      type="button"
                      onClick={prevStep}
                      className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={nextStep}
                      className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              )}
              
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="bg-purple-50 rounded-lg p-4 mb-6 border border-purple-100">
                    <h3 className="font-medium text-purple-800 mb-2 flex items-center">
                      <FaChartBar className="mr-2" /> Visualizations & Stakeholders
                    </h3>
                    <p className="text-sm text-gray-600">
                      Specify your visualization preferences and who will be consuming this report.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <div className="flex items-center h-5 mt-1">
                        <input
                          id="includeVisuals"
                          name="includeVisuals"
                          type="checkbox"
                          checked={formData.includeVisuals}
                          onChange={(e) => {
                            setFormData(prev => ({
                              ...prev,
                              includeVisuals: e.target.checked
                            }));
                          }}
                          className="focus:ring-purple-500 h-4 w-4 text-purple-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3">
                        <label htmlFor="includeVisuals" className="text-sm font-medium text-gray-700">
                          Include data visualizations (charts & graphs)
                        </label>
                        <p className="text-sm text-gray-500">
                          We'll automatically create appropriate visualizations based on the data using Chart.js
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="stakeholders" className="block text-sm font-medium text-gray-700 mb-1">
                        Who are the key stakeholders?
                      </label>
                      <textarea
                        id="stakeholders"
                        name="stakeholders"
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                        placeholder="e.g., 'Board members, Project managers, Development team'"
                        value={formData.stakeholders}
                        onChange={handleChange}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700 mb-1">
                        Target audience expertise level
                      </label>
                      <select
                        id="targetAudience"
                        name="targetAudience"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                        value={formData.targetAudience}
                        onChange={handleChange}
                      >
                        <option value="">Select an option</option>
                        <option value="technical">Technical (detailed, specialized terminology)</option>
                        <option value="business">Business (focus on impacts and outcomes)</option>
                        <option value="executive">Executive (high-level, strategic overview)</option>
                        <option value="mixed">Mixed audience (balanced approach)</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="timeframe" className="block text-sm font-medium text-gray-700 mb-1">
                        Report timeframe
                      </label>
                      <input
                        type="text"
                        id="timeframe"
                        name="timeframe"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                        placeholder="e.g., 'Last quarter', 'YTD', 'Last 6 months'"
                        value={formData.timeframe}
                        onChange={handleChange}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="deliveryFormat" className="block text-sm font-medium text-gray-700 mb-1">
                        Preferred export format
                      </label>
                      <div className="flex space-x-4">
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id="format-pdf"
                            name="deliveryFormat"
                            value="pdf"
                            checked={formData.deliveryFormat === 'pdf'}
                            onChange={handleChange}
                            className="focus:ring-purple-500 h-4 w-4 text-purple-600 border-gray-300"
                          />
                          <label htmlFor="format-pdf" className="ml-2 text-sm text-gray-700">
                            PDF Document
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id="format-docx"
                            name="deliveryFormat"
                            value="docx"
                            checked={formData.deliveryFormat === 'docx'}
                            onChange={handleChange}
                            className="focus:ring-purple-500 h-4 w-4 text-purple-600 border-gray-300"
                          />
                          <label htmlFor="format-docx" className="ml-2 text-sm text-gray-700">
                            Word Document (.docx)
                          </label>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 border-t border-gray-200 pt-4">
                      <h3 className="text-lg text-gray-800 flex items-center gap-2 mb-4">
                        <FaCalendarAlt className="text-purple-600" />
                        Schedule Report
                      </h3>
                      
                      <div className="mb-4">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="scheduleReport"
                            name="scheduleReport"
                            checked={formData.scheduleReport}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              scheduleReport: e.target.checked
                            }))}
                            className="focus:ring-purple-500 h-4 w-4 text-purple-600 border-gray-300 rounded"
                          />
                          <label htmlFor="scheduleReport" className="ml-3 text-sm font-medium text-gray-700">
                            Schedule this report to run automatically
                          </label>
                        </div>
                      </div>
                      
                      {formData.scheduleReport && (
                        <div className="bg-purple-50 p-4 rounded-lg space-y-4">
                          <div className="mb-4">
                            <label htmlFor="scheduleFrequency" className="block text-sm font-medium text-gray-700 mb-1">
                              Frequency
                            </label>
                            <select
                              id="scheduleFrequency"
                              name="scheduleFrequency"
                              value={formData.scheduleFrequency}
                              onChange={handleChange}
                              className="mt-1 block w-full pl-3 pr-10 py-2 text-base text-black border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-md"
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="annually">Annually</option>
                              <option value="custom">Custom</option>
                            </select>
                          </div>
                          
                          {formData.scheduleFrequency === 'custom' && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label htmlFor="scheduleCustomHours" className="block text-sm font-medium text-gray-700 mb-1">
                                  Hours
                                </label>
                                <input
                                  type="number"
                                  id="scheduleCustomHours"
                                  name="scheduleCustomHours"
                                  min="0"
                                  max="999"
                                  value={formData.scheduleCustomHours}
                                  onChange={handleChange}
                                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-black focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                                />
                              </div>
                              <div>
                                <label htmlFor="scheduleCustomMinutes" className="block text-sm font-medium text-gray-700 mb-1">
                                  Minutes
                                </label>
                                <input
                                  type="number"
                                  id="scheduleCustomMinutes"
                                  name="scheduleCustomMinutes"
                                  min="0"
                                  max="59"
                                  value={formData.scheduleCustomMinutes}
                                  onChange={handleChange}
                                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-black focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                                />
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center pt-2">
                            <FaInfoCircle className="text-purple-600 mr-2 flex-shrink-0" />
                            <p className="text-sm text-black">
                              {formData.scheduleFrequency === 'custom' 
                                ? `This report will run every ${formData.scheduleCustomHours || 0} hours and ${formData.scheduleCustomMinutes || 0} minutes.`
                                : `This report will run ${formData.scheduleFrequency}.`}
                              <br />
                              Reports will be genereated automatically and saved to your "Your Reports" page 
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-4 flex justify-between">
                    <button
                      type="button"
                      onClick={prevStep}
                      className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Previous
                    </button>
                    <div className="flex space-x-3">
                      {formData.scheduleReport && (
                        <button
                          type="button"
                          onClick={handleScheduleReport}
                          disabled={isGenerating}
                          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
                        >
                          {isGenerating ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Scheduling...
                            </>
                          ) : (
                            <>
                              <FaCalendarAlt className="mr-2" /> Schedule Report
                            </>
                          )}
                        </button>
                      )}
                      {!formData.scheduleReport && (
                        <button
                          type="submit"
                          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
                          disabled={isPrefetching}
                        >
                          {isPrefetching ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Fetching Data for Review
                            </>
                          ) : (
                            'Fetch Data for Review'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 5 && prefetchedData && (
                <div className="space-y-6">
                  <div className="bg-purple-50 rounded-lg p-4 mb-6 border border-purple-100">
                    <h3 className="font-medium text-purple-800 mb-2 flex items-center">
                      <FaDatabase className="mr-2" /> Data Review & Approval
                    </h3>
                    <p className="text-sm text-gray-600">
                      Review the data that will be used to generate your report. Please approve if it looks good.
                    </p>
                  </div>

                  {/* Database Data */}
                  <div className="mb-6 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-gray-800 mb-2">Database Query Results</h4>
                    <div className="bg-gray-50 p-4 rounded mb-4 max-h-96 overflow-y-auto text-gray-700 custom-scrollbar">
                      {prefetchedData.claudeResponse?.response ? (
                        <div className="whitespace-pre-wrap font-sans text-sm" 
                             dangerouslySetInnerHTML={{ __html: prefetchedData.claudeResponse.response }}>
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No database results available.</p>
                      )}
                    </div>
                  </div>

                  {/* Website Context */}
                  {prefetchedData.webContext && (
                    <div className="mb-6 border border-gray-200 rounded-lg p-4">
                      <h4 className="text-lg font-medium text-gray-800 mb-2">Website Context</h4>
                      <div className="bg-gray-50 p-4 rounded mb-4 max-h-96 overflow-y-auto text-gray-700 custom-scrollbar">
                        <div className="whitespace-pre-wrap font-sans text-sm"
                             dangerouslySetInnerHTML={{ __html: formatDatabaseResults(prefetchedData.webContext) }}>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 flex justify-between">
                    <button
                      type="button"
                      onClick={rejectData}
                      className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center"
                    >
                      <FaTimes className="mr-2" /> Reject & Start Over
                    </button>
                    <button
                      type="button"
                      onClick={approveData}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Generating Report...
                        </>
                      ) : (
                        <>
                          <FaCheck className="mr-2" /> Approve & Generate Report
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            {report ? (
              <>
                <ReportRenderer 
                  title={report.title || ''} 
                  content={report.content || ''} 
                  charts={report.charts || report.visualizations || []}
                />
                
                {/* Custom report control buttons */}
                <div className="mt-8 p-4 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    {/* Chat bar on left */}
                    <div className="flex items-center w-1/2 max-w-md">
                      <div className="relative flex-1">
                        {isSendingChat ? (
                          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-purple-500 rounded-full animate-pulse"></div>
                        ) : (
                          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        )}
                        <input
                          type="text"
                          placeholder="Suggest edits..."
                          className="pl-9 pr-12 w-full bg-white border border-gray-200 rounded-md py-2 text-sm text-black"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleChatSubmit(e);
                            }
                          }}
                          disabled={isSendingChat}
                        />
                        <button
                          className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full ${
                            isSendingChat || !chatMessage.trim() 
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                              : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                          }`}
                          onClick={handleChatSubmit}
                          disabled={isSendingChat || !chatMessage.trim()}
                        >
                          <FaPaperPlane className="h-3 w-3" />
                        </button>
                      </div>
                      
                      {/* Show conversation history button - placed next to the chat input */}
                      {chatHistory.length > 0 && (
                        <button
                          onClick={() => setShowConversation(!showConversation)}
                          className="ml-2 bg-purple-100 text-black hover:bg-purple-200 border-purple-200 border rounded-md px-3 py-1.5 text-sm flex items-center"
                          title="Show conversation history"
                        >
                          <FaComments className="mr-2 h-3.5 w-3.5" />
                          {showConversation ? 'Hide Chat' : 'Show Chat'}
                        </button>
                      )}
                    </div>
                    
                    {/* Action buttons on right */}
                    <div className="flex items-center space-x-2">
                      {/* 1. Edit button */}
                      <button
                        onClick={() => {
                          if (!isManualEditing) {
                            // Set content editable when entering edit mode
                            setIsManualEditing(true);
                          } else {
                            // Save changes when exiting edit mode
                            handleSaveManualEdits();
                          }
                        }}
                        className="bg-purple-100 text-black hover:bg-purple-200 border-purple-200 border rounded-md px-3 py-1.5 text-sm flex items-center"
                      >
                        <FaEdit className="mr-2 h-3.5 w-3.5" />
                        {isManualEditing ? 'Save Edits' : 'Edit'}
                      </button>
                      
                      {/* 2. Export dropdown button */}
                      <div className="relative inline-block">
                        <button
                          onClick={() => setShowExportOptions(!showExportOptions)}
                          className="bg-purple-100 text-black hover:bg-purple-200 border-purple-200 border rounded-md px-3 py-1.5 text-sm flex items-center"
                        >
                          <FaDownload className="mr-2 h-3.5 w-3.5" />
                          Export
                        </button>
                        
                        {showExportOptions && (
                          <div className="absolute bottom-full mb-2 right-0 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                            <div className="py-1" role="menu" aria-orientation="vertical">
                              <button 
                                onClick={() => {
                                  exportReport('pdf');
                                  setShowExportOptions(false);
                                }}
                                className="flex w-full items-center px-4 py-2 text-sm text-black hover:bg-gray-100"
                                role="menuitem"
                              >
                                <FaFilePdf className="mr-2 h-3.5 w-3.5 text-red-500" />
                                Export as PDF
                              </button>
                              <button 
                                onClick={() => {
                                  exportReport('docx');
                                  setShowExportOptions(false);
                                }}
                                className="flex w-full items-center px-4 py-2 text-sm text-black hover:bg-gray-100"
                                role="menuitem"
                              >
                                <FaFileWord className="mr-2 h-3.5 w-3.5 text-blue-500" />
                                Export as DOCX
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* 3. Save button */}
                      <button
                        onClick={saveReport}
                        className="bg-purple-100 text-black hover:bg-purple-200 border-purple-200 border rounded-md px-3 py-1.5 text-sm flex items-center"
                      >
                        <FaCheck className="mr-2 h-3.5 w-3.5" /> Save
                      </button>
                    </div>
                  </div>
                  
                  {/* Chat Messages (only show when showConversation is true) */}
                  {showConversation && chatHistory.length > 0 && (
                    <div className="border-t border-gray-200 p-4 bg-white mt-4 rounded-md">
                      <div className="bg-white max-h-[300px] overflow-y-auto">
                        {chatHistory.map((message, index) => (
                          <div 
                            key={index} 
                            className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
                          >
                            <div 
                              className={`inline-block max-w-[75%] rounded-lg px-4 py-2 ${
                                message.role === 'user' 
                                  ? 'bg-purple-100 text-black rounded-br-none' 
                                  : 'bg-gray-50 border border-gray-200 text-black rounded-bl-none'
                              }`}
                            >
                              {message.content}
                            </div>
                          </div>
                        ))}
                        {isSendingChat && (
                          <div className="text-left mb-4">
                            <div className="inline-flex items-center bg-gray-50 border border-gray-200 text-black rounded-lg px-4 py-2">
                              <FaSpinner className="animate-spin mr-2" />
                              <span>Processing...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-yellow-50 p-4 rounded-md mb-6 text-yellow-700">
                <p>Loading report content...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 