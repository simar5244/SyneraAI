'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { FaCalendarAlt, FaChartBar, FaChartPie, FaDownload, FaFilter } from 'react-icons/fa';

// Register Chart.js components
Chart.register(...registerables);

// Types
interface BudgetData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor?: string[];
    borderWidth?: number;
  }[];
}

interface BudgetItem {
  id: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  fiscalYear: string;
  quarter: string;
  department: string;
}

interface BudgetVisualizationProps {
  fiscalYear?: string;
  departmentId?: string;
}

export default function BudgetVisualization({ fiscalYear, departmentId }: BudgetVisualizationProps) {
  const [activeChart, setActiveChart] = useState<'overview' | 'departments' | 'trends' | 'categories'>('overview');
  const [timeRange, setTimeRange] = useState<'quarter' | 'year' | 'all'>('quarter');
  const [isLoading, setIsLoading] = useState(true);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  
  // Chart refs
  const overviewChartRef = useRef<HTMLCanvasElement>(null);
  const overviewChartInstance = useRef<Chart | null>(null);
  
  const departmentChartRef = useRef<HTMLCanvasElement>(null);
  const departmentChartInstance = useRef<Chart | null>(null);
  
  const trendsChartRef = useRef<HTMLCanvasElement>(null);
  const trendsChartInstance = useRef<Chart | null>(null);
  
  const categoriesChartRef = useRef<HTMLCanvasElement>(null);
  const categoriesChartInstance = useRef<Chart | null>(null);

  // Fetch data on component mount
  useEffect(() => {
    const fetchBudgetData = async () => {
      setIsLoading(true);
      try {
        // In a real app, this would be an API call
        // For demo purposes, we'll use mock data
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock budget items
        const mockBudgetItems: BudgetItem[] = [
          {
            id: '1',
            category: 'Personnel',
            amount: 2500000,
            spent: 1875000,
            remaining: 625000,
            fiscalYear: '2023',
            quarter: 'Q3',
            department: 'Operations'
          },
          {
            id: '2',
            category: 'Equipment',
            amount: 1800000,
            spent: 950000,
            remaining: 850000,
            fiscalYear: '2023',
            quarter: 'Q3',
            department: 'Operations'
          },
          {
            id: '3',
            category: 'Training',
            amount: 750000,
            spent: 520000,
            remaining: 230000,
            fiscalYear: '2023',
            quarter: 'Q3',
            department: 'Operations'
          },
          {
            id: '4',
            category: 'Research',
            amount: 3200000,
            spent: 2400000,
            remaining: 800000,
            fiscalYear: '2023',
            quarter: 'Q3',
            department: 'R&D'
          },
          {
            id: '5',
            category: 'IT Infrastructure',
            amount: 1250000,
            spent: 980000,
            remaining: 270000,
            fiscalYear: '2023',
            quarter: 'Q3',
            department: 'IT'
          },
          {
            id: '6',
            category: 'Facilities',
            amount: 900000,
            spent: 650000,
            remaining: 250000,
            fiscalYear: '2023',
            quarter: 'Q3',
            department: 'Administration'
          },
          {
            id: '7',
            category: 'Security',
            amount: 1100000,
            spent: 825000,
            remaining: 275000,
            fiscalYear: '2023',
            quarter: 'Q3',
            department: 'Security'
          }
        ];
        
        setBudgetItems(mockBudgetItems);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching budget data:', error);
        setIsLoading(false);
      }
    };
    
    fetchBudgetData();
  }, [fiscalYear, departmentId]);

  // Initialize and update charts when data changes
  useEffect(() => {
    if (isLoading || budgetItems.length === 0) return;
    
    // Destroy existing chart instances to prevent memory leaks
    if (overviewChartInstance.current) {
      overviewChartInstance.current.destroy();
    }
    
    if (departmentChartInstance.current) {
      departmentChartInstance.current.destroy();
    }
    
    if (trendsChartInstance.current) {
      trendsChartInstance.current.destroy();
    }
    
    if (categoriesChartInstance.current) {
      categoriesChartInstance.current.destroy();
    }
    
    // Create overview chart (allocated vs spent)
    if (overviewChartRef.current) {
      const totalAllocated = budgetItems.reduce((total, item) => total + item.amount, 0);
      const totalSpent = budgetItems.reduce((total, item) => total + item.spent, 0);
      const totalRemaining = totalAllocated - totalSpent;
      
      const ctx = overviewChartRef.current.getContext('2d');
      if (ctx) {
        overviewChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Spent', 'Remaining'],
            datasets: [{
              label: 'Budget Overview',
              data: [totalSpent, totalRemaining],
              backgroundColor: [
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)'
              ],
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                position: 'bottom'
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const value = context.raw as number;
                    const percentage = Math.round((value / totalAllocated) * 100);
                    return `${context.label}: $${value.toLocaleString()} (${percentage}%)`;
                  }
                }
              }
            }
          }
        });
      }
    }
    
    // Create department allocation chart
    if (departmentChartRef.current) {
      // Group by department
      const departmentData: Record<string, number> = {};
      budgetItems.forEach(item => {
        if (departmentData[item.department]) {
          departmentData[item.department] += item.amount;
        } else {
          departmentData[item.department] = item.amount;
        }
      });
      
      const departments = Object.keys(departmentData);
      const allocations = Object.values(departmentData);
      
      const ctx = departmentChartRef.current.getContext('2d');
      if (ctx) {
        departmentChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: departments,
            datasets: [{
              label: 'Budget Allocation by Department',
              data: allocations,
              backgroundColor: [
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(153, 102, 255, 0.8)'
              ],
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function(value) {
                    return '$' + (value as number).toLocaleString();
                  }
                }
              }
            },
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const value = context.raw as number;
                    return `Budget: $${value.toLocaleString()}`;
                  }
                }
              }
            }
          }
        });
      }
    }
    
    // Create trends chart (simulated data over time)
    if (trendsChartRef.current) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Simulated monthly spending data
      const monthlySpendings = [
        650000, 720000, 830000, 910000, 880000, 950000, 
        1020000, 1100000, 1200000, 0, 0, 0 // Future months are zero
      ];
      
      // Simulated monthly allocations
      const monthlyAllocations = [
        800000, 800000, 900000, 950000, 950000, 1000000,
        1100000, 1200000, 1300000, 1300000, 1300000, 1300000
      ];
      
      const ctx = trendsChartRef.current.getContext('2d');
      if (ctx) {
        trendsChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: months,
            datasets: [
              {
                label: 'Allocated',
                data: monthlyAllocations,
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1
              },
              {
                label: 'Spent',
                data: monthlySpendings,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1
              }
            ]
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function(value) {
                    return '$' + (value as number / 1000000).toFixed(1) + 'M';
                  }
                }
              }
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const value = context.raw as number;
                    return `${context.dataset.label}: $${value.toLocaleString()}`;
                  }
                }
              }
            }
          }
        });
      }
    }
    
    // Create categories chart
    if (categoriesChartRef.current) {
      // Group by category
      const categoryLabels = budgetItems.map(item => item.category);
      const spentData = budgetItems.map(item => item.spent);
      const remainingData = budgetItems.map(item => item.remaining);
      
      const ctx = categoriesChartRef.current.getContext('2d');
      if (ctx) {
        categoriesChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: categoryLabels,
            datasets: [
              {
                label: 'Spent',
                data: spentData,
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                borderWidth: 1
              },
              {
                label: 'Remaining',
                data: remainingData,
                backgroundColor: 'rgba(255, 206, 86, 0.8)',
                borderWidth: 1
              }
            ]
          },
          options: {
            responsive: true,
            scales: {
              x: {
                stacked: true
              },
              y: {
                stacked: false,
                beginAtZero: true,
                ticks: {
                  callback: function(value) {
                    return '$' + (value as number / 1000).toFixed(0) + 'K';
                  }
                }
              }
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const value = context.raw as number;
                    return `${context.dataset.label}: $${value.toLocaleString()}`;
                  }
                }
              }
            }
          }
        });
      }
    }
    
    // Cleanup on component unmount
    return () => {
      if (overviewChartInstance.current) {
        overviewChartInstance.current.destroy();
      }
      if (departmentChartInstance.current) {
        departmentChartInstance.current.destroy();
      }
      if (trendsChartInstance.current) {
        trendsChartInstance.current.destroy();
      }
      if (categoriesChartInstance.current) {
        categoriesChartInstance.current.destroy();
      }
    };
  }, [isLoading, budgetItems]);

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading budget data...</p>
        </div>
      </div>
    );
  }

  // Calculate summary statistics
  const totalAllocated = budgetItems.reduce((total, item) => total + item.amount, 0);
  const totalSpent = budgetItems.reduce((total, item) => total + item.spent, 0);
  const totalRemaining = totalAllocated - totalSpent;
  const percentUsed = Math.round((totalSpent / totalAllocated) * 100);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Budget Visualization</h2>
        
        <div className="flex space-x-2">
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="appearance-none bg-white border border-gray-300 rounded-md py-2 pl-3 pr-10 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="quarter">Current Quarter</option>
              <option value="year">Fiscal Year 2023</option>
              <option value="all">All Time</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <FaCalendarAlt size={14} />
            </div>
          </div>
          
          <button
            className="flex items-center justify-center p-2 bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50"
            title="Export Data"
          >
            <FaDownload size={14} />
          </button>
          
          <button
            className="flex items-center justify-center p-2 bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50"
            title="Filter Data"
          >
            <FaFilter size={14} />
          </button>
        </div>
      </div>
      
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Total Budget</div>
          <div className="text-2xl font-bold text-gray-900">${(totalAllocated/1000000).toFixed(2)}M</div>
          <div className="text-xs text-gray-500">Fiscal Year 2023</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Spent</div>
          <div className="text-2xl font-bold text-blue-600">${(totalSpent/1000000).toFixed(2)}M</div>
          <div className="text-xs text-gray-500">({percentUsed}% of total)</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Remaining</div>
          <div className="text-2xl font-bold text-yellow-600">${(totalRemaining/1000000).toFixed(2)}M</div>
          <div className="text-xs text-gray-500">({100-percentUsed}% of total)</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Departments</div>
          <div className="text-2xl font-bold text-purple-600">
            {new Set(budgetItems.map(item => item.department)).size}
          </div>
          <div className="text-xs text-gray-500">Active budget units</div>
        </div>
      </div>
      
      {/* Chart navigation */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveChart('overview')}
          className={`py-2 px-4 border-b-2 font-medium text-sm ${
            activeChart === 'overview' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <FaChartPie className="inline mr-2" />
          Overview
        </button>
        
        <button
          onClick={() => setActiveChart('departments')}
          className={`py-2 px-4 border-b-2 font-medium text-sm ${
            activeChart === 'departments' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <FaChartBar className="inline mr-2" />
          By Department
        </button>
        
        <button
          onClick={() => setActiveChart('trends')}
          className={`py-2 px-4 border-b-2 font-medium text-sm ${
            activeChart === 'trends' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <FaChartBar className="inline mr-2" />
          Spending Trends
        </button>
        
        <button
          onClick={() => setActiveChart('categories')}
          className={`py-2 px-4 border-b-2 font-medium text-sm ${
            activeChart === 'categories' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <FaChartBar className="inline mr-2" />
          By Category
        </button>
      </div>
      
      {/* Chart display area */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="h-96">
          {activeChart === 'overview' && (
            <canvas ref={overviewChartRef} />
          )}
          
          {activeChart === 'departments' && (
            <canvas ref={departmentChartRef} />
          )}
          
          {activeChart === 'trends' && (
            <canvas ref={trendsChartRef} />
          )}
          
          {activeChart === 'categories' && (
            <canvas ref={categoriesChartRef} />
          )}
        </div>
      </div>
      
      {/* Data table for the selected view */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">Budget Details</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Allocated
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spent
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Remaining
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % Used
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {budgetItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.spent.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.remaining.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2 w-24">
                        <div 
                          className={`h-2.5 rounded-full ${
                            (item.spent / item.amount) > 0.9 ? 'bg-red-600' : 
                            (item.spent / item.amount) > 0.7 ? 'bg-yellow-500' : 'bg-green-600'
                          }`}
                          style={{ width: `${(item.spent / item.amount) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-700">
                        {Math.round((item.spent / item.amount) * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 