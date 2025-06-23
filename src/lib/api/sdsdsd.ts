'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FaExclamationTriangle, FaUserPlus, FaBrain, FaChartLine, FaProjectDiagram, FaUserTie, 
  FaSearch, FaInfoCircle, FaArrowRight, FaTimes, FaSyncAlt, FaHistory, FaLightbulb, FaSpinner, 
  FaExclamationCircle, FaPuzzlePiece, FaUserShield, FaShieldAlt, FaUserCheck, FaUserTimes, 
  FaCheckCircle, FaStar, FaChevronDown } from 'react-icons/fa';
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
  const [showEmployeeDetails, setShowEmployeeDetails] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [showSuccessorDetails, setShowSuccessorDetails] = useState(false);
  const [selectedSuccessor, setSelectedSuccessor] = useState<{
    name: string;
    scores: any;
    explanation: string;
  } | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      const response = await fetch(`${baseUrl}/api/succession/run-analysis`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
      // Add cache busting parameter
      const cacheParam = `?cache=${Date.now()}`;
      const response = await fetch(`${baseUrl}/api/succession/at-risk${cacheParam}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch high-risk employees');
      }
      const data = await response.json();
      console.log("At-risk employees data:", data); // Debug log
      setHighRiskEmployees(data.employees || []);
    } catch (error) {
      console.error('Error fetching high-risk employees:', error);
      setError('Failed to fetch at-risk employees. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Search for successor candidates
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      return;
    }
    
    addToHistory(searchQuery);
    setIsSearching(true);
    setError(null);
    setActiveTab('search-results');
    setProcessingSteps([]);
    
    // Show AI processing steps animation
    const processingPhases = [
      'Searching employee database...',
      'Analyzing attrition risk factors...',
      'Finding potential successors...',
      'Calculating successor match scores...',
      'Generating succession recommendations...'
    ];
    
    for (let i = 0; i < processingPhases.length; i++) {
      setProcessingSteps(prev => [...prev, processingPhases[i]]);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    try {
      // Use window.location.origin to ensure correct base URL
      const baseUrl = window.location.origin;
      
      // Detect if the search is an email and use the email parameter directly
      const isEmail = searchQuery.includes('@');
      // Add cache busting parameter
      const cacheParam = `&cache=${Date.now()}`;
      let url = isEmail 
        ? `${baseUrl}/api/succession/search?email=${encodeURIComponent(searchQuery)}${cacheParam}`
        : `${baseUrl}/api/succession/search?query=${encodeURIComponent(searchQuery)}${cacheParam}`;
      
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No employee found matching your search criteria');
        }
        throw new Error('Failed to search for employee');
      }
      
      const data = await response.json();
      console.log("Search results data:", data); // Add debug logging
      
      // Map the successors from API to the expected SuccessorCandidate format
      const mappedSuccessors: SuccessorCandidate[] = Array.isArray(data.successors) 
        ? data.successors.map((successor: any) => ({
            id: successor.candidate_id || successor.candidate_email || 'unknown',
            name: successor.candidate_name || 'Unknown',
            email: successor.candidate_email || '',
            jobTitle: successor.candidate_jobTitle || successor.candidate_role || 'Employee',
            score: successor.successor_score || 0,
            isViable: successor.viability === 'viable' || successor.viability === 'good' || successor.viability === 'excellent',
            explanation: successor.summary || successor.viability_explanation || 'No explanation available',
            viableExplanation: successor.viability_explanation || '',
            strengths: Array.isArray(successor.strengths) 
              ? successor.strengths.map((s: any) => s.description || '') 
              : [],
            developmentAreas: Array.isArray(successor.development_areas) 
              ? successor.development_areas.map((d: any) => d.description || '') 
              : [],
            factorScores: {
              stabilityIndex: successor.factor_scores?.stability_index || 0,
              projectComplexity: successor.factor_scores?.project_complexity || 0,
              cognitiveLoad: successor.factor_scores?.cognitive_load || 0,
              promotionVelocity: successor.factor_scores?.promotion_velocity || 0,
              competencySimilarity: successor.factor_scores?.competency_similarity || 0
            },
            factorDetails: successor.factor_details || {}
          }))
        : [];
      
      // Format the response to match the expected SearchResultsData structure
      const formattedData: SearchResultsData = {
        employee: {
          id: data.id || 'unknown',
          name: data.name || 'Unknown',
          email: data.email || 'unknown@example.com',
          jobTitle: data.jobTitle || 'Employee',
          department: data.department || 'Unknown',
          attritionScore: data.attritionScore || 0.5,
          attritionRisk: data.attritionRisk || 'medium',
          primaryExplanation: data.primaryExplanation || 'Multiple factors contributing to attrition risk',
          primaryRiskFactors: data.primaryRiskFactors || [],
          factorScores: data.factorScores || {
            responsibilityMismatch: 0.5,
            tenureFactor: 0.5,
            utilizationFactor: 0.5,
            seniorityFactor: 0.5,
            taskVarietyIndex: 0.5,
            jobIntensity: 0.5,
            roleProjectRatio: 0.5,
            collaborationIndex: 0.5
          },
          factorDetails: data.factorDetails || {},
          // Map the MongoDB specific fields
          salary: data.salary || '',
          workMode: data.workMode || '',
          feedbackMetrics: data.feedbackMetrics,
          jobResponsibilities: data.jobResponsibilities || [],
          toolsProficient: data.toolsProficient || '',
          projects: data.projects || []
        },
        successorData: {
          potentialSuccessors: mappedSuccessors
        }
      };
      
      console.log("Formatted employee data:", formattedData.employee); // Debug log for employee data
      
      setSearchResults(formattedData);
      setSuccessorData({ potentialSuccessors: mappedSuccessors });
      setActiveTab('search-results');
    } catch (error: any) {
      console.error('Error searching for employee:', error);
      setError(error.message || 'Error searching for employee');
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
      const response = await fetch(`${baseUrl}/api/succession/explain?employee=${employeeId}&successor=${successorId}`);
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
        const cacheParam = `?cache=${Date.now()}`;
        const response = await fetch(`${baseUrl}/api/succession/search?email=${encodeURIComponent(employee.email)}${cacheParam}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log("Fresh employee data:", data);
          
          if (data) {
            // Update with fresh data
            const updatedEmployee: EmployeeData = {
              ...employee,
              // Update with MongoDB-specific fields
              salary: data.salary || employee.salary,
              workMode: data.workMode || employee.workMode,
              feedbackMetrics: data.feedbackMetrics || employee.feedbackMetrics,
              jobResponsibilities: data.jobResponsibilities || employee.jobResponsibilities,
              toolsProficient: data.toolsProficient || employee.toolsProficient,
              projects: data.projects || employee.projects
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
  const openSuccessorDetails = (name: string, scores: any, explanation: string) => {
    setSelectedSuccessor({
      name,
      scores,
      explanation
    });
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

  // Add the successor profile function
  const openSuccessorProfile = (successor: SuccessorCandidate) => {
    // Create a profile-like object with the successor data
    const successorProfile: EmployeeData = {
      id: successor.id,
      name: successor.name,
      email: successor.email || 'Not available',
      jobTitle: successor.jobTitle || 'Not specified',
      department: '',
      attritionScore: 1 - (successor.factorScores?.stabilityIndex || 0.5), // Inverse of stability
      attritionRisk: 'unknown',
      primaryExplanation: successor.explanation,
      primaryRiskFactors: [],
      factorScores: {
        responsibilityMismatch: 0,
        tenureFactor: 0,
        utilizationFactor: 0,
        seniorityFactor: 0,
        taskVarietyIndex: 0,
        jobIntensity: 0,
        roleProjectRatio: 0,
        collaborationIndex: 0
      },
      // Add the successor specific fields
      salary: 'Not available',
      workMode: 'Not available',
      feedbackMetrics: {
        received: {
          count: 0,
          averageRating: 0
        }
      },
      jobResponsibilities: [],
      toolsProficient: '',
      // Include the successor scores
      matchScores: successor.factorScores as any, // Cast to fix type issues
      strengths: successor.strengths || [],
      developmentAreas: successor.developmentAreas || [],
      successorScore: successor.score,
      isViableSuccessor: successor.isViable
    };
    
    setSelectedEmployee(successorProfile);
    setShowEmployeeDetails(true);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
              <FaUserTie className="text-purple-700 mr-3" />
              <span className="text-purple-700">Succession</span>  Planning Dashboard
            </h1>
            <p className="text-lg text-gray-600">
              Find the right successors with AI-powered matching and risk assessment
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {lastAnalysisTime && (
              <span className="text-sm text-gray-500">
                Last analyzed: {lastAnalysisTime.toLocaleTimeString()}
              </span>
            )}
            <Button 
              onClick={triggerAnalysis}
              disabled={isAnalysisRunning}
              className="bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
            >
              <FaSyncAlt className={isAnalysisRunning ? "animate-spin" : ""} />
              {isAnalysisRunning ? "Analyzing..." : "Refresh"}
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
                            Risk Score: {Math.round(employee.attritionScore * 100)}%
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
                            {employee.primaryRiskFactors.slice(0, 2).map((factor: AttritionFactor, idx: number) => (
                              <div key={idx} className="flex items-start">
                                <FaExclamationCircle className="text-amber-500 mt-0.5 mr-2" size={14} />
                                <div>
                                  <span className="text-sm font-medium text-gray-700">
                                    {factor.factor.replace(/_/g, ' ')} ({Math.round(factor.score * 100)}%)
                                  </span>
                                  <p className="text-sm text-gray-600">{factor.explanation}</p>
                                </div>
                              </div>
                            ))}
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
                          <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                            <FaUserPlus className="text-purple-600 mr-2" size={14} />
                            Potential Successors:
                          </h4>
                          <div className="space-y-3">
                            {employee.successors && employee.successors.length > 0 ? (
                              employee.successors.map((successor, idx) => (
                                <div key={idx} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm">
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
                                  
                                  <p className="text-xs text-gray-600 mb-2">{successor.explanation || "This candidate has been identified as a potential successor."}</p>

                                  {/* Quick View Accordion */}
                                  <Collapsible className="border-t pt-2">
                                    <div className="flex justify-between items-center">
                                      <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="sm" className="p-0 h-6 text-purple-600">
                                          <FaChevronDown className="h-3 w-3 mr-1" />
                                          Quick View
                                        </Button>
                                      </CollapsibleTrigger>
                                      <Button 
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-xs px-2 bg-white text-purple-700 border-purple-200 hover:bg-purple-50 flex items-center"
                                        onClick={() => openSuccessorProfile(successor)}
                                      >
                                        Employee Profile
                                      </Button>
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
                                              const scorePercent = Math.round(value * 100);
                                              
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
                                                          {factorDescription}
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
                                              <li key={idx} className="mb-0.5">{strength}</li>
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
                                      {successor.developmentAreas && successor.developmentAreas.length > 0 ? (
                                        <div>
                                          <h4 className="text-xs font-medium text-gray-800 mb-1">Development Areas:</h4>
                                          <ul className="pl-4 text-xs text-gray-700 list-disc">
                                            {successor.developmentAreas.slice(0, 2).map((area, idx) => (
                                              <li key={idx} className="mb-0.5">{area}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : (
                                        <div>
                                          <h4 className="text-xs font-medium text-gray-800 mb-1">Development Areas:</h4>
                                          <ul className="pl-4 text-xs text-gray-700 list-disc">
                                            <li className="mb-0.5">May need additional leadership training</li>
                                            <li className="mb-0.5">Further technical expertise development</li>
                                          </ul>
                                        </div>
                                      )}
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
                            View Full Profile
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
                      
                      <h4 className="font-medium text-gray-800 mb-3 flex items-center">
                        <FaUserPlus className="text-purple-600 mr-2" size={14} />
                        Potential Successors:
                      </h4>
                      
                      <div className="space-y-3">
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
                              
                              <p className="text-xs text-gray-600 mb-2">{successor.explanation}</p>

                              {/* Quick View Accordion */}
                              <Collapsible className="border-t pt-2">
                                <div className="flex justify-between items-center">
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="p-0 h-6 text-purple-600">
                                      <FaChevronDown className="h-3 w-3 mr-1" />
                                      Quick View
                                    </Button>
                                  </CollapsibleTrigger>
                                  <Button 
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs px-2 bg-white text-purple-700 border-purple-200 hover:bg-purple-50 flex items-center"
                                    onClick={() => openSuccessorProfile(successor)}
                                  >
                                    Employee Profile
                                  </Button>
                                </div>
                                <CollapsibleContent className="mt-2">
                                  {/* Quick explanation of factors */}
                                  <div className="bg-gray-50 p-2 rounded-md text-xs text-gray-600 mb-2">
                                    Higher scores (green) indicate better successor match. Lower scores (red) indicate areas needing development.
                                  </div>
                                  
                                  {/* Factor Scores */}
                                  {successor.factorScores && Object.keys(successor.factorScores).length > 0 && (
                                    <div className="mb-2">
                                      <h4 className="text-xs font-medium text-gray-800 mb-1">Match Factors:</h4>
                                      <div className="space-y-1">
                                        {Object.entries(successor.factorScores).map(([key, value]) => {
                                          if (typeof value !== 'number') return null;
                                          const scorePercent = Math.round(value * 100);
                                          
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
                                                      {factorDescription}
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
                                  {successor.strengths && successor.strengths.length > 0 && (
                                    <div className="mb-2">
                                      <h4 className="text-xs font-medium text-gray-800 mb-1">Key Strengths:</h4>
                                      <ul className="pl-4 text-xs text-gray-700 list-disc">
                                        {successor.strengths.slice(0, 2).map((strength, idx) => (
                                          <li key={idx} className="mb-0.5">{strength}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* Development Areas */}
                                  {successor.developmentAreas && successor.developmentAreas.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-800 mb-1">Development Areas:</h4>
                                      <ul className="pl-4 text-xs text-gray-700 list-disc">
                                        {successor.developmentAreas.slice(0, 2).map((area, idx) => (
                                          <li key={idx} className="mb-0.5">{area}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
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
              <div className="sticky top-0 bg-white z-10 border-b px-6 py-3 flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                  <FaUserTie className="text-purple-600 mr-2" />
                  Employee Profile: {selectedEmployee.name}
                </h3>
                <div className="flex items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEmployeeDetails(selectedEmployee)}
                    className="text-xs mr-2 bg-white text-green-700 border-green-200 hover:bg-green-50 flex items-center"
                  >
                    <FaSyncAlt className="mr-1" size={10} />
                    Refresh
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowEmployeeDetails(false)}
                    className="hover:bg-gray-100 rounded-full h-8 w-8 p-0 flex items-center justify-center"
                  >
                    <FaTimes />
                  </Button>
                </div>
              </div>
              
              <div className="p-5">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Left Column - Personal Info */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="text-base font-medium text-gray-800 mb-3">Employment Information</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Name</p>
                            <p className="font-medium text-gray-900">{selectedEmployee.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Email</p>
                            <p className="font-medium text-gray-900">{selectedEmployee.email}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Job Title</p>
                            <p className="font-medium text-gray-900">{selectedEmployee.jobTitle}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Department</p>
                            <p className="font-medium text-gray-900">{selectedEmployee.department || "Not specified"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Salary</p>
                            <p className="font-medium text-gray-900">{selectedEmployee.salary || "Confidential"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Work Mode</p>
                            <p className="font-medium text-gray-900">{selectedEmployee.workMode || "Not specified"}</p>
                          </div>
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
                                  size={16}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-gray-700">
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
                                  size={16}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-gray-700">
                              {selectedEmployee.feedbackRating.toFixed(1)} ({selectedEmployee.totalFeedbacks || 0} ratings)
                            </span>
                          </div>
                        ) : (
                          <p className="font-medium text-gray-900">No feedback available</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Column - Skills and Responsibilities */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="text-base font-medium text-gray-800 mb-3">Skills & Responsibilities</h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Job Responsibilities</p>
                        {selectedEmployee.jobResponsibilities && selectedEmployee.jobResponsibilities.length > 0 ? (
                          <ul className="text-gray-700 text-sm list-disc pl-4">
                            {selectedEmployee.jobResponsibilities.map((responsibility, idx) => (
                              <li key={idx}>{responsibility.duty} ({responsibility.hours} hrs/week)</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-700 text-sm">No responsibilities listed</p>
                        )}
                      </div>
                      
                      {selectedEmployee.toolsProficient && (
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Tools & Technologies</p>
                          <div className="flex flex-wrap gap-1 mt-1">
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
                      )}
                      
                      {selectedEmployee.projects && selectedEmployee.projects.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Projects</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedEmployee.projects.map((project, idx) => (
                              <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-xs">
                                {project.project_title || project}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Debug Information (only in development) */}
                {process.env.NODE_ENV !== 'production' && (
                  <div className="mt-4 p-3 border border-gray-200 rounded-md bg-gray-50">
                    <h4 className="text-xs font-medium text-gray-700 mb-1">Debug Info</h4>
                    <details>
                      <summary className="text-xs text-gray-500 cursor-pointer">Raw Employee Data</summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-60 p-2 bg-gray-100 rounded">
                        {JSON.stringify(selectedEmployee, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}

                {/* Close button */}
                <div className="mt-5 flex justify-end">
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

        {/* Successor Details Modal */}
        {showSuccessorDetails && selectedSuccessor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-5xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white z-10 border-b px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  Successor Match Details: {selectedSuccessor.name}
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowSuccessorDetails(false)}
                  className="hover:bg-gray-100 rounded-full h-8 w-8 p-0 flex items-center justify-center"
                >
                  <FaTimes />
                </Button>
              </div>
              
              <div className="p-6">
                {/* Match Explanation */}
                <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-base font-medium text-gray-800 mb-2">Match Explanation</h4>
                  <p className="text-gray-700">{selectedSuccessor.explanation}</p>
                </div>
                
                {/* Factor Scores in 2-column layout */}
                <div className="mb-6">
                  <h4 className="text-base font-medium text-gray-800 mb-3">Match Factor Analysis</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    These factors determine how well this successor matches the position requirements.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(selectedSuccessor.scores).map(([key, value]) => {
                      if (typeof value !== 'number') return null;
                      
                      const scorePercent = Math.round(value as number * 100);
                      const factorName = key.replace(/([A-Z])/g, ' $1').trim();
                      
                      let factorDescription = '';
                      let factorIcon = <FaInfoCircle className="text-gray-500" />;
                      let detailedExplanation = '';
                      
                      // Set icon and description based on factor key
                      switch(key) {
                        case 'stabilityIndex':
                          factorIcon = <FaShieldAlt className="text-blue-500" />;
                          factorDescription = "Likelihood to stay with company long-term";
                          detailedExplanation = "The Stability Index is calculated from the inverse of attrition risk, weighted by tenure patterns and role satisfaction metrics.";
                          break;
                        case 'projectComplexity':
                          factorIcon = <FaProjectDiagram className="text-purple-500" />;
                          factorDescription = "Experience with challenging work";
                          detailedExplanation = "Project Complexity assessment combines budget size, team size, project criticality, and technical stack diversity with ELO-style ranking.";
                          break;
                        case 'cognitiveLoad':
                          factorIcon = <FaBrain className="text-amber-500" />;
                          factorDescription = "Ability to handle complex demands";
                          detailedExplanation = "This factor measures adaptability using job intensity (50%), multitasking ability (30%), and complexity handling (20%).";
                          break;
                        case 'promotionVelocity':
                          factorIcon = <FaChartLine className="text-green-500" />;
                          factorDescription = "Career growth trajectory";
                          detailedExplanation = "Promotion Velocity combines promotion frequency (60%) and skill acquisition rate (40%) based on industry benchmarks.";
                          break;
                        case 'competencySimilarity':
                          factorIcon = <FaPuzzlePiece className="text-indigo-500" />;
                          factorDescription = "Skill overlap with position";
                          detailedExplanation = "Competency Similarity uses weighted cosine similarity between profiles, combining tool proficiency, job duties, and project technologies.";
                          break;
                      }
                      
                      // Color coding for scores
                      const getScoreColor = (score: number) => {
                        if (score >= 0.8) return { bg: 'bg-green-500', text: 'text-green-700' };
                        if (score >= 0.6) return { bg: 'bg-emerald-500', text: 'text-emerald-700' };
                        if (score >= 0.4) return { bg: 'bg-yellow-500', text: 'text-yellow-700' };
                        return { bg: 'bg-red-500', text: 'text-red-700' };
                      };
                      
                      const colors = getScoreColor(value as number);
                      
                      return (
                        <div key={key} className="bg-white rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="p-1.5 bg-gray-100 rounded-full mr-2">
                                {factorIcon}
                              </div>
                              <div>
                                <h6 className="text-sm font-medium text-gray-800">{factorName}</h6>
                                <p className="text-xs text-gray-500">{factorDescription}</p>
                              </div>
                            </div>
                            <Badge className={
                              scorePercent >= 70 ? "bg-green-100 text-green-800" :
                              scorePercent >= 50 ? "bg-yellow-100 text-yellow-800" :
                              "bg-red-100 text-red-800"
                            }>
                              {scorePercent}%
                            </Badge>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${colors.bg}`} 
                              style={{ width: `${scorePercent}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="flex justify-end mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowSuccessorDetails(false)}
                    className="border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

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