/**
 * Role-based access control utility
 * 
 * Defines roles, permissions, and related functions for the application.
 */

// Role definitions
export enum UserRole {
  ADMIN = 'admin',
  ADMIN_MOCK = 'admin_mock',
  TOP_MANAGEMENT = 'top_management',
  TOP_MANAGEMENT_TIER_1 = 'top_management_tier_1',
  MANAGER = 'manager',
  EMPLOYEE = 'employee'
}

// Tier definitions
export enum UserTier {
  TIER_1 = 1,
  TIER_2 = 2,
  TIER_3 = 3 // Tier 3 for employees = part-time
}

// Permission definitions
export enum Permission {
  VIEW_DASHBOARD = 'view_dashboard',
  VIEW_PROJECTS = 'view_projects',
  VIEW_EMPLOYEES = 'view_employees',
  VIEW_ANALYTICS = 'view_analytics',
  VIEW_ECONOMY = 'view_economy',
  VIEW_SUCCESSION = 'view_succession',
  VIEW_SIMULATION = 'view_simulation',
  
  MANAGE_PROJECTS = 'manage_projects',
  MANAGE_EMPLOYEES = 'manage_employees',
  
  CHANGE_ROLES = 'change_roles',
  ACCESS_SETTINGS = 'access_settings',
  
  VIEW_ALL_DATA = 'view_all_data',
  USE_MOCK_DATA = 'use_mock_data',
  VIEW_PROFILE = 'view_profile',
  EDIT_PROFILE = 'edit_profile',
  USE_ORGGPT = 'use_orggpt'
}

// Mapping roles to their default permissions
const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.VIEW_DASHBOARD,
    Permission.ACCESS_SETTINGS,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE
  ],
  [UserRole.ADMIN_MOCK]: [
    Permission.VIEW_DASHBOARD,
    Permission.ACCESS_SETTINGS,
    Permission.USE_MOCK_DATA,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE
  ],
  [UserRole.TOP_MANAGEMENT]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_PROJECTS,
    Permission.VIEW_EMPLOYEES,
    Permission.VIEW_ECONOMY,
    Permission.USE_ORGGPT,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE
  ],
  [UserRole.TOP_MANAGEMENT_TIER_1]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_PROJECTS,
    Permission.VIEW_EMPLOYEES,
    Permission.VIEW_ECONOMY,
    Permission.VIEW_SUCCESSION,
    Permission.VIEW_SIMULATION,
    Permission.USE_ORGGPT,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE
  ],
  [UserRole.MANAGER]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_PROJECTS,
    Permission.MANAGE_PROJECTS,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE
  ],
  [UserRole.EMPLOYEE]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_PROJECTS,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE
  ]
};

// Function to check if a user has a specific permission
export const hasPermission = (role: UserRole, permission: Permission): boolean => {
  return rolePermissions[role]?.includes(permission) || false;
};

// Automatic role assignment based on position in org hierarchy
export const autoAssignRole = (orgDepth: number): UserRole => {
  if (orgDepth >= 2) {
    return UserRole.MANAGER;
  }
  return UserRole.EMPLOYEE;
};

// Function to determine if a user should have access to a specific page/feature
export const canAccess = (role: UserRole, requiredPermission: Permission): boolean => {
  return hasPermission(role, requiredPermission);
};

// Mock user accounts for testing
export const mockAccounts = [
  {
    id: 'emp-with-data',
    email: 'employee-data@example.com',
    firstName: 'Emma',
    lastName: 'Davis',
    role: UserRole.EMPLOYEE,
    tier: UserTier.TIER_2,
    hasData: true,
    password: 'password123' // In a real app, this would be hashed
  },
  {
    id: 'emp-no-data',
    email: 'employee-nodata@example.com',
    firstName: 'Noah',
    lastName: 'Smith',
    role: UserRole.EMPLOYEE,
    tier: UserTier.TIER_3, // Part-time
    hasData: false,
    password: 'password123'
  },
  {
    id: 'mgmt-with-data',
    email: 'exec-data@example.com',
    firstName: 'Oliver',
    lastName: 'Johnson',
    role: UserRole.TOP_MANAGEMENT,
    tier: UserTier.TIER_1,
    hasData: true,
    password: 'password123'
  },
  {
    id: 'mgmt-tier1-data',
    email: 'exec-tier1@example.com',
    firstName: 'Charlotte',
    lastName: 'Brown',
    role: UserRole.TOP_MANAGEMENT_TIER_1,
    tier: UserTier.TIER_1,
    hasData: true,
    password: 'password123'
  },
  {
    id: 'mgmt-no-data',
    email: 'exec-nodata@example.com',
    firstName: 'Sophia',
    lastName: 'Williams',
    role: UserRole.TOP_MANAGEMENT,
    tier: UserTier.TIER_2,
    hasData: false,
    password: 'password123'
  },
  {
    id: 'admin',
    email: 'admin@organizationgalaxy.com',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
    tier: UserTier.TIER_1,
    hasData: false,
    password: 'admin123'
  },
  {
    id: 'admin-mock',
    email: 'admin-mock@organizationgalaxy.com',
    firstName: 'Admin',
    lastName: 'Mock',
    role: UserRole.ADMIN_MOCK,
    tier: UserTier.TIER_1,
    hasData: true,
    password: 'admin123'
  }
];

// Function to get mock user by email
export const getMockUserByEmail = (email: string) => {
  return mockAccounts.find(account => account.email === email);
};

// Function to get mock user by ID
export const getMockUserById = (id: string) => {
  return mockAccounts.find(account => account.id === id);
}; 