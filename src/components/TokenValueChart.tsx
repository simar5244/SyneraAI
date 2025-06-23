'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { FaArrowUp, FaArrowDown, FaInfoCircle } from 'react-icons/fa';

// Register Chart.js components
Chart.register(...registerables);

interface TokenValueChartProps {
  tokenSymbol: string;
  tokenName: string;
  currentValue: number;
  changePercent: number;
  description?: string;
  initialData?: Array<{
    date: string;
    value: number;
  }>;
  timeframe?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';
}

export default function TokenValueChart({
  tokenSymbol,
  tokenName,
  currentValue,
  changePercent,
  description,
  initialData = [],
  timeframe = 'month'
}: TokenValueChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(timeframe);
  const [showInfo, setShowInfo] = useState(false);
  const [chartData, setChartData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(true);

  // Generate mock data for the chart if not provided
  useEffect(() => {
    const generateMockData = () => {
      setIsLoading(true);
      
      // If we have initial data, use it
      if (initialData.length > 0) {
        setChartData(initialData);
        setIsLoading(false);
        return;
      }
      
      // Otherwise, generate mock data based on the selected timeframe
      let days: number;
      switch (selectedTimeframe) {
        case 'day':
          days = 1;
          break;
        case 'week':
          days = 7;
          break;
        case 'month':
          days = 30;
          break;
        case 'quarter':
          days = 90;
          break;
        case 'year':
          days = 365;
          break;
        case 'all':
          days = 730; // 2 years
          break;
        default:
          days = 30;
      }
      
      // Starting value approximation
      const endValue = currentValue;
      const startValue = endValue / (1 + (changePercent / 100));
      
      // Generate data points
      const data = [];
      const now = new Date();
      
      for (let i = days; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        // Create some random but realistic-looking fluctuations
        // More volatility for smaller timeframes
        let volatilityFactor;
        switch (selectedTimeframe) {
          case 'day':
            volatilityFactor = 0.005;
            break;
          case 'week':
            volatilityFactor = 0.01;
            break;
          default:
            volatilityFactor = 0.02;
        }
        
        // Linear progression from start to end with random noise
        const progress = (days - i) / days;
        const baseValue = startValue + (endValue - startValue) * progress;
        const randomFactor = 1 + (Math.random() - 0.5) * volatilityFactor;
        
        data.push({
          date: date.toISOString().split('T')[0],
          value: baseValue * randomFactor
        });
      }
      
      setChartData(data);
      setIsLoading(false);
    };
    
    generateMockData();
  }, [selectedTimeframe, currentValue, changePercent, initialData]);

  // Initialize and update chart when data changes
  useEffect(() => {
    if (isLoading || chartData.length === 0 || !chartRef.current) return;
    
    // Destroy any existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;
    
    // Prepare data for chart
    const dates = chartData.map(item => item.date);
    const values = chartData.map(item => item.value);
    
    // Determine chart color based on change percentage
    const isPositive = changePercent >= 0;
    const primaryColor = isPositive ? 'rgb(52, 211, 153)' : 'rgb(248, 113, 113)';
    const gradientColor = isPositive ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)';
    
    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, gradientColor);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    // Create and configure chart
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: `${tokenName} Value`,
          data: values,
          borderColor: primaryColor,
          backgroundColor: gradient,
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 5,
          tension: 0.2,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                return `Value: ${context.parsed.y.toFixed(4)} credits`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              maxTicksLimit: 8,
              maxRotation: 0
            }
          },
          y: {
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              callback: function(value) {
                return value.toFixed(4);
              }
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        },
        elements: {
          point: {
            radius: 0,
            hitRadius: 10,
            hoverRadius: 5
          }
        }
      }
    });
    
    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [chartData, isLoading, tokenName, changePercent]);

  if (isLoading) {
    return (
      <div className="animate-pulse h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Loading chart data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center">
            <h3 className="text-xl font-bold text-gray-900">{tokenSymbol}</h3>
            <div className="relative ml-2">
              <button 
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowInfo(!showInfo)}
              >
                <FaInfoCircle size={16} />
              </button>
              
              {showInfo && (
                <div className="absolute z-10 left-0 mt-2 w-64 px-4 py-3 bg-white rounded-lg shadow-lg border border-gray-200 text-sm text-gray-600">
                  <p className="font-medium text-gray-900 mb-1">{tokenName}</p>
                  <p>{description || `${tokenName} represents the value measurement for contributions and achievements within the organization.`}</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-500">{tokenName}</p>
        </div>
        
        <div className="text-right">
          <div className="text-xl font-bold text-gray-900">{currentValue.toFixed(4)}</div>
          <div className={`flex items-center justify-end text-sm ${
            changePercent >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {changePercent >= 0 ? (
              <FaArrowUp className="mr-1" size={12} />
            ) : (
              <FaArrowDown className="mr-1" size={12} />
            )}
            {Math.abs(changePercent).toFixed(2)}%
          </div>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex space-x-1 text-sm">
          {['day', 'week', 'month', 'quarter', 'year', 'all'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedTimeframe(period)}
              className={`px-3 py-1 rounded-md ${
                selectedTimeframe === period
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {period === 'day' ? '1D' : 
               period === 'week' ? '1W' : 
               period === 'month' ? '1M' : 
               period === 'quarter' ? '3M' : 
               period === 'year' ? '1Y' : 'All'}
            </button>
          ))}
        </div>
      </div>
      
      <div className="h-64">
        <canvas ref={chartRef}></canvas>
      </div>
      
      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>Last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
} 