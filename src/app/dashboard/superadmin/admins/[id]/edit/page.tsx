'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// Schema for editing (password is optional)
const editAdminSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }).optional().or(z.literal('')), // Optional or empty string
  company: z.string().min(1, { message: "Please select a company." }),
});

interface Company {
  _id: string;
  name: string;
}

interface User {
  _id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}

export default function EditAdminPage() {
  const router = useRouter();
  const params = useParams();
  const adminId = params?.id;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [initialData, setInitialData] = useState<User | null>(null);

  const form = useForm<z.infer<typeof editAdminSchema>>({
    resolver: zodResolver(editAdminSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      password: '', // Start empty
      company: '',
    },
  });

  // Fetch initial admin data and companies
  useEffect(() => {
    if (!adminId) return;

    const fetchData = async () => {
      setFetchingData(true);
      const token = localStorage.getItem('token');
      try {
        // Fetch Admin User
        const userRes = await fetch(`/api/admin/users/${adminId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!userRes.ok) throw new Error('Failed to fetch admin user data');
        const userData: User = await userRes.json();
        setInitialData(userData);
        form.reset({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email,
          username: userData.username,
          password: '', // Keep password blank initially
          company: userData.company || '',
        });

        // Fetch Companies
        const companyRes = await fetch('/api/superadmin/companies', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!companyRes.ok) throw new Error('Failed to fetch companies');
        const companyData = await companyRes.json();
        setCompanies(companyData);

      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load initial data.');
        router.push('/dashboard/superadmin?tab=admins'); // Go back if loading fails
      } finally {
        setFetchingData(false);
      }
    };

    fetchData();
  }, [adminId, router, form]); // Add form to dependencies

  const onSubmit = async (formData: z.infer<typeof editAdminSchema>) => {
    if (!adminId) return;
    setLoading(true);
    const token = localStorage.getItem('token');

    // Exclude password if not provided
    const payload: any = { ...formData };
    if (!formData.password) {
      delete payload.password;
    }

    try {
      const response = await fetch(`/api/admin/users/${adminId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update admin user');
      }

      toast.success(`Admin user "${formData.username}" updated successfully`);
      router.push('/dashboard/superadmin?tab=admins');
    } catch (error: any) {
      console.error('Error updating admin:', error);
      toast.error(error.message || 'Failed to update admin user');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
     return (
      <div className="p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

   if (!initialData) {
     return (
       <div className="p-6 text-center">
         <p className="text-red-600">Could not load admin data.</p>
         <Link href="/dashboard/superadmin?tab=admins">
            <Button type="button" variant="outline" className="mt-4">Back to Superadmin</Button>
         </Link>
       </div>
     );
   }

  return (
    <div className="p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Edit Admin User: {initialData.username}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
               {/* Fields are same as create, but pre-filled */}
               {/* First Name */}
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name*</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* Last Name */}
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name*</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email*</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* Username */}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username*</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* Password (Optional) */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password (Optional)</FormLabel>
                    <FormControl><Input type="password" placeholder="Leave blank to keep current" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* Company Select */}
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company*</FormLabel>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={companies.length === 0}
                      required
                    >
                      <option value="" disabled>Select a company</option>
                      {companies.map((company) => (
                        <option key={company._id} value={company.name}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                     {companies.length === 0 && <p className="text-sm text-red-600">No companies available.</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                 <Link href="/dashboard/superadmin?tab=admins">
                    <Button type="button" variant="outline" className="text-black">Cancel</Button>
                 </Link>
                <Button type="submit" className="bg-purple-600 text-white hover:bg-purple-700" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
} 