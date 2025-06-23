//THIS IS EMPLOYEE NODE BACKUP
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Badge } from "@/components/ui/badge";
import { isManagement, managementColor } from '../utils/colorUtils';

// Department color mapping
const departmentColors = {
  'Engineering': '#3498db',
  'Tool Design': '#27ae60',
  'Design': '#9b59b6',
  'Management': '#e74c3c',
  'Marketing': '#f39c12',
  'Sales': '#2ecc71',
  'HR': '#f39c12',
  'Finance': '#9b59b6',
  'Operations': '#1abc9c',
  'Executive': '#34495e',
  'Product': '#1abc9c',
  'Customer Support': '#FFC312',
  'Unassigned': '#95a5a6',
};

// Function to determine text color based on background color
const getTextColor = (bgColor: string): string => {
  // Convert hex to RGB
  const r = parseInt(bgColor.slice(1, 3), 16);
  const g = parseInt(bgColor.slice(3, 5), 16);
  const b = parseInt(bgColor.slice(5, 7), 16);
  
  // Calculate brightness (0-255)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Return white for dark backgrounds, black for light backgrounds
  return brightness > 125 ? '#000000' : '#ffffff';
};

// Extract department from job title if not specified
const getDepartmentFromTitle = (title: string, department: string): string => {
  if (department && department !== 'Unassigned') return department;
  
  const titleLower = title?.toLowerCase() || '';
  if (titleLower.includes('engineer')) return 'Engineering';
  if (titleLower.includes('design')) return 'Design';
  if (titleLower.includes('tool')) return 'Tool Design';
  if (titleLower.includes('manager') || titleLower.includes('director')) return 'Management';
  if (titleLower.includes('sales')) return 'Sales';
  if (titleLower.includes('marketing')) return 'Marketing';
  
  return 'Unassigned';
};

// Function to get utilization color based on score
const getUtilizationColor = (score: number): string => {
  // Overutilized
  if (score >= 1.3) return '#ef4444'; // Very overutilized (deep red)
  if (score >= 1.2) return '#f87171'; // Highly overutilized (red)
  if (score >= 1.1) return '#fb923c'; // Moderately overutilized (orange)
  if (score > 1.0) return '#fdba74'; // Slightly overutilized (light orange)
  
  // Optimal
  if (score >= 0.9) return '#4ade80'; // Optimal utilization (green)
  
  // Underutilized
  if (score >= 0.7) return '#7dd3fc'; // Slightly underutilized (light blue)
  if (score >= 0.5) return '#38bdf8'; // Moderately underutilized (blue)
  if (score >= 0.3) return '#0ea5e9'; // Highly underutilized (deeper blue)
  return '#0284c7'; // Very underutilized (dark blue)
};

// Function to get background color based on utilization
const getCardBackgroundColor = (score: number): string => {
  // Overutilized - reddish backgrounds
  if (score >= 1.3) return 'rgba(239, 68, 68, 0.1)'; // Very overutilized
  if (score >= 1.2) return 'rgba(248, 113, 113, 0.08)'; // Highly overutilized
  if (score >= 1.1) return 'rgba(251, 146, 60, 0.07)'; // Moderately overutilized
  if (score > 1.0) return 'rgba(253, 186, 116, 0.06)'; // Slightly overutilized
  
  // Optimal - white/very light green
  if (score >= 0.9) return 'rgba(74, 222, 128, 0.05)'; // Optimal
  
  // Underutilized - bluish backgrounds
  if (score >= 0.7) return 'rgba(125, 211, 252, 0.06)'; // Slightly underutilized
  if (score >= 0.5) return 'rgba(56, 189, 248, 0.07)'; // Moderately underutilized
  if (score >= 0.3) return 'rgba(14, 165, 233, 0.08)'; // Highly underutilized
  return 'rgba(2, 132, 199, 0.1)'; // Very underutilized
};

// Function to get utilization category label
const getUtilizationCategory = (score: number): string => {
  if (score >= 1.3) return "Critical";
  if (score >= 1.2) return "Very High";
  if (score >= 1.1) return "High";
  if (score > 1.0) return "Above Optimal";
  if (score >= 0.9) return "Optimal";
  if (score >= 0.7) return "Moderate";
  if (score >= 0.5) return "Low";
  if (score >= 0.3) return "Very Low";
  return "Minimal";
};

const EmployeeNode = ({ data }: NodeProps<any>) => {
  // Determine employee department - ensure we have a valid department
  const jobTitle = data.jobTitle || '';
  const rawDepartment = data.department || 'Unassigned';
  const department = getDepartmentFromTitle(jobTitle, rawDepartment);
  
  // Get department color
  const departmentColor = (department in departmentColors) ? 
    departmentColors[department as keyof typeof departmentColors] : '#95a5a6';
  
  // Check if role is management
  const managementRole = isManagement(jobTitle);
  const topBarColor = managementRole ? managementColor : departmentColor;
  
  // Get utilization data with defaults - Ensuring we're using actual MongoDB data
  const utilizationScore = data.utilization?.score ?? 0.8;
  const utilizationPercent = Math.round(utilizationScore * 100);
  const utilizationCategory = data.utilization?.category || getUtilizationCategory(utilizationScore);
  
  // Get attrition risk data
  const attritionRisk = data.attritionAssessment?.attrition_risk || 'unknown';
  
  // Determine color for attrition risk
  let riskColor = '#6b7280'; // Default gray
  if (typeof attritionRisk === 'string') {
    if (attritionRisk.toLowerCase() === 'high') {
      riskColor = '#ef4444'; // Red
    } else if (attritionRisk.toLowerCase() === 'medium') {
      riskColor = '#f97316'; // Orange
    } else if (attritionRisk.toLowerCase() === 'low') {
      riskColor = '#84cc16'; // Green
    }
  }
  
  // Check for redistributed duties
  const hasRedistributedDuties = data.job_intensity_analysis?.duties?.some(duty => duty.redistributed === true);
  
  // Get card background color based on utilization
  const cardBgColor = getCardBackgroundColor(utilizationScore);
  
  // Create display name
  const displayName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
  
  // Calculate the tint color and opacity based on utilization
  const tintColor = utilizationScore > 1.0 
    ? `rgba(239, 68, 68, ${Math.min((utilizationScore - 1.0) * 0.5, 0.3)})` // Red tint for over-utilization
    : utilizationScore < 0.7 
      ? `rgba(14, 165, 233, ${Math.min((0.7 - utilizationScore) * 0.7, 0.3)})` // Blue tint for under-utilization
      : 'transparent';

  return (
    <div 
      className="node-card relative rounded-md shadow-md border w-48 transition-all duration-300 hover:shadow-lg"
      style={{ 
        borderColor: departmentColor,
        backgroundColor: cardBgColor, // Apply utilization-based background color
        boxShadow: `0 0 8px 0 ${tintColor}`
      }}
    >
      {/* Top connection point */}
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ background: departmentColor, width: '10px', height: '10px', top: '-6px' }}
      />
      
      {/* Department color bar */}
      <div 
        className="h-2 w-full rounded-t-md" 
        style={{ backgroundColor: departmentColor }}
      ></div>
      
      <div className="p-3.5">
        {/* Employee header with avatar */}
        <div className="flex items-center mb-2">
          {data.avatar ? (
            <div className="w-12 h-12 rounded-full overflow-hidden mr-3 border-2" style={{ borderColor: departmentColor }}>
              <img 
                src={data.avatar} 
                alt={displayName} 
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div 
              className="w-12 h-12 rounded-full mr-3 flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: departmentColor, color: getTextColor(departmentColor) }}
            >
              {data.firstName?.[0] || ''}{data.lastName?.[0] || ''}
            </div>
          )}
          
          <div className="flex-1 overflow-hidden">
            <div className="font-bold text-black truncate text-sm">
              {displayName || 'Unnamed'}
            </div>
            {/* Show indicator for new duties */}
            {hasRedistributedDuties && (
              <div className="text-[9px] text-purple-600 font-semibold mt-0.5 flex items-center">
                <span className="h-1.5 w-1.5 bg-purple-500 rounded-full mr-1"></span>
                New Duties Assigned
              </div>
            )}
          </div>
        </div>
        
        {/* Job Title */}
        <div className="text-xs text-black uppercase font-semibold tracking-wide mb-1 truncate">
          {jobTitle || 'No Title'}
        </div>
        
        {/* Utilization indicator */}
        <div className="mt-1">
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-black">Utilization:</span>
            <span 
              className="font-medium"
              style={{ color: getUtilizationColor(utilizationScore) }}
            >
              {utilizationPercent}% <span className="text-[9px]">({utilizationCategory})</span>
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="h-1.5 rounded-full" 
              style={{ 
                width: `${Math.min(utilizationPercent, 130)}%`,
                backgroundColor: getUtilizationColor(utilizationScore)
              }}
            ></div>
          </div>
          
          {/* Attrition Risk indicator */}
          {attritionRisk !== 'unknown' && (
            <div className="flex justify-between items-center text-xs mt-2">
              <span className="text-black">Retention Risk:</span>
              <span 
                className="font-medium capitalize"
                style={{ color: riskColor }}
              >
                {attritionRisk}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Bottom connection point */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: departmentColor, width: '10px', height: '10px', bottom: '-6px' }}
      />
    </div>
  );
};

export default memo(EmployeeNode);
