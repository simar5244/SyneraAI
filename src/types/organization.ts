/**
 * Types related to organization structure and ERP integrations
 */

// ERP System Types
export type ERPType = 'SAP_HR' | 'MICROSOFT_AD' | 'PEOPLESOFT' | 'CUSTOM';

// Organization structure
export interface Organization {
  id: string;
  name: string;
  description?: string;
  industry?: string;
  logoUrl?: string;
  size?: 'small' | 'medium' | 'large' | 'enterprise';
  employeeCount?: number;
  foundedYear?: number;
  headquarters?: {
    city: string;
    country: string;
    address?: string;
  };
  departments?: Department[];
}

// Department within an organization
export interface Department {
  id: string;
  name: string;
  description?: string;
  headId?: string; // ID of department head
  parentDepartmentId?: string | null; // For hierarchical department structure
}

// Employee structure
export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  departmentId: string;
  managerId?: string;
  hireDate: Date;
  status: 'active' | 'inactive' | 'onLeave';
  profileImage?: string;
  contactInformation?: {
    phone?: string;
    address?: string;
  };
  skills?: string[];
}

// ERP Connection
export interface ERPConnection {
  id: string;
  name: string;
  type: ERPType;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSynced?: Date;
  connectionDetails: Record<string, any>;
  errorMessage?: string;
}

// Project structure
export interface Project {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: string;
  department: string;
  priority: string;
  teams: string[];
  members: string[];
  techStack: string[];
  completionPercentage: number;
}

// Value Token structure
export interface ValueToken {
  employeeId: string;
  tokens: number;
  influenceScore: number;
} 