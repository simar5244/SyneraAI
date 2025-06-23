"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

interface ChartNode {
  id: string;
  name: string;
  role: string;
  tier: number;
  avatar_url: string | null;
  workload_hours: number;
  stress_level: number;
  stress_intensity: string;
  children: ChartNode[];
}

interface OrgChartProps {
  orgChart: {
    root_nodes: ChartNode[];
    stress_zones: Record<string, string[]>;
  };
  onSelectUser: (user: ChartNode) => void;
  selectedUser: ChartNode | null;
}

const OrgChartVisualizer = ({ orgChart, onSelectUser, selectedUser }: OrgChartProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 600 });

  useEffect(() => {
    if (svgRef.current && orgChart) {
      const containerWidth = svgRef.current.parentElement?.clientWidth || 800;
      setDimensions({ width: containerWidth, height: 600 });
      renderChart();
    }
  }, [orgChart, dimensions, selectedUser, renderChart]);

  const getStressColor = useCallback((intensity: string) => {
    switch (intensity) {
      case "light-blue": return "#63B3ED";
      case "blue": return "#3182CE";
      case "deep-blue": return "#2C5282";
      case "light-orange": return "#FBD38D";
      case "orange": return "#ED8936";
      case "deep-orange": return "#C05621";
      case "red": return "#E53E3E";
      default: return "#A0AEC0"; // none/neutral
    }
  }, []);

  const renderChart = useCallback(() => {
    if (!svgRef.current || !orgChart || !orgChart.root_nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 50, right: 20, bottom: 50, left: 20 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    const g = svg
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create a hierarchical structure for d3
    const hierarchy = d3.hierarchy({
      id: "root",
      name: "Organization",
      children: orgChart.root_nodes
    });

    // Create tree layout
    const treeLayout = d3.tree().size([width, height]);
    const treeData = treeLayout(hierarchy);

    // Create links
    g.selectAll(".link")
      .data(treeData.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d3.linkVertical()
        .x((d: any) => d.x)
        .y((d: any) => d.y)
      )
      .attr("fill", "none")
      .attr("stroke", "#CBD5E0")
      .attr("stroke-width", 1.5);

    // Create nodes
    const nodes = g.selectAll(".node")
      .data(treeData.descendants().slice(1)) // Skip root
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
      .on("click", (event, d: any) => {
        onSelectUser(d.data);
        event.stopPropagation();
      });

    // Add node circles
    nodes.append("circle")
      .attr("r", 25)
      .attr("fill", (d: any) => getStressColor(d.data.stress_intensity))
      .attr("stroke", (d: any) => selectedUser && d.data.id === selectedUser.id ? "#3182CE" : "#CBD5E0")
      .attr("stroke-width", (d: any) => selectedUser && d.data.id === selectedUser.id ? 3 : 1);

    // Add name labels
    nodes.append("text")
      .attr("dy", 40)
      .attr("text-anchor", "middle")
      .text((d: any) => d.data.name?.split(" ")[0] || "Unknown")
      .attr("fill", "#2D3748")
      .attr("font-size", "12px");

    // Add role labels
    nodes.append("text")
      .attr("dy", 55)
      .attr("text-anchor", "middle")
      .text((d: any) => d.data.role || "")
      .attr("fill", "#718096")
      .attr("font-size", "10px");
  }, [svgRef, orgChart, dimensions, selectedUser, onSelectUser, getStressColor]);

  if (!orgChart || !orgChart.root_nodes.length) {
    return <div className="text-center p-6">No organization data available.</div>;
  }

  return (
    <div className="relative">
      <svg ref={svgRef} className="w-full overflow-auto"></svg>
      <div className="mt-4 flex justify-center flex-wrap gap-3">
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 rounded-full mr-2 bg-gray-400"></span>
          <span className="text-xs">Normal</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 rounded-full mr-2 bg-blue-300"></span>
          <span className="text-xs">Underworked (Light)</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 rounded-full mr-2 bg-blue-500"></span>
          <span className="text-xs">Underworked (Medium)</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 rounded-full mr-2 bg-blue-800"></span>
          <span className="text-xs">Underworked (Heavy)</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 rounded-full mr-2 bg-orange-300"></span>
          <span className="text-xs">Overworked (Light)</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 rounded-full mr-2 bg-orange-500"></span>
          <span className="text-xs">Overworked (Medium)</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 rounded-full mr-2 bg-orange-700"></span>
          <span className="text-xs">Overworked (Heavy)</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 rounded-full mr-2 bg-red-500"></span>
          <span className="text-xs">Critical Overwork</span>
        </div>
      </div>
      {selectedUser && (
        <div className="mt-4 p-3 bg-gray-50 border rounded-md">
          <h3 className="font-medium text-sm">Selected: {selectedUser.name}</h3>
          <p className="text-xs text-gray-600">{selectedUser.role} · Workload: {selectedUser.workload_hours.toFixed(1)} hours</p>
        </div>
      )}
    </div>
  );
};

export default OrgChartVisualizer; 