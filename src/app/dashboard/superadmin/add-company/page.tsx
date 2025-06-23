"use client";

import { useRouter } from "next/navigation";
import { FiArrowLeft } from 'react-icons/fi';
import { useState } from "react";
import { toast } from 'react-hot-toast';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const companySchema = z.object({
  name: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  companyCode: z.string().min(3, { message: "Company code must be at least 3 characters." }).optional(),
  domain: z.string().optional(),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export default function AddCompanyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "", companyCode: "", domain: "" }
  });

  const onSubmit = async (values: CompanyFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/superadmin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create company");
      const result = await res.json();
      console.log('Created company:', result);
      toast.success(`Company "${result.name}" created`);
      router.push("/dashboard/superadmin");
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 text-black">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
        <FiArrowLeft className="mr-2"/> Back
      </Button>
      <h1 className="text-2xl font-semibold mb-4">Add Company</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Company Name</FormLabel>
              <FormControl><Input {...field} className="text-black placeholder-black" placeholder="Company Name" /></FormControl>
              <FormMessage className="text-black" />
            </FormItem>
          )} />
          <FormField control={form.control} name="companyCode" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Company Code</FormLabel>
              <FormControl><Input {...field} className="text-black placeholder-black" placeholder="Company Code" /></FormControl>
              <FormMessage className="text-black" />
            </FormItem>
          )} />
          <FormField control={form.control} name="domain" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-black">Domain</FormLabel>
              <FormControl><Input {...field} className="text-black placeholder-black" placeholder="Domain" /></FormControl>
              <FormMessage className="text-black" />
            </FormItem>
          )} />
          <Button type="submit" className="bg-purple-600 text-white hover:bg-purple-700" disabled={loading}>
            {loading ? "Creating..." : "Create Company"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
