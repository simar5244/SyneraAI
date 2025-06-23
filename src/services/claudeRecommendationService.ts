import axios from 'axios';

interface ProjectDetails {
  project_title: string;
  project_description: string;
  department: string;
  status: string;
  priority: string;
  tech_stack?: string[];
  total_hours?: number;
  total_budget?: number;
}

interface RecommendationResult {
  employees: any[];
  tools: string[];
}

export class ClaudeRecommendationService {
  async getRecommendations(
    projectDetails: ProjectDetails,
    companyCode: string
  ): Promise<RecommendationResult> {
    try {
      console.log('Starting Claude recommendation process for company:', companyCode);
      
      // Get auth token from localStorage
      let token = '';
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('token') || '';
      }
      
      // Prepare the query for Claude
      const query = this.buildClaudeQuery(projectDetails);
      
      // Call the claude-query.js API endpoint directly
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/api/claude-query`;
      
      const response = await axios.post(
        url,
        { 
          query, 
          session_id: `project_rec_${Date.now()}`,
          collection: 'users,projects' // Specifically querying users and projects collections
        },
        { 
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
          } 
        }
      );
      
      // Parse the response
      if (!response.data?.response) {
        throw new Error('Invalid response from Claude API');
      }
      
      // Extract recommendations from Claude's response
      return this.parseClaudeResponse(response.data.response);
      
    } catch (error: any) {
      console.error('Error getting recommendations from Claude:', error);
      throw new Error(`Failed to get recommendations: ${error.message}`);
    }
  }
  
  private buildClaudeQuery(projectDetails: ProjectDetails): string {
    return `I need to staff a new project with the following details:
      
Project Title: ${projectDetails.project_title}
Project Description: ${projectDetails.project_description || 'N/A'}
Department: ${projectDetails.department || 'N/A'}
Priority: ${projectDetails.priority || 'medium'}
Status: ${projectDetails.status || 'planning'}
Tech Stack: ${projectDetails.tech_stack ? projectDetails.tech_stack.join(', ') : 'N/A'}
Total Hours: ${projectDetails.total_hours || 'Not specified'}
Total Budget: ${projectDetails.total_budget || 'Not specified'}

Search the users collection in our MongoDB database and provide the following in a STRUCTURED FORMAT:

1. Team composition - Identify EXACTLY 3 suitable employees from our company database who have the right skills for this project.
2. For each employee, specify:
   - Full name (use real names from the users collection)
   - Email (use EXACT email from the MongoDB database)
   - Role on the project that best fits their skills (e.g. Project Lead, Developer, Designer)
   - Department (from their current department in the database)
   - Their current job responsibilities (pull from jobResponsibilities field in MongoDB - this is very important)
   - Specific tasks they should handle for this project (be detailed and aligned with the project needs)
   - Estimated hours they should contribute to this project PER WEEK (realistic number considering standard 40hr workweek, don't exceed 15hrs/week for any employee)
   - Tools they should use (specific to their tasks)
   - Indicate exactly ONE person as the project lead (choose the most senior or qualified person)

IMPORTANT: Consider each person's current job responsibilities, workload, and skills. Do not assign excessive hours that would interfere with their primary job duties.

Format your response EXACTLY as follows with no deviations:

TEAM RECOMMENDATIONS:
1. [Full Name] - [Role]
   - Email: [Exact email from MongoDB]
   - Department: [Department]
   - Job Responsibilities: [Job responsibilities from MongoDB]
   - Tasks: [Comma-separated list of specific tasks for this project]
   - Hours: [Number]
   - Tools: [Comma-separated list of tools]
   - Lead: [Yes/No]

2. [Next team member...]

3. [Last team member...]

Do not include any other information, explanations or notes outside this exact format.`;
  }
  
  private parseClaudeResponse(responseText: string): RecommendationResult {
    try {
      // Extract employee recommendations - using a set to prevent duplicates
      const employeesMap = new Map(); // Use a map to track employees by name
      const toolsSet = new Set<string>();
      
      // Improved parsing logic for structured team recommendations format
      let currentEmployee: any = null;
      
      // First extract the structured sections properly
      const teamSectionMatch = responseText.match(/TEAM RECOMMENDATIONS:[\s\S]*?(?=TOOLS RECOMMENDATIONS:|$)/i);
      
      // Process team section
      if (teamSectionMatch && teamSectionMatch[0]) {
        const teamSection = teamSectionMatch[0].split('\n');
        let employeeCount = 0; // Count how many actual employees we've found
        
        for (let i = 0; i < teamSection.length; i++) {
          const line = teamSection[i].trim();
          
          if (line.toUpperCase().includes('TEAM RECOMMENDATIONS')) {
            continue; // Skip the header
          }
          
          // Look for numbered employees (1. Name - Role)
          const employeeMatch = line.match(/^\d+\.\s+([\w\s]+)\s*-\s*([\w\s]+)/);
          if (employeeMatch) {
            // Save previous employee if exists
            if (currentEmployee && !employeesMap.has(currentEmployee.name)) {
              employeesMap.set(currentEmployee.name, currentEmployee);
              employeeCount++;
            }
            
            const name = employeeMatch[1].trim();
            const role = employeeMatch[2].trim();
            
            // Skip if we already have this employee
            if (employeesMap.has(name)) {
              currentEmployee = null;
              continue;
            }
            
            // Limit to maximum 3 employees
            if (employeeCount >= 3) {
              break;
            }
            
            // Create new employee
            currentEmployee = {
              name,
              email: '', // Will be populated from MongoDB if available
              department: '',
              role,
              tasks: '',
              hours: '10',
              toolsUsed: '',
              isLead: false,
              score: 90 - (employeeCount * 5), // Decreasing scores
              matchReason: 'Recommended by AI'
            };
            continue;
          }
          
          // Process employee details if we have a current employee
          if (currentEmployee) {
            // Email
            if (line.toLowerCase().includes('email:')) {
              const email = line.split(':')[1].trim();
              if (email && email.includes('@')) {
                currentEmployee.email = email;
              }
            }
            // Department
            else if (line.toLowerCase().includes('department:')) {
              currentEmployee.department = line.split(':')[1].trim();
            }
            // Job Responsibilities from MongoDB
            else if (line.toLowerCase().includes('job responsibilities:')) {
              const jobResponsibilities = line.split(':')[1].trim();
              if (jobResponsibilities) {
                try {
                  // Try to parse as JSON array first
                  if (jobResponsibilities.startsWith('[') && jobResponsibilities.endsWith(']')) {
                    const parsedArray = JSON.parse(jobResponsibilities);
                    
                    // Handle array of objects with duty/hours properties
                    if (parsedArray.length > 0 && typeof parsedArray[0] === 'object' && parsedArray[0].duty) {
                      currentEmployee.jobResponsibilities = parsedArray;
                    } 
                    // Handle array of strings
                    else if (parsedArray.length > 0 && typeof parsedArray[0] === 'string') {
                      currentEmployee.jobResponsibilities = parsedArray;
                    }
                    // Fallback for other array formats
                    else {
                      currentEmployee.jobResponsibilities = parsedArray.map((item: any) => 
                        typeof item === 'object' ? JSON.stringify(item) : String(item)
                      );
                    }
                  } 
                  // Handle comma or semicolon separated list
                  else {
                    currentEmployee.jobResponsibilities = jobResponsibilities
                      .split(/[,;]/).map(r => r.trim()).filter(Boolean);
                  }
                } catch (e) {
                  // If JSON parsing fails, treat as comma-separated list
                  currentEmployee.jobResponsibilities = jobResponsibilities
                    .split(/[,;]/).map(r => r.trim()).filter(Boolean);
                  
                  // If there's only one entry and no commas/semicolons, keep it as is
                  if (currentEmployee.jobResponsibilities.length === 1 && 
                      jobResponsibilities.indexOf(',') === -1 && 
                      jobResponsibilities.indexOf(';') === -1) {
                    currentEmployee.jobResponsibilities = [jobResponsibilities];
                  }
                }
              }
            }
            // Tasks for this project
            else if (line.toLowerCase().includes('tasks:')) {
              currentEmployee.tasks = line.split(':')[1].trim();
            }
            // Hours
            else if (line.toLowerCase().includes('hours:')) {
              const hours = line.split(':')[1].trim();
              currentEmployee.hours = hours.replace(/\D/g, ''); // Extract numeric part
            }
            // Tools
            else if (line.toLowerCase().includes('tools:')) {
              const toolsText = line.split(':')[1].trim();
              const tools = toolsText.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean);
              currentEmployee.toolsUsed = tools.join(', ');
            }
            // Lead status
            else if (line.toLowerCase().includes('lead:')) {
              const isLead = line.split(':')[1].trim().toLowerCase() === 'yes';
              currentEmployee.isLead = isLead;
            }
          }
        }
        
        // Add the last employee if exists and not a duplicate
        if (currentEmployee && !employeesMap.has(currentEmployee.name)) {
          employeesMap.set(currentEmployee.name, currentEmployee);
        }
      }
      
      // Create fallback if no employees were found
      if (employeesMap.size === 0) {
        employeesMap.set('Project Lead', {
          name: 'Project Lead',
          email: 'N/A',
          department: 'N/A',
          role: 'Project Manager',
          tasks: 'Coordinate project activities',
          hours: '10',
          toolsUsed: 'Project Management Software',
          isLead: true,
          score: 95,
          matchReason: 'Fallback recommendation'
        });
      }
      
      // If we somehow got more than 3 employees, take only the first 3
      const employees = Array.from(employeesMap.values()).slice(0, 3);
      
      // Make sure we have at least one lead
      let hasLead = employees.some(emp => emp.isLead);
      if (!hasLead && employees.length > 0) {
        employees[0].isLead = true;
      }
      
      // Collect tools from employee toolsUsed fields
      const toolsFromEmployees = new Set<string>();
      employees.forEach((emp: any) => {
        if (emp.toolsUsed) {
          const tools = emp.toolsUsed.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean);
          tools.forEach((tool: string) => toolsFromEmployees.add(tool));
        }
      });
      
      // If employee emails are still empty/default, try to set a reasonable format
      employees.forEach(emp => {
        if (!emp.email || emp.email === '') {
          // Format a consistent email address based on name
          emp.email = `${emp.name.toLowerCase().replace(/\s+/g, '.')}@company.com`;
        }
      });
      
      return {
        employees,
        tools: []  // Return empty array as we'll no longer display the separate tools section
      };
    } catch (error) {
      console.error('Error parsing Claude response:', error);
      // Return fallback data
      return {
        employees: [{
          name: 'Project Lead',
          email: 'N/A',
          department: 'N/A',
          role: 'Project Manager',
          tasks: 'Coordinate project activities',
          hours: '10',
          toolsUsed: 'Project Management Software',
          isLead: true,
          score: 95,
          matchReason: 'Fallback recommendation'
        }],
        tools: []  // Empty array for tools section
      };
    }
  }
}

export default new ClaudeRecommendationService();

export function useClaudeRecommendations() {
  const getRecommendations = async (
    projectDetails: ProjectDetails,
    companyCode: string
  ): Promise<RecommendationResult> => {
    const service = new ClaudeRecommendationService();
    return service.getRecommendations(projectDetails, companyCode);
  };

  return { getRecommendations };
} 