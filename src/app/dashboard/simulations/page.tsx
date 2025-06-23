'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlusCircle, FiBarChart2, FiUsers, FiRefreshCw, FiDollarSign, FiClock, FiEdit, FiCopy, FiTrash2, FiFilter } from 'react-icons/fi';
import { motion } from 'framer-motion';
import clsx from 'clsx';

// Simulation types
type SimulationType = 'attrition' | 'reorganization' | 'growth' | 'cost_reduction';

interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  type: SimulationType;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  parameters: any;
  isTemplate: boolean;
}

const SimulationsPage = () => {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [templates, setTemplates] = useState<SimulationScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<SimulationType | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newScenario, setNewScenario] = useState({
    name: '',
    description: '',
    type: 'attrition' as SimulationType,
    parameters: {}
  });

  // Fetch scenarios on component mount
  useEffect(() => {
    fetchScenarios();
  }, []);

  // Function to fetch scenarios from API
  const fetchScenarios = async () => {
    setLoading(true);
    try {
      // Fetch user's scenarios
      const res = await fetch('/api/simulation/scenarios');
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const scenarioData = data.scenarios || [];
      setScenarios(scenarioData.filter((s: SimulationScenario) => !s.isTemplate));
      
      // Fetch template scenarios
      const templateRes = await fetch('/api/simulation/scenarios?includeTemplates=true');
      const templateData = await templateRes.json();
      
      if (templateData.error) {
        throw new Error(templateData.error);
      }
      
      setTemplates(templateData.scenarios.filter((s: SimulationScenario) => s.isTemplate));
    } catch (err) {
      console.error('Error fetching scenarios:', err);
      setError('Failed to load scenarios. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Function to create a new scenario
  const createScenario = async () => {
    if (!newScenario.name || !newScenario.type) {
      setError('Name and type are required');
      return;
    }
    
    try {
      const res = await fetch('/api/simulation/scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newScenario),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setScenarios([...scenarios, data]);
        setShowCreateModal(false);
        setNewScenario({
          name: '',
          description: '',
          type: 'attrition',
          parameters: {}
        });
      } else {
        setError(data.error || 'Failed to create scenario');
      }
    } catch (err) {
      console.error('Error creating scenario:', err);
      setError('Failed to create scenario. Please try again.');
    }
  };

  // Function to run a simulation
  const runSimulation = (scenarioId: string) => {
    router.push(`/dashboard/simulations/${scenarioId}/run`);
  };

  // Function to view results
  const viewResults = (scenarioId: string) => {
    router.push(`/dashboard/simulations/${scenarioId}/results`);
  };

  // Function to duplicate a scenario
  const duplicateScenario = async (scenario: SimulationScenario) => {
    try {
      const duplicatedScenario = {
        ...scenario,
        name: `Copy of ${scenario.name}`,
        isTemplate: false,
      };
      
      delete duplicatedScenario.id;
      
      const res = await fetch('/api/simulation/scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(duplicatedScenario),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setScenarios([...scenarios, data]);
      } else {
        setError(data.error || 'Failed to duplicate scenario');
      }
    } catch (err) {
      console.error('Error duplicating scenario:', err);
      setError('Failed to duplicate scenario. Please try again.');
    }
  };

  // Function to delete a scenario
  const deleteScenario = async (scenarioId: string) => {
    if (confirm('Are you sure you want to delete this scenario?')) {
      try {
        const res = await fetch(`/api/simulation/scenarios/${scenarioId}`, {
          method: 'DELETE',
        });
        
        if (res.ok) {
          setScenarios(scenarios.filter(s => s.id !== scenarioId));
        } else {
          const data = await res.json();
          setError(data.error || 'Failed to delete scenario');
        }
      } catch (err) {
        console.error('Error deleting scenario:', err);
        setError('Failed to delete scenario. Please try again.');
      }
    }
  };

  // Function to edit a scenario
  const editScenario = (scenarioId: string) => {
    router.push(`/dashboard/simulations/${scenarioId}/edit`);
  };

  // Filter scenarios by type
  const filteredScenarios = typeFilter === 'all'
    ? scenarios
    : scenarios.filter(s => s.type === typeFilter);

  // Helper function to get icon for simulation type
  const getTypeIcon = (type: SimulationType) => {
    switch (type) {
      case 'attrition':
        return <FiUsers className="text-orange-500" />;
      case 'reorganization':
        return <FiRefreshCw className="text-purple-500" />;
      case 'growth':
        return <FiBarChart2 className="text-green-500" />;
      case 'cost_reduction':
        return <FiDollarSign className="text-red-500" />;
      default:
        return <FiUsers className="text-gray-500" />;
    }
  };

  // Helper function to format date
  const formatDate = (date: Date) => {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-800">HR Simulations</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
        >
          <FiPlusCircle className="mr-2" />
          New Simulation
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button 
            className="float-right font-bold"
            onClick={() => setError(null)}
          >
            &times;
          </button>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center mb-2">
          <FiFilter className="mr-2 text-gray-500" />
          <span className="text-gray-700 font-medium">Filter by type:</span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setTypeFilter('all')}
            className={clsx(
              "px-3 py-1 rounded-md",
              typeFilter === 'all' 
                ? "bg-gray-800 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            )}
          >
            All
          </button>
          <button
            onClick={() => setTypeFilter('attrition')}
            className={clsx(
              "px-3 py-1 rounded-md flex items-center",
              typeFilter === 'attrition' 
                ? "bg-orange-500 text-white" 
                : "bg-orange-100 text-orange-700 hover:bg-orange-200"
            )}
          >
            <FiUsers className="mr-1" /> Attrition
          </button>
          <button
            onClick={() => setTypeFilter('reorganization')}
            className={clsx(
              "px-3 py-1 rounded-md flex items-center",
              typeFilter === 'reorganization' 
                ? "bg-purple-500 text-white" 
                : "bg-purple-100 text-purple-700 hover:bg-purple-200"
            )}
          >
            <FiRefreshCw className="mr-1" /> Reorganization
          </button>
          <button
            onClick={() => setTypeFilter('growth')}
            className={clsx(
              "px-3 py-1 rounded-md flex items-center",
              typeFilter === 'growth' 
                ? "bg-green-500 text-white" 
                : "bg-green-100 text-green-700 hover:bg-green-200"
            )}
          >
            <FiBarChart2 className="mr-1" /> Growth
          </button>
          <button
            onClick={() => setTypeFilter('cost_reduction')}
            className={clsx(
              "px-3 py-1 rounded-md flex items-center",
              typeFilter === 'cost_reduction' 
                ? "bg-red-500 text-white" 
                : "bg-red-100 text-red-700 hover:bg-red-200"
            )}
          >
            <FiDollarSign className="mr-1" /> Cost Reduction
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {filteredScenarios.length === 0 ? (
            <div className="bg-gray-100 rounded-lg p-8 text-center">
              <h3 className="text-xl font-medium text-gray-700 mb-2">No simulations found</h3>
              <p className="text-gray-500 mb-4">
                {typeFilter !== 'all' 
                  ? `You don't have any ${typeFilter} simulations yet.`
                  : "You haven't created any simulations yet."}
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Create your first simulation
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredScenarios.map((scenario) => (
                <motion.div
                  key={scenario.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center">
                        <div className="mr-3 p-2 rounded-full bg-gray-100">
                          {getTypeIcon(scenario.type)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-gray-800">{scenario.name}</h3>
                          <p className="text-gray-500 text-sm">
                            {scenario.type.charAt(0).toUpperCase() + scenario.type.slice(1)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {scenario.description || "No description provided."}
                    </p>
                    
                    <div className="flex items-center text-sm text-gray-500 mb-4">
                      <FiClock className="mr-1" />
                      <span>Created {formatDate(scenario.createdAt)}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => runSimulation(scenario.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm flex items-center justify-center"
                      >
                        Run Simulation
                      </button>
                      <button
                        onClick={() => viewResults(scenario.id)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm"
                      >
                        Results
                      </button>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between">
                      <button
                        onClick={() => editScenario(scenario.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <FiEdit size={18} />
                      </button>
                      <button
                        onClick={() => duplicateScenario(scenario)}
                        className="text-green-600 hover:text-green-800"
                      >
                        <FiCopy size={18} />
                      </button>
                      <button
                        onClick={() => deleteScenario(scenario.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {templates.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Starter Templates</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200"
                  >
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center">
                          <div className="mr-3 p-2 rounded-full bg-gray-100">
                            {getTypeIcon(template.type)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg text-gray-800">{template.name}</h3>
                            <div className="flex items-center">
                              <span className="text-xs font-medium bg-blue-100 text-blue-800 rounded-full px-2 py-0.5">
                                Template
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {template.description || "No description provided."}
                      </p>
                      
                      <button
                        onClick={() => duplicateScenario(template)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm flex items-center justify-center"
                      >
                        <FiCopy className="mr-1" />
                        Use Template
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Simulation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Create New Simulation</h2>
            
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Simulation Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setNewScenario({...newScenario, type: 'attrition'})}
                  className={clsx(
                    "p-3 rounded-lg border flex flex-col items-center justify-center text-center transition-colors",
                    newScenario.type === 'attrition'
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-gray-200 hover:border-orange-300 hover:bg-orange-50"
                  )}
                >
                  <FiUsers size={24} className="mb-2 text-orange-500" />
                  <span className="font-medium">Attrition Analysis</span>
                </button>
                
                <button
                  onClick={() => setNewScenario({...newScenario, type: 'reorganization'})}
                  className={clsx(
                    "p-3 rounded-lg border flex flex-col items-center justify-center text-center transition-colors",
                    newScenario.type === 'reorganization'
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 hover:border-purple-300 hover:bg-purple-50"
                  )}
                >
                  <FiRefreshCw size={24} className="mb-2 text-purple-500" />
                  <span className="font-medium">Reorganization</span>
                </button>
                
                <button
                  onClick={() => setNewScenario({...newScenario, type: 'growth'})}
                  className={clsx(
                    "p-3 rounded-lg border flex flex-col items-center justify-center text-center transition-colors",
                    newScenario.type === 'growth'
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 hover:border-green-300 hover:bg-green-50"
                  )}
                >
                  <FiBarChart2 size={24} className="mb-2 text-green-500" />
                  <span className="font-medium">Growth Planning</span>
                </button>
                
                <button
                  onClick={() => setNewScenario({...newScenario, type: 'cost_reduction'})}
                  className={clsx(
                    "p-3 rounded-lg border flex flex-col items-center justify-center text-center transition-colors",
                    newScenario.type === 'cost_reduction'
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-200 hover:border-red-300 hover:bg-red-50"
                  )}
                >
                  <FiDollarSign size={24} className="mb-2 text-red-500" />
                  <span className="font-medium">Cost Reduction</span>
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Simulation Name</label>
              <input
                type="text"
                value={newScenario.name}
                onChange={(e) => setNewScenario({...newScenario, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a name for your simulation"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Description (Optional)</label>
              <textarea
                value={newScenario.description}
                onChange={(e) => setNewScenario({...newScenario, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe what this simulation will analyze"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end mt-6 space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={createScenario}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Simulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationsPage; 