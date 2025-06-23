import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Organization, Department, Employee } from '../types/organization';
import { createERPConnector, ERPConnectionConfig, ERPOrganizationStructure } from './erpService';

/**
 * Interface for organization data API responses
 */
interface OrganizationAPIResponse {
  id: string;
  name: string;
  description?: string;
  industry?: string;
  size?: string;
  employeeCount?: number;
  departments?: DepartmentAPIResponse[];
}

interface DepartmentAPIResponse {
  id: string;
  name: string;
  description?: string;
  headId?: string;
  parentDepartmentId?: string;
}

// In-memory cache for organization data
let organizationsCache: Map<string, Organization> = new Map();

/**
 * Fetch organization data from API
 * @param organizationId Organization ID to fetch
 * @returns Promise with organization data
 */
export const fetchOrganization = async (organizationId: string): Promise<Organization> => {
  // Check cache first
  if (organizationsCache.has(organizationId)) {
    return organizationsCache.get(organizationId)!;
  }

  try {
    // Replace with actual API endpoint in production
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.organizationgalaxy.com';
    const response = await axios.get<OrganizationAPIResponse>(`${apiUrl}/organizations/${organizationId}`);
    
    const organization: Organization = {
      id: response.data.id,
      name: response.data.name,
      description: response.data.description,
      industry: response.data.industry,
      size: response.data.size as 'small' | 'medium' | 'large' | 'enterprise' | undefined,
      employeeCount: response.data.employeeCount,
      departments: response.data.departments?.map((dept: DepartmentAPIResponse) => ({
        id: dept.id,
        name: dept.name,
        description: dept.description,
        headId: dept.headId,
        parentDepartmentId: dept.parentDepartmentId
      }))
    };

    // Cache the result
    organizationsCache.set(organizationId, organization);
    return organization;
  } catch (error) {
    console.error('Error fetching organization:', error);
    throw new Error('Failed to fetch organization data');
  }
};

/**
 * Create a new organization
 * @param organizationData Organization data
 * @returns Created organization
 */
export const createOrganization = async (organizationData: Omit<Organization, 'id'>): Promise<Organization> => {
  try {
    const newOrganization: Organization = {
      ...organizationData,
      id: uuidv4()
    };

    // Replace with actual API call in production
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.organizationgalaxy.com';
    const response = await axios.post<Organization>(`${apiUrl}/organizations`, newOrganization);
    
    // Update cache
    organizationsCache.set(response.data.id, response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating organization:', error);
    throw new Error('Failed to create organization');
  }
};

/**
 * Update an existing organization
 * @param organizationId Organization ID
 * @param updates Updates to apply
 * @returns Updated organization
 */
export const updateOrganization = async (
  organizationId: string, 
  updates: Partial<Omit<Organization, 'id'>>
): Promise<Organization> => {
  try {
    // Replace with actual API call in production
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.organizationgalaxy.com';
    const response = await axios.patch<Organization>(`${apiUrl}/organizations/${organizationId}`, updates);
    
    // Update cache
    organizationsCache.set(organizationId, response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating organization:', error);
    throw new Error('Failed to update organization');
  }
};

/**
 * Import organization structure from ERP system
 * @param organizationId Organization ID
 * @param erpConfig ERP connection configuration
 * @returns Updated organization with imported structure
 */
export const importOrganizationFromERP = async (
  organizationId: string,
  erpConfig: ERPConnectionConfig
): Promise<Organization> => {
  try {
    // Create ERP connector
    const erpConnector = createERPConnector(erpConfig);
    
    // Test connection
    await erpConnector.testConnection();
    
    // Fetch organization structure from ERP
    const erpOrgStructure: ERPOrganizationStructure = await erpConnector.getOrganizationStructure();
    
    // Convert ERP data to our format
    const departments: Department[] = erpOrgStructure.departments?.map(dept => ({
      id: dept.id,
      name: dept.name,
      description: dept.description,
      headId: dept.headId,
      parentDepartmentId: dept.parentId
    })) || [];
    
    // Update organization with new departments
    const updatedOrg = await updateOrganization(organizationId, {
      departments
    });
    
    return updatedOrg;
  } catch (error) {
    console.error('Error importing from ERP:', error);
    throw new Error('Failed to import organization from ERP');
  }
};

/**
 * Import employees from ERP system
 * @param organizationId Organization ID
 * @param erpConfig ERP connection configuration
 * @returns Array of imported employees
 */
export const importEmployeesFromERP = async (
  organizationId: string,
  erpConfig: ERPConnectionConfig
): Promise<Employee[]> => {
  try {
    // Create ERP connector
    const erpConnector = createERPConnector(erpConfig);
    
    // Test connection
    await erpConnector.testConnection();
    
    // Fetch employees from ERP
    const erpEmployees = await erpConnector.getEmployees();
    
    // Convert ERP employee data to our format
    const employees: Employee[] = erpEmployees.map(emp => ({
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email || '',
      position: emp.position || 'Employee',
      departmentId: emp.department || '',
      managerId: emp.managerId,
      hireDate: new Date(emp.hireDate || Date.now()),
      status: 'active' as const,
      skills: emp.attributes?.skills as string[] || []
    }));
    
    // In production, would save employees to database
    // For now, return the mapped employees
    return employees;
  } catch (error) {
    console.error('Error importing employees from ERP:', error);
    throw new Error('Failed to import employees from ERP');
  }
};

/**
 * Get department hierarchy
 * @param organizationId Organization ID
 * @returns Hierarchical department structure
 */
export const getDepartmentHierarchy = async (organizationId: string): Promise<any[]> => {
  try {
    const organization = await fetchOrganization(organizationId);
    
    if (!organization.departments || organization.departments.length === 0) {
      return [];
    }
    
    // Build department hierarchy
    const departmentMap = new Map<string, any>();
    
    // First pass: create department nodes
    organization.departments.forEach(dept => {
      departmentMap.set(dept.id, {
        ...dept,
        children: []
      });
    });
    
    // Second pass: build hierarchy
    const rootDepartments: any[] = [];
    
    organization.departments.forEach(dept => {
      const deptNode = departmentMap.get(dept.id);
      
      if (dept.parentDepartmentId && departmentMap.has(dept.parentDepartmentId)) {
        // Add as child to parent
        const parentNode = departmentMap.get(dept.parentDepartmentId);
        parentNode.children.push(deptNode);
      } else {
        // Root department (no parent)
        rootDepartments.push(deptNode);
      }
    });
    
    return rootDepartments;
  } catch (error) {
    console.error('Error building department hierarchy:', error);
    throw new Error('Failed to get department hierarchy');
  }
}; 