'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CalendarIcon, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Define the task schema
const taskSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  assignees: z.array(z.string()).optional(),
  estimatedHours: z.number().min(0, "Hours cannot be negative").optional(),
  technologies: z.array(z.string()).optional(),
});

// Define the project schema
const projectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  startDate: z.date({
    required_error: "Start date is required.",
  }),
  endDate: z.date({
    required_error: "End date is required.",
  }),
  teamMembers: z.array(z.string()).min(1, "At least one team member is required."),
  tasks: z.array(taskSchema).optional(),
  technologies: z.array(z.string()).optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function CreateProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [teamMemberInput, setTeamMemberInput] = useState("");
  const [technologyInput, setTechnologyInput] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [currentTask, setCurrentTask] = useState({
    title: "",
    description: "",
    assignees: [] as string[],
    estimatedHours: 0,
    technologies: [] as string[],
  });
  const [taskAssigneeInput, setTaskAssigneeInput] = useState("");
  const [taskTechnologyInput, setTaskTechnologyInput] = useState("");
  
  // Initialize the form
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      teamMembers: [],
      tasks: [],
      technologies: [],
    },
  });
  
  const { setValue, watch } = form;
  const teamMembers = watch("teamMembers") || [];
  const technologies = watch("technologies") || [];
  
  // Team member handlers
  const handleAddTeamMember = () => {
    if (!teamMemberInput.trim()) return;
    if (!teamMemberInput.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    if (teamMembers.includes(teamMemberInput)) {
      toast.error("Team member already added");
      return;
    }
    
    setValue("teamMembers", [...teamMembers, teamMemberInput]);
    setTeamMemberInput("");
  };
  
  const handleRemoveTeamMember = (member: string) => {
    setValue("teamMembers", teamMembers.filter((m) => m !== member));
  };
  
  // Technology handlers
  const handleAddTechnology = () => {
    if (!technologyInput.trim()) return;
    
    if (technologies?.includes(technologyInput)) {
      toast.error("Technology already added");
      return;
    }
    
    setValue("technologies", [...(technologies || []), technologyInput]);
    setTechnologyInput("");
  };
  
  const handleRemoveTechnology = (tech: string) => {
    setValue("technologies", technologies?.filter((t) => t !== tech));
  };
  
  // Task handlers
  const handleAddTaskAssignee = () => {
    if (!taskAssigneeInput.trim()) return;
    if (!taskAssigneeInput.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    if (currentTask.assignees.includes(taskAssigneeInput)) {
      toast.error("Assignee already added");
      return;
    }
    
    setCurrentTask({
      ...currentTask,
      assignees: [...currentTask.assignees, taskAssigneeInput],
    });
    setTaskAssigneeInput("");
  };
  
  const handleRemoveTaskAssignee = (assignee: string) => {
    setCurrentTask({
      ...currentTask,
      assignees: currentTask.assignees.filter((a) => a !== assignee),
    });
  };
  
  const handleAddTaskTechnology = () => {
    if (!taskTechnologyInput.trim()) return;
    
    if (currentTask.technologies.includes(taskTechnologyInput)) {
      toast.error("Technology already added to task");
      return;
    }
    
    setCurrentTask({
      ...currentTask,
      technologies: [...currentTask.technologies, taskTechnologyInput],
    });
    setTaskTechnologyInput("");
  };
  
  const handleRemoveTaskTechnology = (tech: string) => {
    setCurrentTask({
      ...currentTask,
      technologies: currentTask.technologies.filter((t) => t !== tech),
    });
  };
  
  const handleAddTask = () => {
    if (!currentTask.title.trim()) {
      toast.error("Task title is required");
      return;
    }
    
    setTasks([...tasks, { ...currentTask, id: Date.now() }]);
    setValue("tasks", [...tasks, currentTask]);
    
    // Reset the current task
    setCurrentTask({
      title: "",
      description: "",
      assignees: [],
      estimatedHours: 0,
      technologies: [],
    });
  };
  
  const handleRemoveTask = (taskId: number) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    setTasks(updatedTasks);
    setValue("tasks", updatedTasks);
  };
  
  // Form submission
  async function onSubmit(data: ProjectFormValues) {
    setLoading(true);
    
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || "Failed to create project");
      }
      
      toast.success("Project created successfully!");
      router.push(`/projects/${result.projectId}`);
    } catch (error: any) {
      toast.error(error.message || "An error occurred while creating the project");
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Create New Project</h1>
      
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="details">Project Details</TabsTrigger>
          <TabsTrigger value="tasks">Tasks & Team</TabsTrigger>
        </TabsList>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-6">
            <TabsContent value="details">
              <Card>
                <CardHeader>
                  <CardTitle>Project Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter project name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the project goals, scope, and requirements"
                            rows={5}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Start Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>End Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div>
                    <FormLabel>Technologies</FormLabel>
                    <FormDescription>
                      Add the technologies used in this project
                    </FormDescription>
                    
                    <div className="flex gap-2 mt-2 mb-3">
                      <Input
                        placeholder="Add technology (e.g., React, Python, AWS)"
                        value={technologyInput}
                        onChange={(e) => setTechnologyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTechnology();
                          }
                        }}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        onClick={handleAddTechnology}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {technologies?.map((tech) => (
                        <Badge key={tech} variant="secondary" className="gap-1">
                          {tech}
                          <button
                            type="button"
                            onClick={() => handleRemoveTechnology(tech)}
                            className="ml-1 rounded-full h-4 w-4 flex items-center justify-center text-xs"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="tasks">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Team Members</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <FormLabel>Add Team Members</FormLabel>
                    <FormDescription>
                      Enter team members' email addresses
                    </FormDescription>
                    
                    <div className="flex gap-2 mt-2 mb-3">
                      <Input
                        placeholder="Email address (e.g., user@example.com)"
                        value={teamMemberInput}
                        onChange={(e) => setTeamMemberInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTeamMember();
                          }
                        }}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        onClick={handleAddTeamMember}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {teamMembers.map((member) => (
                        <Badge key={member} variant="secondary" className="gap-1">
                          {member}
                          <button
                            type="button"
                            onClick={() => handleRemoveTeamMember(member)}
                            className="ml-1 rounded-full h-4 w-4 flex items-center justify-center text-xs"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    
                    {form.formState.errors.teamMembers && (
                      <p className="text-sm text-red-500 mt-2">
                        {form.formState.errors.teamMembers.message}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Project Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-medium mb-4">Add New Task</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <FormLabel>Task Title</FormLabel>
                        <Input
                          placeholder="Enter task title"
                          value={currentTask.title}
                          onChange={(e) => setCurrentTask({...currentTask, title: e.target.value})}
                        />
                      </div>
                      
                      <div>
                        <FormLabel>Description</FormLabel>
                        <Textarea
                          placeholder="Describe the task"
                          rows={3}
                          value={currentTask.description}
                          onChange={(e) => setCurrentTask({...currentTask, description: e.target.value})}
                        />
                      </div>
                      
                      <div>
                        <FormLabel>Estimated Hours</FormLabel>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Hours"
                          value={currentTask.estimatedHours || ""}
                          onChange={(e) => setCurrentTask({
                            ...currentTask, 
                            estimatedHours: parseInt(e.target.value) || 0
                          })}
                        />
                      </div>
                      
                      <div>
                        <FormLabel>Assignees</FormLabel>
                        <div className="flex gap-2 mt-2 mb-2">
                          <Input
                            placeholder="@ mention a team member"
                            value={taskAssigneeInput}
                            onChange={(e) => setTaskAssigneeInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTaskAssignee();
                              }
                            }}
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon"
                            onClick={handleAddTaskAssignee}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          {currentTask.assignees.map((assignee) => (
                            <Badge key={assignee} variant="secondary" className="gap-1">
                              {assignee}
                              <button
                                type="button"
                                onClick={() => handleRemoveTaskAssignee(assignee)}
                                className="ml-1 rounded-full h-4 w-4 flex items-center justify-center text-xs"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <FormLabel>Technologies</FormLabel>
                        <div className="flex gap-2 mt-2">
                          <Input
                            placeholder="Technologies used for this task"
                            value={taskTechnologyInput}
                            onChange={(e) => setTaskTechnologyInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTaskTechnology();
                              }
                            }}
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon"
                            onClick={handleAddTaskTechnology}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mt-2">
                          {currentTask.technologies.map((tech) => (
                            <Badge key={tech} variant="secondary" className="gap-1">
                              {tech}
                              <button
                                type="button"
                                onClick={() => handleRemoveTaskTechnology(tech)}
                                className="ml-1 rounded-full h-4 w-4 flex items-center justify-center text-xs"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <Button 
                        type="button" 
                        onClick={handleAddTask}
                        className="w-full"
                      >
                        Add Task
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">Task List</h3>
                    
                    {tasks.length === 0 ? (
                      <div className="text-center p-4 border border-dashed rounded-lg">
                        <p className="text-muted-foreground">No tasks added yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {tasks.map((task, index) => (
                          <div key={task.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">{task.title}</h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveTask(task.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            {task.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {task.description}
                              </p>
                            )}
                            
                            <div className="text-sm">
                              <span className="font-medium">Hours: </span>
                              {task.estimatedHours || 0}
                            </div>
                            
                            {task.assignees.length > 0 && (
                              <div className="mt-2">
                                <span className="text-sm font-medium">Assignees: </span>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {task.assignees.map((assignee: string) => (
                                    <Badge key={assignee} variant="secondary">
                                      {assignee}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {task.technologies.length > 0 && (
                              <div className="mt-2">
                                <span className="text-sm font-medium">Technologies: </span>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {task.technologies.map((tech: string) => (
                                    <Badge key={tech} variant="outline">
                                      {tech}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </div>
          </form>
        </Form>
      </Tabs>
    </div>
  );
} 