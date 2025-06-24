'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import OrganizationalGalaxy from '@/components/visualization/OrganizationalGalaxy';
import NetworkChart from '@/components/visualization/NetworkChart';
import HierarchyTree from '@/components/visualization/HierarchyTree';

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  workIntensity: number;
  collaborationIntensity: number;
  projects: string[];
  duties: string[];
  managerId?: string;
  collaborators: string[];
}

interface EmployeeData {
  employees: Employee[];
}

const VisualizeERPPageContent = () => {
  const searchParams = useSearchParams();
  const connectionId = searchParams.get('connectionId');
  
  const [isLoading, setIsLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const departments = employeeData 
    ? [...new Set(employeeData.employees.map(emp => emp.department))]
    : [];
  
  const roles = employeeData 
    ? [...new Set(employeeData.employees.map(emp => emp.role))]
    : [];
  
  // Fetch employee data
  useEffect(() => {
    if (!connectionId) {
      toast.error('Missing connection ID. Please connect to an ERP system first.');
      setIsLoading(false);
      return;
    }
    
    const fetchEmployeeData = async () => {
      try {
        const response = await fetch(`/api/erp/employees?connectionId=${connectionId}`);
        const result = await response.json();
        
        if (result.success) {
          setEmployeeData(result.data);
        } else {
          toast.error(result.message || 'Failed to fetch employee data');
        }
      } catch (error) {
        console.error('Error fetching employee data:', error);
        toast.error('An error occurred while fetching employee data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEmployeeData();
  }, [connectionId]);
  
  // Filter employees based on department, role, and search query
  const filteredEmployees = employeeData?.employees.filter(employee => {
    // If no filters are applied ("all" means no filter), include all employees
    if (filterDepartment === 'all' && filterRole === 'all' && !searchQuery) {
      return true;
    }
    
    // Apply department filter ("all" means no filter)
    if (filterDepartment !== 'all' && employee.department !== filterDepartment) {
      return false;
    }
    
    // Apply role filter ("all" means no filter)
    if (filterRole !== 'all' && employee.role !== filterRole) {
      return false;
    }
    
    // Apply search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        employee.name.toLowerCase().includes(query) ||
        employee.role.toLowerCase().includes(query) ||
        employee.department.toLowerCase().includes(query)
      );
    }
    
    return true;
  }) || [];
  
  // Reset all filters
  const handleResetFilters = () => {
    setFilterDepartment('');
    setFilterRole('');
    setSearchQuery('');
  };
  
  if (isLoading) {
    return (
      <div className="container py-10 flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-xl">Loading organization data...</p>
        </div>
      </div>
    );
  }
  
  if (!connectionId) {
    return (
      <div className="container py-10">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center p-6">
              <h2 className="text-2xl font-semibold mb-2">No ERP Connection</h2>
              <p className="mb-4">Please connect to an ERP system to visualize your organization.</p>
              <Button asChild>
                <a href="/erp/connect">Connect to ERP</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-6">Organization Visualization</h1>
      
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="department">Department</Label>
          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger id="department">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="role">Role</Label>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger id="role">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles.map(role => (
                <SelectItem key={role} value={role}>{role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Search by name, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-end">
          <Button 
            variant="outline" 
            onClick={handleResetFilters}
            className="w-full"
          >
            Reset Filters
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="galaxy" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="galaxy">Organizational Galaxy</TabsTrigger>
          <TabsTrigger value="network">Network Chart</TabsTrigger>
          <TabsTrigger value="tree">Hierarchy Tree</TabsTrigger>
        </TabsList>
        
        <TabsContent value="galaxy" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="h-[calc(100vh-300px)] min-h-[500px]">
                {employeeData && (
                  <OrganizationalGalaxy 
                    employees={filteredEmployees} 
                    allEmployees={employeeData.employees}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="network" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="h-[calc(100vh-300px)] min-h-[500px]">
                {employeeData && (
                  <NetworkChart 
                    employees={filteredEmployees}
                    allEmployees={employeeData.employees}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="tree" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="h-[calc(100vh-300px)] min-h-[500px]">
                {employeeData && (
                  <HierarchyTree 
                    employees={filteredEmployees}
                    allEmployees={employeeData.employees}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const VisualizeERPPage = () => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <VisualizeERPPageContent />
    </Suspense>
  );
};

export default VisualizeERPPage; 