"use client";

import React, { useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";

interface OrgNode {
  id: string;
  name: string;
  role: string;
  workload: number;
  children: OrgNode[];
}

interface WorkloadDistributionPanelProps {
  orgData: OrgNode;
  selectedUserId?: string;
  onSelectUser: (userId: string) => void;
}

export default function WorkloadDistributionPanel({
  orgData,
  selectedUserId,
  onSelectUser
}: WorkloadDistributionPanelProps) {
  // Flatten the org tree to get all employees
  const allEmployees = useMemo(() => {
    const flatten = (node: OrgNode, result: OrgNode[] = []): OrgNode[] => {
      result.push(node);
      if (node.children) {
        node.children.forEach(child => flatten(child, result));
      }
      return result;
    };
    
    return flatten(orgData);
  }, [orgData]);
  
  // Sort employees by workload in descending order
  const sortedByWorkload = useMemo(() => {
    return [...allEmployees].sort((a, b) => b.workload - a.workload);
  }, [allEmployees]);
  
  // Get overloaded and underutilized employees
  const overloadedEmployees = useMemo(() => 
    sortedByWorkload.filter(emp => emp.workload >= 85), 
    [sortedByWorkload]
  );
  
  const underutilizedEmployees = useMemo(() => 
    sortedByWorkload.filter(emp => emp.workload < 40), 
    [sortedByWorkload]
  );
  
  // Calculate distribution statistics
  const stats = useMemo(() => {
    const workloads = allEmployees.map(emp => emp.workload);
    const totalWorkload = workloads.reduce((sum, val) => sum + val, 0);
    const avgWorkload = totalWorkload / workloads.length;
    
    const overloadedCount = workloads.filter(w => w >= 85).length;
    const overloadedPercentage = (overloadedCount / workloads.length) * 100;
    
    const underutilizedCount = workloads.filter(w => w < 40).length;
    const underutilizedPercentage = (underutilizedCount / workloads.length) * 100;
    
    return {
      avgWorkload: avgWorkload.toFixed(1),
      overloadedCount,
      overloadedPercentage: overloadedPercentage.toFixed(1),
      underutilizedCount,
      underutilizedPercentage: underutilizedPercentage.toFixed(1)
    };
  }, [allEmployees]);
  
  // Generate a single workload problem insight
  const workloadInsight = useMemo(() => {
    if (overloadedEmployees.length > 0 && underutilizedEmployees.length > 0) {
      return "Opportunity to redistribute work from overloaded to underutilized team members";
    } 
    else if (overloadedEmployees.length > 0) {
      return "Consider hiring additional staff to reduce workload on overloaded employees";
    }
    else if (underutilizedEmployees.length > 0) {
      return "Consider assigning more responsibilities to underutilized employees";
    }
    return "Workload appears to be well-distributed across the organization";
  }, [overloadedEmployees, underutilizedEmployees]);
  
  return (
    <div>
      <h3 className="text-lg font-medium mb-3">Workload Distribution</h3>
      
      {/* Summary Statistics */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-50 p-2 rounded-lg text-center">
          <div className="text-sm text-gray-500">Avg Workload</div>
          <div className="text-xl font-medium">{stats.avgWorkload}%</div>
        </div>
        <div className="bg-red-50 p-2 rounded-lg text-center">
          <div className="text-sm text-gray-500">Overloaded</div>
          <div className="text-xl font-medium text-red-700">
            {stats.overloadedCount} 
            <span className="text-sm">({stats.overloadedPercentage}%)</span>
          </div>
        </div>
        <div className="bg-blue-50 p-2 rounded-lg text-center">
          <div className="text-sm text-gray-500">Underutilized</div>
          <div className="text-xl font-medium text-blue-700">
            {stats.underutilizedCount}
            <span className="text-sm">({stats.underutilizedPercentage}%)</span>
          </div>
        </div>
      </div>
      
      {/* Insight */}
      <div className="bg-amber-50 p-3 rounded-lg mb-4">
        <div className="text-sm text-amber-800">
          <span className="font-medium">AI Insight:</span> {workloadInsight}
        </div>
      </div>
      
      {/* Top Overloaded Employees */}
      {overloadedEmployees.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2 flex items-center">
            <ChevronDownIcon className="mr-1 text-red-600" />
            Top Overloaded Employees
          </h4>
          <div className="space-y-2">
            {overloadedEmployees.slice(0, 3).map(emp => (
              <div 
                key={emp.id}
                className={`p-2 rounded-lg border ${selectedUserId === emp.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                onClick={() => onSelectUser(emp.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm">{emp.name}</div>
                    <div className="text-xs text-gray-500">{emp.role}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-700">{emp.workload}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Most Underutilized Employees */}
      {underutilizedEmployees.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2 flex items-center">
            <ChevronUpIcon className="mr-1 text-blue-600" />
            Most Underutilized Employees
          </h4>
          <div className="space-y-2">
            {underutilizedEmployees.slice(0, 3).map(emp => (
              <div 
                key={emp.id}
                className={`p-2 rounded-lg border ${selectedUserId === emp.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                onClick={() => onSelectUser(emp.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm">{emp.name}</div>
                    <div className="text-xs text-gray-500">{emp.role}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-700">{emp.workload}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 