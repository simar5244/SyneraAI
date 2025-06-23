"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChangeEvent, useEffect, useState, useCallback, FormEvent } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import ProjectDisplayCard from "./ProjectDisplayCard";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  fetchProjects,
  addNewProject,
  searchUsers,
  addUserToProject,
  removeUserFromProject,
  assignedTasks,
  fetchTasks,
  unassignTask,
  assignTask,
  addToolToUser,
  removeToolFromUser,
} from "./api";
import { toast } from "react-hot-toast";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import AddProjectModal from "./AddProjectModal";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: "planning" | "in-progress" | "review" | "completed";
  priority: "low" | "medium" | "high" | "critical";
  startDate: string;
  endDate?: string;
  department?: string;
  memberCount?: number;
  progress?: number;
  employees: Array<string | { email?: string; employee_email?: string; }>;
  total_budget: number;
  createdByRole: string;
  isManagementProject: boolean;
  viewers: Array<string | { email?: string; user_email?: string; }>;
  visibleToAll: boolean;
  hasAccess: boolean;
}

interface Task {
  id: string;
  task_title?: string;
  task_description?: string;
  task_status?: string;
  assigned_user_id?: string;
  project_id?: string;
}

interface User {
  id: string;
  name?: string;
  email?: string;
  picture?: string;
  role?: string;
}

interface UserTechnology {
  userId: string;
  technology: string;
}

interface AssignedUser {
  userId?: string;
  name?: string;
  email?: string;
  technologies: string[];
}

interface UserAssignment {
  id: string;
  project_id?: string;
  user_id?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchUserTerm, setSearchUserTerm] = useState<string>("");
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [searchingUsers, setSearchingUsers] = useState<boolean>(false);
  const [addingUser, setAddingUser] = useState<boolean>(false);
  const [removingUser, setRemovingUser] = useState<boolean>(false);
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
  const [assigningTask, setAssigningTask] = useState<boolean>(false);
  const [unassigningTask, setUnassigningTask] = useState<boolean>(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [creatingProject, setCreatingProject] = useState<boolean>(false);
  const [addingTool, setAddingTool] = useState<boolean>(false);
  const [addToolUserId, setAddToolUserId] = useState<string | null>(null);
  const [newTool, setNewTool] = useState<string>("");
  const [removingTool, setRemovingTool] = useState<boolean>(false);
  const [removeToolUserId, setRemoveToolUserId] = useState<string | null>(null);
  const [toolToRemove, setToolToRemove] = useState<string>("");
  const [sortOption, setSortOption] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showInlineForm, setShowInlineForm] = useState(false);
  const [inlineData, setInlineData] = useState({
    name: "",
    description: "",
    status: "planning" as const,
    priority: "low" as const,
    startDate: "",
    endDate: "",
    department: "",
    total_budget: "" as string | number,
  });

  const [quickFormData, setQuickFormData] = useState({
    name: "",
    description: "",
    status: "planning" as const,
    priority: "low" as const,
    startDate: "",
    endDate: "",
    department: "",
    total_budget: 0 as number,
  });

  const onSubmitInline = async (e: React.FormEvent) => {
    e.preventDefault();
    // Convert total_budget to number before sending
    const inlineDataWithNumberBudget = {
      ...inlineData,
      total_budget: parseFloat(inlineData.total_budget) || 0
    };
    await handleAddProject(inlineDataWithNumberBudget);
    setInlineData({
      name: "",
      description: "",
      status: "planning",
      priority: "low",
      startDate: "",
      endDate: "",
      department: "",
      total_budget: "",
    });
    setShowInlineForm(false);
  };

  const onSubmitQuick = async (e: FormEvent) => {
    e.preventDefault();
    // Ensure total_budget is a number
    const quickFormDataWithNumberBudget = {
      ...quickFormData,
      total_budget: typeof quickFormData.total_budget === 'string' 
        ? parseFloat(quickFormData.total_budget) || 0 
        : quickFormData.total_budget
    };
    await handleAddProject(quickFormDataWithNumberBudget);
    setQuickFormData({ 
      name: "", 
      description: "", 
      status: "planning", 
      priority: "low", 
      startDate: "", 
      endDate: "", 
      department: "", 
      total_budget: 0 
    });
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projects) filterProjects();
  }, [searchTerm, departmentFilter, sortOption, projects]);

  useEffect(() => {
    if (currentProject) {
      loadAssignedUsers(currentProject);
      loadTasks(currentProject);
    }
  }, [currentProject]);

  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      setErrorMessage(null);
      console.log("%c FETCHING PROJECTS WITH PERMISSION FILTERING", "background: #3f51b5; color: white; padding: 4px; font-size: 16px; font-weight: bold;");
      const result = await fetchProjects();

      console.log("%c API RESPONSE:", "background: #2196f3; color: white; padding: 2px;", result);

      if (result.error) {
        setErrorMessage(result.error);
        setProjects([]);
        setFilteredProjects([]);
        toast.error(`Error: ${result.error}`);
        return;
      }

      if (result?.projects && Array.isArray(result.projects)) {
        // Clear any caching by creating completely new objects
        const formattedProjects = result.projects.map((p: any) => {
          const id = p.id || p._id?.toString() || "";
          const name = p.name || p.project_title || p.Project_Name || "";
          // Log every project we receive for debugging
          console.log(`Project: ${name}, Management: ${p.isManagementProject ? 'YES' : 'NO'}, Creator Role: ${p.createdByRole || 'unknown'}`);
          
          return {
            id,
            name,
            description: p.project_description ?? p.description ?? "",
            status: p.status ?? p.project_status ?? "planning",
            priority: p.priority ?? "low",
            startDate: p.start_date ?? p.startDate ?? "",
            endDate: p.end_date ?? p.endDate ?? "",
            department: p.department ?? p.Department_A ?? "",
            memberCount: Array.isArray(p.employee_contributions) ? p.employee_contributions.length : 0,
            progress: p.progress ?? 0,
            employees: Array.isArray(p.employees) ? p.employees : (Array.isArray(p.employee_contributions) ? p.employee_contributions.map((c: any) => c.name) : []),
            total_budget: p.total_budget ?? 0,
            createdByRole: p.createdByRole || '',
            isManagementProject: p.isManagementProject || ['top_management_tier_1', 'top_management_tier_2', 'top_management_tier_3'].includes(p.createdByRole) || false,
            viewers: p.viewers || [],
            visibleToAll: p.visibleToAll || false,
            hasAccess: true // The API already filtered these, so they have access
          };
        });

        console.log("%c FORMATTED PROJECTS:", "background: #4caf50; color: white; padding: 2px;", formattedProjects);
        setProjects(formattedProjects);
        setFilteredProjects(formattedProjects);
      } else {
        console.error("Invalid projects data:", result);
        setProjects([]);
        setFilteredProjects([]);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load projects");
      setProjects([]);
      setFilteredProjects([]);
      toast.error("Failed to load projects. Please try again.");
    } finally {
      setLoadingProjects(false);
    }
  };

  const filterProjects = useCallback(() => {
    if (!projects) return;

    let filtered = [...projects];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) => {
          // Check project name
          if (p.name.toLowerCase().includes(term)) return true;
          
          // Check project description
          if (p.description?.toLowerCase().includes(term)) return true;
          
          // Check employees (handle both string and object types)
          if (p.employees.some(e => {
            if (typeof e === 'string') {
              return e.toLowerCase().includes(term);
            }
            return false; // Object type employees are handled differently
          })) return true;
          
          return false;
        }
      );
    }

    // Filter by department
    if (departmentFilter !== "all") {
      filtered = filtered.filter((p) => p.department === departmentFilter);
    }

    // Sort projects
    switch (sortOption) {
      case "start_earliest":
        filtered.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        break;
      case "start_latest":
        filtered.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        break;
      case "end_earliest":
        filtered.sort((a, b) => (a.endDate ? new Date(a.endDate).getTime() : 0) - (b.endDate ? new Date(b.endDate).getTime() : 0));
        break;
      case "end_latest":
        filtered.sort((a, b) => (b.endDate ? new Date(b.endDate).getTime() : 0) - (a.endDate ? new Date(a.endDate).getTime() : 0));
        break;
      case "budget_low":
        filtered.sort((a, b) => a.total_budget - b.total_budget);
        break;
      case "budget_high":
        filtered.sort((a, b) => b.total_budget - a.total_budget);
        break;
      default:
        break;
    }

    setFilteredProjects(filtered);
  }, [searchTerm, departmentFilter, sortOption, projects]);

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleDepartmentFilterChange = (value: string) => setDepartmentFilter(value);

  const handleSortChange = (value: string) => setSortOption(value);

  const handleAddProject = async (projectData: any): Promise<{ success: boolean; error?: string }> => {
    try {
      setCreatingProject(true);
      
      // Get current user info
      let currentUserData = null;
      try {
        const userResponse = await fetch('/api/auth/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.user) {
            currentUserData = userData.user;
          }
        }
      } catch (err) {
        console.error('Error fetching current user:', err);
      }
      
      // Ensure project is visible by default
      const dataToSubmit = {
        ...projectData,
        visibleToAll: projectData.visibleToAll !== false, // Default to true
        creatorEmail: currentUserData?.email,
        creatorName: currentUserData?.name,
        creatorRole: currentUserData?.role,
        total_budget: parseFloat(projectData.total_budget) || 0 // Convert to number
      };
      
      // Create URL with query params for auth context
      let url = '/api/projects';
      if (currentUserData) {
        const params = new URLSearchParams();
        if (currentUserData.id) params.append('userId', currentUserData.id);
        if (currentUserData.email) params.append('userEmail', currentUserData.email);
        if (currentUserData.role) params.append('userRole', currentUserData.role);
        if (params.toString()) url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSubmit),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Project created successfully!');
        await loadProjects();
        setIsDialogOpen(false); // Close the modal on success
      } 
      return result;
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
      return { success: false, error: (error as Error).message };
    } finally {
      setCreatingProject(false);
    }
  };

  const handleSearchUsers = async (term: string) => {
    setSearchUserTerm(term);
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchingUsers(true);
      const result = await searchUsers(term);
      if (result?.users) {
        setSearchResults(result.users);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleSetCurrentProject = (projectId: string) => {
    setCurrentProject(projectId);
  };

  const loadAssignedUsers = async (projectId: string) => {
    try {
      setLoadingUsers(true);
      const usersData = await assignedTasks(projectId);
      if (usersData?.assignedUsers) {
        const formattedData: AssignedUser[] = usersData.assignedUsers.map(
          (user: any) => ({
            userId: user.userId || undefined,
            name: user.name,
            email: user.email,
            technologies: user.technologies || [],
          })
        );
        setAssignedUsers(formattedData);
      }
    } catch (error) {
      console.error("Error loading assigned users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadTasks = async (projectId: string) => {
    try {
      setLoadingTasks(true);
      const result = await fetchTasks(projectId);
      if (result?.tasks) {
        setTasks(result.tasks);
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleAddUserToProject = async (userId: string) => {
    if (!currentProject) return;

    try {
      setAddingUser(true);
      const result = await addUserToProject(currentProject, userId);
      if (result?.success) {
        await loadAssignedUsers(currentProject);
        await loadProjects(); // Refresh projects to update assignments
      }
    } catch (error) {
      console.error("Error adding user to project:", error);
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUserFromProject = async (userId: string) => {
    if (!currentProject) return;

    try {
      setRemovingUser(true);
      const result = await removeUserFromProject(currentProject, userId);
      if (result?.success) {
        await loadAssignedUsers(currentProject);
        await loadProjects(); // Refresh projects to update assignments
      }
    } catch (error) {
      console.error("Error removing user from project:", error);
    } finally {
      setRemovingUser(false);
    }
  };

  const handleAssignTask = async (taskId: string, userId: string) => {
    if (!currentProject) return;

    try {
      setAssigningTask(true);
      setSelectedTaskId(taskId);
      setSelectedUserId(userId);
      const result = await assignTask(taskId, userId);
      if (result?.success) {
        await loadTasks(currentProject);
      }
    } catch (error) {
      console.error("Error assigning task:", error);
    } finally {
      setAssigningTask(false);
      setSelectedTaskId(null);
      setSelectedUserId(null);
    }
  };

  const handleUnassignTask = async (taskId: string) => {
    if (!currentProject) return;

    try {
      setUnassigningTask(true);
      setSelectedTaskId(taskId);
      const result = await unassignTask(taskId);
      if (result?.success) {
        await loadTasks(currentProject);
      }
    } catch (error) {
      console.error("Error unassigning task:", error);
    } finally {
      setUnassigningTask(false);
      setSelectedTaskId(null);
    }
  };

  const handleAddToolToUser = async (userId: string, tool: string) => {
    if (!currentProject || !tool.trim()) return;

    try {
      setAddingTool(true);
      setAddToolUserId(userId);
      const result = await addToolToUser(userId, tool);
      if (result?.success) {
        await loadAssignedUsers(currentProject);
        setNewTool("");
      }
    } catch (error) {
      console.error("Error adding tool:", error);
    } finally {
      setAddingTool(false);
      setAddToolUserId(null);
    }
  };

  const handleRemoveToolFromUser = async (userId: string, tool: string) => {
    if (!currentProject) return;

    try {
      setRemovingTool(true);
      setRemoveToolUserId(userId);
      setToolToRemove(tool);
      const result = await removeToolFromUser(userId, tool);
      if (result?.success) {
        await loadAssignedUsers(currentProject);
      }
    } catch (error) {
      console.error("Error removing tool:", error);
    } finally {
      setRemovingTool(false);
      setRemoveToolUserId(null);
      setToolToRemove("");
    }
  };

  return (
    <div className="relative min-h-screen bg-gray-50 p-4 md:p-8">
      {/* New Heading */}
      <div className="text-center mb-10 md:mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mt-4">
          <span className="text-purple-700">Project</span> Management
        </h1>
        <p className="mt-3 text-lg text-gray-600 max-w-xl mx-auto">
          Organize, track, and manage all your projects efficiently.
        </p>
      </div>
      {/* End New Heading */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 grid grid-cols-3 gap-3 mr-4">
          <div>
            <Input
              id="search"
              name="search"
              autoComplete="off"
              placeholder="Search Project or Employee"
              value={searchTerm}
              onChange={handleSearch}
              className="border-gray-300 text-gray-900"
            />
          </div>
          <div>
            <Select
              value={departmentFilter}
              onValueChange={handleDepartmentFilterChange}
            >
              <SelectTrigger className="border-gray-300 text-gray-900 bg-white">
                <SelectValue placeholder="Filter by department" />
              </SelectTrigger>
              <SelectContent className="bg-white text-gray-900">
                <SelectItem value="all" className="text-gray-900">
                  All Departments
                </SelectItem>
                {Array.from(new Set(projects.map((p) => p.department || "").filter((dep) => dep))).map((dep) => (
                  <SelectItem key={dep} value={dep} className="text-gray-900">
                    {dep}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={sortOption} onValueChange={handleSortChange}>
              <SelectTrigger className="border-gray-300 text-gray-900 bg-white">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent className="bg-white text-gray-900">
                <SelectItem value="start_earliest">Date Started: Earliest</SelectItem>
                <SelectItem value="start_latest">Date Started: Latest</SelectItem>
                <SelectItem value="end_earliest">Date Finished: Earliest</SelectItem>
                <SelectItem value="end_latest">Date Finished: Latest</SelectItem>
                <SelectItem value="budget_low">Budget: Lowest</SelectItem>
                <SelectItem value="budget_high">Budget: Highest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button 
          onClick={() => router.push('/dashboard/projects/create')}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          Add Project
        </Button>
      </div>

      {/* Dialog for Add Project Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
            <DialogDescription>
              Create a new project with all the relevant details.
            </DialogDescription>
          </DialogHeader>
          <AddProjectModal onAddProject={handleAddProject} />
        </DialogContent>
      </Dialog>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <div className="flex">
            <div className="py-1">
              <svg className="h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="font-bold">Authentication Error</p>
              <p className="text-sm">{errorMessage}</p>
              <p className="text-sm mt-2">
                Please ensure you are logged in and have the correct company access. 
                <Button className="text-sm ml-2 bg-red-600 hover:bg-red-700 text-white" 
                  onClick={() => window.location.href = '/login'}>
                  Go to Login
                </Button>
              </p>
            </div>
          </div>
        </div>
      )}

      {loadingProjects ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects
            .filter(project => {
              // Only show projects that the user has access to
              // The API should have filtered these, but we'll double-check here for safety
              
              // Get current user info from local storage
              let currentUser = null;
              try {
                const userJson = localStorage.getItem('user');
                if (userJson) currentUser = JSON.parse(userJson);
              } catch (error) {
                console.error('Error fetching current user from localStorage:', error);
              }
              
              if (!currentUser) return false;
              
              // Check if user is top management (can see all projects)
              const isTopManagement = ['top_management_tier_1', 'top_management_tier_2', 'top_management_tier_3'].includes(currentUser.role || '');
              
              // All projects are visible to top management
              if (isTopManagement) return true;
              
              // Check if the project is marked as visible to all
              if (project.visibleToAll) return true;
              
              // Check if user is a member of the project
              const isMember = Array.isArray(project.employees) && project.employees.some(
                (emp) => {
                  if (typeof emp === 'string') 
                    return emp === currentUser.email;
                  else 
                    return (emp && typeof emp === 'object' && 
                      ('email' in emp ? emp.email === currentUser.email : false) || 
                      ('employee_email' in emp ? emp.employee_email === currentUser.email : false));
                }
              );
              
              if (isMember) return true;
              
              // Check if user is a viewer of the project
              const isViewer = Array.isArray(project.viewers) && project.viewers.some(
                (viewer) => {
                  if (typeof viewer === 'string')
                    return viewer === currentUser.email;
                  else
                    return (viewer && typeof viewer === 'object' && 
                      ('email' in viewer ? viewer.email === currentUser.email : false) || 
                      ('user_email' in viewer ? viewer.user_email === currentUser.email : false));
                }
              );
              
              if (isViewer) return true;
              
              // If none of the conditions are met, user doesn't have access
              return false;
            })
            .map((project) => (
              <ProjectDisplayCard
                key={project.id}
                project={project}
                onClick={() => handleSetCurrentProject(project.id)}
              />
            ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-600">
          <p className="text-lg">No projects found. Create a new project to get started.</p>
        </div>
      )}

      {currentProject && (
        <div className="mt-8 border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">
            Project Management:{" "}
            {projects.find((p) => p.id === currentProject)?.name || "Project"}
          </h2>
          {/* Project details summary */}
          {(() => {
            const selected = projects.find((p) => p.id === currentProject);
            return selected ? (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <strong>Description:</strong> {selected.description || "N/A"}
                </div>
                <div>
                  <strong>Status:</strong> {selected.status}
                </div>
                <div>
                  <strong>Priority:</strong> {selected.priority}
                </div>
                <div>
                  <strong>Department:</strong> {selected.department || "N/A"}
                </div>
                <div>
                  <strong>Employees:</strong> {selected.employees.join(", ")}
                </div>
                <div>
                  <strong>Budget:</strong> {selected.total_budget}
                </div>
              </div>
            ) : null;
          })()}
          <Tabs defaultValue="users">
            <TabsList className="mb-4">
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Add Users</h3>
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Search for users..."
                    value={searchUserTerm}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                  />
                </div>

                {searchingUsers ? (
                  <div>Searching...</div>
                ) : (
                  searchResults.length > 0 && (
                    <div className="border rounded-md p-4 mb-4">
                      <h4 className="font-medium mb-2">Search Results</h4>
                      <ul className="space-y-2">
                        {searchResults.map((user) => (
                          <li
                            key={user.id}
                            className="flex justify-between items-center"
                          >
                            <div>
                              {user.name} ({user.email})
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleAddUserToProject(user.id)}
                              disabled={addingUser}
                            >
                              {addingUser ? "Adding..." : "Add to Project"}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                )}

                <h3 className="text-lg font-semibold mb-2">Assigned Users</h3>
                {loadingUsers ? (
                  <div>Loading users...</div>
                ) : assignedUsers.length === 0 ? (
                  <div>No users assigned to this project.</div>
                ) : (
                  <div className="space-y-4">
                    {assignedUsers.map((user) => (
                      <div
                        key={user.userId}
                        className="border rounded-md p-4 space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">{user.name}</h4>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              user.userId &&
                              handleRemoveUserFromProject(user.userId)
                            }
                            disabled={removingUser}
                          >
                            {removingUser ? "Removing..." : "Remove"}
                          </Button>
                        </div>

                        <div>
                          <h5 className="text-sm font-medium mb-1">
                            Technologies
                          </h5>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {user.technologies.length === 0 ? (
                              <span className="text-sm text-gray-500">
                                No technologies assigned
                              </span>
                            ) : (
                              user.technologies.map((tech, index) => (
                                <div
                                  key={index}
                                  className="bg-gray-100 px-2 py-1 rounded-md text-sm flex items-center"
                                >
                                  {tech}
                                  <button
                                    className="ml-1 text-red-500"
                                    onClick={() =>
                                      user.userId &&
                                      handleRemoveToolFromUser(user.userId, tech)
                                    }
                                    disabled={
                                      removingTool &&
                                      removeToolUserId === user.userId &&
                                      toolToRemove === tech
                                    }
                                  >
                                    ×
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Input
                              placeholder="Add technology..."
                              value={
                                addToolUserId === user.userId ? newTool : ""
                              }
                              onChange={(e) => setNewTool(e.target.value)}
                              size="sm"
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                user.userId &&
                                handleAddToolToUser(user.userId, newTool)
                              }
                              disabled={
                                addingTool && addToolUserId === user.userId
                              }
                            >
                              {addingTool && addToolUserId === user.userId
                                ? "Adding..."
                                : "Add"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tasks">
              <div>
                <h3 className="text-lg font-semibold mb-2">Project Tasks</h3>
                {loadingTasks ? (
                  <div>Loading tasks...</div>
                ) : tasks.length === 0 ? (
                  <div>No tasks for this project.</div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="border rounded-md p-4 space-y-2"
                      >
                        <div className="flex justify-between">
                          <div>
                            <h4 className="font-medium">
                              {task.task_title || "Untitled Task"}
                            </h4>
                            <p className="text-sm">
                              {task.task_description || "No description"}
                            </p>
                            <p className="text-xs text-gray-500">
                              Status: {task.task_status || "Not set"}
                            </p>
                          </div>
                          <div>
                            {task.assigned_user_id ? (
                              <div className="flex items-center">
                                <span className="text-sm mr-2">
                                  Assigned to:{" "}
                                  {assignedUsers.find(
                                    (u) => u.userId === task.assigned_user_id
                                  )?.name || "Unknown"}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnassignTask(task.id)}
                                  disabled={
                                    unassigningTask &&
                                    selectedTaskId === task.id
                                  }
                                >
                                  {unassigningTask && selectedTaskId === task.id
                                    ? "Unassigning..."
                                    : "Unassign"}
                                </Button>
                              </div>
                            ) : (
                              <div>
                                <Select
                                  onValueChange={(userId) =>
                                    handleAssignTask(task.id, userId)
                                  }
                                  disabled={
                                    assigningTask && selectedTaskId === task.id
                                  }
                                >
                                  <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Assign to user" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {assignedUsers.map((user) => (
                                      <SelectItem
                                        key={user.userId}
                                        value={user.userId || ""}
                                      >
                                        {user.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}