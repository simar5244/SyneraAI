'use client';

import React, { useState, useEffect } from 'react';
import { FaChartLine, FaExchangeAlt, FaArrowUp, FaArrowDown, FaCoins, FaSpinner, FaLightbulb, FaHistory } from 'react-icons/fa';

// Types for our internal economy components
interface ValueToken {
  id: string;
  name: string;
  symbol: string;
  description: string;
  totalSupply: number;
  marketCap: number;
  currentValue: number;
  changePercent24h: number;
  createdAt: Date;
  iconUrl?: string;
}

interface Transaction {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  toUserName: string;
  tokenId: string;
  tokenName: string;
  tokenSymbol: string;
  amount: number;
  timestamp: Date;
  reason: string;
  status: 'completed' | 'pending' | 'failed';
}

interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: 'allocation' | 'incentive' | 'policy';
  implementationDifficulty: 'easy' | 'moderate' | 'complex';
  estimatedBenefit: number; // percentage improvement
  generatedAt: Date;
  implemented: boolean;
}

interface ValueAllocation {
  departmentId: string;
  departmentName: string;
  totalAllocation: number;
  usedAllocation: number;
  remainingAllocation: number;
  tokens: {
    [tokenSymbol: string]: {
      amount: number;
      value: number;
    }
  };
}

export default function InternalEconomyPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'allocations' | 'ai-recommendations'>('overview');
  const [tokens, setTokens] = useState<ValueToken[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allocations, setAllocations] = useState<ValueAllocation[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false);
  const [aiModelResponse, setAiModelResponse] = useState<string>('');

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // In a real implementation, these would be API calls
        // For this demo, we'll use mock data
        
        // Mock tokens
        const mockTokens: ValueToken[] = [
          {
            id: '1',
            name: 'Strategic Value',
            symbol: 'STV',
            description: 'Awarded for contributions to strategic objectives',
            totalSupply: 1000000,
            marketCap: 5000000,
            currentValue: 5.23,
            changePercent24h: 2.4,
            createdAt: new Date('2023-01-01'),
            iconUrl: '/tokens/strategic.png'
          },
          {
            id: '2',
            name: 'Tactical Value',
            symbol: 'TTV',
            description: 'Awarded for operational achievements',
            totalSupply: 2500000,
            marketCap: 3750000,
            currentValue: 1.45,
            changePercent24h: -0.8,
            createdAt: new Date('2023-01-01'),
            iconUrl: '/tokens/tactical.png'
          },
          {
            id: '3',
            name: 'Innovation Credit',
            symbol: 'INNO',
            description: 'Rewards for innovative solutions and ideas',
            totalSupply: 500000,
            marketCap: 2500000,
            currentValue: 4.98,
            changePercent24h: 5.2,
            createdAt: new Date('2023-01-01'),
            iconUrl: '/tokens/innovation.png'
          }
        ];
        
        // Mock transactions
        const mockTransactions: Transaction[] = [
          {
            id: '1',
            fromUserId: 'system',
            toUserId: 'user123',
            fromUserName: 'System',
            toUserName: 'Alex Johnson',
            tokenId: '1',
            tokenName: 'Strategic Value',
            tokenSymbol: 'STV',
            amount: 250,
            timestamp: new Date('2023-09-15T14:30:00'),
            reason: 'Quarterly strategic value allocation',
            status: 'completed'
          },
          {
            id: '2',
            fromUserId: 'user123',
            toUserId: 'user456',
            fromUserName: 'Alex Johnson',
            toUserName: 'Sarah Williams',
            tokenId: '1',
            tokenName: 'Strategic Value',
            tokenSymbol: 'STV',
            amount: 50,
            timestamp: new Date('2023-09-16T09:15:00'),
            reason: 'Recognition for project support',
            status: 'completed'
          },
          {
            id: '3',
            fromUserId: 'user789',
            toUserId: 'user123',
            fromUserName: 'Michael Chen',
            toUserName: 'Alex Johnson',
            tokenId: '3',
            tokenName: 'Innovation Credit',
            tokenSymbol: 'INNO',
            amount: 75,
            timestamp: new Date('2023-09-20T16:45:00'),
            reason: 'Innovative solution to security protocol issue',
            status: 'completed'
          }
        ];
        
        // Mock allocations
        const mockAllocations: ValueAllocation[] = [
          {
            departmentId: 'd1',
            departmentName: 'IT Security',
            totalAllocation: 50000,
            usedAllocation: 32500,
            remainingAllocation: 17500,
            tokens: {
              'STV': { amount: 4000, value: 20920 },
              'TTV': { amount: 8000, value: 11600 }
            }
          },
          {
            departmentId: 'd2',
            departmentName: 'Operations',
            totalAllocation: 75000,
            usedAllocation: 45000,
            remainingAllocation: 30000,
            tokens: {
              'STV': { amount: 5000, value: 26150 },
              'TTV': { amount: 13000, value: 18850 }
            }
          },
          {
            departmentId: 'd3',
            departmentName: 'Research & Development',
            totalAllocation: 100000,
            usedAllocation: 68000,
            remainingAllocation: 32000,
            tokens: {
              'STV': { amount: 7000, value: 36610 },
              'TTV': { amount: 8000, value: 11600 },
              'INNO': { amount: 4000, value: 19920 }
            }
          }
        ];
        
        // Mock AI recommendations
        const mockRecommendations: AIRecommendation[] = [
          {
            id: 'r1',
            title: 'Rebalance token allocation for Field Operations',
            description: 'Current allocation is weighted too heavily toward TTV tokens. Recommend shifting 15% to STV to better align with strategic objectives for Q4.',
            impact: 'medium',
            category: 'allocation',
            implementationDifficulty: 'easy',
            estimatedBenefit: 12,
            generatedAt: new Date('2023-09-10T10:15:00'),
            implemented: true
          },
          {
            id: 'r2',
            title: 'Implement cross-department incentive program',
            description: 'Analysis shows siloed operations. Recommend new incentive structure using INNO tokens to reward cross-department collaboration.',
            impact: 'high',
            category: 'incentive',
            implementationDifficulty: 'moderate',
            estimatedBenefit: 24,
            generatedAt: new Date('2023-09-18T14:30:00'),
            implemented: false
          }
        ];
        
        setTokens(mockTokens);
        setTransactions(mockTransactions);
        setAllocations(mockAllocations);
        setRecommendations(mockRecommendations);
        
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Function to generate new AI recommendation using Gemini API
  const generateAIRecommendation = async () => {
    setIsGeneratingRecommendation(true);
    setAiModelResponse('');
    
    try {
      // In a real implementation, this would call your backend which would then use the Gemini API
      // For this demo, we'll simulate the response after a delay
      
      setTimeout(() => {
        // Mock AI generated recommendation
        const newRecommendation: AIRecommendation = {
          id: `r${recommendations.length + 1}`,
          title: 'Implement dynamic token value adjustment',
          description: 'Analysis of current token utilization patterns suggests implementing dynamic value adjustments based on department performance metrics would optimize resource allocation. This would increase token utilization efficiency by approximately 18% while ensuring resources are directed to highest-impact activities.',
          impact: 'high',
          category: 'policy',
          implementationDifficulty: 'complex',
          estimatedBenefit: 18,
          generatedAt: new Date(),
          implemented: false
        };
        
        setRecommendations([...recommendations, newRecommendation]);
        
        setAiModelResponse(`
          Based on analysis of current token distribution, allocation patterns, and organizational objectives, I recommend implementing a dynamic token value adjustment system. This would:
          
          1. Tie token values to department performance metrics
          2. Create automatic rebalancing on bi-weekly cycles
          3. Implement a feedback loop to adjust weights based on outcomes
          
          This approach would optimize resource allocation efficiency by approximately 18% while ensuring resources flow to highest-impact activities.
          
          Implementation would require:
          - Defining performance metrics for each department
          - Creating adjustment algorithms
          - Building monitoring dashboards
          - Training department heads on the new system
        `);
        
        setIsGeneratingRecommendation(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error generating AI recommendation:', error);
      setIsGeneratingRecommendation(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading internal economy data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Internal Economy</h1>
          <p className="text-sm text-gray-600">Manage and track organizational value tokens</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3 px-4 font-medium ${
            activeTab === 'overview'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FaChartLine className="inline mr-2" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`py-3 px-4 font-medium ${
            activeTab === 'transactions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FaExchangeAlt className="inline mr-2" />
          Transactions
        </button>
        <button
          onClick={() => setActiveTab('allocations')}
          className={`py-3 px-4 font-medium ${
            activeTab === 'allocations'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FaCoins className="inline mr-2" />
          Allocations
        </button>
        <button
          onClick={() => setActiveTab('ai-recommendations')}
          className={`py-3 px-4 font-medium ${
            activeTab === 'ai-recommendations'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FaLightbulb className="inline mr-2" />
          AI Recommendations
        </button>
      </div>

      {/* Content area */}
      <div className="flex-grow overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Value Token Overview</h2>
            
            {/* Token Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tokens.map(token => (
                <div key={token.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                        {token.symbol.substring(0, 2)}
                      </div>
                      <div className="ml-4">
                        <h3 className="font-semibold text-lg">{token.name}</h3>
                        <p className="text-sm text-gray-500">{token.symbol}</p>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4">{token.description}</p>
                  
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span className="text-gray-500">Current Value:</span>
                    <span className="text-gray-900">${token.currentValue.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span className="text-gray-500">24h Change:</span>
                    <span className={token.changePercent24h >= 0 ? "text-green-600" : "text-red-600"}>
                      {token.changePercent24h >= 0 ? <FaArrowUp className="inline mr-1" /> : <FaArrowDown className="inline mr-1" />}
                      {Math.abs(token.changePercent24h).toFixed(2)}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span className="text-gray-500">Total Supply:</span>
                    <span className="text-gray-900">{token.totalSupply.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-gray-500">Market Cap:</span>
                    <span className="text-gray-900">${token.marketCap.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* System Overview */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-lg mb-4">System Overview</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">Total Value Allocated</h4>
                  <p className="text-2xl font-bold text-blue-900">
                    ${allocations.reduce((sum, alloc) => sum + alloc.totalAllocation, 0).toLocaleString()}
                  </p>
                </div>
                
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="text-sm font-medium text-green-800 mb-2">Active Transactions (30d)</h4>
                  <p className="text-2xl font-bold text-green-900">{transactions.length}</p>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="text-sm font-medium text-purple-800 mb-2">Departments</h4>
                  <p className="text-2xl font-bold text-purple-900">{allocations.length}</p>
                </div>
                
                <div className="p-4 bg-amber-50 rounded-lg">
                  <h4 className="text-sm font-medium text-amber-800 mb-2">Token Types</h4>
                  <p className="text-2xl font-bold text-amber-900">{tokens.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">Recent Transactions</h2>
              <div className="flex items-center text-sm text-gray-500">
                <FaHistory className="mr-1" />
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        From → To
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Token
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(transaction.timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{transaction.fromUserName}</div>
                          <div className="text-sm text-gray-500">→ {transaction.toUserName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {transaction.tokenSymbol}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {transaction.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {transaction.reason}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            transaction.status === 'completed' ? 'bg-green-100 text-green-800' : 
                            transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-red-100 text-red-800'
                          }`}>
                            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Allocations Tab */}
        {activeTab === 'allocations' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Department Allocations</h2>
            
            <div className="grid grid-cols-1 gap-6">
              {allocations.map((allocation) => (
                <div key={allocation.departmentId} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg text-gray-900">{allocation.departmentName}</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Department
                    </span>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Allocation Used</span>
                      <span className="text-gray-900 font-medium">
                        ${allocation.usedAllocation.toLocaleString()} 
                        <span className="text-gray-500 font-normal">
                          / ${allocation.totalAllocation.toLocaleString()}
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${(allocation.usedAllocation / allocation.totalAllocation) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <h4 className="font-medium text-gray-800 mb-3">Token Breakdown</h4>
                  <div className="space-y-4">
                    {Object.entries(allocation.tokens).map(([symbol, data]) => {
                      const token = tokens.find(t => t.symbol === symbol);
                      return (
                        <div key={symbol} className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                            {symbol.substring(0, 2)}
                          </div>
                          <div className="ml-3 flex-grow">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-900">{token?.name || symbol}</span>
                              <span className="text-gray-900 font-medium">{data.amount.toLocaleString()} tokens</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>Current value</span>
                              <span>${data.value.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Recommendations Tab */}
        {activeTab === 'ai-recommendations' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">AI Generated Recommendations</h2>
              <button
                onClick={generateAIRecommendation}
                disabled={isGeneratingRecommendation}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingRecommendation ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FaLightbulb className="mr-2" />
                    Generate New Recommendation
                  </>
                )}
              </button>
            </div>
            
            {/* AI Model Response */}
            {aiModelResponse && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                    <FaLightbulb className="text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-lg text-gray-900">AI Analysis Result</h3>
                    <p className="text-sm text-gray-500">Generated just now</p>
                  </div>
                </div>
                <div className="text-gray-700 whitespace-pre-line">
                  {aiModelResponse}
                </div>
              </div>
            )}
            
            {/* Recommendations List */}
            <div className="grid grid-cols-1 gap-6">
              {recommendations.map((rec) => (
                <div key={rec.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">{rec.title}</h3>
                      <div className="flex space-x-2 mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          rec.impact === 'high' ? 'bg-red-100 text-red-800' : 
                          rec.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-green-100 text-green-800'
                        }`}>
                          {rec.impact.charAt(0).toUpperCase() + rec.impact.slice(1)} Impact
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {rec.category.charAt(0).toUpperCase() + rec.category.slice(1)}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          rec.implemented ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {rec.implemented ? 'Implemented' : 'Pending'}
                        </span>
                      </div>
                    </div>
                    <div className="text-green-600 font-medium">
                      +{rec.estimatedBenefit}% 
                      <span className="text-xs font-normal text-gray-500 block text-right">
                        Est. Benefit
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-4">{rec.description}</p>
                  
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Generated: {new Date(rec.generatedAt).toLocaleDateString()}</span>
                    <span>
                      Difficulty: 
                      <span className={`ml-1 ${
                        rec.implementationDifficulty === 'easy' ? 'text-green-600' : 
                        rec.implementationDifficulty === 'moderate' ? 'text-yellow-600' : 
                        'text-red-600'
                      }`}>
                        {rec.implementationDifficulty.charAt(0).toUpperCase() + rec.implementationDifficulty.slice(1)}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 