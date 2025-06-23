'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// Schema for editing company
const editCompanySchema = z.object({
  name: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  companyCode: z.string().min(3, { message: "Company code must be at least 3 characters." }).optional().or(z.literal('')),
  domain: z.string().optional().or(z.literal('')),
});

interface Company {
  _id: string;
  name: string;
  companyCode: string;
  domain?: string;
}

export default function EditCompanyPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params?.id;

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [initialData, setInitialData] = useState<Company | null>(null);

  const form = useForm<z.infer<typeof editCompanySchema>>({
    resolver: zodResolver(editCompanySchema),
    defaultValues: {
      name: '',
      companyCode: '',
      domain: '',
    },
  });

  // Fetch initial company data
  useEffect(() => {
    if (!companyId) return;

    const fetchData = async () => {
      setFetchingData(true);
      const token = localStorage.getItem('token');
      try {
        // Fetch ALL companies and filter client-side
        // Inefficient, but GET /api/superadmin/companies/[id] doesn't exist yet
        const response = await fetch('/api/superadmin/companies', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch company data');
        const companies: Company[] = await response.json();
        const companyToEdit = companies.find(c => c._id === companyId);

        if (companyToEdit) {
          setInitialData(companyToEdit);
          form.reset({
            name: companyToEdit.name,
            companyCode: companyToEdit.companyCode,
            domain: companyToEdit.domain || '',
          });
        } else {
           throw new Error('Company not found');
        }

      } catch (error: any) {
        console.error('Error fetching company data:', error);
        toast.error(error.message || 'Failed to load company data.');
        router.push('/dashboard/superadmin?tab=companies'); // Go back if loading fails
      } finally {
        setFetchingData(false);
      }
    };

    fetchData();
  }, [companyId, router, form]);

  const onSubmit = async (formData: z.infer<typeof editCompanySchema>) => {
    // -------- Backend PUT Endpoint Missing --------
    // The following code would make the PUT request if the endpoint existed.
    // Currently, it will just show a warning.
    toast.error("Save functionality not implemented yet. Missing PUT /api/superadmin/companies/[id] endpoint.");
    console.warn("Attempted to save company, but PUT endpoint is missing.", formData);
    return; // Prevent actual submission
    // -------- End Missing Endpoint Warning --------
    
    /* --- Code if endpoint existed ---
    if (!companyId) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/superadmin/companies/${companyId}`, { // Assuming this endpoint would exist
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update company');
      }

      toast.success(`Company "${formData.name}" updated successfully`);
      router.push('/dashboard/superadmin?tab=companies');
    } catch (error: any) {
      console.error('Error updating company:', error);
      toast.error(error.message || 'Failed to update company');
    } finally {
      setLoading(false);
    }
    */
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
         <p className="text-red-600">Could not load company data.</p>
         <Link href="/dashboard/superadmin?tab=companies">
            <Button type="button" variant="outline" className="mt-4">Back to Superadmin</Button>
         </Link>
       </div>
     );
   }

  return (
    <div className="p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-black">Edit Company: {initialData.name}</CardTitle>
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
                    <FormControl><Input {...field} /></FormControl>
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
                    <FormControl><Input {...field} /></FormControl>
                    <FormDescription className="text-black">
                       Cannot be changed after creation. 
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
                 {/* Button is effectively disabled because onSubmit shows a warning */}
                <Button type="submit" className="bg-purple-600 text-white hover:bg-purple-700" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes (Not Implemented)'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
} 