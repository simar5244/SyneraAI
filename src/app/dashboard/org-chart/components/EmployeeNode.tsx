import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Badge } from "@/components/ui/badge";
import { FaStar, FaStarHalfAlt, FaRegStar } from 'react-icons/fa';

// Import utility functions
import { departmentColors, getUtilizationColor, getUtilizationCategory, getUtilizationBadgeClass } from '../utils/colorUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

// Get contrasting text color for a background color
const getTextColor = (bgColor: string): string => {
  // Simple algorithm to determine if text should be white or black based on background
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#ffffff';
};

// Get department color from department name
const getDepartmentColor = (department: string): string => {
  return departmentColors[department as keyof typeof departmentColors] || departmentColors['Unassigned'];
};

// Determine department from job title if needed
const getDepartmentFromTitle = (title: string, defaultDept: string): string => {
  const title_lower = title.toLowerCase();
  
  if (title_lower.includes('engineering') || title_lower.includes('developer')) {
    return 'Engineering';
  } else if (title_lower.includes('sales') || title_lower.includes('account')) {
    return 'Sales';
  } else if (title_lower.includes('marketing')) {
    return 'Marketing';
  } else if (title_lower.includes('product') || title_lower.includes('design')) {
    return 'Product';
  } else if (title_lower.includes('hr') || title_lower.includes('human resources')) {
    return 'HR';
  } else if (title_lower.includes('finance') || title_lower.includes('accounting')) {
    return 'Finance';
  }
  
  return defaultDept;
};

// Map utilization scores to color classes
const getUtilizationColorClass = (category: string): string => {
  switch (category) {
    case 'critical': return 'bg-red-600';
    case 'very-high': return 'bg-red-500';
    case 'high': return 'bg-red-400';
    case 'above-optimal': return 'bg-orange-400';
    case 'optimal': return 'bg-green-500';
    case 'moderate': return 'bg-blue-300';
    case 'low': return 'bg-blue-400';
    case 'very-low': return 'bg-blue-500';
    case 'minimal': return 'bg-blue-600';
    default: return 'bg-gray-400';
  }
};

// Render star rating based on feedback metrics
const StarRating = ({ rating = 0 }: { rating: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return (
    <div className="flex items-center">
      {[...Array(fullStars)].map((_, i) => (
        <FaStar key={`full-${i}`} className="text-yellow-400 text-xs" />
      ))}
      {hasHalfStar && <FaStarHalfAlt className="text-yellow-400 text-xs" />}
      {[...Array(emptyStars)].map((_, i) => (
        <FaRegStar key={`empty-${i}`} className="text-yellow-400 text-xs" />
      ))}
    </div>
  );
};

// Types for the node data
export interface EmployeeNodeData {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  email?: string;
  department?: string;
  imageUrl?: string;
  role?: string;
  utilization?: {
    score: number;
    category?: string;
    pendingAnalysis?: boolean;
  };
  attritionRisk?: string;
  jobResponsibilities?: Array<{
    duty?: string;
    description?: string;
    name?: string;
    redistributed?: boolean;
    intensity?: number;
    hours_per_week?: number;
  }>;
  redistributionData?: {
    isSuccessor?: boolean;
    receivedDuties?: number;
    utilScoreAfterRedistribution?: number;
  };
  feedbackMetrics?: {
    given?: {
      count?: number;
      averageRating?: number;
    };
    received?: {
      count?: number;
      averageRating?: number;
      weightedAverageRating?: number;
    };
  };
  calculatedUtilization?: {
    score: number;
    category?: string;
    pendingAnalysis?: boolean;
  };
  calculatedAttritionRisk?: string;
  isDeleted?: boolean;
  [key: string]: any; // Allow for other properties
}

// Add a visual indicator for nodes that have received redistributed duties
const RedistributedDutiesBadge = ({ count }: { count: number }) => {
  if (!count) return null;
  
  return (
    <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
      +{count}
    </div>
  );
};

const EmployeeNode = ({ data, isConnectable }: NodeProps<EmployeeNodeData>) => {
  const [expanded, setExpanded] = useState(false);
  
  // If the employee has role superadmin, don't render
  if (data.role === 'superadmin') {
    return null;
  }
  
  // Extract needed properties from data
  const {
    firstName = '',
    lastName = '',
    jobTitle = '',
    email = '',
    department = 'Unassigned',
    imageUrl,
    utilization,
    attritionRisk,
    jobResponsibilities = [],
    redistributionData,
    feedbackMetrics,
    calculatedUtilization,
    calculatedAttritionRisk,
    isDeleted
  } = data;
  
  // Count redistributed duties
  const redistributedDutiesCount = jobResponsibilities.filter(duty => duty.redistributed).length || 0;
  
  // Determine if this node received duties during redistribution
  const receivedRedistributedDuties = Boolean(redistributionData?.isSuccessor && redistributionData?.receivedDuties && redistributionData.receivedDuties > 0);
  
  // Toggle expanded state
  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };
  
  // Format department color
  const departmentColor = getDepartmentColor(department);
  
  // For display purposes
  const displayName = `${firstName} ${lastName}`.trim() || email || 'Employee';
  
  // Check if job title indicates this is a management position
  const isManagement = jobTitle.toLowerCase().includes('manager') || 
    jobTitle.toLowerCase().includes('director') || 
    jobTitle.toLowerCase().includes('chief') ||
    jobTitle.toLowerCase().includes('head of');
  
  // Get utilization percentage and color coding  
  const getUtilizationStyles = () => {
    if (!utilization || utilization.score === undefined) return {};
    
    const { score } = utilization;
    
    // Color code based on utilization
    if (score > 0.9) {
      // Overutilized - red tint
      return {
        backgroundColor: 'rgba(254, 226, 226, 0.9)',
        border: '1px solid rgba(220, 38, 38, 0.5)'
      };
    } else if (score < 0.5) {
      // Underutilized - blue tint
      return {
        backgroundColor: 'rgba(219, 234, 254, 0.9)',
        border: '1px solid rgba(37, 99, 235, 0.5)'
      };
    }
    
    // Optimal - no special styling
    return {};
  };
  
  // Determine role type and border style for the card
  const roleTypeColor = isManagement ? 'bg-gray-800' : `bg-[${departmentColor}]`;
  
  // Determine border styling for redistribution recipients
  const redistributionBorderStyle = receivedRedistributedDuties 
    ? { border: '2px solid #9333ea', boxShadow: '0 0 8px rgba(147, 51, 234, 0.4)' } 
    : {};
  
  // Combined styles
  const combinedStyles = {
    ...getUtilizationStyles(),
    ...redistributionBorderStyle,
  };
  
  // Get attrition risk color
  const getAttritionRiskColor = () => {
    if (!attritionRisk) return 'bg-gray-100 text-gray-800';
    
    switch(attritionRisk.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get feedback rating if available
  const getFeedbackRating = () => {
    if (feedbackMetrics?.received?.averageRating) {
      return feedbackMetrics.received.averageRating;
    }
    return 0;
  };
  
  // Count job duties from various possible sources
  const getJobDutiesCount = () => {
    if (data.jobResponsibilities && data.jobResponsibilities.length > 0) {
      return data.jobResponsibilities.length;
    }
    if (data.jobDuties && data.jobDuties.length > 0) {
      return data.jobDuties.length;
    }
    return 0;
  };
  
  // Ensure all cards have consistent dimensions
  const cardStyles = {
    width: '280px',
    height: '220px',
    minWidth: '280px',
    minHeight: '220px',
    maxWidth: '280px',
    maxHeight: '220px',
    ...combinedStyles
  };

  // Get utilization badge class for visual display
  const getUtilizationBadgeClass = (score: number) => {
    if (score > 0.9) return 'bg-blue-100 text-blue-800';
    if (score < 0.5) return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  // Debug log to verify data
  console.log(`Node ${data.id || data.email}: `, {
    utilization: utilization?.score,
    calculatedUtilization: calculatedUtilization?.score,
    jobDuties: getJobDutiesCount()
  });

  // Determine which utilization score to display
  const displayedUtilization = calculatedUtilization || utilization;
  const utilizationScore = displayedUtilization?.score || 0.5;
  const utilizationCategory = displayedUtilization?.category || 'medium';
  
  // Determine which attrition risk to display
  const displayedAttritionRisk = calculatedAttritionRisk || attritionRisk || 'medium';
  
  // Format utilization score as percentage
  const formattedUtilization = `${Math.round(utilizationScore * 100)}%`;
  
  // Get color classes based on utilization score
  const getUtilizationColorClass = (score: number) => {
    if (score <= 0.33) return 'text-red-500';
    if (score <= 0.66) return 'text-yellow-500';
    return 'text-green-500';
  };
  
  // Get color classes based on attrition risk
  const getAttritionColorClass = (risk: string) => {
    if (risk === 'high') return 'text-red-500';
    if (risk === 'medium') return 'text-yellow-500';
    return 'text-green-500';
  };
  
  // Render stars based on utilization score
  const renderUtilizationStars = (score: number) => {
    const fullStars = Math.floor(score * 5);
    const hasHalfStar = score * 5 - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <div className="flex">
        {[...Array(fullStars)].map((_, i) => (
          <FaStar key={`full-${i}`} className="text-yellow-500" />
        ))}
        {hasHalfStar && <FaStarHalfAlt className="text-yellow-500" />}
        {[...Array(emptyStars)].map((_, i) => (
          <FaRegStar key={`empty-${i}`} className="text-gray-300" />
        ))}
      </div>
    );
  };
  
  // Node border style based on deletion status
  const nodeBorderClass = isDeleted 
    ? 'border-2 border-red-500' 
    : 'border border-gray-200';

  return (
    <>
      {/* Top handle - bigger and more visible */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-6 h-6 bg-blue-500 border-2 border-white"
        style={{ top: -10, borderRadius: '50%', boxShadow: '0 0 5px rgba(0, 0, 0, 0.3)', zIndex: 10 }}
        isConnectable={isConnectable}
      />

      <div 
        className={`bg-white rounded-md shadow-md p-3 relative ${nodeBorderClass}`}
        style={cardStyles}
      >
        {/* Role type indicator (top bar) */}
        <div 
          className={`absolute top-0 left-0 right-0 h-2 rounded-t-md ${roleTypeColor}`}
        ></div>
        
        {/* Show badge for redistribution */}
        {redistributedDutiesCount > 0 && (
          <RedistributedDutiesBadge count={redistributedDutiesCount} />
        )}
        
        <div className="flex items-center mb-2 pl-2 mt-1">
          {/* Avatar/Image */}
          <div className="mr-3">
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt={`${firstName} ${lastName}`} 
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg uppercase">
                {firstName?.[0] || ''}
                {lastName?.[0] || ''}
              </div>
            )}
          </div>
          
          {/* Name and title */}
          <div className="flex-grow overflow-hidden">
            <div className="font-semibold text-gray-800 truncate">
              {firstName} {lastName}
            </div>
            <div className="text-gray-600 text-sm truncate">
              {jobTitle || 'Employee'}
            </div>
          </div>
        </div>
        
        {/* Department */}
        <div className="text-xs text-gray-600 truncate mb-2 pl-2">
          {department || 'Department: N/A'}
        </div>
        
        {/* Metrics Section */}
        <div className="border-t border-gray-200 pt-2 mt-1">
          {/* Utilization Scores */}
          <div className="grid grid-cols-2 gap-1 mb-2">
            {/* Comprehensive Utilization */}
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium text-gray-500">Comp. Util:</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${utilization?.score !== undefined ? getUtilizationBadgeClass(utilization.score) : 'bg-gray-100'}`}>
                      {utilization?.score !== undefined 
                        ? `${Math.round(utilization.score * 100)}%` 
                        : 'N/A'}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]" align="end" side="bottom">
                    <div className="space-y-2">
                      <div className="font-semibold">Comprehensive Utilization Score</div>
                      <div>Value: {utilization?.score ? Math.round(utilization.score * 100) : 'N/A'}%</div>
                      <div>Status: {utilization?.score ? getUtilizationCategory(utilization.score) : 'N/A'}</div>
                      <div className="text-xs text-gray-500 flex items-center">
                        <Info className="w-3 h-3 mr-1" />
                        <span>Pre-loaded from database analysis</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {/* Raw Utilization (from real-time calculation) */}
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium text-gray-500">Raw Util:</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${calculatedUtilization?.score !== undefined ? getUtilizationBadgeClass(calculatedUtilization.score) : 'bg-gray-100'}`}>
                      {calculatedUtilization?.score !== undefined 
                        ? `${Math.round(calculatedUtilization.score * 100)}%` 
                        : 'N/A'}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]" align="end" side="bottom">
                    <div className="space-y-2">
                      <div className="font-semibold">Raw Utilization Score</div>
                      <div>Value: {calculatedUtilization?.score ? Math.round(calculatedUtilization.score * 100) : 'N/A'}%</div>
                      <div className="text-xs text-gray-500 flex items-center">
                        <Info className="w-3 h-3 mr-1" />
                        <span>Calculated in real-time from {getJobDutiesCount()} job duties</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          {/* Attrition Risk Scores */}
          <div className="grid grid-cols-2 gap-1">
            {/* Comprehensive Attrition Risk */}
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium text-gray-500">Comp. Risk:</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${getAttritionRiskColor()}`}>
                      {attritionRisk 
                        ? `${attritionRisk.charAt(0).toUpperCase() + attritionRisk.slice(1)}` 
                        : 'N/A'}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]" align="end" side="bottom">
                    <div className="space-y-2">
                      <div className="font-semibold">Comprehensive Attrition Risk</div>
                      <div>Level: {attritionRisk ? attritionRisk.charAt(0).toUpperCase() + attritionRisk.slice(1) : 'N/A'}</div>
                      {attritionRisk && (
                        <div className="text-sm">
                          {attritionRisk === 'high' 
                            ? 'High risk of employee turnover. Consider workload adjustments and career development opportunities.'
                            : attritionRisk === 'medium'
                            ? 'Moderate risk of turnover. Monitor workload and engagement.'
                            : 'Low risk of turnover. Employee appears to be in a good position.'}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 flex items-center">
                        <Info className="w-3 h-3 mr-1" />
                        <span>Pre-loaded from database analysis</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {/* Raw Attrition Risk */}
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium text-gray-500">Raw Risk:</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${calculatedAttritionRisk ? 
                      (calculatedAttritionRisk === 'high' ? 'bg-red-100 text-red-800' : 
                       calculatedAttritionRisk === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                       'bg-green-100 text-green-800') : 'bg-gray-100 text-gray-800'}`}>
                      {calculatedAttritionRisk 
                        ? `${calculatedAttritionRisk.charAt(0).toUpperCase() + calculatedAttritionRisk.slice(1)}` 
                        : 'N/A'}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]" align="end" side="bottom">
                    <div className="space-y-2">
                      <div className="font-semibold">Raw Attrition Risk</div>
                      <div>Level: {calculatedAttritionRisk ? calculatedAttritionRisk.charAt(0).toUpperCase() + calculatedAttritionRisk.slice(1) : 'N/A'}</div>
                      <div className="text-xs text-gray-500 flex items-center">
                        <Info className="w-3 h-3 mr-1" />
                        <span>Calculated in real-time from {getJobDutiesCount()} job duties</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          {/* Feedback Rating - Make more prominent */}
          {getFeedbackRating() > 0 && (
            <div className="flex items-center justify-between px-2 py-1 bg-yellow-50 border-y border-yellow-100 my-1 mt-2">
              <span className="text-xs font-medium text-gray-700">Feedback:</span>
              <StarRating rating={getFeedbackRating()} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom handle - bigger and more visible */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-6 h-6 bg-blue-500 border-2 border-white"
        style={{ bottom: -10, borderRadius: '50%', boxShadow: '0 0 5px rgba(0, 0, 0, 0.3)', zIndex: 10 }}
        isConnectable={isConnectable}
      />

      {/* Deleted label */}
      {isDeleted && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge variant="destructive" className="text-xs py-0 px-2">
            DELETED
          </Badge>
        </div>
      )}
    </>
  );
};

export default memo(EmployeeNode);
