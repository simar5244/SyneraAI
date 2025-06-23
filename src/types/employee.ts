/**
 * TypeScript definitions for the Employee model
 */

export interface Employee {
  employee_id: string;
  name: string;
  work_email: string;
  job_title: string;
  department: string;
  manager_id?: string;  // Optional as some employees (e.g., CEO) might not have a manager
  tenure: number;       // In months
  skills: string[];
  seniority_level: 'Junior' | 'Mid-level' | 'Senior' | 'Lead' | 'Principal';
  org_level: number;    // Organizational hierarchy level (1 = CEO, 2 = VPs, etc.)
  hire_date: Date;
  last_promotion_date?: Date;
  active: boolean;
  
  // Analytics fields
  value_tokens: number;
  influence_score: number;
  attrition_risk: number;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

export type EmployeeSeniorityLevel = 'Junior' | 'Mid-level' | 'Senior' | 'Lead' | 'Principal';

export interface EmployeeFilters {
  department?: string;
  seniority_level?: EmployeeSeniorityLevel;
  skills?: string[];
  active?: boolean;
  min_tenure?: number;
  max_tenure?: number;
  search_term?: string;
} 