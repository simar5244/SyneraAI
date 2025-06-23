import vectorService, { VectorService } from './vectorService';
import geminiService, { GeminiService } from './geminiService';

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

interface EmployeeRecommendation {
  name: string;
  email: string;
  department: string;
  role: string;
  tasks: string;
  hours: string;
  toolsUsed: string;
  isLead?: boolean;
  score: number;
  matchReason: string;
}

interface RecommendationResult {
  employees: EmployeeRecommendation[];
  tools: string[];
}

export class EnhancedRecommendationService {
  private vectorService: VectorService;
  private geminiService: GeminiService;
  // No need for connection string in frontend

  constructor() {
    this.vectorService = vectorService;
    this.geminiService = geminiService;
  }

  // No need for initialization in frontend

  // Get recommendations for a project
  async getRecommendations(
    projectDetails: ProjectDetails,
    companyCode: string
  ): Promise<RecommendationResult> {
    console.log('Starting recommendation process for company:', companyCode);
    console.log('Project details:', JSON.stringify(projectDetails, null, 2));
    try {
      // Step 1: Generate project embedding
      console.log('Creating project context for embedding...');
      const projectContext = this.createProjectContext(projectDetails);
      console.log('Project context created:', projectContext.substring(0, 100) + '...');
      
      // Generate embedding for project description
      console.log('Generating project embedding...');
      const projectEmbedding = await this.vectorService.generateEmbedding(projectContext);
      
      // Step 2: Find similar employees using vector search
      console.log('Finding similar employees using vector search...');
      const { employees, needsLLMAnalysis } = await this.vectorService.findSimilarEmployees(
        projectEmbedding,
        companyCode,
        10 // Limit to top 10 candidates
      );
      console.log(`Found ${employees.length} potential candidates`);
      
      // Step 3: Process candidates
      let recommendations: EmployeeRecommendation[] = [];
      const allTools = new Set<string>();
      
      // Get company information for context
      const companyInfo = await this.getCompanyInfo(companyCode);
      
      // Process each candidate
      for (const employee of employees) {
        let recommendation: EmployeeRecommendation;
        
        // For high similarity scores, use direct matching
        if (employee.score >= 0.75) {
          // Generate tasks and tools using Gemini
          console.log('Generating tasks and tools with Gemini...');
          const { tasks, tools } = await this.geminiService.generateTasksAndTools(
            employee,
            projectDetails
          );
          console.log('Tasks and tools generation complete');
          
          // Add tools to the set
          tools.forEach(tool => allTools.add(tool));
          
          // Create recommendation
          recommendation = {
            name: employee.name,
            email: employee.email,
            department: employee.department || '',
            role: employee.position || employee.role || '',
            tasks: tasks,
            hours: this.estimateHours(projectDetails.priority, employee.position || employee.role || ''),
            toolsUsed: tools.join(', '),
            isLead: this.determineLead(employee.position || employee.role || '', employee.score),
            score: Math.round(employee.score * 100),
            matchReason: 'Strong skill match with project requirements'
          };
        } 
        // For medium similarity scores, use Gemini for deeper analysis
        else if (needsLLMAnalysis && employee.score >= 0.6) {
          // Analyze employees with Gemini
          console.log('Analyzing employee fit with Gemini...');
          const analyzedEmployee = await this.geminiService.analyzeEmployeeFit(
            employee,
            projectDetails,
            companyInfo
          );
          console.log('Employee analysis complete');
          
          // Generate tasks and tools
          console.log('Generating tasks and tools with Gemini...');
          const { tasks, tools } = await this.geminiService.generateTasksAndTools(
            employee,
            projectDetails
          );
          console.log('Tasks and tools generation complete');
          
          // Add tools to the set
          tools.forEach(tool => allTools.add(tool));
          
          // Update recommendation with tasks and tools
          recommendation = analyzedEmployee;
          recommendation.tasks = tasks;
          recommendation.toolsUsed = tools.join(', ');
        }
        // For low similarity scores, skip
        else {
          continue;
        }
        
        recommendations.push(recommendation);
      }
      
      // Sort by score (descending)
      recommendations = recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5 recommendations
      
      // Ensure we have at least one lead
      const hasLead = recommendations.some(rec => rec.isLead);
      if (!hasLead && recommendations.length > 0) {
        recommendations[0].isLead = true;
      }
      
      console.log('Recommendation process completed successfully');
      return {
        employees: recommendations,
        tools: Array.from(allTools)
      };
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      console.error('Error stack:', error.stack);
      
      // More specific error messages based on where the failure occurred
      if (error.message.includes('embedding')) {
        console.error('Failed at embedding generation stage');
      } else if (error.message.includes('similar')) {
        console.error('Failed at finding similar employees stage');
      } else if (error.message.includes('analyze')) {
        console.error('Failed at employee analysis stage');
      } else if (error.message.includes('tasks')) {
        console.error('Failed at tasks generation stage');
      }
      
      throw new Error(`Failed to generate recommendations: ${error.message}`);
    }
  }

  // Generate text representation of project for embedding
  private createProjectContext(project: ProjectDetails): string {
    return `
      Project Title: ${project.project_title}
      Project Description: ${project.project_description}
      Department: ${project.department}
      Priority: ${project.priority}
      Tech Stack: ${project.tech_stack ? project.tech_stack.join(', ') : ''}
    `;
  }

  // Get company information for context
  private async getCompanyInfo(companyCode: string): Promise<any> {
    // This would typically fetch company info from the database
    // For now, return a basic object with the company code
    return {
      companyCode,
      industry: 'Technology' // Default assumption
    };
  }

  // Estimate hours based on project priority and role
  private estimateHours(priority: string, role: string): string {
    const priorityMultiplier: {[key: string]: number} = {
      'critical': 1.5,
      'high': 1.2,
      'medium': 1.0,
      'low': 0.7
    };
    
    const roleMultiplier: {[key: string]: number} = {
      'ceo': 0.3,
      'cfo': 0.4,
      'cto': 0.5,
      'coo': 0.4,
      'vp': 0.6,
      'director': 0.7,
      'senior_manager': 0.8,
      'manager': 0.9,
      'senior': 1.0,
      'lead': 1.1,
      'mid': 1.2,
      'junior': 1.3,
      'intern': 0.8
    };
    
    // Determine role multiplier
    const normalizedRole = role.toLowerCase();
    let roleMulti = 1.0; // Default
    
    for (const [roleName, multiplier] of Object.entries(roleMultiplier)) {
      if (normalizedRole.includes(roleName)) {
        roleMulti = multiplier;
        break;
      }
    }
    
    // Base hours per week (10 hours)
    const baseHours = 10;
    const adjustedHours = baseHours * (priorityMultiplier[priority] || 1.0) * roleMulti;
    
    // Round to nearest 5
    return Math.round(adjustedHours / 5) * 5 + '';
  }

  // Determine if employee should be lead
  private determineLead(role: string, score: number): boolean {
    const leadershipRoles = ['manager', 'director', 'lead', 'senior', 'vp', 'cto', 'ceo', 'cfo', 'coo'];
    const normalizedRole = role.toLowerCase();
    
    // Check if role contains leadership keywords
    const isLeadershipRole = leadershipRoles.some(leaderRole => 
      normalizedRole.includes(leaderRole)
    );
    
    // Consider both role and score
    return isLeadershipRole && score > 75;
  }

  // No need for connection closing in frontend
}

// Create React hook for using the recommendation engine
export function useEnhancedRecommendations() {
  const getRecommendations = async (
    projectDetails: ProjectDetails,
    companyCode: string
  ): Promise<RecommendationResult> => {
    try {
      // Create service
      const service = new EnhancedRecommendationService();
      
      // Get recommendations
      const result = await service.getRecommendations(projectDetails, companyCode);
      
      // No need to close connections
      
      return result;
    } catch (error) {
      console.error('Error in useEnhancedRecommendations:', error);
      throw error;
    }
  };
  
  return { getRecommendations };
}
