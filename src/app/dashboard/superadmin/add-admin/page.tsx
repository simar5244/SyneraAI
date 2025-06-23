"use client";

import { useRouter } from "next/navigation";
import { FiArrowLeft } from 'react-icons/fi';
import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const adminSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  company: z.string().min(1, { message: "Please select a company." }),
});

type AdminFormValues = z.infer<typeof adminSchema>;

type Company = { _id: string; name: string };

export default function AddAdminPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AdminFormValues>({
    resolver: zodResolver(adminSchema),
    defaultValues: { firstName: '', lastName: '', email: '', username: '', password: '', company: '' }
  });

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/superadmin/companies', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        setCompanies(Array.isArray(data) ? data : data.companies || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchCompanies();
  }, []);

  const onSubmit = async (values: AdminFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...values, role: 'admin' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create admin');
      router.push('/dashboard/superadmin');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 text-black">
        <FiArrowLeft className="mr-2"/> Back
      </Button>
      <h1 className="text-2xl font-semibold mb-4 text-black">Add Admin User</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField control={form.control} name="firstName" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">First Name</FormLabel>
              <FormControl><Input {...field} placeholder="First Name" className="text-black placeholder-black"/></FormControl>
              <FormMessage className="text-black" />
            </FormItem>
          )} />
          <FormField control={form.control} name="lastName" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Last Name</FormLabel>
              <FormControl><Input {...field} placeholder="Last Name" className="text-black placeholder-black"/></FormControl>
              <FormMessage className="text-black" />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Email</FormLabel>
              <FormControl><Input type="email" {...field} placeholder="Email" className="text-black placeholder-black"/></FormControl>
              <FormMessage className="text-black" />
            </FormItem>
          )} />
          <FormField control={form.control} name="username" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Username</FormLabel>
              <FormControl><Input {...field} placeholder="Username" className="text-black placeholder-black"/></FormControl>
              <FormMessage className="text-black" />
            </FormItem>
          )} />
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Password</FormLabel>
              <FormControl><Input type="password" {...field} placeholder="Password" className="text-black placeholder-black"/></FormControl>
              <FormMessage className="text-black" />
            </FormItem>
          )} />
          <FormField control={form.control} name="company" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Company</FormLabel>
              <FormControl>
                <select {...field} className="w-full rounded-md border bg-white px-3 py-2 text-black placeholder-black">
                  <option value="">Select a company</option>
                  {companies.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </FormControl>
              <FormMessage className="text-black" />
            </FormItem>
          )} />
          <Button type="submit" className="bg-purple-600 text-white hover:bg-purple-700" disabled={loading}>
            {loading ? 'Creating...' : 'Create Admin'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
