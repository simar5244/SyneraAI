export interface EmployeeContribution {
  employee_id: string;
  role: string;
  hours_per_week: number;
  start_date: Date;
  end_date?: Date;
  active: boolean;
  // Extended fields for UI contributions
  name?: string;
  email?: string;
  department?: string;
  tasks?: string | string[];
  tools_used?: string | string[];
}

export type ProjectStatus = 'Planning' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled';
export type ProjectPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Project {
  project_id: string;
  project_title: string;
  project_description?: string;
  tech_stack?: string[];
  start_date: Date;
  end_date?: Date;
  department: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  total_hours?: number;
  employee_contributions: EmployeeContribution[];
  complexity_score?: number;
  impact_score?: number;
  risk_level?: number;
  created_at: Date;
  updated_at: Date;
}