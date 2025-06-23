export interface Department {
  id: string;
  name: string;
  description?: string;
  manager_id?: string;
  parent_department_id?: string;
  created_at: Date;
  updated_at: Date;
}

export type SeniorityLevel = 'Junior' | 'Mid-level' | 'Senior' | 'Lead' | 'Principal'; 