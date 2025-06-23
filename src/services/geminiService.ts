import axios from 'axios';

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

interface EmployeeRecommendation {
  name: string;
  email: string;
  department: string;
  role: string;
  tasks: string;
  hours: string;
  toolsUsed: string;
  isLead: boolean;
  score: number;
  matchReason: string;
}

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

export class GeminiService {
  private readonly apiKey: string;
  private readonly apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

  constructor() {
    // Get API key from environment
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }
    this.apiKey = apiKey;
  }

  // Analyze employee fit for project using Gemini LLM
  async analyzeEmployeeFit(
    employee: any,
    project: ProjectDetails,
    companyInfo: any
  ): Promise<EmployeeRecommendation> {
    try {
      const prompt = this.buildEmployeeFitPrompt(employee, project, companyInfo);
      const response = await this.callGeminiAPI(prompt);
      
      return this.parseEmployeeFitResponse(response, employee);
    } catch (error: any) {
      console.error('Error analyzing employee fit with Gemini:', error);
      throw new Error(`Failed to analyze employee fit. Please check your Gemini API key and ensure it's properly configured. Error: ${error?.message || 'Unknown error'}`);
    }
  }

  // Generate tasks and tools for an employee on a project
  async generateTasksAndTools(
    employee: any,
    project: ProjectDetails
  ): Promise<{ tasks: string; tools: string[] }> {
    try {
      const prompt = this.buildTasksToolsPrompt(employee, project);
      const response = await this.callGeminiAPI(prompt);
      
      return this.parseTasksToolsResponse(response);
    } catch (error: any) {
      console.error('Error generating tasks and tools with Gemini:', error);
      throw new Error(`Failed to generate tasks and tools. Please check your Gemini API key and ensure it's properly configured. Error: ${error?.message || 'Unknown error'}`);
    }
  }

  // Call Gemini API with the given prompt
  private async callGeminiAPI(prompt: string): Promise<GeminiResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured. Please set the NEXT_PUBLIC_GEMINI_API_KEY environment variable.');
    }
    
    try {
      console.log('Calling Gemini API with prompt:', prompt.substring(0, 100) + '...');
      
      const response = await axios.post<GeminiResponse>(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );
      
      if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error('Unexpected response format from Gemini API:', response.data);
        throw new Error('Invalid response format from Gemini API');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Error calling Gemini API:', error);
      console.error('Error response data:', error.response?.data);
      throw new Error(`Failed to get response from Gemini API: ${error.message}`);
    }
  }

  // Build prompt for employee fit analysis
  private buildEmployeeFitPrompt(
    employee: any,
    project: ProjectDetails,
    companyInfo: any
  ): string {
    return `
You are an AI assistant helping with employee-project matching. Analyze the following employee and project data to determine if the employee is a good fit for the project.

## Employee Information
Name: ${employee.name}
Email: ${employee.email}
Role/Position: ${employee.position || employee.role || 'N/A'}
Department: ${employee.department || 'N/A'}
Skills: ${employee.skills ? employee.skills.join(', ') : 'N/A'}
Current Utilization: ${employee.utilization || 'Unknown'}%
Job Responsibilities: ${this.formatResponsibilities(employee.jobResponsibilities)}

## Project Information
Title: ${project.project_title}
Description: ${project.project_description}
Department: ${project.department}
Priority: ${project.priority}
Status: ${project.status}
Tech Stack: ${project.tech_stack ? project.tech_stack.join(', ') : 'N/A'}
Total Hours: ${project.total_hours || 'Not specified'}
Total Budget: ${project.total_budget || 'Not specified'}

## Company Information
Company Code: ${companyInfo.companyCode}
Industry: ${companyInfo.industry || 'Not specified'}

Based on the above information, provide a JSON response with the following structure:
{
  "isGoodFit": true/false,
  "score": [number between 0-100],
  "matchReason": "[brief explanation of why the employee is a good fit]",
  "isLeadCandidate": true/false,
  "recommendedHours": "[number of hours per week]"
}

Focus on skill match, role appropriateness, department alignment, and current utilization. Be specific and concise.
`;
  }

  // Build prompt for tasks and tools generation
  private buildTasksToolsPrompt(
    employee: any,
    project: ProjectDetails
  ): string {
    return `
You are an AI assistant helping with project task and tool assignment. Based on the employee profile and project details, recommend specific tasks and tools.

## Employee Information
Name: ${employee.name}
Role/Position: ${employee.position || employee.role || 'N/A'}
Skills: ${employee.skills ? employee.skills.join(', ') : 'N/A'}
Job Responsibilities: ${this.formatResponsibilities(employee.jobResponsibilities)}

## Project Information
Title: ${project.project_title}
Description: ${project.project_description}
Department: ${project.department}
Tech Stack: ${project.tech_stack ? project.tech_stack.join(', ') : 'N/A'}

Based on the above information, provide a JSON response with the following structure:
{
  "tasks": "[comma-separated list of 3-5 specific tasks for this employee on this project]",
  "tools": ["tool1", "tool2", "tool3", "tool4", "tool5"]
}

The tasks should be specific to the employee's role and the project requirements. The tools should be relevant to the project's tech stack and the employee's skills.
`;
  }

  // Parse the response from Gemini API for employee fit
  private parseEmployeeFitResponse(
    response: GeminiResponse,
    employee: any
  ): EmployeeRecommendation {
    try {
      if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response format from Gemini API');
      }
      
      const textResponse = response.candidates[0].content.parts[0].text;
      
      // Extract JSON from response
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch?.[0]) {
        throw new Error('No JSON found in response');
      }
      
      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      // Type guard for the parsed response
      const isResponseValid = (
        typeof parsedResponse === 'object' &&
        parsedResponse !== null &&
        ('isGoodFit' in parsedResponse || 'score' in parsedResponse || 'matchReason' in parsedResponse)
      );
      
      if (!isResponseValid) {
        throw new Error('Invalid response structure from Gemini API');
      }
      
      return {
        name: employee.name || 'Unknown',
        email: employee.email || '',
        department: employee.department || '',
        role: employee.position || employee.role || 'Team Member',
        tasks: '', // Will be filled by separate call
        hours: String(parsedResponse.recommendedHours || '10'),
        toolsUsed: '', // Will be filled by separate call
        isLead: Boolean(parsedResponse.isLeadCandidate || false),
        score: Number(parsedResponse.score) || 0,
        matchReason: String(parsedResponse.matchReason || 'Matched by AI analysis')
      };
    } catch (error) {
      console.error('Error parsing Gemini response for employee fit:', error);
      return this.generateFallbackRecommendation(
        employee, 
        {
          project_title: 'Project',
          project_description: 'No project description available',
          department: employee.department || 'General',
          status: 'Active',
          priority: 'Medium',
          tech_stack: []
        }
      );
    }
  }

  // Parse the response from Gemini API for tasks and tools
  private parseTasksToolsResponse(
    response: GeminiResponse
  ): { tasks: string; tools: string[] } {
    try {
      if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response format from Gemini API');
      }
      
      const textResponse = response.candidates[0].content.parts[0].text;
      
      // Extract JSON from response
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch?.[0]) {
        throw new Error('No JSON found in response');
      }
      
      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      // Type guard for the parsed response
      const isResponseValid = (
        typeof parsedResponse === 'object' &&
        parsedResponse !== null &&
        ('tasks' in parsedResponse || 'tools' in parsedResponse)
      );
      
      if (!isResponseValid) {
        throw new Error('Invalid response structure from Gemini API');
      }
      
      // Ensure tasks is a string and tools is an array of strings
      const tasks = typeof parsedResponse.tasks === 'string' ? 
        parsedResponse.tasks : '';
        
      const tools = Array.isArray(parsedResponse.tools) ? 
        parsedResponse.tools.filter((tool: any) => typeof tool === 'string') : [];
      
      return { tasks, tools };
    } catch (error) {
      console.error('Error parsing Gemini response for tasks and tools:', error);
      return {
        tasks: 'No specific tasks generated',
        tools: []
      };
    }
  }

  // Format job responsibilities for prompt
  private formatResponsibilities(responsibilities: { duty: string; hours: number }[] | undefined): string {
    if (!responsibilities || responsibilities.length === 0) {
      return 'Not specified';
    }
    
    return responsibilities.map(r => `${r.duty} (${r.hours} hours)`).join(', ');
  }

  // Generate fallback recommendation if LLM fails
  private generateFallbackRecommendation(
    employee: any,
    project: ProjectDetails
  ): EmployeeRecommendation {
    const role = employee.position || employee.role || 'Team Member';
    const techStack = Array.isArray(project.tech_stack) ? project.tech_stack : [];
    
    return {
      name: employee.name || 'Unknown',
      email: employee.email || '',
      department: employee.department || 'General',
      role: role,
      tasks: this.generateFallbackTasks(role, project),
      hours: '10',
      toolsUsed: this.generateFallbackTools(techStack).join(', '),
      isLead: this.isSeniorRole(role),
      score: 70,
      matchReason: 'Matched based on skill similarity'
    };
  }

  // Generate fallback tasks based on role and project
  private generateFallbackTasks(role: string, project: ProjectDetails): string {
    const normalizedRole = role.toLowerCase();
    
    if (normalizedRole.includes('developer') || normalizedRole.includes('engineer')) {
      return 'Code implementation, Unit testing, Code reviews';
    } else if (normalizedRole.includes('designer')) {
      return 'UI/UX design, Wireframing, Prototyping';
    } else if (normalizedRole.includes('manager')) {
      return 'Team coordination, Progress tracking, Stakeholder communication';
    } else if (normalizedRole.includes('analyst')) {
      return 'Requirements gathering, Data analysis, Documentation';
    } else {
      return 'Project support, Documentation, Testing';
    }
  }

  // Generate fallback tools based on tech stack
  private generateFallbackTools(techStack: string[]): string[] {
    if (techStack.length === 0) {
      return ['Jira', 'Slack', 'Google Docs', 'GitHub', 'VS Code'];
    }
    
    const tools = new Set<string>();
    
    // Add common tools based on tech stack
    techStack.forEach(tech => {
      const normalizedTech = tech.toLowerCase();
      
      if (normalizedTech.includes('javascript') || normalizedTech.includes('js')) {
        tools.add('VS Code');
        tools.add('npm');
        tools.add('ESLint');
      } else if (normalizedTech.includes('python')) {
        tools.add('PyCharm');
        tools.add('Jupyter');
        tools.add('Pytest');
      } else if (normalizedTech.includes('java')) {
        tools.add('IntelliJ IDEA');
        tools.add('Maven');
        tools.add('JUnit');
      } else if (normalizedTech.includes('react')) {
        tools.add('React DevTools');
        tools.add('Redux DevTools');
        tools.add('Storybook');
      }
    });
    
    // Add common project tools
    tools.add('Jira');
    tools.add('GitHub');
    
    return Array.from(tools).slice(0, 5);
  }

  // Check if a role is senior/lead
  private isSeniorRole(role: string): boolean {
    const seniorKeywords = ['lead', 'senior', 'manager', 'director', 'head', 'chief', 'principal'];
    const normalizedRole = role.toLowerCase();
    
    return seniorKeywords.some(keyword => normalizedRole.includes(keyword));
  }
}

export default new GeminiService();
