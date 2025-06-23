"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FaSearch, FaFileAlt, FaDownload, FaTrash, FaEye, FaSpinner, FaCalendarAlt, FaChartBar, FaSync, FaTimes, FaEdit, FaHistory, FaPaperPlane, FaCheck, FaFilePdf, FaFileWord, FaComments, FaCheckCircle, FaCalendarTimes } from 'react-icons/fa';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';

// Import the ReportRenderer component dynamically to avoid SSR issues with charts
const ReportRenderer = dynamic(() => import('@/components/ReportRenderer'), { ssr: false });

// Skeleton component for loading states
const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 ${className}`}
    {...props}
  />
);

interface Report {
  _id: string;
  title: string;
  topic: string;
  createdAt: string;
  content: string;
  visualizations: any[];
  company?: string;
  wordCount?: number;
  targetAudience?: string;
  timeframe?: string;
  deliveryFormat?: string;
  hasVisualizations?: boolean;
  isScheduled?: boolean;
  scheduledReportId?: string;
}

interface ReportVersion {
  content: string;
  visualizations: any[];
  timestamp: Date;
  versionNumber: number;
}

export default function YourReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [viewingReport, setViewingReport] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx' | null>(null);
  const [exportLoading, setExportLoading] = useState<'pdf' | 'docx' | false>(false);
  
  // New state variables for edit mode and version history
  const [isEditMode, setIsEditMode] = useState(false);
  const [reportVersions, setReportVersions] = useState<ReportVersion[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  
  // New state variables for edit suggestions
  const [editMessage, setEditMessage] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [recentEdits, setRecentEdits] = useState<{textEdits: {targetContent: string, replacementContent: string}[], newVisualization: boolean}>({
    textEdits: [], 
    newVisualization: false
  });
  const [showEditHighlight, setShowEditHighlight] = useState(false);
  
  // New state variable for export options
  const [showExportOptions, setShowExportOptions] = useState(false);
  
  // Fetch saved reports on component mount
  useEffect(() => {
    fetchReports();
  }, []);
  
  // Effect to make report content editable when in edit mode
  useEffect(() => {
    if (isEditMode) {
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
  }, [isEditMode, viewingReport]);
  
  // Function to fetch saved reports
  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/saved-reports', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API returned ${response.status}`);
      }
      
      const data = await response.json();
      // Make sure each report has the scheduledReportId if it's scheduled
      const processedReports = (data.reports || []).map((report: Report) => {
        if (report.isScheduled && !report.scheduledReportId) {
          return {
            ...report,
            scheduledReportId: report.scheduledReportId || report._id
          };
        }
        return report;
      });
      
      setReports(processedReports);
    } catch (err: any) {
      console.error("Error fetching reports:", err);
      setError(err.message || "Failed to fetch reports");
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };
  
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
  
  // Function to open a report for viewing
  const openReport = async (reportId: string) => {
    try {
      setLoading(true);
      setError(null);
      setIsEditMode(false); // Ensure we're not in edit mode
      
      const response = await fetch('/api/saved-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'getReport',
          reportId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch report');
      }
      
      const data = await response.json();
      setSelectedReport(data.report);
      setViewingReport(true);
      
      // Check if report has versions stored in MongoDB and load them
      if (data.report.versions && Array.isArray(data.report.versions)) {
        setReportVersions(data.report.versions);
        setSelectedVersion(data.report.versions.length);
      } else {
        // Reset version history when opening a new report
        setReportVersions([]);
      }
      setShowVersionHistory(false);
      
      // Load conversation history for this specific report
      const history = await loadConversationHistory(reportId);
      setConversationHistory(history);
      setConversationId(reportId);
      
      // Show success notification
      toast.success("Report opened successfully!");
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching the report');
      toast.error(err.message || 'Failed to open report');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to open a report in edit mode
  const openReportInEditMode = async (reportId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/saved-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'getReport',
          reportId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch report');
      }
      
      const data = await response.json();
      setSelectedReport(data.report);
      setViewingReport(true);
      setIsEditMode(true); // Set edit mode to true
      
      // Check if report has versions stored in MongoDB
      if (data.report.versions && Array.isArray(data.report.versions) && data.report.versions.length > 0) {
        setReportVersions(data.report.versions);
        setSelectedVersion(data.report.versions.length);
      } else {
        // Initialize version history with the original version if none exists
        const initialVersion: ReportVersion = {
          content: data.report.content,
          visualizations: data.report.visualizations || [],
          timestamp: new Date(),
          versionNumber: 1
        };
        
        setReportVersions([initialVersion]);
        setSelectedVersion(1);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching the report');
      toast.error(err.message || 'Failed to open report in edit mode');
    } finally {
      setLoading(false);
    }
  };
  
  // Enhanced save edits function with notifications
  const handleSaveEdits = async () => {
    if (!selectedReport) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get the current content from the editable div
      const reportContentElement = document.querySelector('.report-content');
      if (!reportContentElement) {
        throw new Error('Could not find report content element');
      }
      
      // Get the HTML content from the editable div
      const updatedContent = reportContentElement.innerHTML;
      
      // Create a new version entry
      const newVersion: ReportVersion = {
        content: updatedContent,
        visualizations: selectedReport.visualizations || [],
        timestamp: new Date(),
        versionNumber: reportVersions.length + 1
      };
      
      // Add the new version to the version history
      const updatedVersions = [...reportVersions, newVersion];
      setReportVersions(updatedVersions);
      setSelectedVersion(updatedVersions.length);
      
      // Update the report object with new content
      const updatedReport = {
        ...selectedReport,
        content: updatedContent
      };
      
      // Update the report in the database
      const response = await fetch('/api/saved-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'updateReport',
          reportId: selectedReport._id,
          reportData: {
            ...updatedReport,
            versions: updatedVersions
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save report');
      }
      
      // Update the local state
      setSelectedReport(updatedReport);
      
      // Show success notification
      toast.success("Report saved successfully!");
      
      // Exit edit mode
      setIsEditMode(false);
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the report');
      toast.error(err.message || 'Failed to save report');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to cancel edits and return to view mode
  const handleCancelEdits = () => {
    // Reset to the original report content
    if (selectedReport) {
      // Exit edit mode without saving changes
      setIsEditMode(false);
      setShowVersionHistory(false);
      toast.success("Edits canceled");
    }
  };
  
  // Function to preview a specific version of the report
  const handlePreviewVersion = (versionNumber: number) => {
    setSelectedVersion(versionNumber);
    
    // Find the version in the version history
    const version = reportVersions.find(v => v.versionNumber === versionNumber);
    if (version && selectedReport) {
      // Create a temporary preview of this version
      const previewReport = {
        ...selectedReport,
        content: version.content,
        visualizations: version.visualizations
      };
      
      // Update the UI to show this version
      setSelectedReport(previewReport);
    }
  };
  
  // Function to revert to a specific version of the report
  const handleRevertToVersion = async (versionNumber: number) => {
    if (!selectedReport) return;
    
    try {
      setLoading(true);
      
      // Find the version in the version history
      const version = reportVersions.find(v => v.versionNumber === versionNumber);
      if (!version) {
        throw new Error('Version not found');
      }
      
      // Update the report with the reverted content without creating a new version
      const updatedReport = {
        ...selectedReport,
        content: version.content,
        visualizations: version.visualizations
      };
      
      // Update the report in the database
      const response = await fetch('/api/saved-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'updateReport',
          reportId: selectedReport._id,
          reportData: updatedReport
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revert to selected version');
      }
      
      // Update local state
      setSelectedReport(updatedReport);
      setSelectedVersion(versionNumber);
      
      toast.success(`Reverted to version ${versionNumber}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred while reverting to the selected version');
      toast.error(err.message || 'Failed to revert to selected version');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to delete a report
  const deleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this report?")) {
      return;
    }
    
    try {
      const response = await fetch('/api/saved-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'deleteReport',
          reportId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API returned ${response.status}`);
      }
      
      // Remove the deleted report from the state
      setReports(reports.filter(report => report._id !== reportId));
      toast.success("Report deleted successfully");
      
      // If the deleted report was being viewed, close it
      if (selectedReport && selectedReport._id === reportId) {
        setSelectedReport(null);
        setViewingReport(false);
      }
    } catch (err: any) {
      console.error("Error deleting report:", err);
      toast.error("Failed to delete report");
    }
  };
  
  // Enhanced export function with notifications
  const exportReport = async (reportId: string, format: 'pdf' | 'docx') => {
    if (!selectedReport) return;
    
    setExportLoading(format);
    
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required. Please log in.');
        return;
      }
      
      // Call the API to export the report
      const response = await fetch(`/api/report-generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          operation: 'export',
          exportFormat: format,
          reportContent: selectedReport.content,
          reportTitle: selectedReport.title,
          visualizations: selectedReport.visualizations || [],
          reportId: selectedReport._id
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to export report as ${format}`);
      }
      
      // Create a blob from the response and download it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${selectedReport.title || 'Report'}.${format}`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Add a small delay before showing the success message
      setTimeout(() => {
        setExportLoading(false);
        setExportFormat(null);
        toast.success(`Report exported as ${format.toUpperCase()} successfully!`);
      }, 1000);
    } catch (error) {
      console.error(`Error exporting report as ${format}:`, error);
      toast.error(`Failed to export report as ${format.toUpperCase()}`);
      
      // Reset loading state on error
      setExportLoading(false);
      setExportFormat(null);
    }
  };
  
  // Filter reports based on search query
  const filteredReports = reports.filter(report => {
    const title = (report.title || '').toLowerCase();
    const topic = (report.topic || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return title.includes(query) || topic.includes(query);
  });
  
  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  // Function to save a new version outside edit mode
  const handleSaveNewVersion = async () => {
    if (!selectedReport) return;
    try {
      setLoading(true);
      setError(null);

      // Retrieve current rendered content
      let currentContent: string = selectedReport.content;
      const contentElement = document.querySelector('.report-content');
      if (contentElement) {
        currentContent = contentElement.innerHTML;
      }

      const newVersion: ReportVersion = {
        content: currentContent,
        visualizations: selectedReport.visualizations || [],
        timestamp: new Date(),
        versionNumber: reportVersions.length + 1,
      };

      const updatedVersions = [...reportVersions, newVersion];
      const updatedReport = { ...selectedReport, versions: updatedVersions } as any;

      const response = await fetch('/api/saved-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateReport',
          reportId: selectedReport._id,
          reportData: updatedReport,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save new version');
      }

      setReportVersions(updatedVersions);
      setSelectedVersion(updatedVersions.length);
      toast.success('New version saved!');
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the new version');
      toast.error(err.message || 'Failed to save new version');
    } finally {
      setLoading(false);
    }
  };

  // Enhanced function for handling edit suggestions with better notifications
  const handleSendEditSuggestion = async () => {
    if (!editMessage.trim() || isSubmittingEdit || !selectedReport) return;
    
    setIsSubmittingEdit(true);
    
    // Add user message to conversation history
    const userMessage = editMessage;
    const updatedHistory = [...conversationHistory, { role: 'user', content: userMessage }];
    setConversationHistory(updatedHistory);
    setEditMessage('');
    
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
          message: userMessage,
          reportId: selectedReport._id,
          reportContent: selectedReport.content,
          reportTitle: selectedReport.title,
          visualizations: selectedReport.visualizations || [],
          conversationId: selectedReport._id, // Use reportId as conversationId
          history: updatedHistory
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process edit suggestion');
      }
      
      const data = await response.json();
      
      // Update conversation history with AI response
      const finalHistory = [...updatedHistory, { role: 'assistant', content: data.response || 'I processed your request.' }];
      setConversationHistory(finalHistory);
      
      // Save the updated conversation history with the report ID
      await saveConversationHistory(selectedReport._id, finalHistory);
      
      // Apply edits if any
      if (data.edits && data.edits.type !== 'none') {
        // Track what changes were made for notifications
        let addedContent = false;
        let removedContent = false;
        let modifiedVisualizations = false;
        
        // Handle text edits
        if (data.edits.type === 'text_edit' && data.edits.textEdits && data.edits.textEdits.length > 0) {
          let updatedContent = selectedReport.content;
          
          data.edits.textEdits.forEach((edit: { targetContent: string; replacementContent: string }) => {
            if (edit.targetContent && edit.replacementContent !== undefined) {
              // Check if content was added or removed
              if (edit.targetContent.length > edit.replacementContent.length) {
                removedContent = true;
              } else if (edit.targetContent.length < edit.replacementContent.length) {
                addedContent = true;
              }
              
              // Apply the edit
              updatedContent = updatedContent.replace(edit.targetContent, edit.replacementContent);
            }
          });
          
          // Update report content
          setSelectedReport({
            ...selectedReport,
            content: updatedContent
          });
          
          // Notify LLM changes
          if (addedContent && removedContent) {
            toast.success("LLM modified content: parts added and removed.");
          } else if (addedContent) {
            toast.success("LLM added content to the report.");
          } else if (removedContent) {
            toast.success("LLM removed content from the report.");
          }
        }
        
        // Handle new visualization
        if (data.edits.type === 'visualization' && data.edits.newVisualization) {
          modifiedVisualizations = true;
          
          // Add the new visualization
          const updatedVisualizations = [
            ...(selectedReport.visualizations || []),
            data.edits.newVisualization
          ];
          
          setSelectedReport({
            ...selectedReport,
            visualizations: updatedVisualizations
          });
          
          // Show notification for visualization changes
          toast.success("Visualization added to the report.");
        }
        
        // Set recent edits for highlighting
        setRecentEdits({
          textEdits: data.edits.textEdits || [],
          newVisualization: Boolean(data.edits.newVisualization)
        });
        setShowEditHighlight(true);
        
        // Auto-hide the highlight after 5 seconds
        setTimeout(() => {
          setShowEditHighlight(false);
        }, 5000);
      } else {
        // If no edits were made but the request was processed
        toast.success("No edits were applied.");
      }
    } catch (error) {
      console.error('Error sending edit suggestion:', error);
      // Add error message to conversation
      const errorHistory = [...updatedHistory, { 
        role: 'assistant', 
        content: `Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`
      }];
      setConversationHistory(errorHistory);
      
      // Still save the conversation with the error
      if (selectedReport) {
        await saveConversationHistory(selectedReport._id, errorHistory);
      }
      
      toast.error(`Failed to process edit suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmittingEdit(false);
    }
  };
  
  // Update the cancelSchedule function to remove the confirmation dialog
  const cancelSchedule = async (reportId: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/scheduled-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'cancel',
          reportId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel scheduled report');
      }

      toast.success('Scheduled report canceled successfully');
      fetchReports(); // Refresh the reports list
    } catch (error) {
      console.error('Error canceling scheduled report:', error);
      toast.error('Failed to cancel scheduled report');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col space-y-2">
      <h1 className="text-3xl font-bold tracking-tight">
  <span className="text-purple-600">Saved</span> <span className="text-black">Reports</span>
</h1>
        <p className="text-gray-800">
          View, manage, and export your saved reports.
        </p>
      </div>
      
      {viewingReport && selectedReport ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div></div> {/* Empty div for spacing */}
            <Button 
              variant="outline" 
              onClick={() => {
                setViewingReport(false);
                setSelectedReport(null);
                setIsEditMode(false);
                setShowVersionHistory(false);
                toast.success("Returned to reports list");
              }}
              className="bg-purple-100 text-black hover:bg-purple-200 border-purple-200"
            >
              Back to Reports
            </Button>
          </div>
          
          <div className="flex flex-col gap-4">
            {/* Main Report Content */}
            <Card className="w-full flex flex-col">
              {/* Edit mode controls - add fixed controls at the top when in edit mode for both views */}
              {isEditMode && (
                <div className="p-4 flex justify-between items-center border-b border-gray-200">
                  <h3 className="text-lg font-medium text-black">Editing Report</h3>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setIsEditMode(false)} 
                      className="px-3 py-1.5 bg-white text-black border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedReport) return;
                        
                        try {
                          setLoading(true);
                          console.log('Saving report:', selectedReport._id);
                          
                          // Get current content from report-content div if we're in edit mode
                          let updatedContent = selectedReport.content;
                          if (isEditMode) {
                            const reportContentElement = document.querySelector('.report-content');
                            if (!reportContentElement) {
                              throw new Error('Could not find report content element');
                            }
                            
                            // Get the HTML content from the editable div
                            updatedContent = reportContentElement.innerHTML;
                            console.log('Got updated content from editable div, length:', updatedContent.length);
                          }
                          
                          // Create a new version if we're in edit mode
                          let updatedVersions = [...reportVersions];
                          if (isEditMode) {
                            const newVersion = {
                              content: updatedContent,
                              visualizations: selectedReport.visualizations || [],
                              timestamp: new Date(),
                              versionNumber: reportVersions.length + 1
                            };
                            updatedVersions = [...reportVersions, newVersion];
                            console.log('Created new version:', newVersion.versionNumber);
                          }
                          
                          // Get token from localStorage
                          const token = localStorage.getItem('token');
                          if (!token) {
                            throw new Error('Authentication required. Please log in.');
                          }
                          
                          // Update report in the database
                          console.log('Sending save request to API');
                          const response = await fetch('/api/saved-reports', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              action: 'saveReport',
                              reportId: selectedReport._id,
                              reportData: {
                                ...selectedReport,
                                content: updatedContent,
                                versions: isEditMode ? updatedVersions : reportVersions,
                                updatedAt: new Date().toISOString()
                              }
                            })
                          });
                          
                          console.log('Save API response status:', response.status);
                          const responseData = await response.json();
                          console.log('Save API response data:', responseData);
                          
                          if (response.ok) {
                            if (isEditMode) {
                              setReportVersions(updatedVersions);
                              setSelectedVersion(updatedVersions.length);
                            }
                            
                            setSelectedReport({
                              ...selectedReport,
                              content: updatedContent
                            });
                            
                            // Show success notification
                            toast.success("Report saved successfully!");
                            
                            setIsEditMode(false);
                          } else {
                            throw new Error(responseData.error || 'Failed to save report');
                          }
                        } catch (error) {
                          console.error('Error saving report:', error);
                          toast.error(`Failed to save report: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-purple-600 text-white rounded-md shadow-sm hover:bg-purple-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
              
              <CardContent className="p-6 flex-1">
                <ReportRenderer 
                  title={selectedReport.title} 
                  content={selectedReport.content} 
                  charts={selectedReport.visualizations}
                  reportId={selectedReport._id}
                  onSave={isEditMode ? handleSaveEdits : undefined}
                  onClose={isEditMode ? handleCancelEdits : undefined}
                />
                
                {/* Apply contentEditable mode when in edit mode */}
                {isEditMode && (
                  <style jsx global>{`
                    .report-content {
                      border: 1px dashed #8B5CF6;
                      padding: 10px;
                      min-height: 300px;
                      outline: none;
                    }
                    .report-content:focus {
                      border: 1px solid #8B5CF6;
                      box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
                    }
                  `}</style>
                )}
              </CardContent>
              
              {/* Report Actions Row */}
              <div className="mt-8 border-t border-gray-200 p-4 bg-white rounded-b-lg">
                <div className="flex items-center justify-between">
                  {/* Chat bar on left */}
                  <div className="flex items-center w-1/2 max-w-md">
                    <div className="relative flex-1">
                      {isSubmittingEdit ? (
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-purple-500 rounded-full animate-pulse"></div>
                      ) : (
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      )}
                      <input
                        type="text"
                        placeholder="Suggest edits..."
                        className="pl-9 pr-12 w-full bg-white border border-gray-200 rounded-md py-2 text-sm text-black"
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendEditSuggestion();
                          }
                        }}
                        disabled={isSubmittingEdit}
                      />
                      <button
                        className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full ${
                          isSubmittingEdit || !editMessage.trim() 
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                            : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                        }`}
                        onClick={handleSendEditSuggestion}
                        disabled={isSubmittingEdit || !editMessage.trim()}
                      >
                        <FaPaperPlane className="h-3 w-3" />
                      </button>
                    </div>
                    
                    {/* Show conversation history button - Now placed next to the chat input */}
                    {conversationHistory.length > 0 && (
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
                        // Use the same edit functionality as ReportRenderer
                        if (selectedReport) {
                          setIsEditMode(!isEditMode);
                          // If we're entering edit mode, create a new version
                          if (!isEditMode && reportVersions.length === 0) {
                            const initialVersion: ReportVersion = {
                              content: selectedReport.content,
                              visualizations: selectedReport.visualizations || [],
                              timestamp: new Date(),
                              versionNumber: 1
                            };
                            setReportVersions([initialVersion]);
                            setSelectedVersion(1);
                          }
                          
                          // Don't open version history automatically when entering edit mode
                          // This was causing version history to only open on first edit
                        }
                      }}
                      className="bg-purple-100 text-black hover:bg-purple-200 border-purple-200 border rounded-md px-3 py-1.5 text-sm flex items-center"
                    >
                      <FaEdit className="mr-2 h-3.5 w-3.5" />
                      Edit
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
                                exportReport(selectedReport?._id || '', 'pdf');
                                setShowExportOptions(false);
                              }}
                              disabled={exportLoading === 'pdf'}
                              className="flex w-full items-center px-4 py-2 text-sm text-black hover:bg-gray-100"
                              role="menuitem"
                            >
                              {exportLoading === 'pdf' ? (
                                <FaSpinner className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FaFilePdf className="mr-2 h-3.5 w-3.5 text-red-500" />
                              )}
                              Export as PDF
                        </button>
                        <button 
                          onClick={() => {
                                exportReport(selectedReport?._id || '', 'docx');
                                setShowExportOptions(false);
                              }}
                              disabled={exportLoading === 'docx'}
                              className="flex w-full items-center px-4 py-2 text-sm text-black hover:bg-gray-100"
                              role="menuitem"
                            >
                              {exportLoading === 'docx' ? (
                                <FaSpinner className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FaFileWord className="mr-2 h-3.5 w-3.5 text-blue-500" />
                              )}
                              Export as DOCX
                        </button>
                      </div>
                    </div>
                      )}
                    </div>
                    
                    {/* 3. Version History button */}
                    <button
                      onClick={() => {
                        setShowVersionHistory(!showVersionHistory);
                      }}
                      className="bg-purple-100 text-black hover:bg-purple-200 border-purple-200 border rounded-md px-3 py-1.5 text-sm flex items-center"
                    >
                      <FaHistory className="mr-2 h-3.5 w-3.5" /> 
                      Versions
                    </button>

                    {/* 4. Save New Version button */}
                    {!isEditMode && (
                      <button
                        onClick={handleSaveNewVersion}
                        className="bg-purple-100 text-black hover:bg-purple-200 border-purple-200 border rounded-md px-3 py-1.5 text-sm flex items-center"
                      >
                        <FaCheckCircle className="mr-2 h-3.5 w-3.5" />
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Chat Messages (only show when showConversation is true) */}
              {showConversation && conversationHistory.length > 0 && (
                <div className="border-t border-gray-200 p-4 bg-white">
                  <div className="bg-white max-h-[300px] overflow-y-auto">
                    {conversationHistory.map((message, index) => (
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
                    {isSubmittingEdit && (
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
            </Card>
            
            {/* Version History Section - Display horizontally BELOW the report */}
            {showVersionHistory && (
              <div className="version-history bg-white rounded-lg shadow-md p-4 mb-4 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                    <FaHistory className="mr-2 text-purple-600" /> Version History
                  </h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowVersionHistory(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <FaTimes />
                  </Button>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  Select a version to preview. You can revert to a previous version if needed.
                </p>
                
                {/* Horizontal scrollable version list */}
                <div className="overflow-x-auto pb-2">
                  <div className="flex space-x-2 min-w-max">
                    {reportVersions.map((version, index) => {
                      const versionNumber = index + 1;
                      const isSelected = selectedVersion === versionNumber;
                      const date = new Date(version.timestamp);
                      
                      return (
                        <div 
                          key={`version-${versionNumber}`}
                          className={`flex-shrink-0 border rounded-md p-3 cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-purple-100 border-purple-300' 
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                          onClick={() => handlePreviewVersion(versionNumber)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-black">Version {versionNumber}</div>
                            {isSelected && (
                              <Badge variant="outline" className="bg-gray-100 text-black border-none text-xs hover:bg-gray-200">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center">
                            <FaCalendarAlt className="mr-1" />
                            {format(date, 'MM/dd/yyyy, h:mm a')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {selectedVersion !== reportVersions.length && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleRevertToVersion(selectedVersion || 1)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Revert to Version {selectedVersion}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <FaSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search reports..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <select
                className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black bg-white"
                onChange={(e) => {
                  const sortOrder = e.target.value;
                  if (sortOrder === 'newest') {
                    setReports([...reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                  } else if (sortOrder === 'oldest') {
                    setReports([...reports].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
                  }
                }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              
              <Button 
                variant="outline" 
                onClick={fetchReports}
                disabled={loading}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                {loading ? <FaSpinner className="h-4 w-4 animate-spin" /> : <><FaSync className="mr-2 h-4 w-4" /> Refresh</>}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/dashboard/report-generation'}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                <FaFileAlt className="mr-2 h-4 w-4" /> Generate New Report
              </Button>
            </div>
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {loading ? (
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="flex flex-col items-center justify-center py-12">
                <div className="mb-4">
                  <FaSpinner className="h-10 w-10 text-purple-600 animate-spin" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Loading</h3>
                
              </div>
            </div>
          ) : filteredReports.length > 0 ? (
            <div className="space-y-4 w-[60%] mx-auto">
              {filteredReports.map((report) => (
                <Card key={report._id} className="hover:shadow-md transition-shadow duration-300 bg-white border border-gray-200 flex flex-col min-h-[180px] w-full">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg line-clamp-1 text-gray-900">
                        {report.title}
                      </CardTitle>
                      {report.isScheduled && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 ml-2">
                          <FaCalendarAlt className="mr-1 h-3 w-3" />
                          Scheduled
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2 flex-grow">
                    <div className="flex items-center text-sm text-gray-700">
                      <FaCalendarAlt className="mr-2 text-gray-500" />
                      <span>Created on {formatDate(report.createdAt)}</span>
                    </div>
                    {report.hasVisualizations && (
                      <div className="flex items-center text-sm text-gray-700 mt-2">
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          <FaChartBar className="mr-1 h-3 w-3" />
                          Visualizations
                        </Badge>
                        {report.isScheduled && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 ml-2">
                            <FaCalendarAlt className="mr-1 h-3 w-3" />
                            Scheduled
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-2">
                    <div className="flex justify-end w-full space-x-2">
                      {report.isScheduled && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => cancelSchedule(report.scheduledReportId || report._id)}
                          className="text-black hover:bg-orange-50 border-orange-200"
                          title="Cancel Schedule"
                        >
                          <FaCalendarTimes className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => deleteReport(report._id)}
                        className="text-gray-700 hover:bg-gray-100"
                        title="Delete"
                      >
                        <FaTrash className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() => openReport(report._id)}
                      >
                        Open
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FaFileAlt className="h-12 w-12 text-purple-600 mb-4" />
                <h3 className="text-lg font-medium text-black">No reports found</h3>
                <p className="text-sm text-black text-center mt-1">
                  {searchQuery ? 'No reports match your search criteria.' : 'You haven\'t saved any reports yet.'}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}