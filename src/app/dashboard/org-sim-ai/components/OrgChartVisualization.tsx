"use client";

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { OrgNode } from './OrgSimAIPageContent';

interface OrgChartVisualizationProps {
  data: OrgNode;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export default function OrgChartVisualization({ 
  data, 
  selectedNodeId, 
  onSelectNode 
}: OrgChartVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    // Get container dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    // Create d3 hierarchy
    const root = d3.hierarchy(data);
    
    // Calculate tree layout
    const treeLayout = d3.tree<OrgNode>()
      .size([containerWidth - 100, containerHeight - 80]);
    
    treeLayout(root);
    
    // Create SVG canvas
    const svg = d3.select(svgRef.current)
      .attr("width", containerWidth)
      .attr("height", containerHeight)
      .append("g")
      .attr("transform", "translate(40, 40)");
    
    // Create links between nodes
    svg.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d3.linkHorizontal()
        .x((d: any) => d.y) // Swap x and y for horizontal layout
        .y((d: any) => d.x)
      )
      .style("fill", "none")
      .style("stroke", "#ccc")
      .style("stroke-width", 1.5);
    
    // Create node groups
    const nodeGroup = svg.selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => `translate(${d.y}, ${d.x})`)
      .style("cursor", "pointer")
      .on("click", (event, d: any) => {
        event.stopPropagation();
        onSelectNode(d.data.id);
      });
    
    // Add node rectangles
    nodeGroup.append("rect")
      .attr("x", -70)
      .attr("y", -30)
      .attr("width", 140)
      .attr("height", 60)
      .attr("rx", 5)
      .attr("ry", 5)
      .style("fill", (d: any) => {
        // Colors based on workload
        if (d.data.workload >= 85) return "#fecaca"; // Red for high workload
        if (d.data.workload >= 70) return "#fed7aa"; // Orange for medium-high
        if (d.data.workload <= 40) return "#bfdbfe"; // Blue for low
        return "#d1fae5"; // Green for optimal
      })
      .style("stroke", (d: any) => d.data.id === selectedNodeId ? "#000" : "#888")
      .style("stroke-width", (d: any) => d.data.id === selectedNodeId ? 3 : 1)
      .style("filter", (d: any) => d.data.id === selectedNodeId ? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" : "none");
    
    // Add name text
    nodeGroup.append("text")
      .attr("dy", "-10")
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .text((d: any) => d.data.name);
    
    // Add role text
    nodeGroup.append("text")
      .attr("dy", "10")
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#555")
      .text((d: any) => d.data.role);
    
    // Add workload text
    nodeGroup.append("text")
      .attr("dy", "25")
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("font-weight", "500")
      .style("fill", (d: any) => {
        if (d.data.workload >= 85) return "#991b1b"; // Dark red
        if (d.data.workload >= 70) return "#9a3412"; // Dark orange
        if (d.data.workload <= 40) return "#1e40af"; // Dark blue
        return "#047857"; // Dark green
      })
      .text((d: any) => `${d.data.workload}% Workload`);

    // Add click handler to reset selection when clicking outside nodes
    d3.select(svgRef.current).on("click", () => {
      onSelectNode("");
    });
    
  }, [data, selectedNodeId, onSelectNode]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-auto">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
} 