// Department color mapping
export const departmentColors = {
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

// Management role color
export const managementColor = '#34495e';

// Function to determine text color based on background color
export const getTextColor = (bgColor: string): string => {
  // Convert hex to RGB
  const r = parseInt(bgColor.slice(1, 3), 16);
  const g = parseInt(bgColor.slice(3, 5), 16);
  const b = parseInt(bgColor.slice(5, 7), 16);
  
  // Calculate brightness (0-255)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Return white for dark backgrounds, black for light backgrounds
  return brightness > 125 ? '#000000' : '#ffffff';
};

// Check if role is management
export const isManagement = (title: string): boolean => {
  const titleLower = title?.toLowerCase() || '';
  return titleLower.includes('manager') || 
         titleLower.includes('director') || 
         titleLower.includes('lead') || 
         titleLower.includes('chief') || 
         titleLower.includes('head') ||
         titleLower.includes('supervisor') ||
         titleLower.includes('executive');
};

// Function to get utilization color based on score
export const getUtilizationColor = (score: number): string => {
  // Overutilized
  if (score >= 1.3) return '#ef4444'; // Critical (deep red)
  if (score >= 1.2) return '#f97316'; // Very High (orange)
  if (score >= 1.1) return '#f59e0b'; // High (amber)
  if (score > 1.0) return '#fbbf24'; // Above Optimal (light amber)
  
  // Optimal
  if (score >= 0.9) return '#22c55e'; // Optimal (green)
  
  // Underutilized
  if (score >= 0.7) return '#60a5fa'; // Slightly underutilized (light blue)
  if (score >= 0.5) return '#3b82f6'; // Moderately underutilized (blue)
  if (score >= 0.3) return '#2563eb'; // Highly underutilized (darker blue)
  return '#1d4ed8'; // Very underutilized (dark blue)
};

// Function to get background color based on utilization
export const getCardBackgroundColor = (score: number): string => {
  // Overutilized - orange/red backgrounds with increased opacity
  if (score >= 1.3) return 'rgba(239, 68, 68, 0.15)'; // Critical (red)
  if (score >= 1.2) return 'rgba(249, 115, 22, 0.15)'; // Very High (orange)
  if (score >= 1.1) return 'rgba(245, 158, 11, 0.12)'; // High (amber)
  if (score > 1.0) return 'rgba(251, 191, 36, 0.1)'; // Above Optimal (light amber)
  
  // Optimal - very light green background
  if (score >= 0.9) return 'rgba(34, 197, 94, 0.05)'; // Optimal (green)
  
  // Underutilized - bluish backgrounds with increased opacity
  if (score >= 0.7) return 'rgba(96, 165, 250, 0.1)'; // Slightly underutilized (light blue)
  if (score >= 0.5) return 'rgba(59, 130, 246, 0.12)'; // Moderately underutilized (blue)
  if (score >= 0.3) return 'rgba(37, 99, 235, 0.15)'; // Highly underutilized (darker blue)
  return 'rgba(29, 78, 216, 0.18)'; // Very underutilized (dark blue)
};

// Function to get utilization category label
export const getUtilizationCategory = (score: number): string => {
  if (score >= 1.3) return "Critical (Overutilized)";
  if (score >= 1.2) return "Very High (Overutilized)";
  if (score >= 1.1) return "High (Overutilized)";
  if (score > 1.0) return "Above Optimal";
  if (score >= 0.9) return "Optimal";
  if (score >= 0.7) return "Moderate";
  if (score >= 0.5) return "Low (Underutilized)";
  if (score >= 0.3) return "Very Low (Underutilized)";
  return "Minimal (Underutilized)";
};

// Function to get utilization badge color class
export const getUtilizationBadgeClass = (score: number): string => {
  if (score >= 1.3) return 'bg-red-600 text-white';
  if (score >= 1.2) return 'bg-orange-600 text-white';
  if (score >= 1.1) return 'bg-amber-500 text-white';
  if (score > 1.0) return 'bg-yellow-400 text-gray-800';
  if (score >= 0.9) return 'bg-green-500 text-white';
  if (score >= 0.7) return 'bg-blue-400 text-white';
  if (score >= 0.5) return 'bg-blue-500 text-white';
  if (score >= 0.3) return 'bg-blue-600 text-white';
  return 'bg-blue-700 text-white';
};

// Extract department from job title if not specified
export const getDepartmentFromTitle = (title: string, department: string): string => {
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