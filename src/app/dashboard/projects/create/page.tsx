"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import AddProjectModal from "../AddProjectModal";
import { addNewProject } from "../api";
import { toast } from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

export default function CreateProjectPage() {
  const router = useRouter();
  const [creatingProject, setCreatingProject] = useState(false);

  const handleAddProject = async (projectData: any): Promise<{ success: boolean; error?: string }> => {
    setCreatingProject(true);
    try {
      console.log("Submitting project data to API:", projectData);
      const result = await addNewProject(projectData);
      console.log("Project creation result:", result);

      if (result.success) {
        // Wait a moment to ensure the project data is fully processed
        await new Promise(resolve => setTimeout(resolve, 500));
        // Redirect to the specific project detail page rather than just the projects list
        if (result.projectId) {
          router.push(`/dashboard/projects/${result.projectId}`);
        } else {
          router.push("/dashboard/projects");
        }
      } else {
        toast.error(result.error || "Failed to create project");
      }
      return result;
    } catch (err: any) {
      console.error("Error adding project:", err);
      toast.error("An unexpected error occurred");
      return { success: false, error: err.message };
    } finally {
      setCreatingProject(false);
    }
  };

  return (
    <div className="min-h-screen overflow-auto p-6 bg-gray-50 text-gray-800">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
            onClick={() => router.push("/dashboard/projects")}
          >
            <ArrowLeft size={16} />
            Back to Projects
          </Button>
          
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Create New Project</h1>
          <p className="text-gray-500">Fill in the details below to create a new project.</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <AddProjectModal onAddProject={handleAddProject} />
        </div>
      </div>
    </div>
  );
}