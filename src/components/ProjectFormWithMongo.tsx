'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaTimes, FaPlus, FaExclamationCircle } from 'react-icons/fi';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// Form validation schema
const employeeContributionSchema = z.object({
  employeeId: z.string().min(1, "Please select an employee"),
  employeeName: z.string(),
  role: z.string().min(1, "Role is required"),
  hoursPerWeek: z.number().min(1, "Hours must be at least 1"),
  tasks: z.array(z.object({
    description: z.string().min(3, "Task description is required"),
    hours: z.number().min(1, "Hours must be at least 1"),
    status: z.string().default("Not Started")
  }))
});

const projectSchema = z.object({
  project_title: z.string().min(2, {
    message: "Project title must be at least 2 characters.",
  }),
  project_description: z.string().min(10, {
    message: "Project description must be at least 10 characters.",
  }),
  start_date: z.date(),
  end_date: z.date().optional(),
  department: z.string().min(1, {
    message: "Department is required."
  }),
  status: z.string().default("Planning"),
  priority: z.string().default("Medium"),
  total_hours: z.number().min(1, {
    message: "Total hours must be at least 1."
  }),
  budget: z.number().optional(),
  tech_stack: z.array(z.string()).optional(),
  methodologies: z.array(z.string()).optional(),
  employee_contributions: z.array(employeeContributionSchema)
});

export default function ProjectFormWithMongo() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [techStackOptions, setTechStackOptions] = useState([
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'React', 'Angular', 
    'Vue.js', 'Node.js', 'Django', 'Spring Boot', 'SharePoint', 'Power Apps', 
    'Office 365', 'Teams', 'Jira', 'Asana', 'Trello', 'Smartsheet'
  ]);
  const [selectedTechStack, setSelectedTechStack] = useState<string[]>([]);
  const [methodologies, setMethodologies] = useState([
    'Agile', 'Scrum', 'Kanban', 'Waterfall', 'Lean', 'Six Sigma', 'DevOps', 'Design Thinking'
  ]);
  const [selectedMethodologies, setSelectedMethodologies] = useState<string[]>([]);
  
  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      project_title: '',
      project_description: '',
      start_date: new Date(),
      department: '',
      status: 'Planning',
      priority: 'Medium',
      total_hours: 0,
      tech_stack: [],
      methodologies: [],
      employee_contributions: []
    }
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "employee_contributions",
  });
  
  // Fetch employees on component mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch('/api/employees');
        if (response.ok) {
          const data = await response.json();
          setEmployees(data);
        } else {
          // Use mock data if API fails
          setEmployees([
            { id: 'emp-001', name: 'John Doe', position: 'Developer' },
            { id: 'emp-002', name: 'Jane Smith', position: 'Designer' },
            { id: 'emp-003', name: 'Mike Johnson', position: 'Project Manager' }
          ]);
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
        // Use mock data on error
        setEmployees([
          { id: 'emp-001', name: 'John Doe', position: 'Developer' },
          { id: 'emp-002', name: 'Jane Smith', position: 'Designer' },
          { id: 'emp-003', name: 'Mike Johnson', position: 'Project Manager' }
        ]);
      }
    };
    
    fetchEmployees();
  }, []);
  
  // Handle form submission
  async function onSubmit(data: z.infer<typeof projectSchema>) {
    setIsSubmitting(true);
    setSubmitError('');
    
    try {
      // Calculate total hours from employee contributions
      let calculatedTotalHours = 0;
      data.employee_contributions.forEach(contribution => {
        contribution.tasks.forEach(task => {
          calculatedTotalHours += task.hours;
        });
      });
      
      // Update total hours
      data.total_hours = calculatedTotalHours;
      
      // Add tech stack and methodologies
      data.tech_stack = selectedTechStack;
      data.methodologies = selectedMethodologies;
      
      // Send data to API
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create project');
      }
      
      // Handle successful submission
      router.push('/projects');
    } catch (error: any) {
      console.error('Error creating project:', error);
      setSubmitError(error.message || 'An error occurred while creating the project');
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const handleAddTask = (contributionIndex: number) => {
    const currentContributions = form.getValues("employee_contributions");
    if (!currentContributions[contributionIndex].tasks) {
      currentContributions[contributionIndex].tasks = [];
    }
    
    currentContributions[contributionIndex].tasks.push({
      description: '',
      hours: 1,
      status: 'Not Started'
    });
    
    form.setValue("employee_contributions", currentContributions);
  };
  
  const handleRemoveTask = (contributionIndex: number, taskIndex: number) => {
    const currentContributions = form.getValues("employee_contributions");
    currentContributions[contributionIndex].tasks.splice(taskIndex, 1);
    form.setValue("employee_contributions", currentContributions);
  };
  
  const handleTechStackChange = (tech: string) => {
    if (selectedTechStack.includes(tech)) {
      setSelectedTechStack(prev => prev.filter(item => item !== tech));
    } else {
      setSelectedTechStack(prev => [...prev, tech]);
    }
  };
  
  const handleMethodologyChange = (methodology: string) => {
    if (selectedMethodologies.includes(methodology)) {
      setSelectedMethodologies(prev => prev.filter(item => item !== methodology));
    } else {
      setSelectedMethodologies(prev => [...prev, methodology]);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h1 className="text-2xl font-bold mb-6">Create New Project</h1>
      
      {submitError && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FaExclamationCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          </div>
        </div>
      )}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="project_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter project title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Engineering">Engineering</SelectItem>
                      <SelectItem value="Product">Product</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="project_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe the project objectives, scope, and deliverables" 
                    className="min-h-[120px]"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field}
                      value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field}
                      value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                      onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budget (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Enter budget amount" 
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Planning">Planning</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Technologies & Methodologies</h3>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Tech Stack</h4>
              <div className="flex flex-wrap gap-2">
                {techStackOptions.map((tech) => (
                  <label key={tech} className="flex items-center space-x-2 bg-gray-100 rounded-md px-3 py-1">
                    <Checkbox 
                      checked={selectedTechStack.includes(tech)}
                      onCheckedChange={() => handleTechStackChange(tech)}
                    />
                    <span className="text-sm">{tech}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Methodologies</h4>
              <div className="flex flex-wrap gap-2">
                {methodologies.map((methodology) => (
                  <label key={methodology} className="flex items-center space-x-2 bg-gray-100 rounded-md px-3 py-1">
                    <Checkbox 
                      checked={selectedMethodologies.includes(methodology)}
                      onCheckedChange={() => handleMethodologyChange(methodology)}
                    />
                    <span className="text-sm">{methodology}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Team & Tasks</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() => append({
                  employeeId: '',
                  employeeName: '',
                  role: '',
                  hoursPerWeek: 0,
                  tasks: []
                })}
                className="flex items-center"
              >
                <FaPlus className="mr-2" />
                Add Team Member
              </Button>
            </div>
            
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-md bg-gray-50 space-y-4">
                <div className="flex justify-between">
                  <h4 className="font-medium">Team Member {index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => remove(index)}
                    size="sm"
                  >
                    <FaTimes />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`employee_contributions.${index}.employeeId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            const selectedEmployee = employees.find(emp => emp.id === value);
                            form.setValue(`employee_contributions.${index}.employeeName`, selectedEmployee?.name || '');
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employees.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.name} ({employee.position})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name={`employee_contributions.${index}.role`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role in Project</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Project Lead">Project Lead</SelectItem>
                            <SelectItem value="Developer">Developer</SelectItem>
                            <SelectItem value="Designer">Designer</SelectItem>
                            <SelectItem value="QA Engineer">QA Engineer</SelectItem>
                            <SelectItem value="Business Analyst">Business Analyst</SelectItem>
                            <SelectItem value="Subject Matter Expert">Subject Matter Expert</SelectItem>
                            <SelectItem value="Technical Writer">Technical Writer</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name={`employee_contributions.${index}.hoursPerWeek`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours Per Week</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="text-sm font-medium">Tasks</h5>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddTask(index)}
                      className="flex items-center text-xs"
                    >
                      <FaPlus className="mr-1" />
                      Add Task
                    </Button>
                  </div>
                  
                  {form.getValues().employee_contributions[index]?.tasks?.map((task, taskIndex) => (
                    <div key={taskIndex} className="p-3 border rounded bg-white space-y-3">
                      <div className="flex justify-between">
                        <h6 className="text-xs font-medium">Task {taskIndex + 1}</h6>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTask(index, taskIndex)}
                          className="h-6 w-6 p-0"
                        >
                          <FaTimes size={14} />
                        </Button>
                      </div>
                      
                      <FormField
                        control={form.control}
                        name={`employee_contributions.${index}.tasks.${taskIndex}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Description</FormLabel>
                            <FormControl>
                              <Input placeholder="Task description" {...field} className="text-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name={`employee_contributions.${index}.tasks.${taskIndex}.hours`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Hours</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  className="text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name={`employee_contributions.${index}.tasks.${taskIndex}.status`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Not Started">Not Started</SelectItem>
                                  <SelectItem value="In Progress">In Progress</SelectItem>
                                  <SelectItem value="Completed">Completed</SelectItem>
                                  <SelectItem value="Blocked">Blocked</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                  
                  {(!form.getValues().employee_contributions[index]?.tasks || 
                    form.getValues().employee_contributions[index]?.tasks.length === 0) && (
                    <div className="text-center p-4 border border-dashed rounded bg-gray-50">
                      <p className="text-sm text-gray-500">No tasks added yet. Click "Add Task" to create tasks.</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {fields.length === 0 && (
              <div className="text-center p-6 border border-dashed rounded bg-gray-50">
                <p className="text-gray-500 mb-2">No team members added yet</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({
                    employeeId: '',
                    employeeName: '',
                    role: '',
                    hoursPerWeek: 0,
                    tasks: []
                  })}
                  className="flex items-center mx-auto"
                >
                  <FaPlus className="mr-2" />
                  Add Team Member
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/projects')}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                  Saving...
                </>
              ) : 'Create Project'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
} 