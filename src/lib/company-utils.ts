import { Session } from 'next-auth';

/**
 * Extract company code from user session
 * Ensures multi-tenancy by providing the correct company identifier
 * for database operations
 */
export function getCompanyFromSession(session: Session | null): string | null {
  if (!session || !session.user) return null;
  
  // Extract company from user data
  // This assumes company code is stored in session.user.company
  // Adjust according to your actual session structure
  const company = session.user.company || 
                 (session.user as any).companyCode || 
                 process.env.DEFAULT_COMPANY;
  
  if (!company) {
    console.warn('No company found in session, multi-tenancy may be compromised');
    return null;
  }
  
  return company;
}

/**
 * Get the database name for a company
 * Follows the naming convention: company_<company_code_lowercase>
 */
export function getCompanyDatabaseName(company: string): string {
  if (!company) return '';
  return `company_${company.toLowerCase()}`;
}

/**
 * Validate if a company exists in the system
 * This could be expanded to check against a list of valid companies
 */
export function isValidCompany(company: string): boolean {
  if (!company) return false;
  
  // Add validation logic here if needed
  // For now, just check if it's a non-empty string
  return company.trim().length > 0;
}

/**
 * Ensure company code doesn't contain any characters that would be
 * problematic in database names
 */
export function sanitizeCompanyCode(company: string): string {
  if (!company) return '';
  
  // Remove special characters, spaces, etc.
  return company.toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .trim();
}
