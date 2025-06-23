"use client"

import React, { useState, useEffect, useRef } from 'react';
import { FaExclamationTriangle, FaUserPlus, FaBrain, FaChartLine, FaProjectDiagram, FaUserTie, 
  FaSearch, FaInfoCircle, FaArrowRight, FaTimes, FaSyncAlt, FaHistory, FaLightbulb, FaSpinner, 
  FaExclamationCircle, FaPuzzlePiece, FaUserShield, FaShieldAlt, FaUserCheck, FaUserTimes, 
  FaCheckCircle, FaStar, FaChevronDown, FaChevronUp, FaUser, FaExternalLinkAlt, FaSync, 
  FaClipboardList } from 'react-icons/fa';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import AttritionRiskDetails from '@/components/AttritionRiskDetails';
import SuccessorViabilityCard from '@/components/SuccessorViabilityCard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from 'sonner';

// Use a simplified Skeleton component directly
const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 ${className}`}
    {...props}
  />
);

// Mock data for critical roles and potential successors
const criticalRolesData = [
  {
    id: 'CR001',
    title: 'Chief Technology Officer',
    currentHolder: {
      id: 'E002',
      name: 'Sarah Johnson',
      tenure: 48,
      readiness: 'N/A',
      criticality: 'Very High',
      attritionRisk: 'Medium',
      image: 'https://randomuser.me/api/portraits/women/44.jpg'
    },
    potentialSuccessors: [
      { id: 'E007', name: 'Alex Williams', title: 'Engineering Director', readiness: '12-24 months', match: 87, image: 'https://randomuser.me/api/portraits/men/32.jpg' },
      { id: 'E012', name: 'Jason Chen', title: 'Head of Data Science', readiness: '6-12 months', match: 76, image: 'https://randomuser.me/api/portraits/men/59.jpg' },
      { id: 'E025', name: 'Michelle Lee', title: 'Platform Engineering Lead', readiness: '24+ months', match: 68, image: 'https://randomuser.me/api/portraits/women/85.jpg' }
    ]
  },
  {
    id: 'CR002',
    title: 'VP of Product',
    currentHolder: {
      id: 'E003',
      name: 'Michael Chen',
      tenure: 36,
      readiness: 'N/A',
      criticality: 'High',
      attritionRisk: 'Low',
      image: 'https://randomuser.me/api/portraits/men/32.jpg'
    },
    potentialSuccessors: [
      { id: 'E014', name: 'Rebecca Taylor', title: 'Senior Product Manager', readiness: '6-12 months', match: 91, image: 'https://randomuser.me/api/portraits/women/22.jpg' },
      { id: 'E018', name: 'Daniel Park', title: 'UX Director', readiness: '12-24 months', match: 72, image: 'https://randomuser.me/api/portraits/men/79.jpg' }
    ]
  },
  {
    id: 'CR003',
    title: 'Head of Data Science',
    currentHolder: {
      id: 'E012',
      name: 'Jason Chen',
      tenure: 24,
      readiness: 'N/A',
      criticality: 'High',
      attritionRisk: 'High',
      image: 'https://randomuser.me/api/portraits/men/59.jpg'
    },
    potentialSuccessors: [
      { id: 'E023', name: 'Anita Patel', title: 'Senior Data Scientist', readiness: 'Ready Now', match: 85, image: 'https://randomuser.me/api/portraits/women/65.jpg' },
      { id: 'E034', name: 'Robert Jackson', title: 'ML Engineering Lead', readiness: '6-12 months', match: 78, image: 'https://randomuser.me/api/portraits/men/45.jpg' }
    ]
  }
];

// Define interfaces for the data structures
interface SuccessorCandidate {
  id: string;
  name: string;
  email?: string;
  jobTitle?: string;
  score: number;
  isViable: boolean;
  explanation: string;
  viableExplanation?: string;
  strengths?: string[];
  developmentAreas?: string[];
  factorScores?: {
    stabilityIndex?: number;
    projectComplexity?: number;
    cognitiveLoad?: number;
    promotionVelocity?: number;
    competencySimilarity?: number;
    [key: string]: number | undefined;
  };
  factorDetails?: Record<string, any>;
}

interface AttritionFactor {
  factor: string;
  score: number;
  explanation: string;
  description?: string;  // Add optional description field
}

interface FactorScores {
  responsibilityMismatch: number;
  tenureFactor: number;
  utilizationFactor: number;
  seniorityFactor: number;
  taskVarietyIndex: number;
  jobIntensity: number;
  roleProjectRatio: number;
  collaborationIndex: number;
}

interface EmployeeData {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  department?: string;
  projects?: any[]; // Change to any[] to match MongoDB structure
  attritionScore: number;
  attritionRisk: string;
  primaryExplanation: string;
  primaryRiskFactors: AttritionFactor[];
  factorScores: FactorScores;
  factorDetails?: Record<string, any>;
  successors?: SuccessorCandidate[];
  successorCount?: number; // Add successorCount property
  // Updated to match MongoDB structure
  salary?: string;
  workMode?: string;
  feedbackMetrics?: {
    received: {
      count: number;
      averageRating: number;
    }
  };
  // Keep these for backward compatibility
  feedbackRating?: number;
  totalFeedbacks?: number;
  jobResponsibilities?: any[]; // Array of duty objects
  toolsProficient?: string | string[]; // Can be string or array
  // Additional MongoDB fields
  industry?: string;
  officeLocation?: string;
  utilization_score?: number;
  // Successor specific fields
  matchScores?: {
    stabilityIndex?: number;
    projectComplexity?: number;
    cognitiveLoad?: number;
    promotionVelocity?: number;
    competencySimilarity?: number;
    [key: string]: number | undefined;
  };
  strengths?: string[];
  developmentAreas?: string[];
  isViableSuccessor?: boolean;
  successorScore?: number;
}

interface SearchResultsData {
  employee: EmployeeData;
  successorData?: {
    potentialSuccessors: SuccessorCandidate[];
  };
}

// Helper function to safely render any value as a string
const safeRender = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(v => safeRender(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return '';
};

export default function SuccessionPlanningPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultsData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [highRiskEmployees, setHighRiskEmployees] = useState<EmployeeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);
  const [successorData, setSuccessorData] = useState<{ potentialSuccessors: SuccessorCandidate[] } | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string>('');
  const [activeTab, setActiveTab] = useState('at-risk');
  const [error, setError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [insightMode, setInsightMode] = useState(false);
  const [showEmployeeDetails, setShowEmployeeDetails] = useState<boolean>(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showSuccessorDetails, setShowSuccessorDetails] = useState(false);
  const [selectedSuccessor, setSelectedSuccessor] = useState<{
    name: string;
    scores: any;
    explanation: string;
  } | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Load search history on component mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('successionSearchHistory');
      if (savedHistory) {
        setSearchHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
    
    // Focus on search input 
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);
  
  // Save search history whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('successionSearchHistory', JSON.stringify(searchHistory));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }, [searchHistory]);

  // Trigger analysis on component mount
  useEffect(() => {
    triggerAnalysis();
    fetchHighRiskEmployees();
  }, []);

  // Set up a timer to refresh data every 5 minutes
  useEffect(() => {
    const refreshTimer = setInterval(() => {
      fetchHighRiskEmployees();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(refreshTimer);
  }, []);

  // Add custom styles for the scrollbar
  useEffect(() => {
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
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handleHistoryClick = (query: string) => {
    setSearchQuery(query);
    setShowHistory(false);
    handleSearch({ preventDefault: () => {} } as React.FormEvent);
  };

  // Add a new search to history
  const addToHistory = (query: string) => {
    if (query.trim() === '') return;
    
    setSearchHistory(prevHistory => {
      // Remove duplicates and add new query at the beginning
      const filteredHistory = prevHistory.filter(item => item !== query);
      return [query, ...filteredHistory].slice(0, 10); // Keep last 10 searches
    });
  };
  
  // Clear search history
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('successionSearchHistory');
  };

  // Trigger backend analysis scripts
  const triggerAnalysis = async () => {
    setIsAnalysisRunning(true);
    try {
      // Use window.location.origin to ensure correct base URL
      const baseUrl = window.location.origin;
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/succession/run-analysis`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (!response.ok) {
        throw new Error('Failed to trigger analysis');
      }
      const data = await response.json();
      setLastAnalysisTime(new Date());
    } catch (error) {
      console.error('Error triggering analysis:', error);
      // Continue to show existing data
    } finally {
      setIsAnalysisRunning(false);
    }
  };

  // Fetch high-risk employees
  const fetchHighRiskEmployees = async () => {
    if (!isLoading) setIsLoading(true);
    setError(null);
    
    try {
      // Use window.location.origin to ensure correct base URL
      const baseUrl = window.location.origin;
      const token = localStorage.getItem('token');
      // Add cache busting parameter
      const cacheParam = `?cache=${Date.now()}`;
      const response = await fetch(`/api/succession/at-risk${cacheParam}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch high-risk employees');
      }
      
      const data = await response.json();
      
      // Check if we got valid data
      if (!data || !data.atRiskEmployees || !Array.isArray(data.atRiskEmployees)) {
        throw new Error('Invalid data format received from server');
      }
      
      console.log(`Received ${data.atRiskEmployees.length} at-risk employees`);
      
      // Map backend data to frontend format
      type BackendEmployeeData = {
        id: string;
        name: string;
        email: string;
        jobTitle?: string;
        department?: string;
        attritionScore?: number;
        attritionRisk?: string;
        primaryExplanation?: string;
        primaryRiskFactors?: any[];
        factorScores?: any;
        successorCount?: number;
        successors?: any[];
        // Additional fields that might be in the MongoDB data
        salary?: string;
        workMode?: string;
        industry?: string;
        officeLocation?: string;
        utilization_score?: number;
        feedbackMetrics?: {
          received?: {
            count?: number;
            averageRating?: number;
          }
        };
        jobResponsibilities?: any[];
        toolsProficient?: string | string[];
        factorDetails?: Record<string, any>;
      };
      
      // Transform backend data to our frontend model
      const employeeData: EmployeeData[] = data.atRiskEmployees.map((emp: BackendEmployeeData) => {
        // Ensure we have valid data for each field
        const factorScores = emp.factorScores || {};
        const successors = Array.isArray(emp.successors) ? emp.successors.map(successor => ({
          ...successor,
          // Ensure all successor properties have valid values
          id: successor.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
          name: successor.name || 'Unknown',
          email: successor.email || '',
          jobTitle: successor.jobTitle || '',
          score: typeof successor.score === 'number' ? successor.score : successor.successorScore || 0.5,
          isViable: typeof successor.isViable === 'boolean' ? successor.isViable : successor.isViableSuccessor || false,
          explanation: successor.explanation || 'Potential successor candidate',
          strengths: Array.isArray(successor.strengths) ? successor.strengths : [],
          developmentAreas: Array.isArray(successor.developmentAreas) ? successor.developmentAreas : [],
          factorScores: successor.factorScores || successor.matchScores || {}
        })) : [];

        return {
          id: emp.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
          name: emp.name || emp.email?.split('@')[0] || 'Unknown Employee',
          email: emp.email || '',
          jobTitle: emp.jobTitle || 'Employee',
          department: emp.department || 'Unknown',
          attritionScore: typeof emp.attritionScore === 'number' ? emp.attritionScore : 0.5,
          attritionRisk: emp.attritionRisk || 'medium',
          primaryExplanation: emp.primaryExplanation || 'Multiple factors contributing to attrition risk',
          primaryRiskFactors: Array.isArray(emp.primaryRiskFactors) ? emp.primaryRiskFactors : [],
          successorCount: typeof emp.successorCount === 'number' ? emp.successorCount : (successors.length || 0),
          successors: successors,
          // Add additional fields that might be used in the UI
          salary: emp.salary || '',
          workMode: emp.workMode || '',
          industry: emp.industry || '',
          officeLocation: emp.officeLocation || '',
          utilization_score: typeof emp.utilization_score === 'number' ? emp.utilization_score : 0.5,
          feedbackRating: emp.feedbackMetrics?.received?.averageRating || 0,
          totalFeedbacks: emp.feedbackMetrics?.received?.count || 0,
          jobResponsibilities: Array.isArray(emp.jobResponsibilities) ? emp.jobResponsibilities : [],
          toolsProficient: emp.toolsProficient || [],
          factorScores: {
            responsibilityMismatch: factorScores.responsibilityMismatch || 0.5,
            tenureFactor: factorScores.tenureFactor || 0.5,
            utilizationFactor: factorScores.utilizationFactor || 0.5,
            seniorityFactor: factorScores.seniorityFactor || 0.5,
            taskVarietyIndex: factorScores.taskVarietyIndex || 0.5,
            jobIntensity: factorScores.jobIntensity || 0.5,
            roleProjectRatio: factorScores.roleProjectRatio || 0.5,
            collaborationIndex: factorScores.collaborationIndex || 0.5
          },
          factorDetails: emp.factorDetails || {}
        };
      });
      
      setHighRiskEmployees(employeeData);
      
      if (employeeData.length === 0) {
        setError('No at-risk employees found. Try refreshing the data.');
      }
    } catch (err) {
      console.error('Error fetching high-risk employees:', err);
      setError(`Error fetching at-risk employees: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Search for successor candidates
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }
    
    setIsSearching(true);
    setSearchResults(null);
    setProcessingSteps([
      "Searching for employees matching your criteria...",
      "Analyzing candidate suitability...",
      "Calculating successor potential..."
    ]);
    
    try {
      // Add search to history
      addToHistory(searchQuery);
      
      const baseUrl = window.location.origin;
      const token = localStorage.getItem('token');
      
      // Search for employee
      const response = await fetch(`/api/succession/search?query=${encodeURIComponent(searchQuery)}`, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("No employee found matching your search criteria");
          setIsSearching(false);
          return;
        }
        throw new Error('Failed to search for employee');
      }
      
      const employee = await response.json();
      
      if (!employee || !employee.email) {
        toast.error("Invalid employee data received");
        setIsSearching(false);
        return;
      }
      
      // Set search results with the employee data
      setSearchResults({ 
        employee: {
          ...employee,
          attritionScore: employee.attritionScore !== undefined ? employee.attritionScore : 0.5,
          attritionRisk: employee.attritionRisk || 'medium',
          primaryRiskFactors: employee.primaryRiskFactors || [],
        } 
      });
      
      // Fetch successor data if available
      if (employee.successors && Array.isArray(employee.successors) && employee.successors.length > 0) {
        setSuccessorData({ 
          potentialSuccessors: employee.successors.map((successor: any) => ({
            ...successor,
            // Ensure required properties exist
            id: successor.id || successor._id || 'unknown',
            name: successor.name || 'Unknown',
            score: successor.score || successor.successorScore || 0.5,
            isViable: successor.isViable || successor.isViableSuccessor || false,
            explanation: successor.explanation || successor.viableExplanation || 'Potential successor candidate',
            factorScores: successor.factorScores || successor.matchScores || {}
          }))
        });
      } else {
        setSuccessorData({ potentialSuccessors: [] });
      }
      
      setActiveTab('search-results');
      
    } catch (error) {
      console.error('Error searching for employee:', error);
      toast.error((error as Error).message);
      // Keep current tab instead of switching to empty search results
    } finally {
      setIsSearching(false);
    }
  };

  // Get AI explanation for successor match
  const getSuccessorExplanation = async (employeeId: string, successorId: string) => {
    setIsExplaining(true);
    setError(null);
    
    try {
      // Use window.location.origin to ensure correct base URL
      const baseUrl = window.location.origin;
      const token = localStorage.getItem('token');
      const response = await fetch(`${baseUrl}/api/succession/explain?employee=${employeeId}&successor=${successorId}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (!response.ok) {
        throw new Error('Failed to get successor explanation');
      }
      const data = await response.json();
      setExplanation(data.explanation);
    } catch (error) {
      console.error('Error getting explanation:', error);
      setError('Failed to generate explanation. Please try again later.');
      setExplanation('');
    } finally {
      setIsExplaining(false);
    }
  };

  // Handle opening employee details modal
  const openEmployeeDetails = async (employee: EmployeeData) => {
    setSelectedEmployee(employee);
    setShowEmployeeDetails(true);
    
    if (employee.email) {
      try {
        // Fetch the latest employee data directly from the API
        const baseUrl = window.location.origin;
        const token = localStorage.getItem('token');
        const cacheParam = `?cache=${Date.now()}`;
        const response = await fetch(`${baseUrl}/api/succession/search?email=${encodeURIComponent(employee.email)}${cacheParam}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log("Fresh employee data:", data);
          
          if (data) {
            // Update with fresh data - include ALL relevant MongoDB fields
            const updatedEmployee: EmployeeData = {
              ...employee,
              // Update with all MongoDB-specific fields
              id: data.id || employee.id,
              name: data.name || employee.name,
              email: data.email || employee.email,
              jobTitle: data.jobTitle || employee.jobTitle,
              department: data.department || employee.department,
              attritionRisk: data.attritionRisk || employee.attritionRisk,
              attritionScore: data.attritionScore || employee.attritionScore,
              primaryExplanation: data.primaryExplanation || employee.primaryExplanation,
              primaryRiskFactors: data.primaryRiskFactors || employee.primaryRiskFactors,
              factorScores: data.factorScores || employee.factorScores,
              factorDetails: data.factorDetails || employee.factorDetails,
              // Additional MongoDB fields
              salary: data.salary || employee.salary,
              workMode: data.workMode || employee.workMode,
              feedbackMetrics: data.feedbackMetrics || employee.feedbackMetrics,
              jobResponsibilities: data.jobResponsibilities || employee.jobResponsibilities,
              toolsProficient: data.toolsProficient || employee.toolsProficient,
              projects: data.projects || employee.projects,
              // Add any other fields from the MongoDB document
              industry: data.industry || employee.industry,
              officeLocation: data.officeLocation || employee.officeLocation,
              utilization_score: data.utilization_score || employee.utilization_score,
              successors: data.successors || employee.successors
            };
            setSelectedEmployee(updatedEmployee);
          }
        }
      } catch (error) {
        console.error("Error fetching fresh employee data:", error);
      }
    }
  };

  // Handle opening successor details modal
  const openSuccessorDetails = (successorOrName: SuccessorCandidate | string, scores?: any, explanation?: string) => {
    if (typeof successorOrName === 'string') {
      // Handle the old function signature
      setSelectedSuccessor({
        name: successorOrName,
        scores: scores || {},
        explanation: explanation || ''
      });
    } else {
      // Handle the new function signature with SuccessorCandidate object
      const successor = successorOrName;
      setSelectedSuccessor({
        name: successor.name,
        scores: successor.factorScores || {},
        explanation: successor.explanation || 'Potential successor candidate'
      });
    }
    setShowSuccessorDetails(true);
  };

  // Generate user-friendly explanation for a factor
  const getFactorExplanation = (factorName: string, score: number, details: any) => {
    // Round score to percentage
    const scorePercent = Math.round(score * 100);
    
    // Default explanation if specific logic isn't available
    let explanation = `This factor has a score of ${scorePercent}%.`;
    
    switch(factorName) {
      case 'responsibilityMismatch':
        if (score > 0.7) {
          explanation = `There's a significant mismatch (${scorePercent}%) between expected responsibilities for this position and actual duties. This can lead to frustration and turnover.`;
        } else if (score > 0.4) {
          explanation = `There's a moderate mismatch (${scorePercent}%) between expected and actual job responsibilities, which may cause some dissatisfaction.`;
        } else {
          explanation = `Job responsibilities are well-aligned (only ${scorePercent}% mismatch) with the employee's role expectations.`;
        }
        break;
        
      case 'tenureFactor':
        if (score > 0.7) {
          explanation = `At ${scorePercent}% risk, the employee is in a high-risk tenure period where employees commonly reassess their position.`;
        } else if (score > 0.4) {
          explanation = `At ${scorePercent}% risk, the employee's current tenure puts them at moderate risk - they may be considering new opportunities.`;
        } else {
          explanation = `The employee's current tenure period is typically stable (${scorePercent}% risk), suggesting lower likelihood of departure based on time factors.`;
        }
        break;
        
      case 'utilizationFactor':
        if (score > 0.7) {
          explanation = `At ${scorePercent}%, this employee is significantly under or over-utilized, creating a high risk of burnout or disengagement.`;
        } else if (score > 0.4) {
          explanation = `At ${scorePercent}%, this employee's workload is somewhat imbalanced, which may lead to moderate attrition risk.`;
        } else {
          explanation = `The employee has a healthy workload balance (${scorePercent}% risk), suggesting good capacity utilization.`;
        }
        break;
        
      case 'seniorityFactor':
        if (score > 0.7) {
          explanation = `At this seniority level, the employee has a ${scorePercent}% risk - mid-level professionals often actively seek advancement opportunities.`;
        } else if (score > 0.4) {
          explanation = `The employee's career stage shows a ${scorePercent}% risk - typical for professionals evaluating growth options.`;
        } else {
          explanation = `The employee's seniority level has a relatively low attrition pattern (${scorePercent}% risk) - either very junior or well-established leadership.`;
        }
        break;
        
      case 'taskVarietyIndex':
        if (score > 0.7) {
          explanation = `At ${scorePercent}% risk, the employee may have either too many disparate tasks (overwhelming) or too few (boring).`;
        } else if (score > 0.4) {
          explanation = `The task variety is slightly imbalanced (${scorePercent}% risk), which may impact engagement moderately.`;
        } else {
          explanation = `The employee has a healthy balance of task variety (${scorePercent}% risk), keeping their work engaging without overwhelming them.`;
        }
        break;
        
      case 'jobIntensity':
        if (score > 0.7) {
          explanation = `With a ${scorePercent}% risk score, the job intensity is problematic - either too intense (burnout risk) or too light (boredom).`;
        } else if (score > 0.4) {
          explanation = `The job intensity is somewhat imbalanced (${scorePercent}% risk), which may cause moderate stress or insufficient challenge.`;
        } else {
          explanation = `The job has a healthy intensity level (${scorePercent}% risk), providing appropriate challenge without burnout.`;
        }
        break;
        
      case 'roleProjectRatio':
        if (score > 0.7) {
          explanation = `At ${scorePercent}% risk, the employee has a significant imbalance between their role seniority and project load - either too many or too few projects.`;
        } else if (score > 0.4) {
          explanation = `The employee's project load is somewhat misaligned (${scorePercent}% risk) with what's expected for their seniority.`;
        } else {
          explanation = `The employee has an appropriate project load (${scorePercent}% risk) for their seniority level.`;
        }
        break;
        
      case 'collaborationIndex':
        if (score > 0.7) {
          explanation = `With ${scorePercent}% risk, the employee shows limited social connection and collaboration, increasing isolation and attrition risk.`;
        } else if (score > 0.4) {
          explanation = `The employee has moderate collaboration patterns (${scorePercent}% risk), with room to improve workplace relationships.`;
        } else {
          explanation = `The employee shows strong collaboration and workplace relationships (${scorePercent}% risk), which typically improves retention.`;
        }
        break;
    }
    
    return explanation;
  };

  // Add a function to get mathematical explanations for factors
  const getFactorMathExplanation = (key: string) => {
    switch(key) {
      case 'responsibilityMismatch':
        return "Calculated using Jaccard distance between expected role responsibilities and actual duties. The score is normalized with a sigmoid function (1/(1+e^-10(x-0.5)) to emphasize high mismatch situations.";
      case 'tenureFactor':
        return "Follows a U-shaped curve where risk is high in first 12 months, dips in 1-3 year range, and climbs again at 4+ years. Modeled as f(x) = 0.8-0.4sin(πx/2) where x is tenure in years.";
      case 'utilizationFactor':
        return "Combines workload metrics (hours, project count) against role benchmarks. Uses a Gaussian deviation model where both under and over-utilization increase risk, with optimal utilization at 85%.";
      case 'seniorityFactor':
        return "Based on the employee's career stage. Mid-career professionals (5-15 years experience) have higher attrition risk scores due to growth ambitions. Modeled with a Gaussian curve peaking at 10 years.";
      case 'taskVarietyIndex':
        return "Measures task monotony risk using entropy calculations across work types. Higher entropy (more variety) is optimal to a point, after which cognitive load increases risk. Modeled with inverted U-curve.";
      case 'jobIntensity':
        return "Derived from survey data, communication frequency, deadline density, and cognitive complexity metrics. Higher intensity correlates with burnout risk using a logarithmic scale.";
      case 'roleProjectRatio':
        return "Compares number and complexity of projects to seniority level. Calculated as (actual projects)/(expected projects for role), with weighting for complexity. Both under and over-assignment increase risk.";
      case 'collaborationIndex':
        return "Uses network analysis of workplace interactions. Measures centrality in communication graphs, team cohesion metrics, and reciprocal relationship strength. Lower collaboration correlates with higher isolation and attrition.";
      default:
        return "This factor uses mathematical models based on workplace analytics and HR research to quantify attrition risk.";
    }
  };

  // Function to open the employee profile of a successor
  const openSuccessorProfile = async (successor: SuccessorCandidate) => {
    // Create a base profile from the successor data
    const successorProfile: Employee = {
      id: successor.id || 'temp-id',
      name: successor.name,
      email: successor.email || '',
      department: successor.department || '',
      jobTitle: successor.jobTitle || '',
      workMode: successor.workMode || '',
      attritionScore: 1 - (successor.factorScores?.stabilityIndex || 0.5), // Inverse of stability
      successorCount: 0,
      isAtRisk: false,
      developmentAreas: successor.developmentAreas || [
        'May need additional leadership training',
        'Further technical expertise development'
      ],
      strengths: successor.strengths || [
        'Experience in similar role responsibilities',
        'Compatible skill set for position requirements'
      ]
    };

    // Try to fetch fresh data from MongoDB
    try {
      const token = localStorage.getItem('token');
      const cacheParam = `?cache=${Date.now()}`;
      
      const response = await fetch(`/api/succession/search?email=${encodeURIComponent(successor.email)}${cacheParam}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.employee) {
          // Update with fresh data from MongoDB
          setSearchResults({
            employee: {
              ...data.employee,
              name: data.employee.name || successorProfile.name,
              email: data.employee.email || successorProfile.email,
              department: data.employee.department || successorProfile.department,
              jobTitle: data.employee.jobTitle || successorProfile.jobTitle,
              workMode: data.employee.workMode || successorProfile.workMode,
              attritionScore: data.employee.attritionScore || successorProfile.attritionScore,
              developmentAreas: data.employee.developmentAreas && data.employee.developmentAreas.length > 0 ? 
                data.employee.developmentAreas : successorProfile.developmentAreas,
              strengths: data.employee.strengths && data.employee.strengths.length > 0 ? 
                data.employee.strengths : successorProfile.strengths
            },
            successors: data.successors || []
          });
          setShowEmployeeDetails(true);
          return;
        }
      }
    } catch (error) {
      console.error('Error fetching successor data:', error);
    }
    
    // If we couldn't get fresh data, use what we have
    setSearchResults({
      employee: successorProfile,
      successors: []
    });
    setShowEmployeeDetails(true);
  };

  // State variables for refresh functionality are already declared at the top of the component

  // Function to fetch high risk employees is already declared at the top of the component

  // Add a refresh function that calls the run-analysis API
  const refreshAttritionData = async () => {
    if (isRefreshing || isAnalysisRunning) return;
    
    setIsRefreshing(true);
    setRefreshError(null);
    
    try {
      const token = localStorage.getItem('token');
      
      // Call the run-analysis API to refresh both attrition and successor data
      const response = await fetch(`/api/succession/run-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh data');
      }
      
      const result = await response.json();
      console.log('Refresh result:', result);
      
      // Show success toast - with sonner format
      toast.success("Data refresh is running. Results will update shortly.");
      
      // Refresh the data after a short delay to allow analysis to complete
      setTimeout(() => {
        fetchHighRiskEmployees(); // This will use setHighRiskEmployees from the original function
      }, 5000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setRefreshError((error as Error).message);
      
      // Show error toast - with sonner format
      toast.error("Failed to refresh data. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
              <FaUserTie className="text-purple-700 mr-3" />
              <span className="text-purple-700">Succession </span> Planning Dashboard
            </h1>
            <p className="text-lg text-gray-600">
              Find the right successors with AI-powered matching and risk assessment
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              onClick={refreshAttritionData}
              disabled={isRefreshing || isAnalysisRunning}
              className="bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
            >
              <FaSync className={(isRefreshing || isAnalysisRunning) ? "animate-spin" : ""} />
              {(isRefreshing || isAnalysisRunning) ? "Refreshing..." : "Refresh Data"}
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <FaExclamationTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search and Tabs Container */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-grow relative">
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search employee by name, title, department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10"
                />
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                {searchHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Search history"
                  >
                    <FaHistory />
                  </button>
                )}
                {showHistory && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                    <div className="flex justify-between items-center px-4 py-2 border-b">
                      <h3 className="text-sm font-medium text-gray-700">Recent searches</h3>
                      <button
                        onClick={clearHistory}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Clear All
                      </button>
                    </div>
                    <ul className="max-h-60 overflow-y-auto">
                      {searchHistory.map((query, index) => (
                        <li key={index} className="border-b border-gray-100 last:border-0">
                          <button
                            onClick={() => handleHistoryClick(query)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                          >
                            <FaHistory className="text-gray-400 mr-2" size={12} />
                            <span className="truncate">{query}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Button 
                type="submit" 
                className="bg-purple-600 hover:bg-purple-700"
                disabled={isSearching}
              >
                {isSearching ? (
                  <FaSpinner className="animate-spin mr-2" />
                ) : (
                  <FaSearch className="mr-2" />
                )}
                Find Successors
              </Button>
            </div>
          </form>

          {/* Processing steps (shown during search) */}
          {isSearching && processingSteps.length > 0 && (
            <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <FaBrain className="text-purple-600 mr-2" />
                <h3 className="text-md font-medium text-gray-800">Processing your request</h3>
              </div>
              <ul className="space-y-2">
                {processingSteps.map((step, index) => (
                  <li key={index} className="flex items-center text-sm text-gray-600">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-purple-100 text-purple-800 mr-2 text-xs">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Tabs 
            defaultValue="at-risk" 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="at-risk" className="text-gray-800">At-Risk Employees</TabsTrigger>
              <TabsTrigger value="search-results" className="text-gray-800">Search Results</TabsTrigger>
            </TabsList>

            {/* At-Risk Employees Tab */}
            <TabsContent value="at-risk" className="custom-scrollbar overflow-y-auto max-h-[70vh]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <FaExclamationTriangle className="text-amber-500 mr-2" />
                  Employees at High Risk of Leaving
                </h2>
                
                <Button
                  onClick={() => setInsightMode(!insightMode)}
                  variant="outline"
                  className={`flex items-center text-sm text-gray-800 ${
                    insightMode 
                      ? 'bg-purple-100 text-purple-800 border-purple-200' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <FaLightbulb className="mr-1" />
                  {insightMode ? 'Hide Details' : 'Show Details'}
                </Button>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="mb-4">
                      <CardHeader className="pb-2">
                        <Skeleton className="h-6 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full mb-3" />
                        <Skeleton className="h-4 w-5/6 mb-3" />
                        <div className="mt-4 space-y-2">
                          <Skeleton className="h-16 w-full" />
                          <Skeleton className="h-16 w-full" />
                          <Skeleton className="h-16 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : highRiskEmployees.length > 0 ? (
                <div className="space-y-4">
                  {highRiskEmployees.map((employee) => (
                    <Card key={employee.id} className="mb-4 hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle 
                              className="text-lg text-gray-900 hover:text-purple-700 cursor-pointer"
                              onClick={() => openEmployeeDetails(employee)}
                            >
                              {employee.name}
                            </CardTitle>
                            <CardDescription className="text-base text-gray-600">{employee.jobTitle}</CardDescription>
                          </div>
                          <Badge
                            variant={
                              employee.attritionScore > 0.7
                                ? "destructive"
                                : employee.attritionScore > 0.5
                                ? "default"
                                : "outline"
                            }
                            className="ml-2 text-sm"
                          >
                            Risk Score: {(employee.attritionScore * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4">
                          <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                            Primary Risk Factors:
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none ml-1">
                                    <FaInfoCircle size={14} />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[250px] p-3 bg-white text-gray-800 shadow-lg border rounded-lg text-xs">
                                  <p className="font-medium mb-1">Attrition Risk Factors</p>
                                  <p>These factors contribute most significantly to this employee's likelihood of leaving. Each factor is assigned a percentage that indicates its impact on overall attrition risk.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </h4>
                          <div className="space-y-2">
                            {employee.primaryRiskFactors && Array.isArray(employee.primaryRiskFactors) && employee.primaryRiskFactors.slice(0, 2).map((factor: any, idx: number) => {
                              // Safely extract properties from factor which could be an object with different structures
                              const factorName = typeof factor === 'object' && factor !== null 
                                ? (typeof factor.factor === 'string' ? factor.factor : 'Unknown Factor') 
                                : 'Unknown Factor';
                              
                              const factorScore = typeof factor === 'object' && factor !== null && typeof factor.score === 'number' 
                                ? Math.round(factor.score * 100) 
                                : 0;
                              
                              const factorExplanation = typeof factor === 'object' && factor !== null 
                                ? (typeof factor.explanation === 'string' 
                                  ? factor.explanation 
                                  : typeof factor.description === 'string' 
                                    ? factor.description 
                                    : 'No explanation available') 
                                : 'No explanation available';
                              
                              return (
                                <div key={idx} className="flex items-start">
                                  <FaExclamationCircle className="text-amber-500 mt-0.5 mr-2" size={14} />
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">
                                      {factorName.replace(/_/g, ' ')} ({factorScore}%)
                                    </span>
                                    <p className="text-sm text-gray-600">{factorExplanation}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {insightMode && (
                          <div className="bg-purple-50 p-3 rounded-lg mb-4 border border-purple-100">
                            <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                              <FaBrain className="text-purple-600 mr-2" size={14} />
                              Factor Analysis
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-600">
                                  Responsibility Mismatch:
                                  <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none ml-1">
                                          <FaInfoCircle size={10} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-[250px] p-3 bg-white text-gray-800 shadow-lg border rounded-lg text-xs">
                                        <p className="font-medium mb-1">Responsibility Mismatch</p>
                                        <p>Measures the gap between an employee's job title and actual responsibilities. Higher scores indicate greater mismatch, which increases attrition risk due to role confusion and unfulfilled expectations.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </span>
                                <span className="font-medium text-gray-800">{Math.round(employee.factorScores.responsibilityMismatch * 100)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">
                                  Utilization Factor:
                                  <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none ml-1">
                                          <FaInfoCircle size={10} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-[250px] p-3 bg-white text-gray-800 shadow-lg border rounded-lg text-xs">
                                        <p className="font-medium mb-1">Utilization Factor</p>
                                        <p>Measures the balance of an employee's workload. Both overwork (burnout) and underutilization (boredom) increase attrition risk. This uses a U-curve model where moderate utilization is optimal.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </span>
                                <span className="font-medium text-gray-800">{Math.round(employee.factorScores.utilizationFactor * 100)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">
                                  Job Intensity:
                                  <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none ml-1">
                                          <FaInfoCircle size={10} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-[250px] p-3 bg-white text-gray-800 shadow-lg border rounded-lg text-xs">
                                        <p className="font-medium mb-1">Job Intensity</p>
                                        <p>Measures the cognitive and emotional demands of the role. Higher values indicate that the job requires substantial mental effort, which can lead to higher burnout in roles lacking proper support systems.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </span>
                                <span className="font-medium text-gray-800">{Math.round(employee.factorScores.jobIntensity * 100)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">
                                  Collaboration Index:
                                  <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none ml-1">
                                          <FaInfoCircle size={10} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-[250px] p-3 bg-white text-gray-800 shadow-lg border rounded-lg text-xs">
                                        <p className="font-medium mb-1">Collaboration Index</p>
                                        <p>Measures workplace relationships and social integration. Lower collaboration correlates with higher attrition risk. This factor is calculated using interaction frequency, team integration metrics, and communication patterns.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </span>
                                <span className="font-medium text-gray-800">{Math.round(employee.factorScores.collaborationIndex * 100)}%</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mb-4">
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => openEmployeeDetails(employee)}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center"
                          >
                            <FaUserTie className="mr-2" size={14} />
                            View Employee Profile
                          </Button>
                        </div>

                        <div>
                          <h4 className="font-medium text-gray-800 mb-3 flex items-center justify-between">
                            <div className="flex items-center">
                              <FaUserPlus className="text-purple-600 mr-2" size={14} />
                              Potential Successors:
                            </div>
                            {/* Add a null check before comparison */}
                            {(employee.successorCount ?? 0) > 0 && (
                              <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
                                {employee.successorCount ?? 0} candidate{(employee.successorCount ?? 0) !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </h4>
                          <div className="space-y-3 overflow-hidden">
                            {employee.successors && Array.isArray(employee.successors) && employee.successors.length > 0 ? (
                              employee.successors.map((successor, idx) => (
                                <div key={idx} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm">
                                  <div className="flex justify-between items-start mb-1">
                                    <div>
                                      <h3 className="font-medium text-gray-800">{successor.name}</h3>
                                      <p className="text-xs text-gray-600 truncate">{successor.email || 'No email available'}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Badge className={
                                        successor.score >= 0.7 ? "bg-green-50 text-green-700 border" : 
                                        successor.score >= 0.5 ? "bg-yellow-50 text-yellow-700 border" : 
                                        "bg-red-50 text-red-700 border"
                                      }>
                                        {Math.round(successor.score * 100)}%
                                      </Badge>
                                      {successor.isViable ? (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                          <FaUserCheck className="mr-1" size={12} />
                                          Viable
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                          <FaUserTimes className="mr-1" size={12} />
                                          Non-Viable
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <p className="text-xs text-gray-600 mb-2">{typeof successor.explanation === 'string' ? successor.explanation : "This candidate has been identified as a potential successor."}</p>

                                  {/* Quick View Accordion */}
                                  <Collapsible className="border-t pt-2">
                                    <div className="flex justify-between items-center">
                                      <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="sm" className="p-0 h-6 text-purple-600">
                                          <FaChevronDown className="h-3 w-3 mr-1" />
                                          Quick View
                                        </Button>
                                      </CollapsibleTrigger>
                                      <div className="flex space-x-1">
                                        <Button 
                                          size="sm"
                                          variant="outline"
                                          className="h-5 text-xs px-1.5 bg-white text-purple-700 border-purple-200 hover:bg-purple-50 flex items-center"
                                          onClick={() => openSuccessorProfile(successor)}
                                        >
                                          View Profile
                                        </Button>
                                        <Button 
                                          size="sm"
                                          variant="outline"
                                          className="h-5 text-xs px-1.5 bg-white text-amber-600 border-amber-200 hover:bg-amber-50 flex items-center"
                                          onClick={() => openSuccessorProfile(successor)}
                                        >
                                          <FaUserTie className="mr-1" size={10} />
                                          Profile
                                        </Button>
                                      </div>
                                    </div>
                                    <CollapsibleContent className="mt-2">
                                      {/* Quick explanation of factors */}
                                      <div className="bg-gray-50 p-2 rounded-md text-xs text-gray-600 mb-2">
                                        Higher scores (green) indicate better successor match. Lower scores (red) indicate areas needing development.
                                      </div>
                                      
                                      {/* Factor Scores - Handle missing data gracefully */}
                                      {successor.factorScores && Object.keys(successor.factorScores).length > 0 ? (
                                        <div className="mb-2">
                                          <h4 className="text-xs font-medium text-gray-800 mb-1">Match Factors:</h4>
                                          <div className="space-y-1">
                                            {Object.entries(successor.factorScores).map(([key, value]) => {
                                              if (typeof value !== 'number') return null;
                                              
                                              // Convert keys with underscore to camelCase for display
                                              const displayKey = key.includes('_') 
                                                ? key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
                                                : key;
                                                
                                              const scorePercent = Math.round(value * 100);
                                              
                                              // Get simple description based on factor
                                              let factorDescription = "";
                                              switch(displayKey) {
                                                case 'stabilityIndex':
                                                  factorDescription = "Likelihood to remain with company long-term";
                                                  break;
                                                case 'projectComplexity':
                                                  factorDescription = "Experience handling challenging projects";
                                                  break;
                                                case 'cognitiveLoad':
                                                  factorDescription = "Capability to manage complex work demands";
                                                  break;
                                                case 'promotionVelocity':
                                                  factorDescription = "Career advancement trajectory";
                                                  break;
                                                case 'competencySimilarity':
                                                  factorDescription = "Skills overlap with required role";
                                                  break;
                                                default:
                                                  factorDescription = "Match metric for succession planning";
                                              }
                                              
                                              return (
                                                <div key={key} className="flex items-center text-xs">
                                                  <div className="flex items-center w-2/5">
                                                    <span className="text-gray-700 capitalize">{displayKey.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                    <TooltipProvider delayDuration={0}>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <button className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none ml-1">
                                                            <FaInfoCircle size={10} />
                                                          </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-[200px] p-2 bg-white text-gray-800 text-xs">
                                                          {typeof factorDescription === 'string' ? factorDescription : 'No description available'}
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  </div>
                                                  <div className="ml-1 flex-1">
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                      <div 
                                                        className={`h-1.5 rounded-full ${
                                                          scorePercent >= 70 ? 'bg-green-500' : 
                                                          scorePercent >= 50 ? 'bg-yellow-500' : 
                                                          'bg-red-500'
                                                        }`} 
                                                        style={{ width: `${scorePercent}%` }}
                                                      ></div>
                                                    </div>
                                                  </div>
                                                  <span className="ml-2 font-medium w-8 text-right">{scorePercent}%</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ) : (
                                        // Default factors if none are provided
                                        <div className="mb-2">
                                          <h4 className="text-xs font-medium text-gray-800 mb-1">Match Factors:</h4>
                                          <div className="space-y-1">
                                            {[
                                              { key: 'stabilityIndex', value: successor.score * 0.9, description: "Likelihood to remain with company long-term" },
                                              { key: 'competencySimilarity', value: successor.score * 1.1, description: "Skills overlap with required role" },
                                              { key: 'projectComplexity', value: successor.score * 0.8, description: "Experience handling challenging projects" }
                                            ].map((factor) => {
                                              const scorePercent = Math.min(100, Math.round(factor.value * 100));
                                              
                                              // Get simple description based on factor
                                              let factorDescription = "";
                                              switch(factor.key) {
                                                case 'stabilityIndex':
                                                  factorDescription = "Likelihood to remain with company long-term";
                                                  break;
                                                case 'projectComplexity':
                                                  factorDescription = "Experience handling challenging projects";
                                                  break;
                                                case 'cognitiveLoad':
                                                  factorDescription = "Capability to manage complex work demands";
                                                  break;
                                                case 'promotionVelocity':
                                                  factorDescription = "Career advancement trajectory";
                                                  break;
                                                case 'competencySimilarity':
                                                  factorDescription = "Skills overlap with required role";
                                                  break;
                                                default:
                                                  factorDescription = "Match metric for succession planning";
                                              }
                                              
                                              return (
                                                <div key={factor.key} className="flex items-center text-xs">
                                                  <div className="flex items-center w-2/5">
                                                    <span className="text-gray-700 capitalize">{factor.key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                    <TooltipProvider delayDuration={0}>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <button className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none ml-1">
                                                            <FaInfoCircle size={10} />
                                                          </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-[200px] p-2 bg-white text-gray-800 text-xs">
                                                          {factor.description}
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  </div>
                                                  <div className="ml-1 flex-1">
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                      <div 
                                                        className={`h-1.5 rounded-full ${
                                                          scorePercent >= 70 ? 'bg-green-500' : 
                                                          scorePercent >= 50 ? 'bg-yellow-500' : 
                                                          'bg-red-500'
                                                        }`} 
                                                        style={{ width: `${scorePercent}%` }}
                                                      ></div>
                                                    </div>
                                                  </div>
                                                  <span className="ml-2 font-medium w-8 text-right">{scorePercent}%</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Strengths */}
                                      {successor.strengths && successor.strengths.length > 0 ? (
                                        <div className="mb-2">
                                          <h4 className="text-xs font-medium text-gray-800 mb-1">Key Strengths:</h4>
                                          <ul className="pl-4 text-xs text-gray-700 list-disc">
                                            {successor.strengths.slice(0, 2).map((strength, idx) => (
                                              <li key={idx} className="mb-0.5">{typeof strength === 'string' ? strength : 'Strength'}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : (
                                        <div className="mb-2">
                                          <h4 className="text-xs font-medium text-gray-800 mb-1">Key Strengths:</h4>
                                          <ul className="pl-4 text-xs text-gray-700 list-disc">
                                            <li className="mb-0.5">Experience in similar role responsibilities</li>
                                            <li className="mb-0.5">Compatible skill set for position requirements</li>
                                          </ul>
                                        </div>
                                      )}
                                      
                                      {/* Development Areas */}
                                      <div>
                                        <h4 className="text-xs font-medium text-gray-800 mb-1">Development Areas:</h4>
                                        <ul className="pl-4 text-xs text-gray-700 list-disc">
                                          {successor && successor.developmentAreas && Array.isArray(successor.developmentAreas) && successor.developmentAreas.length > 0 ? (
                                            successor.developmentAreas.slice(0, 2).map((area, idx) => (
                                              <li key={idx} className="mb-0.5">{typeof area === 'string' ? area : 'Development area'}</li>
                                            ))
                                          ) : (
                                            <>
                                              <li className="mb-0.5">May need additional leadership training</li>
                                              <li className="mb-0.5">Further technical expertise development</li>
                                            </>
                                          )}
                                        </ul>
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-500 italic">No suitable successors found</div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert className="bg-white border-gray-200">
                  <FaInfoCircle className="h-4 w-4 text-gray-600" />
                  <AlertTitle className="text-gray-800">No at-risk employees found</AlertTitle>
                  <AlertDescription className="text-gray-700">
                    There are currently no employees identified as having a high attrition risk.
                    Click the &quot;Refresh&quot; button above to run a new analysis.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* Search Results Tab */}
            <TabsContent value="search-results" className="custom-scrollbar overflow-y-auto max-h-[70vh]">
              {searchResults ? (
                <div>
                  <Card className="mb-6 hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle 
                            className="text-lg text-gray-900 hover:text-purple-700 cursor-pointer"
                            onClick={() => openEmployeeDetails(searchResults.employee)}
                          >
                            {searchResults.employee.name}
                          </CardTitle>
                          <CardDescription className="text-base text-gray-600">{searchResults.employee.jobTitle}</CardDescription>
                        </div>
                        <Badge variant={searchResults.employee.attritionScore > 0.7 ? "destructive" : 
                                      searchResults.employee.attritionScore > 0.5 ? "default" : "outline"} 
                              className="ml-2 text-sm">
                          Risk Score: {(searchResults.employee.attritionScore * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      
                      {/* Employee Profile Preview - Condensed version with all fields */}
                      <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-800">Employee Profile</h4>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openEmployeeDetails(searchResults.employee)}
                            className="text-xs bg-white text-purple-700 border-purple-200 hover:bg-purple-50"
                          >
                            Employee Profile
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-gray-700 truncate">{searchResults.employee.email}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Department</p>
                            <p className="text-gray-700">{searchResults.employee.department || "Not specified"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Work Mode</p>
                            <p className="text-gray-700">{searchResults.employee.workMode || "Not specified"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Salary</p>
                            <p className="text-gray-700">{searchResults.employee.salary || "Confidential"}</p>
                          </div>
                          {searchResults.employee.projects && searchResults.employee.projects.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500">Projects</p>
                              <p className="text-gray-700 truncate">
                                {searchResults.employee.projects.slice(0, 2).map(p => p.project_title || p).join(", ")}
                                {searchResults.employee.projects.length > 2 ? "..." : ""}
                              </p>
                            </div>
                          )}
                          {searchResults.employee.feedbackMetrics?.received?.averageRating && (
                            <div>
                              <p className="text-xs text-gray-500">Feedback</p>
                              <p className="text-gray-700 flex items-center">
                                <FaStar className="text-yellow-400 mr-1" size={12} />
                                {searchResults.employee.feedbackMetrics.received.averageRating.toFixed(1)}/5
                                <span className="text-gray-500 ml-1">
                                  ({searchResults.employee.feedbackMetrics.received.count})
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Attrition Risk Details component */}
                      {insightMode && (
                        <AttritionRiskDetails
                          attritionScore={searchResults.employee.attritionScore}
                          attritionRisk={searchResults.employee.attritionRisk}
                          primaryExplanation={searchResults.employee.primaryExplanation}
                          primaryRiskFactors={searchResults.employee.primaryRiskFactors}
                          factorScores={searchResults.employee.factorScores}
                          factorDetails={searchResults.employee.factorDetails}
                          className="mb-4"
                        />
                      )}
                      
                      <h4 className="font-medium text-gray-800 mb-3 flex items-center justify-between">
                        <div className="flex items-center">
                          <FaUserPlus className="text-purple-600 mr-2" size={14} />
                          Potential Successors:
                        </div>
                      </h4>
                      
                      <div className="space-y-3 overflow-hidden">
                        {successorData && successorData.potentialSuccessors?.length > 0 ? (
                          successorData.potentialSuccessors.map((successor: SuccessorCandidate, idx: number) => (
                            <div key={successor.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm">
                              <div className="flex justify-between items-start mb-1">
                                <div>
                                  <h3 className="font-medium text-gray-800">{successor.name}</h3>
                                  <p className="text-xs text-gray-600 truncate">{successor.email || 'No email available'}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge className={successor.score >= 0.7 ? "bg-green-50 text-green-700 border" : successor.score >= 0.5 ? "bg-yellow-50 text-yellow-700 border" : "bg-red-50 text-red-700 border"}>
                                    {Math.round(successor.score * 100)}%
                                  </Badge>
                                  {successor.isViable ? (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      <FaUserCheck className="mr-1" size={12} />
                                      Viable
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                      <FaUserTimes className="mr-1" size={12} />
                                      Non-Viable
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              <p className="text-xs text-gray-600 mb-2">{typeof successor.explanation === 'string' ? successor.explanation : "Potential successor candidate"}</p>

                              {/* Quick View Accordion */}
                              <Collapsible className="border-t pt-2">
                                <div className="flex justify-between items-center">
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="p-0 h-6 text-purple-600">
                                      <FaChevronDown className="h-3 w-3 mr-1" />
                                      Quick View
                                    </Button>
                                  </CollapsibleTrigger>
                                  <div className="flex space-x-1">
                                    <Button 
                                      size="sm"
                                      variant="outline"
                                      className="h-5 text-xs px-1.5 bg-white text-purple-700 border-purple-200 hover:bg-purple-50 flex items-center"
                                      onClick={() => openSuccessorProfile(successor)}
                                    >
                                      View Profile
                                    </Button>
                                    <Button 
                                      size="sm"
                                      variant="outline"
                                      className="h-5 text-xs px-1.5 bg-white text-amber-600 border-amber-200 hover:bg-amber-50 flex items-center"
                                      onClick={() => openSuccessorProfile(successor)}
                                    >
                                      <FaUserTie className="mr-1" size={10} />
                                      Profile
                                    </Button>
                                  </div>
                                </div>
                                <CollapsibleContent className="mt-2">
                                  {/* Quick explanation of factors */}
                                  <div className="bg-gray-50 p-2 rounded-md text-xs text-gray-600 mb-2">
                                    Higher scores (green) indicate better successor match. Lower scores (red) indicate areas needing development.
                                  </div>
                                  
                                  {/* Factor Scores - Safe rendering with null checks */}
                                  {successor && successor.factorScores && typeof successor.factorScores === 'object' && Object.keys(successor.factorScores).length > 0 ? (
                                    <div className="mb-2">
                                      <h4 className="text-xs font-medium text-gray-800 mb-1">Match Factors:</h4>
                                      <div className="space-y-1">
                                        {Object.entries(successor.factorScores).map(([key, value]) => {
                                          if (typeof value !== 'number') return null;
                                          const scorePercent = Math.round(value as number * 100);
                                          
                                          // Get simple description based on factor
                                          let factorDescription = "";
                                          switch(key) {
                                            case 'stabilityIndex':
                                              factorDescription = "Likelihood to remain with company long-term";
                                              break;
                                            case 'projectComplexity':
                                              factorDescription = "Experience handling challenging projects";
                                              break;
                                            case 'cognitiveLoad':
                                              factorDescription = "Capability to manage complex work demands";
                                              break;
                                            case 'promotionVelocity':
                                              factorDescription = "Career advancement trajectory";
                                              break;
                                            case 'competencySimilarity':
                                              factorDescription = "Skills overlap with required role";
                                              break;
                                            default:
                                              factorDescription = "Match metric for succession planning";
                                          }
                                          
                                          return (
                                            <div key={key} className="flex items-center text-xs">
                                              <div className="flex items-center w-2/5">
                                                <span className="text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                <TooltipProvider delayDuration={0}>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <button className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none ml-1">
                                                        <FaInfoCircle size={10} />
                                                      </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-[200px] p-2 bg-white text-gray-800 text-xs">
                                                      {typeof factorDescription === 'string' ? factorDescription : 'No description available'}
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              </div>
                                              <div className="ml-1 flex-1">
                                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                  <div 
                                                    className={`h-1.5 rounded-full ${
                                                      scorePercent >= 70 ? 'bg-green-500' : 
                                                      scorePercent >= 50 ? 'bg-yellow-500' : 
                                                      'bg-red-500'
                                                    }`} 
                                                    style={{ width: `${scorePercent}%` }}
                                                  ></div>
                                                </div>
                                              </div>
                                              <span className="ml-2 font-medium w-8 text-right">{scorePercent}%</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : (
                                    // Default factors if none are provided
                                    <div className="mb-2">
                                      <h4 className="text-xs font-medium text-gray-800 mb-1">Match Factors:</h4>
                                      <div className="space-y-1">
                                        {[
                                          { key: 'stabilityIndex', value: successor.score * 0.9, description: "Likelihood to remain with company long-term" },
                                          { key: 'competencySimilarity', value: successor.score * 1.1, description: "Skills overlap with required role" },
                                          { key: 'projectComplexity', value: successor.score * 0.8, description: "Experience handling challenging projects" }
                                        ].map((factor) => {
                                          const scorePercent = Math.min(100, Math.round(factor.value * 100));
                                          
                                          // Get simple description based on factor
                                          let factorDescription = "";
                                          switch(factor.key) {
                                            case 'stabilityIndex':
                                              factorDescription = "Likelihood to remain with company long-term";
                                              break;
                                            case 'projectComplexity':
                                              factorDescription = "Experience handling challenging projects";
                                              break;
                                            case 'cognitiveLoad':
                                              factorDescription = "Capability to manage complex work demands";
                                              break;
                                            case 'promotionVelocity':
                                              factorDescription = "Career advancement trajectory";
                                              break;
                                            case 'competencySimilarity':
                                              factorDescription = "Skills overlap with required role";
                                              break;
                                            default:
                                              factorDescription = "Match metric for succession planning";
                                          }
                                          
                                          return (
                                            <div key={factor.key} className="flex items-center text-xs">
                                              <div className="flex items-center w-2/5">
                                                <span className="text-gray-700 capitalize">{factor.key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                <TooltipProvider delayDuration={0}>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <button className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none ml-1">
                                                        <FaInfoCircle size={10} />
                                                      </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-[200px] p-2 bg-white text-gray-800 text-xs">
                                                      {typeof factor.description === 'string' ? factor.description : 'No description available'}
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              </div>
                                              <div className="ml-1 flex-1">
                                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                  <div 
                                                    className={`h-1.5 rounded-full ${
                                                      scorePercent >= 70 ? 'bg-green-500' : 
                                                      scorePercent >= 50 ? 'bg-yellow-500' : 
                                                      'bg-red-500'
                                                    }`} 
                                                    style={{ width: `${scorePercent}%` }}
                                                  ></div>
                                                </div>
                                              </div>
                                              <span className="ml-2 font-medium w-8 text-right">{scorePercent}%</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Strengths - Safe rendering with null checks */}
                                  {successor && successor.strengths && Array.isArray(successor.strengths) && successor.strengths.length > 0 ? (
                                    <div className="mb-2">
                                      <h4 className="text-xs font-medium text-gray-800 mb-1">Key Strengths:</h4>
                                      <ul className="pl-4 text-xs text-gray-700 list-disc">
                                        {successor.strengths.slice(0, 2).map((strength, idx) => (
                                          <li key={idx} className="mb-0.5">{typeof strength === 'string' ? strength : 'Strength'}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : (
                                    <div className="mb-2">
                                      <h4 className="text-xs font-medium text-gray-800 mb-1">Key Strengths:</h4>
                                      <ul className="pl-4 text-xs text-gray-700 list-disc">
                                        <li className="mb-0.5">Experience in similar role responsibilities</li>
                                        <li className="mb-0.5">Compatible skill set for position requirements</li>
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* Development Areas - Safe rendering with null checks */}
                                  <div>
                                    <h4 className="text-xs font-medium text-gray-800 mb-1">Development Areas:</h4>
                                    <ul className="pl-4 text-xs text-gray-700 list-disc">
                                      {successor && successor.developmentAreas && Array.isArray(successor.developmentAreas) && successor.developmentAreas.length > 0 ? (
                                        successor.developmentAreas.slice(0, 2).map((area, idx) => (
                                          <li key={idx} className="mb-0.5">{typeof area === 'string' ? area : 'Development area'}</li>
                                        ))
                                      ) : (
                                        <>
                                          <li className="mb-0.5">May need additional leadership training</li>
                                          <li className="mb-0.5">Further technical expertise development</li>
                                        </>
                                      )}
                                    </ul>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-700 italic p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p>No suitable successors found for this employee. Try running a new analysis.</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-10 bg-white rounded-lg border border-gray-200">
                  <FaSearch className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No search results</h3>
                  <p className="mt-2 text-sm text-gray-700">
                    Search for an employee to find potential succession candidates
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Employee Details Modal */}
        {showEmployeeDetails && selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white z-10 border-b px-4 py-2 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FaUserTie className="text-purple-600 mr-2" />
                  {selectedEmployee.name}
                </h3>
              </div>
              
              <div className="p-4">
                {/* Basic Info - Two column layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column - Personal Info */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-800 mb-2">Employment Information</h4>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Email</p>
                          <p className="text-sm text-gray-900">{selectedEmployee.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Job Title</p>
                          <p className="text-sm text-gray-900">{selectedEmployee.jobTitle}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Department</p>
                          <p className="text-sm text-gray-900">{selectedEmployee.department || "Not specified"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Salary</p>
                          <p className="text-sm text-gray-900">{selectedEmployee.salary || "Confidential"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Work Mode</p>
                          <p className="text-sm text-gray-900">{selectedEmployee.workMode || "Not specified"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Industry</p>
                          <p className="text-sm text-gray-900">{selectedEmployee.industry || "Not specified"}</p>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Feedback Rating</p>
                        {selectedEmployee.feedbackMetrics?.received?.averageRating ? (
                          <div className="flex items-center">
                            <div className="flex items-center mr-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <FaStar 
                                  key={star} 
                                  className={star <= (selectedEmployee.feedbackMetrics?.received?.averageRating || 0) ? "text-yellow-400" : "text-gray-300"}
                                  size={12}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-gray-700">
                              {selectedEmployee.feedbackMetrics.received.averageRating.toFixed(1)} ({selectedEmployee.feedbackMetrics.received.count || 0} ratings)
                            </span>
                          </div>
                        ) : selectedEmployee.feedbackRating ? (
                          <div className="flex items-center">
                            <div className="flex items-center mr-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <FaStar 
                                  key={star} 
                                  className={star <= (selectedEmployee.feedbackRating || 0) ? "text-yellow-400" : "text-gray-300"}
                                  size={12}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-gray-700">
                              {selectedEmployee.feedbackRating.toFixed(1)} ({selectedEmployee.totalFeedbacks || 0} ratings)
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-900">No feedback available</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Column - Skills and Responsibilities */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-800 mb-2">Skills & Responsibilities</h4>
                    <div className="space-y-2">
                      {selectedEmployee.jobResponsibilities && selectedEmployee.jobResponsibilities.length > 0 ? (
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Job Responsibilities</p>
                          <ul className="pl-3 text-sm text-gray-700 list-disc">
                            {selectedEmployee.jobResponsibilities.slice(0, 3).map((responsibility: {duty: string, hours: number} | string, idx: number) => (
                              <li key={idx} className="mb-0.5">
                                {typeof responsibility === 'object' ? 
                                  `${responsibility.duty} (${responsibility.hours} hrs/week)` : 
                                  responsibility}
                              </li>
                            ))}
                            {selectedEmployee.jobResponsibilities.length > 3 && (
                              <li className="text-xs text-gray-500">...and {selectedEmployee.jobResponsibilities.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Job Responsibilities</p>
                          <p className="text-sm text-gray-700">Not specified</p>
                        </div>
                      )}
                      
                      {selectedEmployee.toolsProficient ? (
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Tools & Technologies</p>
                          <div className="flex flex-wrap gap-1 mt-1 max-h-20 overflow-y-auto">
                            {typeof selectedEmployee.toolsProficient === 'string' 
                              ? selectedEmployee.toolsProficient.split(',').map((tool: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-xs">
                                    {tool.trim()}
                                  </Badge>
                                ))
                              : Array.isArray(selectedEmployee.toolsProficient) 
                                ? (selectedEmployee.toolsProficient as string[]).map((tool: string, idx: number) => (
                                    <Badge key={idx} variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-xs">
                                      {tool}
                                    </Badge>
                                  ))
                                : (
                                  <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-xs">
                                    {String(selectedEmployee.toolsProficient)}
                                  </Badge>
                                )
                            }
                          </div>
                        </div>
                      ) : null}
                      
                      {selectedEmployee.projects && selectedEmployee.projects.length > 0 ? (
                        <div className="mb-4">
                          <h3 className="text-md font-semibold text-gray-800 mb-2 flex items-center">
                            <FaProjectDiagram className="text-purple-500 mr-2" size={16} />
                            Projects
                          </h3>
                          <ul className="pl-5 list-disc text-gray-700 space-y-1">
                            {selectedEmployee.projects.map((project: {project_title?: string} | string, idx: number) => (
                              <li key={idx}>
                                {typeof project === 'object' ? 
                                  project.project_title || 'Unnamed Project' : 
                                  project}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Office Location</p>
                        <p className="text-sm text-gray-900">{selectedEmployee.officeLocation || "Not specified"}</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Utilization Score</p>
                        <p className="text-sm text-gray-900">
                          {selectedEmployee.utilization_score !== undefined 
                            ? `${(selectedEmployee.utilization_score * 100).toFixed(0)}%` 
                            : "Not calculated"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Close button */}
                <div className="mt-3 flex justify-end">
                  <Button 
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => setShowEmployeeDetails(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Successor Details Modal - REMOVED */}

        {/* Successor Explanation Modal */}
        {explanation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                    <FaBrain className="text-purple-600 mr-2" size={18} />
                    AI Succession Analysis
                  </h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setExplanation('')}
                    className="hover:bg-gray-100 rounded-full h-8 w-8 p-0 flex items-center justify-center"
                  >
                    <FaTimes />
                  </Button>
                </div>
                
                {isExplaining ? (
                  <div className="py-4 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Generating detailed analysis...</p>
                  </div>
                ) : (
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-line text-gray-700 p-4 bg-purple-50 rounded-lg border border-purple-100">
                      {explanation}
                    </div>
                  </div>
                )}
                
                <div className="mt-6 flex justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setExplanation('')}
                    className="border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 