// Utility to map stored role values to frontend labels
export const ROLE_LABELS: Record<string, string> = {
  employee_tier_1: 'Employee',
  employee_tier_2: 'Employee',
  employee_tier_3: 'Employee',
  top_management_tier_1: 'Top Management',
  top_management_tier_2: 'Top Management',
  top_management_tier_3: 'Top Management',
  admin: 'Admin',
  superadmin: 'Superadmin',
};

export function displayRole(role: string): string {
  return ROLE_LABELS[role] || role;
}
