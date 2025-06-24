"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { FiUpload, FiCheckCircle, FiAlertTriangle, FiDownload } from "react-icons/fi";
import { useRouter } from "next/navigation";

// Dynamic schema to handle both server and client side rendering
const formSchema = z.object({
  csvFile: typeof window === 'undefined' 
    ? z.any() // On server, accept any value (will be validated on client)
    : z.instanceof(FileList).refine(
        (files) => files && files.length > 0,
        { message: "Please select a CSV file to upload." }
      )
});

export function CSVUploadForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {}
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsUploading(true);
    setUploadStatus("idle");
    setErrorMessage("");

    try {
      // Skip if no files or file list is empty
      if (!values.csvFile || values.csvFile.length === 0) {
        throw new Error("No file selected");
      }

      const formData = new FormData();
      formData.append("file", values.csvFile[0]);

      const response = await fetch("/api/erp/csv-upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log('CSV upload response:', data);

      if (response.ok) {
        setUploadStatus("success");
        form.reset();
      } else {
        setUploadStatus("error");
        setErrorMessage(data.error || data.details || "Failed to upload CSV file");
      }
    } catch (error) {
      console.error("Error uploading CSV:", error);
      setUploadStatus("error");
      setErrorMessage("An unexpected error occurred");
    } finally {
      setIsUploading(false);
    }
  }

  const completeUpload = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      router.push('/dashboard/employees');
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg max-h-[400px] overflow-y-auto">
      <h2 className="text-lg font-semibold mb-2 text-black">CSV Employee Data Upload</h2>
      <p className="text-black mb-4 text-sm">
        Upload your organization's employee data using a CSV file.
      </p>

      {uploadStatus === "success" && (
        <div className="mb-4 bg-green-50 border-l-4 border-green-400 p-3 flex items-start">
          <FiCheckCircle className="text-green-500 mt-0.5 mr-2" size={16} />
          <div>
            <p className="text-green-700 text-sm font-medium">Upload successful!</p>
          </div>
        </div>
      )}

      {uploadStatus === "error" && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-3 flex items-start">
          <FiAlertTriangle className="text-red-500 mt-0.5 mr-2" size={16} />
          <div>
            <p className="text-red-700 text-sm">{errorMessage}</p>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="csvFile"
            render={({ field: { onChange, value, ...field } }) => (
              <FormItem>
                <FormLabel className="text-sm">CSV File</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="file"
                    accept=".csv"
                    onChange={(e) => onChange(e.target.files)}
                    className="border border-gray-300 rounded-md p-2 w-full text-sm"
                  />
                </FormControl>
                <FormDescription className="text-black text-xs">
                  Include columns: name, email, position, department
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-between pt-2">
            
            <Button 
              type="submit" 
              disabled={isUploading}
              size="sm"
              className="flex items-center text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isUploading ? (
                <>
                  <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                  Uploading...
                </>
              ) : (
                <>
                  <FiUpload className="mr-1" size={14} />
                  Upload CSV
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
      
      {uploadStatus === "success" && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <Button
            onClick={completeUpload}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Complete Upload
          </Button>
        </div>
      )}
    </div>
  );
} 