"use client";

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FaCalendarAlt, FaFlag, FaShieldAlt } from 'react-icons/fa';
import { useRouter } from 'next/navigation';

interface ProjectDisplayCardProps {
  project: {
    id: string;
    name: string;
    status: 'planning' | 'in-progress' | 'review' | 'completed';
    priority: 'low' | 'medium' | 'high' | 'critical';
    startDate: string;
    endDate?: string;
    department?: string;
    createdByRole?: string;
    isManagementProject?: boolean;
    employees?: any[];
  };
  onClick?: () => void;
}

const StatusColors = {
  'planning': 'bg-blue-100 text-blue-800',
  'in-progress': 'bg-yellow-100 text-yellow-800',
  'review': 'bg-purple-100 text-purple-800',
  'completed': 'bg-green-100 text-green-800'
};

const PriorityColors = {
  'low': 'bg-gray-100 text-gray-800',
  'medium': 'bg-blue-100 text-blue-800',
  'high': 'bg-orange-100 text-orange-800',
  'critical': 'bg-red-100 text-red-800'
};

const ProjectDisplayCard: React.FC<ProjectDisplayCardProps> = ({ project, onClick }) => {
  const router = useRouter();
  
  const { 
    id,
    name,
    status = 'planning',
    priority = 'low',
    startDate,
    endDate,
    department,
    createdByRole,
    isManagementProject,
    employees = []
  } = project;

  console.log(`Rendering card for project: ${name}, Management: ${isManagementProject ? 'YES' : 'NO'}, Role: ${createdByRole || 'unknown'}`);

  // Check if created by management or has a management label
  const isTopManagementCreated = 
    isManagementProject || // Use the dedicated flag if available
    (createdByRole && ['top_management_tier_3', 'top_management_tier_2', 'top_management_tier_1'].includes(createdByRole));
  
  // Check if any employee is both a lead and from management
  const hasManagementLead = Array.isArray(employees) && employees.some(emp => 
    (emp.isLead || emp.role === 'Project Lead' || emp.role === 'Lead') && 
    (emp.role === 'top_management_tier_3' || 
     emp.role === 'top_management_tier_2' || 
     emp.role === 'top_management_tier_1')
  );
  
  // Show the management badge if either condition is true
  const showManagementBadge = isTopManagementCreated || hasManagementLead;

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Normalize status to match our status colors
  const normalizeStatus = (status: string): keyof typeof StatusColors => {
    if (!status) return 'planning';
    
    // Convert to lowercase and handle common variations
    const s = status.toLowerCase();
    
    if (s.includes('plan') || s === 'backlog') return 'planning';
    if (s.includes('progress') || s === 'ongoing' || s === 'in progress' || s === 'active') return 'in-progress';
    if (s.includes('review') || s === 'qa' || s === 'testing') return 'review';
    if (s.includes('complet') || s === 'done' || s === 'finished') return 'completed';
    
    // Default to planning if no match
    return 'planning';
  };
  
  const normalizedStatus = normalizeStatus(status);
  
  // Normalize priority to match our priority colors
  const normalizePriority = (priority: string): keyof typeof PriorityColors => {
    if (!priority) return 'low';
    
    const p = priority.toLowerCase();
    
    if (p.includes('critical') || p.includes('urgent') || p === 'highest') return 'critical';
    if (p.includes('high')) return 'high';
    if (p.includes('med') || p === 'normal') return 'medium';
    if (p.includes('low')) return 'low';
    
    return 'low';
  };
  
  const normalizedPriority = normalizePriority(String(priority));

  // Card class based on whether it's a management project or not
  const cardClass = showManagementBadge 
    ? "hover:shadow-md transition-shadow duration-300 bg-white border-2 border-purple-600"
    : "hover:shadow-md transition-shadow duration-300 bg-white border border-gray-200";

  return (
    <Card className={`${cardClass} flex flex-col min-h-[200px]`}>
      <CardHeader className={showManagementBadge ? "pb-2 bg-white" : "pb-2"}>
        <div className="flex justify-between items-start">
          <div className="flex items-center flex-wrap">
            <CardTitle className="text-lg line-clamp-1 text-gray-900">{name}</CardTitle>
            {showManagementBadge && (
              <Badge className="ml-2 bg-purple-700 text-white text-xs font-semibold flex items-center">
                <FaShieldAlt className="mr-1" /> Management
              </Badge>
            )}
          </div>
          <Badge className={StatusColors[normalizedStatus as keyof typeof StatusColors] || ''}>
            {normalizedStatus === 'in-progress'
              ? 'Ongoing'
              : normalizedStatus
                  .charAt(0)
                  .toUpperCase() + normalizedStatus.slice(1).replace('-', ' ')}
          </Badge>
        </div>
        {department && (
          <div className="text-sm text-gray-600 mb-2">{department}</div>
        )}
      </CardHeader>
      <CardContent className="pb-2 flex-grow">
        <div className="space-y-2">
          <div className="flex items-center text-sm text-gray-700">
            <FaCalendarAlt className="mr-2 text-gray-500" />
            <span>
              {formatDate(startDate)}
              {normalizedStatus === 'completed' && endDate
                ? ` - ${formatDate(endDate)}`
                : ''}
            </span>
          </div>
          
          <div className="flex items-center text-sm text-gray-700">
            <FaFlag className="mr-2 text-gray-500" />
            <span className="mr-1 text-gray-700 font-medium">Priority:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${PriorityColors[normalizedPriority as keyof typeof PriorityColors] || ''}`}>
              {normalizedPriority.charAt(0).toUpperCase() + normalizedPriority.slice(1)}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <div className="flex justify-end w-full space-x-2">
          <Button 
            size="sm" 
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => router.push(`/dashboard/projects/${project.id}`)}
          >
            Open
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProjectDisplayCard; 