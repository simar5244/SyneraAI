'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// Re-define schema (could be moved to a shared location)
const companySchema = z.object({
  name: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  companyCode: z.string().min(3, { message: "Company code must be at least 3 characters." }).optional().or(z.literal('')),
  domain: z.string().optional().or(z.literal('')),
});

export default function CreateCompanyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      companyCode: '',
      domain: '',
    },
  });

  const onSubmit = async (formData: z.infer<typeof companySchema>) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      // Use the existing POST endpoint
      const response = await fetch('/api/superadmin/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create company');
      }

      toast.success(`Company "${formData.name}" created successfully`);
      router.push('/dashboard/superadmin?tab=companies'); // Redirect back to companies tab
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast.error(error.message || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-black">Create New Company</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name*</FormLabel>
                    <FormControl><Input placeholder="Enter company name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Code</FormLabel>
                    <FormControl><Input placeholder="e.g., ABC1234 (optional)" {...field} /></FormControl>
                     <FormDescription>
                      Leave blank to auto-generate a code.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Domain</FormLabel>
                    <FormControl><Input placeholder="e.g., company.com (optional)" {...field} /></FormControl>
                     <FormDescription>
                      Used for associating users by email domain.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2 pt-4">
                 <Link href="/dashboard/superadmin?tab=companies">
                    <Button type="button" variant="outline">Cancel</Button>
                 </Link>
                <Button type="submit" className="bg-purple-600 text-white hover:bg-purple-700" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Company'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
} 