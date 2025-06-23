'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, BarChart3, ArrowRight, Users, TrendingUp, Briefcase, DollarSign, Clock, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Spinner from '@/components/ui/spinner';

// Define simulation types and interfaces
type SimulationType = 'attrition' | 'reorganization' | 'growth' | 'cost_reduction';

interface SimulationRequest {
  name: string;
  description?: string;
  type: SimulationType;
  parameters?: any;
  saveResults?: boolean;
}

interface MetricScore {
  name: string;
  score: number;
  change: number;
  impact: 'positive' | 'negative' | 'neutral';
}

interface DepartmentImpact {
  name: string;
  impact: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  notes: string;
}

interface EmployeeImpact {
  id: string;
  name: string;
  position: string;
  impact: number;
  reason: string;
}

interface SimulationRecommendation {
  title: string;
  description: string;
  implementationEffort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  timeline: string;
}

interface SimulationResult {
  id: string;
  name: string;
  description: string;
  type: SimulationType;
  parameters: any;
  createdAt: string;
  metrics: MetricScore[];
  departmentImpacts: DepartmentImpact[];
  employeeImpacts: EmployeeImpact[];
  recommendations: SimulationRecommendation[];
  summary: string;
}

export default function SimulationPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<'setup' | 'results'>('setup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveResults, setSaveResults] = useState(true);
  const [simulationRequest, setSimulationRequest] = useState<SimulationRequest>({
    name: '',
    description: '',
    type: 'attrition',
    parameters: {},
    saveResults: true
  });
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    metrics: true,
    departments: true,
    employees: true,
    recommendations: true
  });

  // Toggle expansion state for each section
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section]
    });
  };

  // Handle input changes for simulation request
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSimulationRequest({
      ...simulationRequest,
      [name]: value
    });
  };

  // Handle type selection
  const handleTypeChange = (value: string) => {
    setSimulationRequest({
      ...simulationRequest,
      type: value as SimulationType,
      // Reset parameters when changing simulation type
      parameters: {}
    });
  };

  // Handle parameter changes for specific simulation types
  const handleParameterChange = (key: string, value: any) => {
    setSimulationRequest({
      ...simulationRequest,
      parameters: {
        ...simulationRequest.parameters,
        [key]: value
      }
    });
  };

  // Run the simulation
  const runSimulation = async () => {
    if (!simulationRequest.name) {
      setError('Please provide a name for the simulation');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/simulation/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...simulationRequest,
          saveResults
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to run simulation');
      }
      
      const result = await response.json();
      setSimulationResult(result);
      setActiveStep('results');
    } catch (err: any) {
      setError(err.message || 'An error occurred while running the simulation');
    } finally {
      setLoading(false);
    }
  };

  // Reset the form to start a new simulation
  const startNewSimulation = () => {
    setSimulationRequest({
      name: '',
      description: '',
      type: 'attrition',
      parameters: {},
      saveResults: true
    });
    setSimulationResult(null);
    setActiveStep('setup');
  };

  // Get appropriate parameter inputs based on simulation type
  const renderParameterInputs = () => {
    switch (simulationRequest.type) {
      case 'attrition':
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Attrition Rate (%)</label>
              <Slider
                defaultValue={[10]}
                max={50}
                step={1}
                value={[simulationRequest.parameters?.attritionRate || 10]}
                onValueChange={([value]) => handleParameterChange('attritionRate', value)}
              />
              <div className="text-sm text-slate-500">
                {simulationRequest.parameters?.attritionRate || 10}% estimated attrition rate
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Average Tenure (Years)</label>
              <Slider
                defaultValue={[3]}
                min={1}
                max={10}
                step={0.5}
                value={[simulationRequest.parameters?.avgTenure || 3]}
                onValueChange={([value]) => handleParameterChange('avgTenure', value)}
              />
              <div className="text-sm text-slate-500">
                {simulationRequest.parameters?.avgTenure || 3} years average tenure
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Focus Department</label>
              <Select 
                value={simulationRequest.parameters?.focusDepartment || 'all'} 
                onValueChange={(value) => handleParameterChange('focusDepartment', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="engineering">Engineering</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="customer_support">Customer Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );
        
      case 'reorganization':
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Structure Type</label>
              <Select 
                value={simulationRequest.parameters?.structureType || 'matrix'} 
                onValueChange={(value) => handleParameterChange('structureType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select structure type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="matrix">Matrix Organization</SelectItem>
                  <SelectItem value="flat">Flat Organization</SelectItem>
                  <SelectItem value="hierarchical">Hierarchical Organization</SelectItem>
                  <SelectItem value="team">Team-based Organization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Reporting Layer Reduction</label>
              <Slider
                defaultValue={[1]}
                min={0}
                max={5}
                step={1}
                value={[simulationRequest.parameters?.layerReduction || 1]}
                onValueChange={([value]) => handleParameterChange('layerReduction', value)}
              />
              <div className="text-sm text-slate-500">
                Reduce by {simulationRequest.parameters?.layerReduction || 1} reporting layers
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Implementation Timeline (Months)</label>
              <Slider
                defaultValue={[3]}
                min={1}
                max={12}
                step={1}
                value={[simulationRequest.parameters?.timeline || 3]}
                onValueChange={([value]) => handleParameterChange('timeline', value)}
              />
              <div className="text-sm text-slate-500">
                {simulationRequest.parameters?.timeline || 3} months implementation timeline
              </div>
            </div>
          </>
        );
        
      case 'growth':
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Growth Rate (%)</label>
              <Slider
                defaultValue={[20]}
                min={5}
                max={100}
                step={5}
                value={[simulationRequest.parameters?.growthRate || 20]}
                onValueChange={([value]) => handleParameterChange('growthRate', value)}
              />
              <div className="text-sm text-slate-500">
                {simulationRequest.parameters?.growthRate || 20}% projected growth rate
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Timeline (Months)</label>
              <Slider
                defaultValue={[12]}
                min={3}
                max={36}
                step={3}
                value={[simulationRequest.parameters?.timelineMonths || 12]}
                onValueChange={([value]) => handleParameterChange('timelineMonths', value)}
              />
              <div className="text-sm text-slate-500">
                {simulationRequest.parameters?.timelineMonths || 12} months growth timeline
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority Area</label>
              <Select 
                value={simulationRequest.parameters?.priorityArea || 'headcount'} 
                onValueChange={(value) => handleParameterChange('priorityArea', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="headcount">Headcount Expansion</SelectItem>
                  <SelectItem value="market">Market Expansion</SelectItem>
                  <SelectItem value="product">Product Line Expansion</SelectItem>
                  <SelectItem value="acquisition">Acquisition Strategy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );
        
      case 'cost_reduction':
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Reduction (%)</label>
              <Slider
                defaultValue={[15]}
                min={5}
                max={40}
                step={1}
                value={[simulationRequest.parameters?.targetReduction || 15]}
                onValueChange={([value]) => handleParameterChange('targetReduction', value)}
              />
              <div className="text-sm text-slate-500">
                {simulationRequest.parameters?.targetReduction || 15}% cost reduction target
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Implementation Timeline (Months)</label>
              <Slider
                defaultValue={[6]}
                min={1}
                max={24}
                step={1}
                value={[simulationRequest.parameters?.timeline || 6]}
                onValueChange={([value]) => handleParameterChange('timeline', value)}
              />
              <div className="text-sm text-slate-500">
                {simulationRequest.parameters?.timeline || 6} months implementation timeline
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Focus Area</label>
              <Select 
                value={simulationRequest.parameters?.focusArea || 'operations'} 
                onValueChange={(value) => handleParameterChange('focusArea', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select focus area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operations">Operational Efficiency</SelectItem>
                  <SelectItem value="workforce">Workforce Optimization</SelectItem>
                  <SelectItem value="vendor">Vendor Consolidation</SelectItem>
                  <SelectItem value="technology">Technology Rationalization</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );
        
      default:
        return null;
    }
  };

  // Get appropriate icon for simulation type
  const getSimulationTypeIcon = (type: SimulationType) => {
    switch (type) {
      case 'attrition':
        return <Users className="h-5 w-5" />;
      case 'reorganization':
        return <Briefcase className="h-5 w-5" />;
      case 'growth':
        return <TrendingUp className="h-5 w-5" />;
      case 'cost_reduction':
        return <DollarSign className="h-5 w-5" />;
      default:
        return <BarChart3 className="h-5 w-5" />;
    }
  };

  // Render the setup form
  const renderSetupForm = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Name*</label>
        <Input
          name="name"
          value={simulationRequest.name}
          onChange={handleInputChange}
          placeholder="Simulation name"
          required
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea
          name="description"
          value={simulationRequest.description}
          onChange={handleInputChange}
          placeholder="Describe the purpose of this simulation"
          rows={3}
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Simulation Type</label>
        <Tabs 
          value={simulationRequest.type} 
          onValueChange={handleTypeChange}
          className="w-full"
        >
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="attrition">
              <Users className="mr-2 h-4 w-4" />
              Attrition
            </TabsTrigger>
            <TabsTrigger value="reorganization">
              <Briefcase className="mr-2 h-4 w-4" />
              Reorganization
            </TabsTrigger>
            <TabsTrigger value="growth">
              <TrendingUp className="mr-2 h-4 w-4" />
              Growth
            </TabsTrigger>
            <TabsTrigger value="cost_reduction">
              <DollarSign className="mr-2 h-4 w-4" />
              Cost Reduction
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="attrition" className="border rounded-md p-4">
            <h3 className="font-medium mb-2">Attrition Simulation</h3>
            <p className="text-sm text-slate-500 mb-4">
              Analyze the impact of employee turnover on your organization and identify effective retention strategies.
            </p>
            {renderParameterInputs()}
          </TabsContent>
          
          <TabsContent value="reorganization" className="border rounded-md p-4">
            <h3 className="font-medium mb-2">Reorganization Simulation</h3>
            <p className="text-sm text-slate-500 mb-4">
              Evaluate different organizational structures to optimize communication, decision-making, and efficiency.
            </p>
            {renderParameterInputs()}
          </TabsContent>
          
          <TabsContent value="growth" className="border rounded-md p-4">
            <h3 className="font-medium mb-2">Growth Simulation</h3>
            <p className="text-sm text-slate-500 mb-4">
              Model the impact of business expansion on your organization's structure, resources, and capabilities.
            </p>
            {renderParameterInputs()}
          </TabsContent>
          
          <TabsContent value="cost_reduction" className="border rounded-md p-4">
            <h3 className="font-medium mb-2">Cost Reduction Simulation</h3>
            <p className="text-sm text-slate-500 mb-4">
              Identify opportunities to optimize costs while minimizing negative impacts on performance and morale.
            </p>
            {renderParameterInputs()}
          </TabsContent>
        </Tabs>
      </div>
      
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="saveResults"
          checked={saveResults}
          onChange={(e) => setSaveResults(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="saveResults" className="text-sm font-medium text-gray-700">
          Save simulation results for future reference
        </label>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          onClick={runSimulation}
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner className="mr-2" /> Running Simulation...
            </>
          ) : (
            <>
              Run Simulation <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Render the simulation results
  const renderResults = () => {
    if (!simulationResult) return null;
    
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold flex items-center">
              {getSimulationTypeIcon(simulationResult.type)}
              <span className="ml-2">{simulationResult.name}</span>
              <Badge className="ml-2 capitalize">
                {simulationResult.type.replace('_', ' ')}
              </Badge>
            </h2>
            <p className="text-sm text-slate-500">
              {new Date(simulationResult.createdAt).toLocaleString()}
            </p>
          </div>
          <Button onClick={startNewSimulation}>
            New Simulation
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{simulationResult.summary}</p>
          </CardContent>
        </Card>
        
        <div>
          <div 
            className="flex justify-between items-center cursor-pointer mb-2"
            onClick={() => toggleSection('metrics')}
          >
            <h3 className="text-lg font-medium flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Key Metrics
            </h3>
            {expandedSections.metrics ? <ChevronUp /> : <ChevronDown />}
          </div>
          
          {expandedSections.metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {simulationResult.metrics.map((metric, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium">{metric.name}</h4>
                      <Badge 
                        variant={
                          metric.impact === 'positive' ? 'default' : 
                          metric.impact === 'negative' ? 'destructive' : 
                          'outline'
                        }
                      >
                        {metric.impact === 'positive' ? '+' : metric.impact === 'negative' ? '-' : ''}
                        {Math.abs(metric.change)}
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold mt-2">{metric.score}</div>
                    <div className="text-sm text-slate-500 flex items-center">
                      {metric.impact === 'positive' ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                      ) : metric.impact === 'negative' ? (
                        <XCircle className="h-4 w-4 text-red-500 mr-1" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-500 mr-1" />
                      )}
                      {metric.impact.charAt(0).toUpperCase() + metric.impact.slice(1)} impact
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <div 
            className="flex justify-between items-center cursor-pointer mb-2"
            onClick={() => toggleSection('departments')}
          >
            <h3 className="text-lg font-medium flex items-center">
              <Briefcase className="mr-2 h-5 w-5" />
              Department Impact
            </h3>
            {expandedSections.departments ? <ChevronUp /> : <ChevronDown />}
          </div>
          
          {expandedSections.departments && (
            <div className="space-y-4">
              {simulationResult.departmentImpacts.map((dept, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium">{dept.name}</h4>
                      <Badge 
                        variant={
                          dept.sentiment === 'positive' ? 'default' : 
                          dept.sentiment === 'negative' ? 'destructive' : 
                          'outline'
                        }
                      >
                        {dept.sentiment === 'positive' ? '+' : dept.sentiment === 'negative' ? '-' : ''}
                        {Math.abs(dept.impact)}
                      </Badge>
                    </div>
                    <p className="text-sm mt-2">{dept.notes}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <div 
            className="flex justify-between items-center cursor-pointer mb-2"
            onClick={() => toggleSection('employees')}
          >
            <h3 className="text-lg font-medium flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Employee Impact
            </h3>
            {expandedSections.employees ? <ChevronUp /> : <ChevronDown />}
          </div>
          
          {expandedSections.employees && (
            <div className="space-y-4">
              {simulationResult.employeeImpacts.map((emp, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{emp.name}</h4>
                        <div className="text-sm text-slate-500">{emp.position}</div>
                      </div>
                      <Badge 
                        variant={emp.impact > 0 ? 'default' : 'destructive'}
                      >
                        {emp.impact > 0 ? '+' : ''}
                        {emp.impact}
                      </Badge>
                    </div>
                    <p className="text-sm mt-2">{emp.reason}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <div 
            className="flex justify-between items-center cursor-pointer mb-2"
            onClick={() => toggleSection('recommendations')}
          >
            <h3 className="text-lg font-medium flex items-center">
              <CheckCircle className="mr-2 h-5 w-5" />
              Recommendations
            </h3>
            {expandedSections.recommendations ? <ChevronUp /> : <ChevronDown />}
          </div>
          
          {expandedSections.recommendations && (
            <div className="space-y-4">
              {simulationResult.recommendations.map((rec, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <h4 className="font-medium">{rec.title}</h4>
                    <p className="text-sm my-2">{rec.description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Badge variant="outline" className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {rec.timeline}
                      </Badge>
                      <Badge 
                        variant={
                          rec.impact === 'high' ? 'default' : 
                          rec.impact === 'low' ? 'outline' : 
                          'secondary'
                        }
                      >
                        Impact: {rec.impact}
                      </Badge>
                      <Badge 
                        variant={
                          rec.implementationEffort === 'low' ? 'default' : 
                          rec.implementationEffort === 'high' ? 'destructive' : 
                          'secondary'
                        }
                      >
                        Effort: {rec.implementationEffort}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Organization Simulation</h1>
      </div>
      
      {activeStep === 'setup' ? renderSetupForm() : renderResults()}
    </div>
  );
} 