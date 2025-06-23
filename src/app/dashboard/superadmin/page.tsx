'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { 
  FiSearch, FiEdit, FiTrash2, FiPlus, FiUsers
} from 'react-icons/fi';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { checkUserAuth, handleAuthRedirect } from '@/utils/auth';

interface Company {
  _id: string;
  name: string;
  companyCode: string;
  domain?: string;
  createdAt?: string;
}

interface User {
  _id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  company?: string;
}

const companySchema = z.object({
  name: z.string().min(2, {
    message: "Company name must be at least 2 characters.",
  }),
  companyCode: z.string().min(3, {
    message: "Company code must be at least 3 characters."
  }).optional(),
  domain: z.string().optional(),
});

const adminSchema = z.object({
  firstName: z.string().min(2, {
    message: "First name must be at least 2 characters.",
  }),
  lastName: z.string().min(2, {
    message: "Last name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  username: z.string().min(3, {
    message: "Username must be at least 3 characters.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
  company: z.string().min(1, {
    message: "Please select a company.",
  }),
});

export default function SuperAdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [apiLoading, setApiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('companies');
  
  // Companies state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearchTerm, setCompanySearchTerm] = useState<string>("");
  const filteredCompanies = companySearchTerm
    ? companies.filter(c => c.name.toLowerCase().includes(companySearchTerm.toLowerCase()))
    : companies;
  
  // Admins state
  const [admins, setAdmins] = useState<User[]>([]);
  const [filteredAdmins, setFilteredAdmins] = useState<User[]>([]);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  
  // Check if the user is a superadmin
  useEffect(() => {
    const checkAuth = async () => {
      const authState = await checkUserAuth(['superadmin']);
      if (handleAuthRedirect(router, authState)) {
        return; // Will redirect if not authenticated/authorized
      }
      
      setCurrentUser(authState.user);
      // If user is superadmin, fetch initial data
      fetchCompanies();
      fetchAdmins();
      setLoading(false);
    };

    checkAuth();
  }, [router]);
  
  // Filter admins when search term changes
  useEffect(() => {
    if (adminSearchTerm.trim() === '') {
      setFilteredAdmins(admins);
    } else {
      const lowercaseSearch = adminSearchTerm.toLowerCase();
      const filtered = admins.filter(
        admin => 
          admin.username.toLowerCase().includes(lowercaseSearch) ||
          admin.email.toLowerCase().includes(lowercaseSearch) ||
          (admin.firstName && admin.firstName.toLowerCase().includes(lowercaseSearch)) ||
          (admin.lastName && admin.lastName.toLowerCase().includes(lowercaseSearch)) ||
          (admin.company && admin.company.toLowerCase().includes(lowercaseSearch))
      );
      setFilteredAdmins(filtered);
    }
  }, [adminSearchTerm, admins]);
  
  // Fetch companies
  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/superadmin/companies', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch companies');
      }
      
      const data = await response.json();
      setCompanies(data);
    } catch (error: any) {
      console.error('Error fetching companies:', error);
      setError(error.message || 'Failed to fetch companies');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch admin users
  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/users?role=admin&role=superadmin&limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch admin users');
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setAdmins(data);
        setFilteredAdmins(data);
      } else if (data.users && Array.isArray(data.users)) {
        setAdmins(data.users);
        setFilteredAdmins(data.users);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: any) {
      console.error('Error fetching admins:', error);
      setError(error.message || 'Failed to fetch admin users');
    } finally {
      setLoading(false);
    }
  };
  
  // Delete a company
  const handleDeleteCompany = async (id: string) => {
    if (!confirm('Are you sure you want to delete this company? This action cannot be undone.')) return;
    setApiLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/superadmin/companies?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete company');
      toast.success('Company deleted successfully');
      fetchCompanies();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };
  
  if (loading && !currentUser) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Super Admin Dashboard</h1>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
          <p>Error: {error}</p>
        </div>
      )}

      <Tabs defaultValue="companies" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="companies" className="text-black">Companies</TabsTrigger>
          <TabsTrigger value="admins" className="text-black">Admin Users</TabsTrigger>
        </TabsList>
        
        <TabsContent value="companies">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-black">Company Management</h2>
            <Button
              type="button"
              className="bg-purple-600 text-white hover:bg-purple-700"
              onClick={() => router.push('/dashboard/superadmin/companies/create')}
            >
              <FiPlus className="mr-2" /> Add Company
            </Button>
          </div>
          <div className="mb-4">
            <div className="relative">
              <Input
                placeholder="Search companies..."
                value={companySearchTerm}
                onChange={e => setCompanySearchTerm(e.target.value)}
                className="pl-10 text-black placeholder-gray-500"
              />
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>
          
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-black">Company Name</TableHead>
                    <TableHead className="text-black">Company Code</TableHead>
                    <TableHead className="text-black">Domain</TableHead>
                    <TableHead className="text-right text-black">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-black">
                        {companySearchTerm ? 'No matching companies.' : 'No companies found. Create your first company.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanies.map((company) => (
                      <TableRow key={company._id}>
                        <TableCell className="font-medium text-black">{company.name}</TableCell>
                        <TableCell className="text-black">{company.companyCode}</TableCell>
                        <TableCell className="text-black">{company.domain || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800" onClick={() => router.push(`/dashboard/superadmin/users?company=${company.name}`)}>
                            <FiUsers className="mr-1" /> View Users
                          </Button>
                          <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-800 ml-2" onClick={() => router.push(`/dashboard/superadmin/companies/${company._id}/edit`)} disabled={apiLoading}>
                            <FiEdit className="mr-1" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800 ml-2" onClick={() => handleDeleteCompany(company._id)} disabled={apiLoading}>
                            <FiTrash2 className="mr-1" /> Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="admins">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-black">Admin User Management</h2>
            <Button
              type="button"
              className="bg-purple-600 text-white hover:bg-purple-700"
              onClick={() => router.push('/dashboard/superadmin/admins/create')}
            >
              <FiPlus className="mr-2" /> Add Admin
            </Button>
          </div>
          <div className="mb-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search admins..."
                value={adminSearchTerm}
                onChange={(e) => setAdminSearchTerm(e.target.value)}
                className="pl-10"
              />
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>
          
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-black">Username</TableHead>
                    <TableHead className="text-black">Name</TableHead>
                    <TableHead className="text-black">Email</TableHead>
                    <TableHead className="text-black">Company</TableHead>
                    <TableHead className="text-black">Role</TableHead>
                    <TableHead className="text-right text-black">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        {adminSearchTerm ? 'No matching admin users found.' : 'No admin users found.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAdmins.map((admin) => (
                      <TableRow key={admin._id}>
                        <TableCell className="font-medium text-black">{admin.username}</TableCell>
                        <TableCell className="text-black">{`${admin.firstName || ''} ${admin.lastName || ''}`.trim() || '-'}</TableCell>
                        <TableCell className="text-black">{admin.email}</TableCell>
                        <TableCell className="text-black">{admin.company || '-'}</TableCell>
                        <TableCell className="text-black">{admin.role === 'superadmin' ? 'Super Admin' : 'Admin'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-800" onClick={() => router.push(`/dashboard/superadmin/admins/${admin._id}/edit`)} disabled={apiLoading}>
                            <FiEdit className="mr-1" /> Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 