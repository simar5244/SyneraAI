'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// Re-define schema (could be moved to a shared location)
const adminSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  company: z.string().min(1, { message: "Please select a company." }),
});

interface Company {
  _id: string;
  name: string;
}

export default function CreateAdminPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCompanies, setFetchingCompanies] = useState(true);

  const form = useForm<z.infer<typeof adminSchema>>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      password: '',
      company: '',
    },
  });

  // Fetch companies for the dropdown
  useEffect(() => {
    const fetchCompanies = async () => {
      setFetchingCompanies(true);
      try {
        const token = localStorage.getItem('token');
        // Assuming the companies endpoint is accessible
        const response = await fetch('/api/superadmin/companies', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch companies');
        const data = await response.json();
        setCompanies(data);
      } catch (error) {
        console.error('Error fetching companies:', error);
        toast.error('Failed to load companies for selection.');
      } finally {
        setFetchingCompanies(false);
      }
    };
    fetchCompanies();
  }, []);

  const onSubmit = async (formData: z.infer<typeof adminSchema>) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          role: 'admin', // Set role to admin on creation
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create admin user');
      }

      toast.success(`Admin user "${formData.username}" created successfully`);
      router.push('/dashboard/superadmin?tab=admins'); // Redirect back to superadmin page, admins tab
    } catch (error: any) {
      console.error('Error creating admin:', error);
      toast.error(error.message || 'Failed to create admin user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-black">Create New Admin User</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
               {/* First Name */}
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name*</FormLabel>
                    <FormControl><Input placeholder="Admin's First Name" {...field} /></FormControl>
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
                    <FormControl><Input placeholder="Admin's Last Name" {...field} /></FormControl>
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
                    <FormControl><Input type="email" placeholder="admin@example.com" {...field} /></FormControl>
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
                    <FormControl><Input placeholder="admin_username" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password*</FormLabel>
                    <FormControl><Input type="password" placeholder="Minimum 8 characters" {...field} /></FormControl>
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
                      disabled={fetchingCompanies || companies.length === 0}
                      required
                    >
                      <option value="" disabled>Select a company</option>
                      {companies.map((company) => (
                        <option key={company._id} value={company.name}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    {fetchingCompanies && <p className="text-sm text-muted-foreground">Loading companies...</p>}
                     {companies.length === 0 && !fetchingCompanies && <p className="text-sm text-red-600">No companies available. Please create a company first.</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                 <Link href="/dashboard/superadmin?tab=admins">
                    <Button type="button" variant="outline">Cancel</Button>
                 </Link>
                <Button type="submit" className="bg-purple-600 text-white hover:bg-purple-700" disabled={loading || fetchingCompanies || companies.length === 0}>
                  {loading ? 'Creating...' : 'Create Admin'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
} 