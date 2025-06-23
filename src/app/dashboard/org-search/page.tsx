'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FaSearch, FaUser, FaBriefcase, FaCode, FaBuilding, FaArrowRight, FaSpinner, FaHistory, FaTrash, FaBrain, FaRobot, FaRegLightbulb } from 'react-icons/fa';
import { HiOutlineLightBulb } from 'react-icons/hi';
import Image from 'next/image';
import Link from 'next/link';

// Define employee type
interface Employee {
  id: string;
  name: string;
  email: string;
  position: string;
  department: string;
  skills: string[];
  experience: number;
  projects: string[];
  image: string;
}

// Define the result explanation type
interface ResultExplanation {
  reasoning: string;
  matchedCriteria: { [key: string]: string[] };
  generalInsight?: string;
}

// Custom hook for search history persistence
function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Load search history on component mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('orgGptSearchHistory');
      if (savedHistory) {
        setSearchHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  }, []);
  
  // Save search history whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('orgGptSearchHistory', JSON.stringify(searchHistory));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }, [searchHistory]);
  
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
    localStorage.removeItem('orgGptSearchHistory');
  };
  
  return { searchHistory, addToHistory, clearHistory };
}

// Mock employee data for demonstration
const mockEmployees: Employee[] = [
  {
    id: 'E001',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    position: 'Senior Frontend Developer',
    department: 'Engineering',
    skills: ['React', 'TypeScript', 'CSS', 'Next.js', 'Redux'],
    experience: 4,
    projects: ['Marketing Website Redesign', 'Customer Dashboard', 'Mobile App UI'],
    image: 'https://randomuser.me/api/portraits/women/44.jpg'
  },
  {
    id: 'E002',
    name: 'Michael Chen',
    email: 'michael.chen@example.com',
    position: 'Data Scientist',
    department: 'Data Science',
    skills: ['Python', 'Machine Learning', 'SQL', 'Data Visualization', 'TensorFlow', 'NLP'],
    experience: 3,
    projects: ['Customer Segmentation', 'Predictive Analytics', 'Recommendation Engine'],
    image: 'https://randomuser.me/api/portraits/men/32.jpg'
  },
  {
    id: 'E003',
    name: 'Emily Rodriguez',
    email: 'emily.rodriguez@example.com',
    position: 'Marketing Manager',
    department: 'Marketing',
    skills: ['Content Strategy', 'SEO', 'Social Media', 'Analytics', 'Campaign Management'],
    experience: 5,
    projects: ['Brand Refresh', 'Product Launch', 'Marketing Website Redesign'],
    image: 'https://randomuser.me/api/portraits/women/68.jpg'
  },
  {
    id: 'E004',
    name: 'David Kim',
    email: 'david.kim@example.com',
    position: 'Backend Engineer',
    department: 'Engineering',
    skills: ['Node.js', 'Python', 'MongoDB', 'GraphQL', 'Docker', 'AWS'],
    experience: 2,
    projects: ['API Migration', 'Authentication Service', 'Microservices Architecture'],
    image: 'https://randomuser.me/api/portraits/men/75.jpg'
  },
  {
    id: 'E005',
    name: 'Alex Turner',
    email: 'alex.turner@example.com',
    position: 'Product Manager',
    department: 'Product',
    skills: ['Product Strategy', 'User Research', 'Prototyping', 'Agile', 'Roadmapping'],
    experience: 6,
    projects: ['Mobile App Redesign', 'Customer Dashboard', 'Onboarding Flow'],
    image: 'https://randomuser.me/api/portraits/women/22.jpg'
  },
  {
    id: 'E006',
    name: 'James Wilson',
    email: 'james.wilson@example.com',
    position: 'DevOps Engineer',
    department: 'Engineering',
    skills: ['Kubernetes', 'AWS', 'CI/CD', 'Terraform', 'Docker', 'Linux'],
    experience: 4,
    projects: ['Cloud Migration', 'Infrastructure Automation', 'Monitoring System'],
    image: 'https://randomuser.me/api/portraits/men/45.jpg'
  },
  {
    id: 'E007',
    name: 'Sophia Garcia',
    email: 'sophia.garcia@example.com',
    position: 'UX/UI Designer',
    department: 'Design',
    skills: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Design Systems'],
    experience: 3,
    projects: ['Marketing Website Redesign', 'Mobile App Redesign', 'Design System Creation'],
    image: 'https://randomuser.me/api/portraits/women/90.jpg'
  },
  {
    id: 'E008',
    name: 'Robert Taylor',
    email: 'robert.taylor@example.com',
    position: 'Security Specialist',
    department: 'Engineering',
    skills: ['Penetration Testing', 'Security Audits', 'OWASP', 'Encryption', 'Auth Systems'],
    experience: 7,
    projects: ['Authentication Service', 'Security Compliance', 'Vulnerability Assessment'],
    image: 'https://randomuser.me/api/portraits/men/28.jpg'
  }
];

// Example queries to help users
const exampleQueries = [
  "People with React and TypeScript experience",
  "Data scientists who know machine learning and Python",
  "Who worked on the Customer Dashboard project?",
  "Engineers with more than 3 years experience",
  "People who know both frontend and backend technologies",
  "Who has the most experience in marketing?",
  "Find team members for a new AI project"
];

export default function OrgSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Employee[]>([]);
  const [showExamples, setShowExamples] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [insightMode, setInsightMode] = useState(false);
  const [resultExplanation, setResultExplanation] = useState<ResultExplanation | null>(null);
  const [processingSteps, setProcessingSteps] = useState<string[]>([]);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { searchHistory, addToHistory, clearHistory } = useSearchHistory();

  useEffect(() => {
    // Set focus on search input when component mounts
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const handleExampleClick = (query: string) => {
    setSearchQuery(query);
    setShowExamples(false);
    // Focus on the search input
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleHistoryClick = (query: string) => {
    setSearchQuery(query);
    setShowHistory(false);
    handleSearch({ preventDefault: () => {} } as React.FormEvent);
  };

  // Function to handle natural language search with AI reasoning
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setShowExamples(false);
    addToHistory(searchQuery.trim());
    
    // In a real app, this would call an API with natural language processing
    // Simulate progressive streaming of processing steps
    setProcessingSteps([]);
    const processingPhases = [
      "Parsing natural language query...",
      "Extracting search criteria...",
      "Identifying key attributes...",
      "Searching employee database...",
      "Ranking results by relevance...",
      "Generating insights..."
    ];
    
    for (let i = 0; i < processingPhases.length; i++) {
      setProcessingSteps(prev => [...prev, processingPhases[i]]);
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    
    // Simulate LLM-based search (in a real app, this would call an external API)
    setTimeout(() => {
      try {
        const results = simulateLLMSearch(searchQuery, mockEmployees);
        setSearchResults(results.matchedEmployees);
        setResultExplanation(results.explanation);
        setIsSearching(false);
      } catch (error) {
        console.error("Search error:", error);
        setIsSearching(false);
      }
    }, 1000);
  };

  // Simulate an LLM-based search 
  const simulateLLMSearch = (query: string, employees: Employee[]) => {
    const normalizedQuery = query.toLowerCase();
    let matchedEmployees: Employee[] = [];
    let matchedCriteria: {[key: string]: string[]} = {};
    let reasoning = '';
    
    // Query analysis - (in a real app, this would be handled by an LLM API)
    const extractedCriteria = {
      skills: [] as string[],
      departments: [] as string[],
      projects: [] as string[],
      experienceLevel: 0,
      experienceComparison: '' as 'more' | 'less' | 'equal' | '',
      isLookingForMost: false,
      attribute: '' as 'experience' | 'skills' | '',
      domain: '' as string
    };
    
    // Extract skills
    const skillKeywords = ['react', 'typescript', 'javascript', 'python', 'node', 'machine learning', 
                           'sql', 'frontend', 'backend', 'ui', 'ux', 'design', 'research', 'marketing',
                           'ai', 'cloud', 'aws', 'devops', 'security'];
                           
    skillKeywords.forEach(skill => {
      if (normalizedQuery.includes(skill)) {
        extractedCriteria.skills.push(skill);
      }
    });
    
    // Extract departments
    const departmentKeywords = ['engineering', 'marketing', 'product', 'design', 'data science'];
    departmentKeywords.forEach(dept => {
      if (normalizedQuery.includes(dept)) {
        extractedCriteria.departments.push(dept);
      }
    });
    
    // Extract projects
    const projectKeywords = ['dashboard', 'website', 'redesign', 'app', 'mobile', 'authentication', 'api'];
    projectKeywords.forEach(project => {
      if (normalizedQuery.includes(project)) {
        extractedCriteria.projects.push(project);
      }
    });
    
    // Check for experience level
    const experienceRegex = /(\d+)\s+years?/i;
    const experienceMatch = normalizedQuery.match(experienceRegex);
    if (experienceMatch) {
      extractedCriteria.experienceLevel = parseInt(experienceMatch[1]);
      
      if (normalizedQuery.includes('more than') || normalizedQuery.includes('greater than')) {
        extractedCriteria.experienceComparison = 'more';
      } else if (normalizedQuery.includes('less than')) {
        extractedCriteria.experienceComparison = 'less';
      } else {
        extractedCriteria.experienceComparison = 'equal';
      }
    }
    
    // Check for superlatives (most, best, etc.)
    if (normalizedQuery.includes('most')) {
      extractedCriteria.isLookingForMost = true;
      
      if (normalizedQuery.includes('experience')) {
        extractedCriteria.attribute = 'experience';
      } else if (normalizedQuery.includes('skills')) {
        extractedCriteria.attribute = 'skills';
      }
      
      // Extract domain
      departmentKeywords.forEach(dept => {
        if (normalizedQuery.includes(dept)) {
          extractedCriteria.domain = dept;
        }
      });
    }
    
    // Build reasoning text
    reasoning = `Based on your query "${query}", I'm looking for `;
    const criteriaText: string[] = [];
    
    if (extractedCriteria.skills.length > 0) {
      criteriaText.push(`people with skills in: ${extractedCriteria.skills.join(', ')}`);
      matchedCriteria.skills = extractedCriteria.skills;
    }
    
    if (extractedCriteria.departments.length > 0) {
      criteriaText.push(`from the ${extractedCriteria.departments.join('/')} department(s)`);
      matchedCriteria.departments = extractedCriteria.departments;
    }
    
    if (extractedCriteria.projects.length > 0) {
      criteriaText.push(`who worked on projects related to: ${extractedCriteria.projects.join(', ')}`);
      matchedCriteria.projects = extractedCriteria.projects;
    }
    
    if (extractedCriteria.experienceLevel > 0) {
      const comparisonText = extractedCriteria.experienceComparison === 'more' ? 'more than' : 
                            extractedCriteria.experienceComparison === 'less' ? 'less than' : 'exactly';
      criteriaText.push(`with ${comparisonText} ${extractedCriteria.experienceLevel} years of experience`);
      matchedCriteria.experience = [`${comparisonText} ${extractedCriteria.experienceLevel} years`];
    }
    
    if (extractedCriteria.isLookingForMost && extractedCriteria.attribute) {
      criteriaText.push(`with the most ${extractedCriteria.attribute}`);
      if (extractedCriteria.domain) {
        criteriaText.push(`in ${extractedCriteria.domain}`);
      }
      
      matchedCriteria.superlative = [`most ${extractedCriteria.attribute}`];
      if (extractedCriteria.domain) {
        matchedCriteria.domain = [extractedCriteria.domain];
      }
    }
    
    reasoning += criteriaText.length > 0 ? criteriaText.join(' ') : "people matching your general criteria";
    
    // Apply filters based on extracted criteria
    let results = [...employees];
    
    // Filter by skills
    if (extractedCriteria.skills.length > 0) {
      results = results.filter(emp => 
        extractedCriteria.skills.some(skill => 
          emp.skills.some(empSkill => empSkill.toLowerCase().includes(skill))
        )
      );
    }
    
    // Filter by department
    if (extractedCriteria.departments.length > 0) {
      results = results.filter(emp => 
        extractedCriteria.departments.some(dept => 
          emp.department.toLowerCase().includes(dept)
        )
      );
    }
    
    // Filter by projects
    if (extractedCriteria.projects.length > 0) {
      results = results.filter(emp => 
        extractedCriteria.projects.some(project => 
          emp.projects.some(empProject => empProject.toLowerCase().includes(project))
        )
      );
    }
    
    // Filter by experience
    if (extractedCriteria.experienceLevel > 0) {
      if (extractedCriteria.experienceComparison === 'more') {
        results = results.filter(emp => emp.experience > extractedCriteria.experienceLevel);
      } else if (extractedCriteria.experienceComparison === 'less') {
        results = results.filter(emp => emp.experience < extractedCriteria.experienceLevel);
      } else {
        results = results.filter(emp => emp.experience === extractedCriteria.experienceLevel);
      }
    }
    
    // Handle superlatives (most, best, etc.)
    if (extractedCriteria.isLookingForMost && extractedCriteria.attribute) {
      if (extractedCriteria.attribute === 'experience') {
        // If domain specified, filter by domain first
        if (extractedCriteria.domain) {
          results = results.filter(emp => 
            emp.department.toLowerCase().includes(extractedCriteria.domain)
          );
        }
        
        // Sort by experience (descending)
        results.sort((a, b) => b.experience - a.experience);
        
        // Take the top result
        if (results.length > 0) {
          results = [results[0]];
        }
      } else if (extractedCriteria.attribute === 'skills') {
        // If domain specified, filter by domain first
        if (extractedCriteria.domain) {
          results = results.filter(emp => 
            emp.department.toLowerCase().includes(extractedCriteria.domain)
          );
        }
        
        // Sort by number of skills (descending)
        results.sort((a, b) => b.skills.length - a.skills.length);
        
        // Take the top result
        if (results.length > 0) {
          results = [results[0]];
        }
      }
    }
    
    // Special case for frontend/backend
    if (normalizedQuery.includes('frontend') && normalizedQuery.includes('backend')) {
      results = employees.filter(emp => {
        const hasBackendSkills = emp.skills.some(skill => 
          ['node.js', 'python', 'java', 'c#', 'mongodb', 'sql', 'graphql', 'api'].some(
            backendSkill => skill.toLowerCase().includes(backendSkill.toLowerCase())
          )
        );
        
        const hasFrontendSkills = emp.skills.some(skill => 
          ['react', 'angular', 'vue', 'css', 'html', 'javascript', 'typescript', 'ui'].some(
            frontendSkill => skill.toLowerCase().includes(frontendSkill.toLowerCase())
          )
        );
        
        return hasBackendSkills && hasFrontendSkills;
      });
      
      matchedCriteria.skills = ['frontend', 'backend'];
      reasoning = "Based on your query, I'm looking for people with both frontend and backend development skills.";
    }
    
    // Special case for new project team
    if (normalizedQuery.includes('team') && normalizedQuery.includes('project')) {
      let projectType = '';
      
      if (normalizedQuery.includes('ai')) {
        projectType = 'AI';
        results = employees.filter(emp => 
          emp.skills.some(skill => 
            ['machine learning', 'python', 'tensorflow', 'nlp', 'data science'].some(
              aiSkill => skill.toLowerCase().includes(aiSkill.toLowerCase())
            )
          )
        );
        matchedCriteria.project = ['AI project'];
      } else if (normalizedQuery.includes('mobile')) {
        projectType = 'mobile';
        results = employees.filter(emp => 
          emp.skills.some(skill => 
            ['react native', 'flutter', 'swift', 'ios', 'android', 'mobile'].some(
              mobileSkill => skill.toLowerCase().includes(mobileSkill.toLowerCase())
            )
          ) || emp.projects.some(project => project.toLowerCase().includes('mobile'))
        );
        matchedCriteria.project = ['Mobile project'];
      }
      
      reasoning = `Based on your query, I've identified team members suitable for a new ${projectType || ''} project based on their relevant skills and experience.`;
    }
    
    // If no specific criteria matched or no results, return everyone
    if ((Object.keys(matchedCriteria).length === 0 || results.length === 0) && 
        !normalizedQuery.includes('team') && !normalizedQuery.includes('most')) {
      if (results.length === 0) {
        reasoning += "\n\nHowever, no employees matched all criteria. Showing everyone in the database.";
      } else if (Object.keys(matchedCriteria).length === 0) {
        reasoning = "Your query didn't contain specific keywords I could match. Showing everyone in the database.";
      }
      results = employees;
    }
    
    // Generate a general insight about the results
    let generalInsight = '';
    if (results.length > 0) {
      const departmentCounts: {[key: string]: number} = {};
      const skillCounts: {[key: string]: number} = {};
      let totalExperience = 0;
      
      results.forEach(emp => {
        // Count departments
        departmentCounts[emp.department] = (departmentCounts[emp.department] || 0) + 1;
        
        // Count skills
        emp.skills.forEach(skill => {
          skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        });
        
        // Sum experience
        totalExperience += emp.experience;
      });
      
      // Most common department
      let mostCommonDept = '';
      let highestDeptCount = 0;
      Object.entries(departmentCounts).forEach(([dept, count]) => {
        if (count > highestDeptCount) {
          mostCommonDept = dept;
          highestDeptCount = count;
        }
      });
      
      // Most common skill
      let mostCommonSkills: string[] = [];
      let highestSkillCount = 0;
      Object.entries(skillCounts).forEach(([skill, count]) => {
        if (count > highestSkillCount) {
          mostCommonSkills = [skill];
          highestSkillCount = count;
        } else if (count === highestSkillCount) {
          mostCommonSkills.push(skill);
        }
      });
      
      // Average experience
      const avgExperience = totalExperience / results.length;
      
      // Build insight
      if (results.length > 1) {
        generalInsight = `The ${results.length} people in these results are primarily from the ${mostCommonDept} department (${highestDeptCount} people). `;
        
        if (mostCommonSkills.length === 1) {
          generalInsight += `The most common skill is ${mostCommonSkills[0]} (${highestSkillCount} people). `;
        } else if (mostCommonSkills.length > 1) {
          generalInsight += `The most common skills are ${mostCommonSkills.slice(0, 3).join(', ')} (each known by ${highestSkillCount} people). `;
        }
        
        generalInsight += `The average experience level is ${avgExperience.toFixed(1)} years.`;
      }
    }
    
    matchedEmployees = results;
    
    return {
      matchedEmployees,
      explanation: {
        reasoning,
        matchedCriteria,
        generalInsight
      }
    };
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">OrgGPT Search</h1>
        <p className="text-gray-600">
          Find the right people in your organization using natural language search with AI-powered understanding.
          Ask questions about skills, departments, projects, experience, and more.
        </p>
      </div>

      {/* Search input */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="relative">
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Try 'People with React and TypeScript experience'"
                className="w-full py-3 px-4 focus:outline-none text-gray-700 pr-10"
              />
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
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 flex items-center"
              disabled={isSearching}
            >
              {isSearching ? (
                <FaSpinner className="animate-spin mr-2" />
              ) : (
                <FaSearch className="mr-2" />
              )}
              Search
            </button>
          </div>
        </form>

        {/* Example queries */}
        {showExamples && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Try one of these examples:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((query, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleClick(query)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm py-1 px-3 rounded-full"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Processing steps (shown during search) */}
      {isSearching && processingSteps.length > 0 && (
        <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <FaBrain className="text-blue-600 mr-2" />
            <h3 className="text-md font-medium text-gray-800">Processing your query</h3>
          </div>
          <ul className="space-y-2">
            {processingSteps.map((step, index) => (
              <li key={index} className="flex items-center text-sm text-gray-600">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-800 mr-2 text-xs">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Search results */}
      {searchResults.length > 0 && !isSearching && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Found {searchResults.length} {searchResults.length === 1 ? 'person' : 'people'} matching your query
            </h2>
            
            <button
              onClick={() => setInsightMode(!insightMode)}
              className={`flex items-center text-sm px-3 py-1 rounded-md ${
                insightMode 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FaRegLightbulb className="mr-1" />
              {insightMode ? 'Hide Insights' : 'Show Insights'}
            </button>
          </div>
          
          {/* AI Reasoning / Insights */}
          {insightMode && resultExplanation && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <FaRobot className="text-blue-600 mr-2" />
                <h3 className="text-md font-medium text-gray-800">AI Reasoning</h3>
              </div>
              <p className="text-sm text-gray-700 mb-3">{resultExplanation.reasoning}</p>
              
              {resultExplanation.generalInsight && (
                <>
                  <div className="flex items-center mt-4 mb-2">
                    <HiOutlineLightBulb className="text-yellow-600 mr-2" />
                    <h3 className="text-sm font-medium text-gray-800">Insight</h3>
                  </div>
                  <p className="text-sm text-gray-700">{resultExplanation.generalInsight}</p>
                </>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((employee) => (
              <div key={employee.id} className="bg-white p-4 rounded-lg shadow border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-start">
                  <Image
                    src={employee.image}
                    alt={employee.name}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full object-cover mr-4 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{employee.name}</h3>
                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <FaBriefcase className="mr-1 text-gray-400 flex-shrink-0" size={12} />
                      <span className="truncate">{employee.position}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <FaBuilding className="mr-1 text-gray-400 flex-shrink-0" size={12} />
                      <span className="truncate">{employee.department}</span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span>{employee.experience} years experience</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3">
                  <h4 className="text-xs font-medium text-gray-500 mb-1">SKILLS</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {employee.skills.map((skill, i) => (
                      <span key={i} 
                        className={`text-xs px-2 py-1 rounded ${
                          resultExplanation?.matchedCriteria?.skills?.some(s => 
                            skill.toLowerCase().includes(s.toLowerCase())
                          )
                          ? 'bg-blue-100 text-blue-800 font-medium' 
                          : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="mt-3">
                  <h4 className="text-xs font-medium text-gray-500 mb-1">PROJECTS</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {employee.projects.map((project, i) => (
                      <span key={i} 
                        className={`text-xs px-2 py-1 rounded ${
                          resultExplanation?.matchedCriteria?.projects?.some(p => 
                            project.toLowerCase().includes(p.toLowerCase())
                          )
                          ? 'bg-green-100 text-green-800 font-medium' 
                          : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {project}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                  <Link
                    href={`/dashboard/employees/${employee.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                  >
                    View Profile <FaArrowRight className="ml-1" size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* No results */}
      {searchResults.length === 0 && !isSearching && searchQuery.trim() && (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
          <FaSearch className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
          <p className="text-gray-600 mb-6">
            Try modifying your search or using different keywords.
          </p>
          <button 
            onClick={() => setShowExamples(true)}
            className="text-blue-600 hover:text-blue-800"
          >
            Try an example query
          </button>
        </div>
      )}
    </div>
  );
} 