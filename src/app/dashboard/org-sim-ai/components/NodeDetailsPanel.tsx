"use client";

import React from 'react';
import { OrgNode } from './OrgSimAIPageContent';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface NodeDetailsPanelProps {
  node: OrgNode | null;
  isOptimized?: boolean;
}

export default function NodeDetailsPanel({ node, isOptimized = false }: NodeDetailsPanelProps) {
  if (!node) {
    return (
      <div className="h-full flex items-center justify-center p-8 border rounded-lg bg-gray-50">
        <p className="text-gray-500 text-center">
          Select a node in the organization chart to view details
        </p>
      </div>
    );
  }

  const workloadColor = 
    node.workload >= 85 ? 'text-red-600' :
    node.workload >= 70 ? 'text-orange-500' :
    node.workload <= 40 ? 'text-blue-600' :
    'text-green-600';

  const workloadBgColor = 
    node.workload >= 85 ? 'bg-red-600' :
    node.workload >= 70 ? 'bg-orange-500' :
    node.workload <= 40 ? 'bg-blue-600' :
    'bg-green-600';

  return (
    <div className="h-full overflow-auto">
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl font-bold">{node.name}</CardTitle>
              <p className="text-sm text-gray-600">{node.role}</p>
            </div>
            {isOptimized && (
              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                AI Optimized
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Workload section */}
          <div>
            <h3 className="text-sm font-medium mb-2">Current Workload</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Capacity Utilization</span>
                <span className={`font-medium ${workloadColor}`}>{node.workload}%</span>
              </div>
              <Progress
                value={node.workload}
                className="h-2"
                indicatorClassName={workloadBgColor}
              />
              <p className="text-xs text-gray-500 mt-1">
                {node.workload >= 85 ? 'Overloaded: Consider redistributing tasks or hiring additional staff.' :
                 node.workload >= 70 ? 'Heavy load: May need attention to prevent burnout.' :
                 node.workload <= 40 ? 'Underutilized: Consider assigning more responsibilities.' :
                 'Optimal workload: Well-balanced capacity utilization.'}
              </p>
            </div>
          </div>

          {/* Skills section */}
          {node.skills && node.skills.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {node.skills.map((skill, i) => (
                  <Badge key={i} variant="secondary" className="bg-gray-100">{skill}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Experience section */}
          {node.experience && (
            <div>
              <h3 className="text-sm font-medium mb-2">Experience</h3>
              <p className="text-sm">{node.experience} years</p>
            </div>
          )}

          {/* Projects section */}
          {node.projects && node.projects.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Projects</h3>
              <ul className="space-y-2">
                {node.projects.map((project, i) => (
                  <li key={i} className="text-sm bg-gray-50 p-2 rounded">
                    <span className="font-medium">{project.name}</span>
                    <span className="mx-2 text-gray-300">•</span>
                    <span className="text-gray-600">{project.allocation}% allocation</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Direct Reports section */}
          {node.children && node.children.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Direct Reports ({node.children.length})</h3>
              <ul className="divide-y">
                {node.children.map((child, i) => (
                  <li key={i} className="py-2">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-sm font-medium">{child.name}</p>
                        <p className="text-xs text-gray-500">{child.role}</p>
                      </div>
                      <Badge variant="outline" className={`
                        ${child.workload >= 85 ? 'bg-red-50 text-red-600 border-red-200' :
                          child.workload >= 70 ? 'bg-orange-50 text-orange-600 border-orange-200' :
                          child.workload <= 40 ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          'bg-green-50 text-green-600 border-green-200'}
                      `}>
                        {child.workload}%
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations section (only for optimized view) */}
          {isOptimized && (
            <div>
              <h3 className="text-sm font-medium mb-2">AI Recommendations</h3>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800">
                <p className="mb-2">
                  {node.workload >= 85 ? 'This role is currently overloaded. Consider:' :
                   node.workload >= 70 ? 'This role has a heavy workload. Consider:' :
                   node.workload <= 40 ? 'This role is underutilized. Consider:' :
                   'This role has an optimal workload after adjustments:'}
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {node.workload >= 85 && (
                    <>
                      <li>Delegating tasks to team members with capacity</li>
                      <li>Hiring additional support staff</li>
                      <li>Temporarily reducing project scope</li>
                    </>
                  )}
                  {node.workload >= 70 && node.workload < 85 && (
                    <>
                      <li>Redistributing some responsibilities</li>
                      <li>Reviewing priority of current projects</li>
                      <li>Monitoring for signs of burnout</li>
                    </>
                  )}
                  {node.workload <= 40 && (
                    <>
                      <li>Assigning additional responsibilities</li>
                      <li>Providing mentoring opportunities</li>
                      <li>Considering for cross-functional projects</li>
                    </>
                  )}
                  {node.workload > 40 && node.workload < 70 && (
                    <>
                      <li>Maintaining current workload distribution</li>
                      <li>Regular check-ins to ensure continued balance</li>
                      <li>Optimal team utilization achieved</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 