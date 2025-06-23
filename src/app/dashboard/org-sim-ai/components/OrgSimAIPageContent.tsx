"use client";

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowsRightLeftIcon, 
  LightBulbIcon,
  ChartBarIcon,
  RefreshIcon,
  ArrowPathIcon,
  UserGroupIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import OrgChart from './OrgChart';
import NodeDetailsPanel from './NodeDetailsPanel';
import { 
  mockOrgData, 
  optimizedOrgData,
  generateRandomOrgData
} from '../data/mockOrgData';
import { Organization } from '@/types';
import EmployeeDetailsPanel from './EmployeeDetailsPanel';

// Define the OrgNode interface for organization data structure
export interface OrgNode {
  id: string;
  name: string;
  role: string;
  workload: number;
  children: OrgNode[];
  skills?: string[];
  experience?: number;
  projects?: string[];
}

// Sample organization data (this would come from your MongoDB in production)
const sampleOrgData: OrgNode = {
  id: "1",
  name: "Sarah Johnson",
  role: "CEO",
  workload: 80,
  skills: ["Leadership", "Strategic Planning", "Business Development"],
  experience: 15,
  projects: ["Company Growth Strategy", "Investor Relations"],
  children: [
    {
      id: "2",
      name: "Michael Chen",
      role: "CTO",
      workload: 90,
      skills: ["System Architecture", "Cloud Infrastructure", "Team Leadership"],
      experience: 12,
      projects: ["Platform Modernization", "Cloud Migration"],
      children: [
        {
          id: "5",
          name: "Raj Patel",
          role: "Lead Developer",
          workload: 95,
          skills: ["JavaScript", "React", "Node.js"],
          experience: 8,
          projects: ["Frontend Refactoring", "API Development"],
          children: [
            {
              id: "8",
              name: "Lisa Wong",
              role: "Senior Developer",
              workload: 85,
              skills: ["React", "TypeScript", "GraphQL"],
              experience: 5,
              projects: ["User Dashboard", "Authentication System"],
              children: []
            },
            {
              id: "9",
              name: "David Kim",
              role: "Developer",
              workload: 70,
              skills: ["JavaScript", "CSS", "HTML"],
              experience: 3,
              projects: ["Landing Page Redesign", "Mobile Responsiveness"],
              children: []
            }
          ]
        },
        {
          id: "6",
          name: "Emily Rodriguez",
          role: "DevOps Manager",
          workload: 75,
          skills: ["Docker", "Kubernetes", "CI/CD"],
          experience: 7,
          projects: ["Deployment Pipeline", "Infrastructure Automation"],
          children: [
            {
              id: "10",
              name: "Carlos Sanchez",
              role: "DevOps Engineer",
              workload: 65,
              skills: ["AWS", "Terraform", "Jenkins"],
              experience: 4,
              projects: ["Monitoring Setup", "Disaster Recovery"],
              children: []
            }
          ]
        }
      ]
    },
    {
      id: "3",
      name: "Jessica Taylor",
      role: "CFO",
      workload: 70,
      skills: ["Financial Planning", "Risk Management", "Investor Relations"],
      experience: 10,
      projects: ["Annual Budget", "Investment Strategy"],
      children: [
        {
          id: "7",
          name: "Robert Johnson",
          role: "Financial Analyst",
          workload: 55,
          skills: ["Financial Modeling", "Data Analysis", "Reporting"],
          experience: 5,
          projects: ["Quarterly Reports", "Cost Analysis"],
          children: []
        }
      ]
    },
    {
      id: "4",
      name: "James Williams",
      role: "COO",
      workload: 85,
      skills: ["Operations Management", "Process Optimization", "Team Building"],
      experience: 11,
      projects: ["Operational Efficiency", "Supply Chain Optimization"],
      children: [
        {
          id: "11",
          name: "Maria Garcia",
          role: "Operations Manager",
          workload: 80,
          skills: ["Project Management", "Process Improvement", "Team Leadership"],
          experience: 7,
          projects: ["Process Redesign", "Team Expansion"],
          children: [
            {
              id: "12",
              name: "Alex Brown",
              role: "Project Manager",
              workload: 90,
              skills: ["Agile Methodology", "Risk Management", "Stakeholder Communication"],
              experience: 5,
              projects: ["Product Launch", "Client Portal"],
              children: []
            },
            {
              id: "13",
              name: "Sophia Lee",
              role: "Project Manager",
              workload: 75,
              skills: ["Scrum", "Resource Allocation", "Client Management"],
              experience: 4,
              projects: ["Mobile App Development", "Website Redesign"],
              children: []
            }
          ]
        }
      ]
    }
  ]
};

// Function to flatten the org data into an array for easier manipulation
const flattenOrgData = (node: OrgNode): OrgNode[] => {
  let result: OrgNode[] = [node];
  if (node.children) {
    for (const child of node.children) {
      result = result.concat(flattenOrgData(child));
    }
  }
  return result;
};

export default function OrgSimAIPageContent() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [currentOrgData, setCurrentOrgData] = useState<OrgNode>(mockOrgData);
  const [optimizedData, setOptimizedData] = useState<OrgNode>(optimizedOrgData);
  const [activeTab, setActiveTab] = useState('current');
  const [showComparison, setShowComparison] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoGenData, setAutoGenData] = useState(false);
  const [currentSimulation, setCurrentSimulation] = useState<number>(0);
  
  // Flatten the org data for easier access
  const allNodes = flattenOrgData(sampleOrgData);
  
  // Function to handle node selection in the org chart
  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const node = allNodes.find(n => n.id === nodeId) || null;
    setSelectedNode(node);
  };
  
  // Different simulation scenarios
  const simulations = [
    { name: "Current Organization", data: sampleOrgData },
    { 
      name: "High Workload Scenario", 
      data: {
        ...sampleOrgData,
        children: sampleOrgData.children.map(dept => ({
          ...dept,
          workload: Math.min(dept.workload + 15, 100),
          children: dept.children.map(team => ({
            ...team,
            workload: Math.min(team.workload + 10, 100),
            children: team.children.map(employee => ({
              ...employee,
              workload: Math.min(employee.workload + 20, 100)
            }))
          }))
        }))
      } 
    },
    { 
      name: "Optimized Workload Distribution", 
      data: {
        ...sampleOrgData,
        children: sampleOrgData.children.map(dept => ({
          ...dept,
          workload: 75,
          children: dept.children.map(team => ({
            ...team,
            workload: 75,
            children: team.children.map(employee => ({
              ...employee,
              workload: 75
            }))
          }))
        }))
      } 
    },
  ];
  
  const currentData = simulations[currentSimulation].data;
  const flattenedCurrentData = flattenOrgData(currentData);
  
  const nextSimulation = () => {
    setCurrentSimulation((currentSimulation + 1) % simulations.length);
    setSelectedNode(null);
    setSelectedNodeId(undefined);
  };
  
  const prevSimulation = () => {
    setCurrentSimulation((currentSimulation - 1 + simulations.length) % simulations.length);
    setSelectedNode(null);
    setSelectedNodeId(undefined);
  };

  // Handle random data generation
  const handleGenerateRandomData = () => {
    setIsLoading(true);
    
    // Simulate API call with a delay
    setTimeout(() => {
      const newData = generateRandomOrgData();
      setCurrentOrgData(newData);
      
      // Generate "optimized" version with reduced workload
      const optimized = JSON.parse(JSON.stringify(newData));
      balanceWorkloads(optimized);
      setOptimizedData(optimized);
      
      setSelectedNodeId(undefined);
      setIsLoading(false);
    }, 1500);
  };

  // Balance workloads in the optimized view
  const balanceWorkloads = (node: OrgNode) => {
    // Simple algorithm to redistribute workload
    if (node.children && node.children.length > 0) {
      // First recursively balance children's workloads
      for (const child of node.children) {
        balanceWorkloads(child);
      }
      
      // Then balance workload between siblings
      const overloadedNodes = node.children.filter(n => n.workload > 75);
      const underutilizedNodes = node.children.filter(n => n.workload < 50);
      
      for (const overNode of overloadedNodes) {
        const excessWorkload = Math.floor((overNode.workload - 70) / underutilizedNodes.length);
        if (excessWorkload > 0 && underutilizedNodes.length > 0) {
          for (const underNode of underutilizedNodes) {
            if (underNode.workload + excessWorkload <= 70) {
              underNode.workload += excessWorkload;
              overNode.workload -= excessWorkload;
            }
          }
        }
      }
      
      // Update parent workload based on average of children
      node.workload = Math.floor(
        node.children.reduce((sum, child) => sum + child.workload, 0) / node.children.length
      );
    }
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSelectedNodeId(undefined);
  };

  // Generate workload insights
  const generateWorkloadInsights = (orgData: OrgNode): { overloaded: OrgNode[], balanced: OrgNode[], underutilized: OrgNode[] } => {
    const allNodes = flattenOrgData(orgData);
    
    return {
      overloaded: allNodes.filter(node => node.workload > 85),
      balanced: allNodes.filter(node => node.workload >= 60 && node.workload <= 85),
      underutilized: allNodes.filter(node => node.workload < 60)
    };
  };

  // Generate optimization analysis
  const generateOptimizationAnalysis = (): React.ReactNode => {
    const currentInsights = generateWorkloadInsights(currentOrgData);
    const optimizedInsights = generateWorkloadInsights(optimizedData);
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Workload Distribution</CardTitle>
            <CardDescription>Before vs After Optimization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Overloaded Employees:</span>
                <div className="flex items-center gap-2">
                  <span className="text-red-500">{currentInsights.overloaded.length}</span>
                  <span>→</span>
                  <span className="text-green-500">{optimizedInsights.overloaded.length}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Balanced Workloads:</span>
                <div className="flex items-center gap-2">
                  <span>{currentInsights.balanced.length}</span>
                  <span>→</span>
                  <span className="text-green-500">{optimizedInsights.balanced.length}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Underutilized Resources:</span>
                <div className="flex items-center gap-2">
                  <span>{currentInsights.underutilized.length}</span>
                  <span>→</span>
                  <span>{optimizedInsights.underutilized.length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Key Recommendations</CardTitle>
            <CardDescription>AI-Suggested Organizational Improvements</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {currentInsights.overloaded.length > optimizedInsights.overloaded.length && (
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
                  <span>Reduced overloaded positions by {currentInsights.overloaded.length - optimizedInsights.overloaded.length}</span>
                </li>
              )}
              {optimizedInsights.balanced.length > currentInsights.balanced.length && (
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
                  <span>Increased balanced workload positions by {optimizedInsights.balanced.length - currentInsights.balanced.length}</span>
                </li>
              )}
              {autoGenData ? (
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
                  <span>Improved project allocation efficiency by redistributing workloads</span>
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
                  <span>Promoted 'Jordan Taylor' to Engineering Director with redefined responsibilities</span>
                </li>
              )}
              {autoGenData ? (
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
                  <span>Optimized team structure to improve collaboration and reduce bottlenecks</span>
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
                  <span>Added new Frontend Developer to reduce workload on existing team members</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Organization Simulation AI</h1>
          <p className="text-gray-500">Visualize and optimize your organizational structure</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoGenData}
              onCheckedChange={setAutoGenData}
              id="auto-gen"
            />
            <label htmlFor="auto-gen" className="text-sm cursor-pointer">
              Use auto-generated data
            </label>
          </div>
          <Button 
            variant="outline" 
            onClick={handleGenerateRandomData}
            disabled={isLoading || !autoGenData}
            className="flex items-center gap-1"
          >
            {isLoading ? (
              <>
                <RefreshIcon className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshIcon className="h-4 w-4" />
                Generate Random Data
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-between mb-6 bg-white rounded-lg p-4 shadow">
        <Button 
          onClick={prevSimulation} 
          className="flex items-center"
          variant="outline"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        <div className="text-lg font-medium">
          {simulations[currentSimulation].name}
        </div>
        
        <Button 
          onClick={nextSimulation}
          className="flex items-center"
          variant="outline"
        >
          Next
          <ArrowRightIcon className="h-4 w-4 ml-2" />
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Org Chart */}
        <div className={showComparison ? "lg:col-span-1" : "lg:col-span-2"}>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="current" className="gap-1">
                  <ChartBarIcon className="h-4 w-4" />
                  Current
                </TabsTrigger>
                <TabsTrigger value="optimized" className="gap-1">
                  <LightBulbIcon className="h-4 w-4" />
                  AI Optimized
                </TabsTrigger>
              </TabsList>
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowComparison(!showComparison)}
                className="flex items-center gap-1 text-sm"
              >
                <ArrowsRightLeftIcon className="h-4 w-4" />
                {showComparison ? "Hide Comparison" : "Show Comparison"}
              </Button>
            </div>

            <TabsContent value="current" className="mt-0">
              <Card>
                <CardContent className="p-4 h-[500px]">
                  <OrgChart 
                    data={currentData}
                    onNodeSelect={handleNodeSelect}
                    selectedNodeId={selectedNodeId}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="optimized" className="mt-0">
              <Card>
                <CardContent className="p-4 h-[500px]">
                  <OrgChart 
                    data={optimizedData}
                    onNodeSelect={(nodeId) => {
                      setSelectedNodeId(nodeId);
                      setSelectedNode(flattenOrgData(optimizedData)[nodeId]);
                    }}
                    selectedNodeId={selectedNodeId}
                  />
                  {generateOptimizationAnalysis()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Node Details */}
        <div className={showComparison ? "lg:col-span-2" : "lg:col-span-1"}>
          {showComparison ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              <div className="h-[500px]">
                <h3 className="font-medium mb-2">Current Organization</h3>
                <NodeDetailsPanel 
                  node={selectedNode && activeTab === 'optimized' 
                    ? flattenOrgData(currentOrgData)[selectedNodeId!] 
                    : selectedNode} 
                />
              </div>
              <div className="h-[500px]">
                <h3 className="font-medium mb-2">AI Optimized</h3>
                <NodeDetailsPanel 
                  node={selectedNode && activeTab === 'current' 
                    ? flattenOrgData(optimizedData)[selectedNodeId!] 
                    : selectedNode}
                  isOptimized={true}
                />
              </div>
            </div>
          ) : (
            <div className="h-[500px]">
              <h3 className="font-medium mb-2">
                {activeTab === 'optimized' ? 'AI Optimized Organization' : 'Current Organization'}
              </h3>
              <NodeDetailsPanel 
                node={selectedNode} 
                isOptimized={activeTab === 'optimized'}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section - Insights */}
      {activeTab === 'optimized' && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <LightBulbIcon className="h-5 w-5 text-amber-500" />
              AI Optimization Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-medium text-sm mb-2">Workload Distribution</h3>
                <p className="text-sm text-gray-600">
                  The AI has rebalanced workloads across the organization, reducing overloaded 
                  positions by 23% and increasing utilization of underutilized roles by 18%.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-sm mb-2">Team Structure</h3>
                <p className="text-sm text-gray-600">
                  Identified 3 teams with unbalanced workloads and proposed redistribution of 
                  responsibilities based on skill sets and capacity utilization.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-sm mb-2">Resource Optimization</h3>
                <p className="text-sm text-gray-600">
                  Suggested 5 role adjustments to better align skills with project requirements, 
                  potentially increasing overall team efficiency by 15%.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 