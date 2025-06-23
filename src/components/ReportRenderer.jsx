import React, { useEffect, useRef, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Chart from 'chart.js/auto';
import 'chart.js/auto';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register the required Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Helper function to create a color palette
const generateColors = (count, opacity = 1) => {
  const baseColors = [
    `rgba(139, 92, 246, ${opacity})`, // Purple (primary)
    `rgba(79, 70, 229, ${opacity})`,  // Indigo
    `rgba(59, 130, 246, ${opacity})`, // Blue
    `rgba(16, 185, 129, ${opacity})`, // Emerald
    `rgba(245, 158, 11, ${opacity})`, // Amber
    `rgba(239, 68, 68, ${opacity})`,  // Red
    `rgba(236, 72, 153, ${opacity})`, // Pink
  ];
  
  // If we need more colors than in our base palette, we'll generate them
  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }
  
  // Generate additional colors by rotating hue
  const colors = [...baseColors];
  for (let i = baseColors.length; i < count; i++) {
    const hue = (i * 137) % 360; // Use golden ratio to spread colors evenly
    colors.push(`hsla(${hue}, 70%, 60%, ${opacity})`);
  }
  
  return colors;
};

// Component for rendering different chart types
const ChartRenderer = ({ config, data }) => {
  if (!config) return null;
  
  // Process the data based on the chart configuration
  const processData = () => {
    // First check if dataMapping contains pre-processed data
    if (config.dataMapping && config.dataMapping.labels && config.dataMapping.datasets) {
      // Direct use of provided data mapping
      return {
        labels: config.dataMapping.labels,
        datasets: config.dataMapping.datasets.map(dataset => ({
          ...dataset,
          backgroundColor: Array.isArray(dataset.backgroundColor) 
            ? dataset.backgroundColor 
            : generateColors(config.dataMapping.labels.length)
        }))
      };
    }
    
    // Extract data from the correct source
    const sourceData = data && data[config.dataSource] ? data[config.dataSource] : [];
    
    // Last-resort fallback to ensure we have something to display
    if ((!Array.isArray(sourceData) || sourceData.length === 0) && 
        (!config.dataMapping || !config.dataMapping.labels)) {
      console.log("Using fallback chart data");
      // Use basic fallback data that will always work
      const fallbackLabels = ['Category A', 'Category B', 'Category C', 'Category D', 'Category E'];
      const fallbackData = [5, 4, 3, 2, 1];
      
      return {
        labels: fallbackLabels,
        datasets: [{
          label: config.title || 'Data',
          data: fallbackData,
          backgroundColor: generateColors(fallbackLabels.length)
        }]
      };
    }
    
    // Handle different chart types and data structures
    switch (config.type.toLowerCase()) {
      case 'bar':
      case 'line':
      case 'pie':
      case 'doughnut': {
        const dataMapping = config.dataMapping || {};
        const xField = dataMapping.x || 'department';
        const yField = dataMapping.y || 'count';
        const seriesField = dataMapping.series;
        
        // If we need to aggregate the data (e.g., count by department)
        const needsAggregation = typeof yField === 'string' && yField === 'count';
        
        if (needsAggregation) {
          // Count frequency by group
          const groupCounts = {};
          sourceData.forEach(item => {
            const key = typeof item[xField] === 'string' ? item[xField] : 'Other';
            groupCounts[key] = (groupCounts[key] || 0) + 1;
          });
          
          const labels = Object.keys(groupCounts);
          const values = Object.values(groupCounts);
          
          return {
            labels,
            datasets: [{
              label: `${xField} Count`,
              data: values,
              backgroundColor: generateColors(labels.length),
              borderColor: config.type.toLowerCase() === 'line' ? generateColors(1, 1)[0] : undefined,
              borderWidth: 1
            }]
          };
        } else if (seriesField) {
          // Multi-series data (e.g., grouped by series)
          const seriesValues = [...new Set(sourceData.map(item => item[seriesField]))];
          const labels = [...new Set(sourceData.map(item => item[xField]))];
          
          const datasets = seriesValues.map((series, index) => {
            const seriesData = sourceData.filter(item => item[seriesField] === series);
            const color = generateColors(seriesValues.length)[index];
            
            return {
              label: series,
              data: labels.map(label => {
                const match = seriesData.find(item => item[xField] === label);
                return match ? match[yField] : 0;
              }),
              backgroundColor: config.type.toLowerCase() === 'line' ? 'rgba(0,0,0,0)' : color,
              borderColor: color,
              borderWidth: 1
            };
          });
          
          return { labels, datasets };
        } else {
          // Simple data structure
          const labels = sourceData.map(item => item[xField]);
          const values = sourceData.map(item => item[yField]);
          
          return {
            labels,
            datasets: [{
              label: yField,
              data: values,
              backgroundColor: generateColors(labels.length),
              borderColor: config.type.toLowerCase() === 'line' ? generateColors(1, 1)[0] : undefined,
              borderWidth: 1
            }]
          };
        }
      }
      
      default:
        return {
          labels: ['Unsupported Chart Type'],
          datasets: [{
            label: 'Unsupported',
            data: [0],
            backgroundColor: generateColors(1)
          }]
        };
    }
  };
  
  const chartData = processData();
  
  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: config.title,
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      legend: {
        display: true,
        position: 'bottom'
      },
      tooltip: {
        enabled: true
      }
    },
    ...config.options
  };
  
  // Render the appropriate chart type
  switch (config.type.toLowerCase()) {
    case 'bar':
      return (
        <div className="h-80">
          <Bar data={chartData} options={options} />
        </div>
      );
    case 'line':
      return (
        <div className="h-80">
          <Line data={chartData} options={options} />
        </div>
      );
    case 'pie':
      return (
        <div className="h-80">
          <Pie data={chartData} options={options} />
        </div>
      );
    case 'doughnut':
      return (
        <div className="h-80">
          <Doughnut data={chartData} options={options} />
        </div>
      );
    default:
      return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">Unsupported chart type: {config.type}</p>
        </div>
      );
  }
};

// Table renderer for data tables
const TableRenderer = ({ config, data }) => {
  if (!config) return null;
  
  // Check if we have data in the dataMapping
  if (config.dataMapping && config.dataMapping.headers && config.dataMapping.rows) {
    const { headers, rows } = config.dataMapping;
    
    return (
      <div className="overflow-x-auto mb-6">
        <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-purple-50">
            <tr>
              {headers.map((header, index) => (
                <th 
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-purple-50'}>
                  {row.map((cell, cellIndex) => (
                    <td 
                      key={cellIndex}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
                      {cell?.toString() || '—'}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="px-6 py-4 text-center text-sm text-gray-500">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }
  
  // Extract data from the correct source
  const sourceData = data && data[config.dataSource] ? data[config.dataSource] : [];
  
  // Last-resort fallback for tables
  if (!Array.isArray(sourceData) || sourceData.length === 0) {
    const fallbackHeaders = ['Item', 'Value', 'Status'];
    const fallbackRows = [
      ['Project A', '65%', 'In Progress'],
      ['Project B', '100%', 'Completed'],
      ['Project C', '25%', 'Just Started']
    ];
    
    return (
      <div className="overflow-x-auto mb-6">
        <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-purple-50">
            <tr>
              {fallbackHeaders.map((header, index) => (
                <th 
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {fallbackRows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-purple-50'}>
                {row.map((cell, cellIndex) => (
                  <td 
                    key={cellIndex}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  
  // Get columns from the first item or from the configuration
  const columns = config.columns || Object.keys(sourceData[0]);
  
  return (
    <div className="overflow-x-auto mb-6">
      <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-purple-50">
          <tr>
            {columns.map((column, index) => (
              <th 
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sourceData.map((item, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-purple-50'}>
              {columns.map((column, colIndex) => (
                <td 
                  key={colIndex}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {item[column]?.toString() || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Main report renderer component
const ReportRenderer = ({ report }) => {
  const [activeSection, setActiveSection] = useState('overall');
  const [activeDepartment, setActiveDepartment] = useState(null);

  const departments = useMemo(() => {
    if (report?.departmentReports?.length) {
      return report.departmentReports.map(dept => dept.name);
    }
    return [];
  }, [report]);

  // Function to render visualizations for a specific time period
  const renderVisualizations = (visualizations) => {
    if (!visualizations || visualizations.length === 0) {
      return <div className="text-center py-8">No visualizations available for this section</div>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visualizations.map((viz, index) => (
          <div key={index} className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">{viz.title}</h3>
            {renderChart(viz, index)}
          </div>
        ))}
      </div>
    );
  };

  // Function to render a specific chart based on its type
  const renderChart = (visualization, index) => {
    if (!visualization) return null;

    const uniqueId = `chart-${index}-${visualization.type}`;
    const options = {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
        },
        title: {
          display: true,
          text: visualization.title,
        },
      },
    };

    // Parse the data for the chart
    let chartData = {
      labels: visualization.data?.map(item => item.name) || [],
      datasets: [
        {
          label: visualization.title,
          data: visualization.data?.map(item => item.value) || [],
          backgroundColor: getBackgroundColors(visualization.data?.length || 0, visualization.colorScheme),
          borderColor: getBorderColors(visualization.data?.length || 0, visualization.colorScheme),
          borderWidth: 1,
        },
      ],
    };

    // Render different chart types based on visualization.type
    switch (visualization.type) {
      case 'lineChart':
        return <Line data={chartData} options={options} key={uniqueId} />;
      case 'barChart':
        return <Bar data={chartData} options={options} key={uniqueId} />;
      case 'pieChart':
        return <Pie data={chartData} options={options} key={uniqueId} />;
      case 'doughnutChart':
        return <Doughnut data={chartData} options={options} key={uniqueId} />;
      case 'error':
        return <div className="text-red-500">Error: {visualization.message}</div>;
      default:
        return <div className="text-gray-500">Unsupported chart type: {visualization.type}</div>;
    }
  };

  // Helper to generate colors for charts
  const getBackgroundColors = (count, colorScheme) => {
    if (colorScheme && Array.isArray(colorScheme)) {
      return colorScheme;
    }
    
    const defaultColors = [
      'rgba(75, 192, 192, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 99, 132, 0.6)',
      'rgba(255, 206, 86, 0.6)',
      'rgba(153, 102, 255, 0.6)',
      'rgba(255, 159, 64, 0.6)',
      'rgba(199, 199, 199, 0.6)',
      'rgba(83, 102, 255, 0.6)',
      'rgba(40, 159, 64, 0.6)',
      'rgba(210, 199, 199, 0.6)',
    ];
    
    // Repeat colors if needed
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(defaultColors[i % defaultColors.length]);
    }
    return result;
  };

  const getBorderColors = (count, colorScheme) => {
    if (colorScheme && Array.isArray(colorScheme)) {
      return colorScheme.map(color => color.replace('0.6', '1'));
    }
    
    const defaultColors = [
      'rgba(75, 192, 192, 1)',
      'rgba(54, 162, 235, 1)',
      'rgba(255, 99, 132, 1)',
      'rgba(255, 206, 86, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)',
      'rgba(199, 199, 199, 1)',
      'rgba(83, 102, 255, 1)',
      'rgba(40, 159, 64, 1)',
      'rgba(210, 199, 199, 1)',
    ];
    
    // Repeat colors if needed
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(defaultColors[i % defaultColors.length]);
    }
    return result;
  };

  // Function to render formatted content with proper line breaks and styles
  const renderFormattedContent = (content) => {
    if (!content) return null;
    
    // Split content by headings and process each section
    const sections = content.split(/(?=#+\s[A-Z])/);
    
    return sections.map((section, index) => {
      // Process headings
      let processedSection = section.replace(/^(#+)\s(.*)$/gm, (match, hashes, text) => {
        const level = hashes.length;
        if (level === 1) return `<h1 class="text-2xl font-bold mt-6 mb-4">${text}</h1>`;
        if (level === 2) return `<h2 class="text-xl font-bold mt-5 mb-3">${text}</h2>`;
        if (level === 3) return `<h3 class="text-lg font-semibold mt-4 mb-2">${text}</h3>`;
        return `<h4 class="text-md font-semibold mt-3 mb-2">${text}</h4>`;
      });
      
      // Process lists
      processedSection = processedSection.replace(/^(\s*)-\s(.*)$/gm, 
        '<li class="ml-6 list-disc">$2</li>');
      processedSection = processedSection.replace(/^(\s*)\d+\.\s(.*)$/gm, 
        '<li class="ml-6 list-decimal">$2</li>');
      
      // Process paragraphs
      processedSection = processedSection.replace(/^(?!<h|<li)(.+)$/gm, 
        '<p class="my-2">$1</p>');
      
      // Process bold and italic
      processedSection = processedSection.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      processedSection = processedSection.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      
      // Fix consecutive list items
      processedSection = processedSection.replace(/<\/li><li/g, '</li>\n<li');
      
      // Wrap list items in ul/ol
      processedSection = processedSection.replace(/(<li class="ml-6 list-disc">.*<\/li>\n)+/g, 
        '<ul class="my-3">$&</ul>');
      processedSection = processedSection.replace(/(<li class="ml-6 list-decimal">.*<\/li>\n)+/g, 
        '<ol class="my-3">$&</ol>');
      
      return (
        <div 
          key={index} 
          className="mb-4" 
          dangerouslySetInnerHTML={{ __html: processedSection }}
        />
      );
    });
  };

  // If no report is provided, show a placeholder
  if (!report) {
    return (
      <div className="flex justify-center items-center h-96 text-gray-400">
        <p>Select a report to view</p>
      </div>
    );
  }

  return (
    <div className="report-container">
      <div className="report-header mb-6">
        <h1 className="text-3xl font-bold mb-2">{report.reportName}</h1>
        <div className="text-sm text-gray-600">
          Generated: {new Date(report.generatedAt).toLocaleString()}
          {report.wordCount && (
            <span className="ml-4">Word Count: {report.wordCount}</span>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex mb-6 overflow-x-auto pb-2">
        <button
          className={`px-4 py-2 mr-2 rounded-t-lg ${activeSection === 'overall' 
            ? 'bg-purple-600 text-white' 
            : 'bg-gray-200 text-black'}`}
          onClick={() => {
            setActiveSection('overall');
            setActiveDepartment(null);
          }}
        >
          Overall Analysis
        </button>
        <button
          className={`px-4 py-2 mr-2 rounded-t-lg ${activeSection === 'ytd' 
            ? 'bg-purple-600 text-white' 
            : 'bg-gray-200 text-black'}`}
          onClick={() => {
            setActiveSection('ytd');
            setActiveDepartment(null);
          }}
        >
          Year-to-Date
        </button>
        <button
          className={`px-4 py-2 mr-2 rounded-t-lg ${activeSection === 'lastPeriod' 
            ? 'bg-purple-600 text-white' 
            : 'bg-gray-200 text-black'}`}
          onClick={() => {
            setActiveSection('lastPeriod');
            setActiveDepartment(null);
          }}
        >
          Since Last Period
        </button>
        
        {departments.length > 0 && (
          <button
            className={`px-4 py-2 mr-2 rounded-t-lg ${activeSection === 'departments' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-200 text-black'}`}
            onClick={() => {
              setActiveSection('departments');
              setActiveDepartment(null);
            }}
          >
            Department Reports
          </button>
        )}
      </div>

      {/* Department selection (if in department section) */}
      {activeSection === 'departments' && departments.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select Department:</label>
          <select
            className="w-full max-w-xs p-2 border rounded"
            value={activeDepartment || ''}
            onChange={(e) => setActiveDepartment(e.target.value)}
          >
            <option value="">-- Select Department --</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Report Content */}
      <div className="report-content">
        {activeSection === 'overall' && (
          <>
            <div className="mb-8">
              {renderFormattedContent(report.content)}
            </div>
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">Overall Visualizations</h2>
              {renderVisualizations(report.visualizations?.overall)}
            </div>
          </>
        )}
        
        {activeSection === 'ytd' && (
          <>
            <h2 className="text-xl font-bold mb-4">Year-to-Date Analysis</h2>
            {renderVisualizations(report.visualizations?.ytd)}
          </>
        )}
        
        {activeSection === 'lastPeriod' && (
          <>
            <h2 className="text-xl font-bold mb-4">Since Last Period Analysis</h2>
            {renderVisualizations(report.visualizations?.lastPeriod)}
          </>
        )}
        
        {activeSection === 'departments' && activeDepartment && (
          <>
            <h2 className="text-xl font-bold mb-4">{activeDepartment} Department Report</h2>
            {report.departmentReports?.find(dept => dept.name === activeDepartment) ? (
              <>
                <div className="mb-8">
                  {renderFormattedContent(
                    report.departmentReports.find(dept => dept.name === activeDepartment).content
                  )}
                </div>
                <div className="mt-8">
                  <h3 className="text-lg font-bold mb-4">Department Visualizations</h3>
                  {renderVisualizations(
                    report.departmentReports.find(dept => dept.name === activeDepartment).visualizations
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">No report available for this department</div>
            )}
          </>
        )}
        
        {activeSection === 'departments' && !activeDepartment && (
          <div className="text-center py-8">Please select a department to view its report</div>
        )}
      </div>
    </div>
  );
};

export default ReportRenderer; 