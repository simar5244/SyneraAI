import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'react-hot-toast';
import { fetchProjects } from "./api";
import ProjectAIRecommendations from '@/components/ProjectAIRecommendations';

interface AddProjectModalProps {
  onAddProject: (project: any) => Promise<{ success: boolean; error?: string; projectId?: string }>;
}

type EmployeeEditor = { name: string; email: string; department: string; role: string; tasks: string; hours: string; toolsUsed: string; isLead?: boolean };

const AddProjectModal = ({ onAddProject }: AddProjectModalProps) => {
  const router = useRouter();
  const [projectData, setProjectData] = useState({
    linkedProjects: [] as { projectId: string; name: string }[], // store multiple linked projects
    name: '', description: '', department: '', startDate: '', endDate: '',
    status: 'planning', priority: 'low', total_budget: '', toolsUsed: '',
    employees: [] as EmployeeEditor[],
    viewers: [] as { name: string; email: string }[], // non-contributing viewers
    visibleToAll: true, // Set to true by default for better visibility
  });
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [showLink, setShowLink] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [localCompanyCode, setLocalCompanyCode] = useState<string | null>(null);
  const [isPrivilegedUser, setIsPrivilegedUser] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);

  useEffect(() => {
    async function loadProjectsList() {
      setLoading(true);
      try {
        // Determine current user from localStorage or API
        const storedUser = localStorage.getItem('user');
        let user: any = storedUser ? JSON.parse(storedUser) : {};
        try {
          const token = localStorage.getItem('token');
          const meRes = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
          if (meRes.ok) {
            const meJson = await meRes.json();
            user = meJson.user || meJson;
          }
        } catch {
          console.warn('Auth/me endpoint unavailable, using localStorage user');
        }
        const userEmail = (user.email || '').toLowerCase();
        setCurrentUser(user);
        setLocalCompanyCode(user.companyCode || null);
        
        // Get all projects
        const result = await fetchProjects();
        const allProjects = result.projects || [];
        // Determine if user is admin or top management
        const roleLower = (user.role || '').toLowerCase();
        const isPrivileged = roleLower === 'admin' || roleLower.startsWith('top_management');
        setIsPrivilegedUser(isPrivileged);
        let accessibleProjects;
        if (isPrivileged) {
          accessibleProjects = allProjects;
        } else {
          accessibleProjects = allProjects.filter((p: any) =>
            p.visibleToAll ||
            (Array.isArray(p.employees) && p.employees.some((e: any) => e.email?.toLowerCase() === userEmail)) ||
            (Array.isArray(p.viewers) && p.viewers.some((v: any) => v.email?.toLowerCase() === userEmail))
          );
        }
        setProjectsList(accessibleProjects);
      } catch (e) {
        console.error('Error loading projects:', e);
        toast.error('Failed to load projects.');
      } finally {
        setLoading(false);
      }
    }
    loadProjectsList();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProjectData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setProjectData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEmployeeChange = (i: number, field: keyof EmployeeEditor, value: string | boolean) => {
    setProjectData(prev => {
      const emps = [...prev.employees]; 
      emps[i] = { ...emps[i], [field]: value };
      return { ...prev, employees: emps };
    });
  };

  const addEmployee = () => setProjectData(prev => ({ ...prev, employees: [...prev.employees, { name:'',email:'',department:'',role:'',tasks:'',hours:'',toolsUsed:'' }] }));
  const removeEmployee = (i: number) => setProjectData(prev => { const emps=[...prev.employees]; emps.splice(i,1); return { ...prev, employees: emps }; });

  const addMember = () => setProjectData(prev => ({ ...prev, viewers: [...prev.viewers, { name: '', email: '' }] }));
  const removeMember = (i: number) => setProjectData(prev => { const m = [...prev.viewers]; m.splice(i,1); return { ...prev, viewers: m }; });
  const handleMemberChange = (i: number, field: 'name' | 'email', value: string) => setProjectData(prev => { const m = [...prev.viewers]; m[i] = { ...m[i], [field]: value }; return { ...prev, viewers: m }; });

  const handleCheckboxChange = (field: string, value: boolean) => {
    setProjectData({
      ...projectData,
      [field]: value
    });
    
    // Log for debugging
    console.log(`Set ${field} to ${value}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        toast.error('Authentication required. Please log in again.');
        setSubmitting(false);
        return;
      }
      
      // Prepare data for API
      const formattedData = {
        project_title: projectData.name,
        project_description: projectData.description,
        department: projectData.department,
        start_date: projectData.startDate,
        end_date: projectData.endDate || undefined,
        status: projectData.status,
        priority: projectData.priority,
        total_budget: projectData.total_budget ? parseFloat(projectData.total_budget) : undefined,
        tools_and_resources: projectData.toolsUsed ? projectData.toolsUsed.split(',').map(t => t.trim()) : [],
        visible_to_all: projectData.visibleToAll,
        
        // Include linked projects array
        linked_projects: projectData.linkedProjects,
        
        // Format employee contributions
        employee_contributions: projectData.employees.map(emp => ({
          name: emp.name,
          email: emp.email,
          department: emp.department,
          role: emp.role,
          is_lead: emp.isLead || false,
          tasks: emp.tasks ? emp.tasks.split(',').map(t => t.trim()) : [],
          hours: parseFloat(emp.hours) || 0,
          tools_used: emp.toolsUsed ? emp.toolsUsed.split(',').map(t => t.trim()) : []
        })),
        
        // Format viewers
        viewers: projectData.viewers.map(viewer => ({
          name: viewer.name,
          email: viewer.email
        }))
      };

      // Check if current user is top management
      const isTopManagement = currentUser?.role && [
        'top_management_tier_1', 
        'top_management_tier_2', 
        'top_management_tier_3'
      ].includes(currentUser.role);
      
      // Get company code from multiple possible sources
      const companyCode = 
        currentUser?.companyCode || 
        currentUser?.company_code || 
        localStorage.getItem('companyCode');
      
      // Create submission data with necessary metadata
      const submissionData = {
        ...formattedData,
        creatorRole: currentUser?.role,
        creatorEmail: currentUser?.email,
        creatorName: currentUser?.name,
        companyCode: companyCode,
        isManagementProject: isTopManagement,
        // Ensure visibleToAll is explicitly set (defaulting to true if not specified)
        visibleToAll: projectData.visibleToAll !== false,
      };
      
      console.log('Submitting project data with company code:', submissionData.companyCode);
      
      const result = await onAddProject(submissionData);
      if (result && result.success && result.projectId) {
        toast.success('Project created successfully!');
        router.push(`/dashboard/projects/${result.projectId}`);
        return;
      }
      toast.error(result?.error || 'Failed to create project');
    } catch (error) {
      console.error('Error submitting project:', error);
      toast.error('Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  // Compute filtered options for linking
  const filteredLinkableProjects = isPrivilegedUser
    ? projectsList
    : projectsList.filter(p =>
        !projectData.linkedProjects.some(lp => lp.projectId === p.id) &&
        (p.project_title || p.name)
      );

  return (
    <form onSubmit={handleSubmit} className="bg-white text-black p-4 space-y-6 w-full">
      {/* Basic Project Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Project Name</Label>
          <Input id="name" name="name" autoComplete="off" value={projectData.name} onChange={handleChange} placeholder="Project name" />
        </div>
        <div>
          <Label htmlFor="department">Department</Label>
          <Input 
            id="department" 
            name="department" 
            autoComplete="off" 
            value={projectData.department} 
            onChange={handleChange} 
            placeholder="Enter department"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" autoComplete="off" value={projectData.description} onChange={handleChange} placeholder="Enter project description" rows={3} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select name="status" value={projectData.status} onValueChange={(v) => handleSelectChange('status', v)}>
            <SelectTrigger id="status" className="text-gray-900 bg-white"><SelectValue placeholder="Select status" className="text-gray-900" /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="planning" className="text-gray-900">Planning</SelectItem>
              <SelectItem value="ongoing" className="text-gray-900">Ongoing</SelectItem>
              <SelectItem value="completed" className="text-gray-900">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select name="priority" value={projectData.priority} onValueChange={(v) => handleSelectChange('priority', v)}>
            <SelectTrigger id="priority" className="text-gray-900 bg-white"><SelectValue placeholder="Select priority" className="text-gray-900" /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="low" className="text-gray-900">Low</SelectItem>
              <SelectItem value="medium" className="text-gray-900">Medium</SelectItem>
              <SelectItem value="high" className="text-gray-900">High</SelectItem>
              <SelectItem value="critical" className="text-gray-900">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" name="startDate" type="date" autoComplete="off" value={projectData.startDate} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" name="endDate" type="date" autoComplete="off" value={projectData.endDate} onChange={handleChange} />
        </div>
      </div>
      
      {/* Budget & Tools Used */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="total_budget">Budget</Label>
          <Input
            id="total_budget" 
            name="total_budget" 
            type="number" 
            placeholder="Enter project budget"
            value={projectData.total_budget} 
            onChange={handleChange}
          />
        </div>
        <div>
          <Label htmlFor="toolsUsed">Tools Used (comma separated)</Label>
          <Input
            id="toolsUsed" 
            name="toolsUsed" 
            placeholder="e.g. Jira, Figma, GitHub"
            value={projectData.toolsUsed} 
            onChange={handleChange}
          />
        </div>
      </div>
      
      {/* Linked Projects Selection */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showLink"
            checked={showLink}
            onCheckedChange={(checked) => setShowLink(!!checked)}
          />
          <Label htmlFor="showLink" className="text-sm font-medium leading-none">
            Is this project linked to other projects?
          </Label>
        </div>
        
        {showLink && (
          <div className="mt-2">
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm text-black">Linked Projects</Label>
              <Button 
                variant="default" 
                size="sm" 
                type="button" 
                onClick={() => {
                  if (selectedProjectId) {
                    const selectedProject = projectsList.find(p => p.id === selectedProjectId);
                    if (selectedProject && !projectData.linkedProjects.some(lp => lp.projectId === selectedProjectId)) {
                      setProjectData(prev => ({
                        ...prev,
                        linkedProjects: [...prev.linkedProjects, {
                          projectId: selectedProjectId,
                          name: selectedProject.project_title || selectedProject.name
                        }]
                      }));
                      setSelectedProjectId('');
                    }
                  }
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Add Project
              </Button>
            </div>
            
            <div className="flex items-center gap-2 mb-3">
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger className="flex-1 bg-white text-black border-gray-300">
                  <SelectValue placeholder="Select a project to link" className="text-black" />
                </SelectTrigger>
                <SelectContent className="bg-white text-black">
                  {filteredLinkableProjects.length > 0 ? (
                    filteredLinkableProjects.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-black hover:bg-gray-100">
                        {p.project_title || p.name || 'Unnamed Project'}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="text-center py-2 text-gray-500">No projects available to link</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {/* Display selected linked projects */}
            <div className="space-y-2">
              {projectData.linkedProjects.map((linkedProject, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded-md">
                  <span className="text-sm text-black">{linkedProject.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Get the removed project ID first
                      const removedProjectId = projectData.linkedProjects[idx].projectId;
                      
                      // Update the state with the removed project
                      setProjectData(prev => ({
                        ...prev,
                        linkedProjects: prev.linkedProjects.filter((_, i) => i !== idx)
                      }));
                      
                      // Fetch projects after removing to update the dropdown
                      const storedToken = localStorage.getItem('token');
                      const companyCode = localStorage.getItem('companyCode') || localCompanyCode || '';
                      
                      if (storedToken) {
                        fetch('/api/projects', {
                          headers: {
                            'Authorization': `Bearer ${storedToken}`,
                            'X-Company-Code': companyCode,
                            'Cache-Control': 'no-cache',
                          }
                        })
                          .then(res => {
                            if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
                            return res.json();
                          })
                          .then(data => {
                            const allProjects = data.projects || [];
                            // Set current user email to filter projects by access permission
                            const userEmail = currentUser?.email?.toLowerCase() || '';
                            // Admin and top management tiers have full access
                            const privilegedRoles = ['admin', 'top_management_tier_1', 'top_management_tier_2', 'top_management_tier_3'];
                            const isPrivileged = privilegedRoles.includes(currentUser?.role || '');
                            // Filter to only show projects the user has access to
                            const accessibleProjects = allProjects.filter((p: any) => {
                              // User is admin or project is visible to all
                              if (isPrivileged || p.visibleToAll) return true;
                              
                              // User is a project member/contributor
                              if (Array.isArray(p.employees) && p.employees.some(
                                (e: any) => e.email?.toLowerCase() === userEmail
                              )) return true;
                              
                              // User is explicitly added as a viewer
                              if (Array.isArray(p.viewers) && p.viewers.some(
                                (v: any) => v.email?.toLowerCase() === userEmail
                              )) return true;
                              
                              // No access
                              return false;
                            });
                            
                            setProjectsList(accessibleProjects);
                          })
                          .catch(err => {
                            console.error('Error refreshing projects:', err);
                          });
                      }
                    }}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </Button>
                </div>
              ))}
              
              {projectData.linkedProjects.length === 0 && (
                <p className="text-sm text-gray-500 italic">No linked projects selected</p>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Employees Section */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex justify-between items-center">
          <span className="text-base">Team Members</span>
          <Button 
            variant="default" 
            size="sm" 
            type="button" 
            onClick={addEmployee} 
            className="bg-purple-600 hover:bg-purple-700 text-white text-base"
          >
            Add Employee
          </Button>
        </div>
        {projectData.employees.map((emp, idx) => (
          <div key={idx} className="border p-4 rounded-md space-y-3 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="font-medium">Employee {idx+1}</span>
              <Button variant="destructive" size="sm" type="button" onClick={() => removeEmployee(idx)}>Remove</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Name" value={emp.name} onChange={(e) => handleEmployeeChange(idx,'name',e.target.value)} />
              <Input placeholder="Email" value={emp.email} onChange={(e) => handleEmployeeChange(idx,'email',e.target.value)} />
              <Input placeholder="Department" value={emp.department} onChange={(e) => handleEmployeeChange(idx,'department',e.target.value)} />
              <Input placeholder="Role" value={emp.role} onChange={(e) => handleEmployeeChange(idx,'role',e.target.value)} />
              <div className="md:col-span-2">
                <Textarea placeholder="Specific Tasks (comma separated)" value={emp.tasks} onChange={(e) => handleEmployeeChange(idx,'tasks',e.target.value)} rows={2} />
              </div>
              <Input type="number" placeholder="Hours Worked" value={emp.hours} onChange={(e) => handleEmployeeChange(idx,'hours',e.target.value)} />
              <Input placeholder="Tools Used (comma separated)" value={emp.toolsUsed} onChange={(e) => handleEmployeeChange(idx,'toolsUsed',e.target.value)} />
              <div className="flex items-center space-x-2 md:col-span-2">
                <Checkbox
                  id={`isLead-${idx}`}
                  checked={emp.isLead || false}
                  onCheckedChange={(checked) => handleEmployeeChange(idx, 'isLead', !!checked)}
                />
                <Label htmlFor={`isLead-${idx}`} className="text-sm">
                  Is this person the lead of the project?
                </Label>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Members (association only) */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex justify-between items-center">
          <span className="text-base">Viewers</span>
          <Button 
            variant="default" 
            size="sm" 
            type="button" 
            onClick={addMember}
            className="bg-purple-600 hover:bg-purple-700 text-white text-base"
          >
            Add Viewer
          </Button>
        </div>
        {projectData.viewers.map((viewer, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <Input placeholder="Name" value={viewer.name} onChange={e => handleMemberChange(idx, 'name', e.target.value)} />
            <Input placeholder="Email" value={viewer.email} onChange={e => handleMemberChange(idx, 'email', e.target.value)} />
            <Button variant="destructive" size="sm" type="button" onClick={() => removeMember(idx)}>Remove</Button>
          </div>
        ))}
      </div>
      
      {/* Project Visibility */}
      <div className="pt-4 border-t">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="visibleToAll"
            name="visibleToAll"
            checked={projectData.visibleToAll}
            onCheckedChange={(checked) => handleCheckboxChange('visibleToAll', !!checked)}
          />
          <Label htmlFor="visibleToAll" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Make Visible to All Employees (Recommended)
          </Label>
        </div>
        <p className="text-xs text-gray-500 pl-6 mt-1">
          When enabled, all employees will have view access to this project.
          Top management will still have edit access regardless of this setting.
        </p>
      </div>
      
      {/* Team Members Section */}
      <div className="pt-4 border-t">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <span className="text-base">Need help staffing this project?</span>
          </div>
          <Button
            type="button" 
            onClick={() => {
              if (!projectData.name.trim()) {
                toast.error('Project Name is required to fetch recommendations');
                return;
              }
              setShowRecommendations(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            Add AI Recommendations
          </Button>
        </div>
        
        {/* AI Recommendations */}
        {showRecommendations && localCompanyCode && (
          <div className="mb-6 border rounded-md p-4 bg-purple-50 border-purple-200">
            <h4 className="font-medium text-sm mb-3 text-purple-800">AI Recommendations</h4>
            <ProjectAIRecommendations
              projectData={projectData}
              onApplyRecommendations={({ employees, tools }) => {
                setProjectData(prev => ({
                  ...prev,
                  employees,
                  toolsUsed: Array.isArray(tools) ? tools.join(', ') : ''
                }));
                toast.success('Team and tools recommendations applied!');
              }}
              companyCode={localCompanyCode!}
            />
          </div>
        )}
      </div>
      
      <div className="flex justify-end pt-4 border-t">
        <Button
          type="submit"
          disabled={submitting}
          className="bg-purple-600 hover:bg-purple-700 text-white text-base px-6"
        >
          {submitting ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
};

export default AddProjectModal;