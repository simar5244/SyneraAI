// Define user role types
export type UserRole = 
  | 'employee_tier_1' 
  | 'employee_tier_2' 
  | 'employee_tier_3'
  | 'top_management_tier_1' 
  | 'top_management_tier_2' 
  | 'top_management_tier_3'
  | 'admin'
  | 'superadmin';

// Define all available routes in the system
export const ROUTES = {
  DASHBOARD: '/dashboard',
  PROJECTS: '/dashboard/projects',
  FEEDBACK: '/dashboard/feedback',
  INTEGRATIONS: '/dashboard/employees',
  VISUALIZATIONS: '/dashboard/visualizations',
  SUCCESSION_PLANNING: '/dashboard/succession-planning',
  WEB_QUERY: '/dashboard/orgai',
  REPORT_GENERATION: '/dashboard/report-generation',
  BILLING: '/dashboard/billing',
  USER_MANAGEMENT: '/dashboard/user-management',
  USER_APPROVALS: '/dashboard/admin/approvals',
  PLATFORM_SETTINGS: '/dashboard/superadmin',
};

// Define route access by role
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  // Employee tiers
  employee_tier_1: [
    ROUTES.DASHBOARD,
    ROUTES.PROJECTS,
    ROUTES.FEEDBACK,
    ROUTES.BILLING,
  ],
  employee_tier_2: [
    ROUTES.DASHBOARD,
    ROUTES.PROJECTS,
    ROUTES.FEEDBACK,
    ROUTES.BILLING,
  ],
  employee_tier_3: [
    ROUTES.DASHBOARD,
    ROUTES.PROJECTS,
    ROUTES.FEEDBACK,
    ROUTES.BILLING,
  ],
  
  // Management tiers
  top_management_tier_1: [
    ROUTES.DASHBOARD,
    ROUTES.INTEGRATIONS,
    ROUTES.PROJECTS,
    ROUTES.FEEDBACK,
    ROUTES.VISUALIZATIONS,
    ROUTES.SUCCESSION_PLANNING,
    ROUTES.WEB_QUERY,
    ROUTES.REPORT_GENERATION,
    ROUTES.BILLING,
  ],
  top_management_tier_2: [
    ROUTES.DASHBOARD,
    ROUTES.INTEGRATIONS,
    ROUTES.PROJECTS,
    ROUTES.FEEDBACK,
    ROUTES.VISUALIZATIONS,
    ROUTES.SUCCESSION_PLANNING,
    ROUTES.WEB_QUERY,
    ROUTES.REPORT_GENERATION,
    ROUTES.BILLING,
  ],
  top_management_tier_3: [
    ROUTES.DASHBOARD,
    ROUTES.INTEGRATIONS,
    ROUTES.PROJECTS,
    ROUTES.FEEDBACK,
    ROUTES.VISUALIZATIONS,
    ROUTES.SUCCESSION_PLANNING,
    ROUTES.WEB_QUERY,
    ROUTES.REPORT_GENERATION,
    ROUTES.BILLING,
  ],
  
  // Admin roles
  admin: [
    ROUTES.DASHBOARD,
    ROUTES.INTEGRATIONS,
    ROUTES.PROJECTS,
    ROUTES.FEEDBACK,
    ROUTES.VISUALIZATIONS,
    ROUTES.SUCCESSION_PLANNING,
    ROUTES.WEB_QUERY,
    ROUTES.REPORT_GENERATION,
    ROUTES.USER_MANAGEMENT,
    ROUTES.BILLING,
  ],
  superadmin: [
    ROUTES.DASHBOARD,
    ROUTES.INTEGRATIONS,
    ROUTES.PROJECTS,
    ROUTES.FEEDBACK,
    ROUTES.VISUALIZATIONS,
    ROUTES.SUCCESSION_PLANNING,
    ROUTES.WEB_QUERY,
    ROUTES.REPORT_GENERATION,
    ROUTES.USER_MANAGEMENT,
    ROUTES.PLATFORM_SETTINGS,
    ROUTES.BILLING,
  ],
};

// Helper function to check if a user has access to a specific route
export function hasRouteAccess(userRole: UserRole | string, path: string): boolean {
  // If no role, deny access
  if (!userRole) return false;
  
  // Get allowed routes for this role
  const allowedRoutes = ROLE_PERMISSIONS[userRole as UserRole] || [];
  
  // Check if the exact path is allowed
  if (allowedRoutes.includes(path)) return true;
  
  // Check if any parent route is allowed (for nested routes)
  return allowedRoutes.some(route => path.startsWith(route));
}

// Helper to get all routes a user can access
export function getUserAccessibleRoutes(userRole: UserRole | string): string[] {
  return ROLE_PERMISSIONS[userRole as UserRole] || [];
} 