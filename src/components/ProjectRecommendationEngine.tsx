import { useState, useEffect } from 'react';

// Define types for recommendation engine
interface EmployeeData {
  id: string;
  name: string;
  email: string;
  position: string;
  department: string;
  managerId?: string;
  skills: string[];
  jobTitle?: string;
  jobResponsibilities?: { duty: string; hours: number }[];
  role?: string;
  utilization?: number;
  feedbackMetrics?: {
    given?: { count: number; averageRating: number };
    received?: { count: number; averageRating: number; weightedAverageRating: number };
  };
  skillsFeedback?: {
    given?: string[];
    received?: string[];
  };
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

interface RecommendationResult {
  employees: {
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
  }[];
  tools: string[];
}

// Main recommendation engine class
export class RecommendationEngine {
  private employees: EmployeeData[] = [];
  private companyCode: string;
  
  constructor(companyCode: string) {
    this.companyCode = companyCode;
  }
  
  // Load employees from API
  private async loadEmployees(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Get company code from local storage or instance variable
      const companyCode = this.companyCode || localStorage.getItem('companyCode');
      if (!companyCode) {
        throw new Error('No company code found');
      }
      
      // Fetch employees from API with company context
      const response = await fetch(`/api/employees?company=${encodeURIComponent(companyCode)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch employees: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      this.employees = data.employees || [];
      
      // Add default utilization if not present
      this.employees = this.employees.map(emp => ({
        ...emp,
        utilization: emp.utilization || 50 // Default to 50% utilization
      }));
      
      console.log(`Loaded ${this.employees.length} employees from company: ${companyCode}`);
    } catch (error) {
      console.error('Error loading employees:', error);
      this.employees = [];
    }
  }
  
  // Load all employees for the company
  async loadAllCompanyEmployees(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Get current user email for authorization
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        throw new Error('No user data found');
      }
      
      let user;
      try {
        user = JSON.parse(userStr);
      } catch (e) {
        throw new Error('Invalid user data format');
      }
      
      // Make API request with company code as parameter
      const response = await fetch(`/api/organization/employee?companyCode=${this.companyCode}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch employees: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid employee data format');
      }
      
      this.employees = data.map((emp: any) => ({
        ...emp,
        skills: typeof emp.skills === 'string' 
          ? emp.skills.split(',').map((s: string) => s.trim()) 
          : (Array.isArray(emp.skills) ? emp.skills : [])
      }));
    } catch (error) {
      console.error('Error loading company employees:', error);
      throw error;
    }
  }
  
  // Calculate skill match score between project and employee
  private calculateSkillMatchScore(projectTechStack: string[], employeeSkills: string[]): number {
    if (!projectTechStack.length || !employeeSkills.length) return 50; // Neutral score
    
    // Normalize all strings for comparison
    const normalizedTechStack = projectTechStack.map(tech => tech.toLowerCase().trim());
    const normalizedSkills = employeeSkills.map(skill => skill.toLowerCase().trim());
    
    // Weight each skill in the tech stack by importance
    const techStackWeights: {[key: string]: number} = {};
    
    // Assign weights based on frequency and position in the tech stack
    normalizedTechStack.forEach((tech, index) => {
      // Primary technologies (first in list) get higher weight
      const positionWeight = Math.max(1.0, 1.5 - (index * 0.1));
      
      if (techStackWeights[tech]) {
        techStackWeights[tech] += positionWeight;
      } else {
        techStackWeights[tech] = positionWeight;
      }
    });
    
    // Calculate weighted match score
    let totalWeightedMatches = 0;
    let totalWeight = 0;
    
    for (const [tech, weight] of Object.entries(techStackWeights)) {
      totalWeight += weight;
      
      // Check for exact matches first (highest value)
      if (normalizedSkills.includes(tech)) {
        totalWeightedMatches += weight * 1.0;
        continue;
      }
      
      // Check for partial matches
      for (const skill of normalizedSkills) {
        if (skill.includes(tech) || tech.includes(skill)) {
          // Calculate similarity score based on length ratio
          const similarity = Math.min(tech.length, skill.length) / Math.max(tech.length, skill.length);
          totalWeightedMatches += weight * similarity * 0.8; // Partial matches get 80% of the value
          break;
        }
      }
    }
    
    // Calculate final score (0-100)
    const matchScore = totalWeight > 0 ? (totalWeightedMatches / totalWeight) * 100 : 50;
    return Math.min(100, matchScore);
  }
  
  // Calculate role appropriateness score
  private calculateRoleAppropriatenessScore(employeeRole: string, projectPriority: string): number {
    // Define role hierarchy
    const roleHierarchy: {[key: string]: number} = {
      'ceo': 10,
      'cfo': 9,
      'cto': 9,
      'coo': 9,
      'vp': 8,
      'director': 7,
      'senior_manager': 6,
      'manager': 5,
      'senior': 4,
      'lead': 4,
      'mid': 3,
      'junior': 2,
      'intern': 1
    };
    
    // Extract role level from position
    const normalizedRole = employeeRole.toLowerCase();
    let roleLevel = 3; // Default to mid-level
    
    for (const [role, level] of Object.entries(roleHierarchy)) {
      if (normalizedRole.includes(role)) {
        roleLevel = level;
        break;
      }
    }
    
    // Determine appropriate role level for project priority
    const priorityRoleMapping: {[key: string]: number[]} = {
      'critical': [5, 9], // Manager to C-level (excluding CEO)
      'high': [4, 7],     // Senior/Lead to Director
      'medium': [3, 6],   // Mid-level to Senior Manager
      'low': [1, 5]       // Intern to Manager
    };
    
    const [minLevel, maxLevel] = priorityRoleMapping[projectPriority] || [1, 10];
    
    // Calculate score based on how well the role matches the project priority
    if (roleLevel < minLevel) {
      // Too junior for the project
      return Math.max(0, (roleLevel / minLevel) * 70);
    } else if (roleLevel > maxLevel) {
      // Too senior for the project
      return Math.max(0, 100 - ((roleLevel - maxLevel) * 15));
    } else {
      // Perfect range - score based on position within range
      const rangeSize = maxLevel - minLevel;
      const positionInRange = (roleLevel - minLevel) / (rangeSize || 1);
      
      // Prefer middle of the range for optimal assignment
      return 85 + 15 * (1 - Math.abs(positionInRange - 0.5) * 2);
    }
  }
  
  // Calculate utilization score (lower utilization = higher score)
  private calculateUtilizationScore(utilization: number = 50): number {
    // Assume utilization is a percentage (0-100)
    // Lower utilization gets higher score, but we want some experience (not 0%)
    if (utilization < 10) return 70; // Very low utilization may indicate inexperience
    if (utilization > 90) return 30; // Overutilized employees
    
    // Optimal utilization around 50-70%
    if (utilization >= 50 && utilization <= 70) {
      return 100 - (Math.abs(60 - utilization) * 1.5);
    }
    
    // Scale linearly for other ranges
    return utilization <= 50 
      ? 70 + (utilization - 10) * (30 / 40) // 10-50% range maps to 70-100
      : 100 - (utilization - 70) * (70 / 20); // 70-90% range maps to 100-30
  }
  
  // Calculate job responsibility match score
  private calculateResponsibilityMatchScore(
    projectDescription: string, 
    employeeResponsibilities: { duty: string; hours: number }[] = []
  ): number {
    if (!projectDescription || !employeeResponsibilities.length) return 50; // Neutral score
    
    // Extract key terms from project description
    const projectTerms = this.extractKeyTerms(projectDescription);
    
    // Weight responsibilities by hours spent (more hours = more expertise)
    let totalMatchScore = 0;
    let totalHoursWeight = 0;
    
    for (const { duty, hours } of employeeResponsibilities) {
      // Extract key terms from each duty
      const dutyTerms = this.extractKeyTerms(duty);
      
      // Calculate term overlap between duty and project
      let termOverlap = 0;
      for (const term of dutyTerms) {
        if (projectTerms.includes(term)) {
          termOverlap++;
        }
      }
      
      // Calculate match score for this duty
      const overlapRatio = dutyTerms.length > 0 ? termOverlap / dutyTerms.length : 0;
      const dutyScore = overlapRatio * 100;
      
      // Weight by hours
      totalMatchScore += dutyScore * hours;
      totalHoursWeight += hours;
    }
    
    // Calculate weighted average score
    return totalHoursWeight > 0 ? totalMatchScore / totalHoursWeight : 50;
  }
  
  // Calculate department match score
  private calculateDepartmentMatchScore(employeeDepartment: string, projectDepartment: string): number {
    if (!projectDepartment || !employeeDepartment) return 50; // Neutral score
    
    // Exact department match
    if (employeeDepartment.toLowerCase() === projectDepartment.toLowerCase()) {
      return 100;
    }
    
    // Related departments (could be expanded with more domain knowledge)
    const relatedDepartments: {[key: string]: string[]} = {
      'engineering': ['development', 'devops', 'qa', 'technical', 'it'],
      'development': ['engineering', 'devops', 'technical', 'it'],
      'design': ['ux', 'ui', 'product', 'creative'],
      'product': ['design', 'ux', 'ui', 'marketing'],
      'marketing': ['sales', 'communications', 'product'],
      'sales': ['marketing', 'business', 'customer'],
      'finance': ['accounting', 'operations'],
      'hr': ['people', 'operations', 'talent'],
      'operations': ['hr', 'finance', 'logistics']
    };
    
    const normalizedEmpDept = employeeDepartment.toLowerCase();
    const normalizedProjDept = projectDepartment.toLowerCase();
    
    // Check if departments are related
    const relatedToEmpDept = relatedDepartments[normalizedEmpDept] || [];
    const relatedToProjDept = relatedDepartments[normalizedProjDept] || [];
    
    if (relatedToEmpDept.some(dept => dept === normalizedProjDept) || 
        relatedToProjDept.some(dept => dept === normalizedEmpDept)) {
      return 70; // Related department
    }
    
    return 30; // Unrelated department
  }
  
  // Recommend employees for a project
  async recommendEmployees(projectDetails: ProjectDetails): Promise<RecommendationResult> {
    if (this.employees.length === 0) {
      await this.loadEmployees();
    }
    
    const recommendations = this.employees.map(employee => {
      // Calculate various match scores
      const skillMatchScore = this.calculateSkillMatchScore(
        projectDetails.tech_stack || [], 
        employee.skills
      );
      
      const roleScore = this.calculateRoleAppropriatenessScore(
        employee.position || employee.role || '', 
        projectDetails.priority
      );
      
      const utilizationScore = this.calculateUtilizationScore(employee.utilization);
      
      const responsibilityScore = this.calculateResponsibilityMatchScore(
        projectDetails.project_description, 
        employee.jobResponsibilities
      );
      
      const departmentScore = this.calculateDepartmentMatchScore(
        employee.department, 
        projectDetails.department
      );
      
      // Calculate weighted total score
      const totalScore = (
        (skillMatchScore * 0.35) + 
        (roleScore * 0.25) + 
        (utilizationScore * 0.15) + 
        (responsibilityScore * 0.15) + 
        (departmentScore * 0.1)
      );
      
      // Determine match reason
      let matchReason = '';
      const highestScore = Math.max(
        skillMatchScore, roleScore, utilizationScore, responsibilityScore, departmentScore
      );
      
      if (highestScore === skillMatchScore && skillMatchScore > 70) {
        matchReason = 'Strong skill match with project requirements';
      } else if (highestScore === roleScore && roleScore > 70) {
        matchReason = 'Appropriate seniority level for this project';
      } else if (highestScore === utilizationScore && utilizationScore > 70) {
        matchReason = 'Currently has capacity for new projects';
      } else if (highestScore === responsibilityScore && responsibilityScore > 70) {
        matchReason = 'Job responsibilities align well with project needs';
      } else if (highestScore === departmentScore && departmentScore > 70) {
        matchReason = 'Works in the same department as the project';
      } else {
        matchReason = 'Good overall match for project requirements';
      }
      
      // Estimate hours based on project priority and employee role
      const estimatedHours = this.estimateProjectHours(
        projectDetails.priority,
        employee.position || employee.role || ''
      );
      
      // Determine if employee should be lead based on role and score
      const shouldBeLead = this.determineLead(
        employee.position || employee.role || '',
        totalScore
      );
      
      // Recommend tools based on skills and project
      const recommendedTools = this.recommendTools(
        employee.skills,
        projectDetails.tech_stack || []
      );
      
      return {
        name: employee.name,
        email: employee.email,
        department: employee.department,
        role: employee.position || employee.role || '',
        tasks: this.generateTasks(projectDetails, employee),
        hours: estimatedHours.toString(),
        toolsUsed: recommendedTools.join(', '),
        isLead: shouldBeLead,
        score: Math.round(totalScore),
        matchReason
      };
    });
    
    // Sort by score (descending)
    const sortedRecommendations = recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 recommendations
    
    // Ensure we have at least one lead
    const hasLead = sortedRecommendations.some(rec => rec.isLead);
    if (!hasLead && sortedRecommendations.length > 0) {
      sortedRecommendations[0].isLead = true;
    }
    
    // Compile list of all recommended tools
    const allTools = new Set<string>();
    sortedRecommendations.forEach(rec => {
      rec.toolsUsed.split(',').forEach(tool => {
        const trimmedTool = tool.trim();
        if (trimmedTool) allTools.add(trimmedTool);
      });
    });
    
    return {
      employees: sortedRecommendations,
      tools: Array.from(allTools)
    };
  }
  
  // Helper method to estimate project hours based on priority and role
  private estimateProjectHours(priority: string, role: string): number {
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
    return Math.round(adjustedHours / 5) * 5;
  }
  
  // Helper method to determine if employee should be lead
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
  
  // Helper method to recommend tools based on skills and project
  private recommendTools(skills: string[], projectTech: string[]): string[] {
    // Enhanced tools by technology area with domain-specific tools
    const toolsByTech: {[key: string]: {[key: string]: string[]}} = {
      // Software development tools
      'software': {
        'javascript': ['VSCode', 'ESLint', 'Jest', 'npm', 'Webpack', 'Babel'],
        'typescript': ['TSLint', 'TypeDoc', 'ts-node', 'VSCode', 'TypeScript Compiler'],
        'react': ['React DevTools', 'Redux DevTools', 'Storybook', 'Styled Components', 'React Testing Library'],
        'angular': ['Angular CLI', 'Protractor', 'Karma', 'NgRx', 'Angular Material'],
        'vue': ['Vue CLI', 'Vuex', 'Vue DevTools', 'Nuxt.js', 'Vite'],
        'node': ['Nodemon', 'PM2', 'Express', 'Postman', 'Node Inspector'],
        'python': ['PyCharm', 'Jupyter', 'Pytest', 'Pandas', 'NumPy', 'Black formatter'],
        'java': ['IntelliJ IDEA', 'Maven', 'JUnit', 'Spring Boot', 'Gradle'],
        'c#': ['Visual Studio', 'ReSharper', 'NUnit', '.NET Core', 'Entity Framework'],
        'php': ['PHPStorm', 'Composer', 'PHPUnit', 'Laravel', 'Symfony'],
        'ruby': ['RubyMine', 'RSpec', 'Rails', 'Bundler', 'Capistrano'],
        'go': ['GoLand', 'Go Modules', 'Gin', 'Echo', 'Delve debugger'],
        'mobile': ['Android Studio', 'Xcode', 'Flutter', 'React Native', 'Fastlane'],
        'general': ['Git', 'GitHub', 'GitLab', 'BitBucket', 'SourceTree']
      },
      
      // DevOps and infrastructure tools
      'devops': {
        'containers': ['Docker', 'Kubernetes', 'Helm', 'Podman', 'containerd'],
        'ci_cd': ['Jenkins', 'GitHub Actions', 'CircleCI', 'Travis CI', 'GitLab CI'],
        'cloud': ['AWS CLI', 'Azure CLI', 'Google Cloud SDK', 'Terraform', 'Pulumi'],
        'monitoring': ['Prometheus', 'Grafana', 'Datadog', 'New Relic', 'Sentry'],
        'security': ['SonarQube', 'OWASP ZAP', 'Vault', 'Snyk', 'Trivy']
      },
      
      // Design tools
      'design': {
        'ui': ['Figma', 'Sketch', 'Adobe XD', 'InVision', 'Zeplin'],
        'graphics': ['Photoshop', 'Illustrator', 'GIMP', 'Inkscape', 'Affinity Designer'],
        'prototyping': ['ProtoPie', 'Framer', 'Principle', 'Marvel', 'Balsamiq']
      },
      
      // Data and analytics tools
      'data': {
        'analytics': ['Tableau', 'Power BI', 'Google Analytics', 'Looker', 'Amplitude'],
        'database': ['MongoDB Compass', 'DBeaver', 'pgAdmin', 'MySQL Workbench', 'Redis Desktop'],
        'big_data': ['Hadoop', 'Spark', 'Kafka', 'Airflow', 'Databricks'],
        'ml': ['TensorFlow', 'PyTorch', 'scikit-learn', 'Keras', 'NLTK']
      },
      
      // Project management and collaboration tools
      'collaboration': {
        'project': ['Jira', 'Trello', 'Asana', 'Monday.com', 'ClickUp'],
        'communication': ['Slack', 'Microsoft Teams', 'Discord', 'Zoom', 'Google Meet'],
        'docs': ['Confluence', 'Notion', 'Google Docs', 'Microsoft Office', 'Dropbox Paper']
      },
      
      // Medical and healthcare tools
      'medical': {
        'clinical': ['Epic', 'Cerner', 'MEDITECH', 'Allscripts', 'NextGen'],
        'research': ['REDCap', 'OpenClinica', 'SPSS', 'SAS', 'R Studio'],
        'imaging': ['PACS', 'Horos', 'OsiriX', 'MIM', 'TeraRecon'],
        'telehealth': ['Zoom for Healthcare', 'Teladoc', 'Doxy.me', 'VSee', 'Amwell']
      }
    };
    
    // Set to track recommended tools
    const recommendedTools = new Set<string>();
    
    // Determine project domain
    const projectDomain = this.determineProjectDomain(projectTech);
    
    // Get domain-specific tools
    const domainTools = toolsByTech[projectDomain] || {};
    
    // Add tools based on project tech stack with domain context
    projectTech.forEach(tech => {
      const normalizedTech = tech.toLowerCase();
      
      // Check each category in the domain
      for (const [category, tools] of Object.entries(domainTools)) {
        if (normalizedTech.includes(category)) {
          // Add 1-2 tools from this category
          tools.slice(0, Math.min(2, tools.length)).forEach(tool => 
            recommendedTools.add(tool)
          );
        }
      }
      
      // Add general tools for software projects
      if (projectDomain === 'software' && recommendedTools.size < 3) {
        const generalTools = domainTools['general'] || [];
        generalTools.slice(0, 1).forEach(tool => recommendedTools.add(tool));
      }
    });
    
    // Add tools based on employee skills with domain context
    skills.forEach(skill => {
      const normalizedSkill = skill.toLowerCase();
      
      // Check each category in the domain
      for (const [category, tools] of Object.entries(domainTools)) {
        if (normalizedSkill.includes(category)) {
          // Add 1 tool from this category
          if (tools.length > 0) {
            recommendedTools.add(tools[0]);
          }
        }
      }
    });
    
    // If we still don't have enough tools, add from other domains
    if (recommendedTools.size < 3) {
      // Add collaboration tools as fallback
      const collaborationTools = toolsByTech['collaboration']?.['project'] || [];
      collaborationTools.slice(0, 1).forEach(tool => recommendedTools.add(tool));
    }
    
    // Limit to 5 tools max
    return Array.from(recommendedTools).slice(0, 5);
  }
  
  // Helper to determine project domain from tech stack
  private determineProjectDomain(techStack: string[]): string {
    if (!techStack || techStack.length === 0) return 'software'; // Default
    
    const normalizedTech = techStack.map(tech => tech.toLowerCase());
    
    // Check for medical/healthcare keywords
    const medicalKeywords = ['healthcare', 'medical', 'clinical', 'patient', 'hospital', 'ehr', 'emr'];
    if (normalizedTech.some(tech => medicalKeywords.some(keyword => tech.includes(keyword)))) {
      return 'medical';
    }
    
    // Check for data/analytics keywords
    const dataKeywords = ['data', 'analytics', 'ml', 'ai', 'machine learning', 'statistics', 'tableau', 'bi'];
    if (normalizedTech.some(tech => dataKeywords.some(keyword => tech.includes(keyword)))) {
      return 'data';
    }
    
    // Check for DevOps keywords
    const devopsKeywords = ['devops', 'cloud', 'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'ci/cd'];
    if (normalizedTech.some(tech => devopsKeywords.some(keyword => tech.includes(keyword)))) {
      return 'devops';
    }
    
    // Check for design keywords
    const designKeywords = ['design', 'ui', 'ux', 'figma', 'sketch', 'photoshop'];
    if (normalizedTech.some(tech => designKeywords.some(keyword => tech.includes(keyword)))) {
      return 'design';
    }
    
    // Default to software
    return 'software';
  }
  
  // Helper method to generate tasks based on project and employee
  private generateTasks(project: ProjectDetails, employee: EmployeeData): string {
    // Project-specific task categories
    const projectType = this.determineProjectType(project.project_title, project.project_description);
    const employeeRole = (employee.position || employee.role || '').toLowerCase();
    
    // Define task templates by project type and role
    const taskTemplates: {[key: string]: {[key: string]: string[]}} = {
      'software': {
        'developer': ['Code implementation', 'Unit testing', 'Code reviews', 'Feature development'],
        'designer': ['UI/UX design', 'Wireframing', 'Prototyping', 'Design system maintenance'],
        'manager': ['Sprint planning', 'Team coordination', 'Progress tracking', 'Technical decisions'],
        'analyst': ['Requirements analysis', 'User story creation', 'Acceptance criteria definition'],
        'tester': ['Test planning', 'Automated testing', 'Bug verification', 'Regression testing'],
        'devops': ['CI/CD pipeline setup', 'Infrastructure management', 'Deployment automation'],
        'default': ['Technical implementation', 'Documentation', 'Testing']
      },
      'marketing': {
        'manager': ['Campaign strategy', 'Performance tracking', 'Team coordination'],
        'designer': ['Creative design', 'Brand asset creation', 'Visual content development'],
        'analyst': ['Market research', 'Campaign analytics', 'Audience segmentation'],
        'content': ['Content creation', 'Copywriting', 'Editorial planning'],
        'social': ['Social media management', 'Community engagement', 'Content scheduling'],
        'default': ['Marketing support', 'Campaign execution', 'Performance analysis']
      },
      'research': {
        'researcher': ['Literature review', 'Experimental design', 'Data collection', 'Analysis'],
        'analyst': ['Statistical analysis', 'Data modeling', 'Methodology development'],
        'manager': ['Research coordination', 'Grant management', 'Team supervision'],
        'writer': ['Research documentation', 'Paper drafting', 'Publication preparation'],
        'default': ['Research support', 'Data processing', 'Documentation']
      },
      'medical': {
        'doctor': ['Clinical assessment', 'Treatment planning', 'Patient consultation'],
        'nurse': ['Patient care', 'Medical assistance', 'Health monitoring'],
        'technician': ['Medical testing', 'Equipment operation', 'Result processing'],
        'researcher': ['Clinical research', 'Trial coordination', 'Data collection'],
        'manager': ['Team coordination', 'Resource allocation', 'Compliance oversight'],
        'default': ['Medical support', 'Documentation', 'Administrative tasks']
      },
      'default': {
        'manager': ['Team coordination', 'Progress tracking', 'Stakeholder communication'],
        'senior': ['Strategic planning', 'Quality assurance', 'Technical leadership'],
        'junior': ['Task execution', 'Documentation', 'Support activities'],
        'default': ['Project tasks', 'Documentation', 'Team collaboration']
      }
    };
    
    // Determine role category
    let roleCategory = 'default';
    const projectTasks = taskTemplates[projectType] || taskTemplates['default'];
    
    for (const category of Object.keys(projectTasks)) {
      if (category !== 'default' && employeeRole.includes(category)) {
        roleCategory = category;
        break;
      }
    }
    
    // Get tasks for the role and project type
    const tasks = projectTasks[roleCategory] || projectTasks['default'];
    
    // Add project-specific context
    const contextualizedTasks = tasks.map(task => {
      if (project.tech_stack && project.tech_stack.length > 0) {
        // Add technology context for technical tasks
        if (task.includes('Code') || task.includes('development') || task.includes('implementation')) {
          return `${task} with ${project.tech_stack[0]}`;
        }
      }
      return task;
    });
    
    // Return formatted tasks
    return contextualizedTasks.join(', ');
  }
  
  // Helper to determine project type from title and description
  private determineProjectType(title: string, description: string): string {
    const combinedText = `${title} ${description}`.toLowerCase();
    
    // Define keywords for different project types
    const typeKeywords: {[key: string]: string[]} = {
      'software': ['software', 'app', 'application', 'website', 'web', 'mobile', 'development', 'coding', 'programming', 'api', 'backend', 'frontend', 'fullstack', 'database'],
      'marketing': ['marketing', 'campaign', 'brand', 'social media', 'content', 'seo', 'advertising', 'market', 'promotion'],
      'research': ['research', 'study', 'analysis', 'investigation', 'experiment', 'scientific', 'academic', 'publication'],
      'medical': ['medical', 'healthcare', 'clinical', 'patient', 'treatment', 'hospital', 'doctor', 'health', 'surgery', 'therapeutic']
    };
    
    // Check for keyword matches
    for (const [type, keywords] of Object.entries(typeKeywords)) {
      for (const keyword of keywords) {
        if (combinedText.includes(keyword)) {
          return type;
        }
      }
    }
    
    return 'default';
  }
  
  // Helper method to extract key terms from text
  private extractKeyTerms(text: string): string[] {
    if (!text) return [];
    
    // Normalize text
    const normalized = text.toLowerCase();
    
    // Remove common stop words
    const stopWords = ['and', 'the', 'to', 'of', 'for', 'in', 'on', 'with', 'by', 'at', 'from'];
    
    // Extract words, filter out short words and stop words
    return normalized
      .split(/\W+/)
      .filter(word => 
        word.length > 3 && 
        !stopWords.includes(word) &&
        !word.match(/^\d+$/) // Filter out pure numbers
      );
  }
}

// React hook for using the recommendation engine
export function useProjectRecommendations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationResult | null>(null);
  
  // Function to get recommendations
  const getRecommendations = async (projectDetails: ProjectDetails, companyCode: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const engine = new RecommendationEngine(companyCode);
      const result = await engine.recommendEmployees(projectDetails);
      setRecommendations(result);
      return result;
    } catch (err) {
      console.error('Error getting recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  };
  
  return { loading, error, recommendations, getRecommendations };
}
