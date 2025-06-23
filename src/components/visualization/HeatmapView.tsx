import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Employee } from '@/types/employee';
import { Department } from '@/types/department';

interface HeatmapData {
  department: string;
  seniorityLevel: string;
  count: number;
}

interface HeatmapCellProps {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  data: HeatmapData;
  onMouseEnter: (event: React.MouseEvent, data: HeatmapData) => void;
  onMouseLeave: () => void;
}

const HeatmapCell: React.FC<HeatmapCellProps> = ({
  x, y, width, height, fill, data, onMouseEnter, onMouseLeave
}) => {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      stroke="#fff"
      strokeWidth={1}
      onMouseEnter={(e) => onMouseEnter(e, data)}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer' }}
    />
  );
};

const HeatmapView: React.FC = () => {
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [seniorityLevels, setSeniorityLevels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean, x: number, y: number, data: HeatmapData | null }>({
    visible: false,
    x: 0,
    y: 0,
    data: null
  });

  const svgRef = useRef<SVGSVGElement>(null);

  // Mock data for demonstration
  useEffect(() => {
    try {
      setIsLoading(true);
      
      // Mock departments and seniority levels
      const mockDepartments = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'Customer Success', 'Finance', 'HR'];
      const mockSeniorityLevels = ['Junior', 'Mid-level', 'Senior', 'Lead', 'Manager', 'Director', 'VP'];
      
      // Generate mock heatmap data
      const mockData: HeatmapData[] = [];
      mockDepartments.forEach(department => {
        mockSeniorityLevels.forEach(level => {
          // Create a random distribution that makes sense
          // More juniors and mid-levels, fewer senior roles
          let count;
          if (level === 'Junior' || level === 'Mid-level') {
            count = Math.floor(Math.random() * 20) + 5; // 5-25 employees
          } else if (level === 'Senior') {
            count = Math.floor(Math.random() * 15) + 3; // 3-18 employees
          } else if (level === 'Lead' || level === 'Manager') {
            count = Math.floor(Math.random() * 8) + 1; // 1-9 employees
          } else {
            count = Math.floor(Math.random() * 3) + 1; // 1-4 employees for Director/VP
          }
          
          mockData.push({
            department,
            seniorityLevel: level,
            count
          });
        });
      });
      
      setDepartments(mockDepartments);
      setSeniorityLevels(mockSeniorityLevels);
      setHeatmapData(mockData);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading heatmap data:', err);
      setError('Failed to load employee distribution data.');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading || !heatmapData.length || !svgRef.current) return;

    const margin = { top: 50, right: 50, bottom: 100, left: 150 };
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3.scaleBand()
      .range([0, width])
      .domain(seniorityLevels)
      .padding(0.05);

    const y = d3.scaleBand()
      .range([0, height])
      .domain(departments)
      .padding(0.05);

    // Find min and max counts for color scaling
    const minCount = d3.min(heatmapData, d => d.count) || 0;
    const maxCount = d3.max(heatmapData, d => d.count) || 1;

    // Color scale
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([minCount, maxCount]);

    // Add X axis
    svg.append('g')
      .style('font-size', '12px')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(0))
      .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');

    // Add Y axis
    svg.append('g')
      .style('font-size', '12px')
      .call(d3.axisLeft(y).tickSize(0));

    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -20)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text('Employee Distribution by Department and Seniority');

    // Create React heatmap cells
    const handleMouseEnter = (event: React.MouseEvent, data: HeatmapData) => {
      setTooltip({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        data
      });
    };

    const handleMouseLeave = () => {
      setTooltip({ ...tooltip, visible: false });
    };

    // Render heatmap cells using React
    const cells = heatmapData.map((d, i) => {
      const xPos = x(d.seniorityLevel) || 0;
      const yPos = y(d.department) || 0;
      
      return (
        <HeatmapCell
          key={`${d.department}-${d.seniorityLevel}`}
          x={xPos}
          y={yPos}
          width={x.bandwidth()}
          height={y.bandwidth()}
          fill={colorScale(d.count)}
          data={d}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      );
    });

    // Create the React elements for the heatmap cells
    const heatmapGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.node()?.appendChild(heatmapGroup);

    // Let React handle cell rendering
    const reactRoot = d3.select(heatmapGroup);
    
    // Add X axis label
    svg.append('text')
      .attr('transform', `translate(${width/2}, ${height + 60})`)
      .style('text-anchor', 'middle')
      .text('Seniority Level');

    // Add Y axis label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 80)
      .attr('x', -(height / 2))
      .style('text-anchor', 'middle')
      .text('Department');

    // Add color legend
    const legendWidth = 20;
    const legendHeight = height / 2;
    
    const legend = svg.append('g')
      .attr('transform', `translate(${width + 20}, ${height/4})`);
    
    // Legend gradient
    const defs = svg.append('defs');
    const linearGradient = defs.append('linearGradient')
      .attr('id', 'linear-gradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');
    
    linearGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', colorScale(minCount));
    
    linearGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', colorScale(maxCount));
    
    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#linear-gradient)');
    
    const legendScale = d3.scaleLinear()
      .domain([minCount, maxCount])
      .range([legendHeight, 0]);
    
    const legendAxis = d3.axisRight(legendScale)
      .ticks(5);
    
    legend.append('g')
      .attr('transform', `translate(${legendWidth}, 0)`)
      .call(legendAxis);

    // Add legend title
    legend.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -10)
      .style('text-anchor', 'middle')
      .text('Count');
      
  }, [isLoading, heatmapData, departments, seniorityLevels, tooltip]);

  if (isLoading) {
    return <div className="text-center p-4">Loading employee distribution...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">Error: {error}</div>;
  }

  return (
    <div className="relative bg-gray-800 p-4 rounded-lg shadow-lg">
      <svg ref={svgRef}></svg>
      {tooltip.visible && tooltip.data && (
        <div
          className="absolute bg-gray-900 text-white p-2 rounded shadow-md text-sm pointer-events-none"
          style={{ left: `${tooltip.x + 10}px`, top: `${tooltip.y + 10}px` }}
        >
          <p><strong>Department:</strong> {tooltip.data.department}</p>
          <p><strong>Seniority:</strong> {tooltip.data.seniorityLevel}</p>
          <p><strong>Count:</strong> {tooltip.data.count}</p>
        </div>
      )}
    </div>
  );
};

export default HeatmapView;

// React component to render cells inside SVG
interface HeatmapCellsProps {
  data: HeatmapData[];
  xScale: d3.ScaleBand<string>;
  yScale: d3.ScaleBand<string>;
  colorScale: d3.ScaleSequential<string, never>;
  onMouseEnter: (event: React.MouseEvent, data: HeatmapData) => void;
  onMouseLeave: () => void;
}

const HeatmapCells: React.FC<HeatmapCellsProps> = ({
  data,
  xScale,
  yScale,
  colorScale,
  onMouseEnter,
  onMouseLeave
}) => {
  return (
    <g>
      {data.map((d) => (
        <HeatmapCell
          key={`${d.department}-${d.seniorityLevel}`}
          x={xScale(d.seniorityLevel) || 0}
          y={yScale(d.department) || 0}
          width={xScale.bandwidth()}
          height={yScale.bandwidth()}
          fill={colorScale(d.count)}
          data={d}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      ))}
    </g>
  );
}; 