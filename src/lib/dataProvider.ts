/**
 * Data Provider
 * 
 * Provides access to organization data, handling both real API calls
 * and mock data based on the user's login type.
 */

import mockData from '@/data/mockData';
import { Organization, Department, Employee, Project, ERPConnection, ValueToken } from '@/types/organization';

// Function to check if the current user is using mock data
export const isMockDataUser = (): boolean => {
  // In a real implementation, this would check the user's account type
  try {
    // Check if user explicitly switched to mock data mode
    const useMockData = localStorage.getItem('useMockData');
    if (useMockData === 'true') {
      return true;
    }
    
    const userJson = localStorage.getItem('user');
    if (!userJson) return false;
    
    const user = JSON.parse(userJson);
    // Test account uses mock data
    return user.email?.includes('test') || user.usesMockData === true;
  } catch (error) {
    console.error('Error checking mock data user:', error);
    return false;
  }
};

// Function to check if we have any real ERP connections
export const hasERPConnections = async (): Promise<boolean> => {
  // For mock data users, we want to show the dashboard, not the connection screen
  if (isMockDataUser()) {
    return true; // Mock user always has data
  }
  
  try {
    // Check if there's an ERP connection status in localStorage
    const hasERPConnected = localStorage.getItem('erpConnected');
    if (hasERPConnected === 'true') {
      return true;
    }
    
    // For non-mock users, check for ERP connections via API
    try {
      // Get auth token
      const token = localStorage.getItem('token');
      if (!token) return false;
      
      const response = await fetch('/api/erp/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Check for any valid connection
        if (data.hasConnection === true) {
          localStorage.setItem('erpConnected', 'true');
          console.log('ERP connection found:', data);
          return true;
        }
        
        // If we have integration counts, we have data
        if (data.integrationCount > 0 || data.historyCount > 0) {
          localStorage.setItem('erpConnected', 'true');
          console.log('Integration data found:', data);
          return true;
        }
      }
    } catch (apiError) {
      console.error('Error checking ERP connection via API:', apiError);
      // Continue to fallback
    }
    
    // Default to no connection if API check fails
    return false;
  } catch (error) {
    console.error('Error checking ERP connections:', error);
    return false;
  }
};

// Organization data functions
export const getOrganization = async (): Promise<Organization> => {
  if (isMockDataUser()) {
    return mockData.organization;
  }
  
  // Get auth token
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  // Real API call
  const response = await fetch('/api/organization', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch organization data');
  }
  
  return await response.json();
};

// Department data functions
export const getDepartments = async (): Promise<Department[]> => {
  if (isMockDataUser()) {
    return mockData.departments;
  }
  
  // Get auth token
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  // Real API call
  const response = await fetch('/api/departments', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch departments');
  }
  
  return await response.json();
};

// Employee data functions
export const getEmployees = async (): Promise<Employee[]> => {
  if (isMockDataUser()) {
    return mockData.employees;
  }
  
  // Get auth token
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  // Real API call
  const response = await fetch('/api/employees', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch employees');
  }
  
  return await response.json();
};

// Projects data functions
export const getProjects = async (): Promise<Project[]> => {
  if (isMockDataUser()) {
    return mockData.projects;
  }
  
  // Get auth token
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  // Get current user
  const userJson = localStorage.getItem('user');
  if (!userJson) {
    throw new Error('No user found');
  }
  
  const user = JSON.parse(userJson);
  
  // Real API call
  const response = await fetch('/api/projects', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-user-id': user.id
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }
  
  return await response.json();
};

// ERP Connection data functions
export const getERPConnections = async (): Promise<ERPConnection[]> => {
  if (isMockDataUser()) {
    return mockData.erpConnections;
  }
  
  // Get auth token
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  // Real API call
  const response = await fetch('/api/erp/connect', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch ERP connections');
  }
  
  const data = await response.json();
  return data.connection ? [data.connection] : [];
};

// Value token data functions
export const getValueTokens = async (): Promise<ValueToken[]> => {
  if (isMockDataUser()) {
    return mockData.valueTokens;
  }
  
  // Get auth token
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  // Real API call
  const response = await fetch('/api/value-tokens', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch value tokens');
  }
  
  return await response.json();
};

// Build employee hierarchy for org tree visualization
export const buildEmployeeHierarchy = (employees: Employee[]): any[] => {
  // Create a map for quick lookup
  const employeeMap = new Map();
  employees.forEach(emp => {
    employeeMap.set(emp.id, {
      ...emp,
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      position: emp.position,
      departmentId: emp.departmentId,
      managerId: emp.managerId,
      children: []
    });
  });
  
  // Build hierarchy
  const rootNodes: any[] = [];
  
  employees.forEach(emp => {
    const employeeNode = employeeMap.get(emp.id);
    
    if (emp.managerId && employeeMap.has(emp.managerId)) {
      // Add as child to manager
      const manager = employeeMap.get(emp.managerId);
      manager.children.push(employeeNode);
    } else {
      // No manager found, add to root
      rootNodes.push(employeeNode);
    }
  });
  
  return rootNodes;
};

// Function to build hierarchical department structure
export const buildDepartmentHierarchy = (departments: Department[]) => {
  const departmentMap = new Map();
  const rootDepartments: any[] = [];
  
  // First pass: create all department nodes
  departments.forEach(dept => {
    departmentMap.set(dept.id, {
      ...dept,
      children: []
    });
  });
  
  // Second pass: establish parent-child relationships
  departments.forEach(dept => {
    const deptNode = departmentMap.get(dept.id);
    
    if (dept.parentDepartmentId && departmentMap.has(dept.parentDepartmentId)) {
      // Add as child to parent department
      const parentDept = departmentMap.get(dept.parentDepartmentId);
      parentDept.children.push(deptNode);
    } else {
      // No parent, add to root
      rootDepartments.push(deptNode);
    }
  });
  
  return rootDepartments;
}; 