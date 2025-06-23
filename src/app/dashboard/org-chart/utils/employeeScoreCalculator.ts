// Employee Score Calculator
// Simplified versions of the Python calculation functions for frontend use

/**
 * Calculate employee utilization score based on available data
 * Simplified version of the employee_utilization_analyzer.py calculation
 */
export interface UtilizationScoreResult {
  score: number;
  status: string;
  confidence: number;
  showInfoTooltip: boolean;
  tooltipText: string;
  factors: {
    toolComplexity: number;
    roleComplexity: number;
    jobIntensity: number;
    workloadFactor: number;
    totalHours: number;
    overtimeHours: number;
    standardHours: number;
  };
}

export function calculateUtilizationScore(employeeData: any): UtilizationScoreResult {
  // Extract relevant data from employee
  const jobTitle = employeeData.jobTitle || '';
  const jobDuties = employeeData.jobDuties || [];
  const tools = extractTools(jobDuties);
  const workSetting = employeeData.workSetting || 'Hybrid';
  
  // Calculate total weekly hours with validation
  const totalHours = jobDuties.reduce((acc: number, duty: any) => {
    const hours = Math.max(0, Math.min(parseInt(duty.hours) || 0, 168)); // Cap at 168 hours/week (24*7)
    return acc + hours;
  }, 0);
  
  // Calculate overtime hours (over 40 hours/week)
  const overtimeHours = Math.max(0, totalHours - 40);
  const standardHours = Math.min(totalHours, 40);
  
  // Calculate different factors that contribute to utilization
  
  // 1. Tool complexity score (based on number of tools)
  const toolComplexity = calculateToolComplexity(tools);
  
  // 2. Role complexity based on job title
  const roleComplexity = calculateRoleComplexity(jobTitle);
  
  // 3. Calculate job intensity based on duties
  const jobIntensity = calculateJobIntensity(jobDuties);
  
  // 4. Calculate workload factor with overtime consideration
  // Standard work week is 40 hours, overtime is penalized
  const baseWorkload = Math.min(1.0, standardHours / 40) || 0.5;
  const overtimePenalty = Math.min(1.0, overtimeHours / 20) * 0.5; // Up to 50% penalty for overtime
  const workloadFactor = Math.min(1.5, baseWorkload + (overtimePenalty * (overtimeHours > 0 ? 1 : 0)));
  
  // Calculate pressure handling score (from Python implementation)
  const pressureHandlingScore = Math.min(1.0, totalHours / 50);
  
  // Calculate breadth score (simplified version of calculate_responsibility_breadth)
  const breadthScore = 0.5; // Default value from Python implementation
  
  // Enhanced utilization formula with overtime consideration
  const rawUtilization = (
    0.12 * toolComplexity + 
    0.25 * workloadFactor + // Increased weight for workload
    0.15 * pressureHandlingScore + // Slightly increased weight
    0.15 * breadthScore +
    0.13 * roleComplexity + 
    0.2 * jobIntensity
  );
  
  // Apply overtime penalty (reduces score for excessive hours)
  const overtimePenaltyFactor = Math.min(1, overtimeHours / 20) * 0.1; // Up to 10% penalty
  const overtimeAdjustedScore = rawUtilization * (1 - overtimePenaltyFactor);
  
  // Adjust for work setting (remote adds complexity)
  const settingAdjustment = workSetting === 'Remote' ? 0.05 : 
                           workSetting === 'Hybrid' ? 0.03 : 0;
  
  // Final score with adjustments and overtime consideration
  let finalScore = Math.max(0, Math.min(1, overtimeAdjustedScore + settingAdjustment));
  
  // If working more than 60 hours, cap the score to prevent unrealistic high scores
  if (totalHours > 60) {
    finalScore = Math.min(finalScore, 0.85);
  }
  
  // Determine status based on score
  let status = 'optimal';
  if (finalScore < 0.3) {
    status = 'severely_underutilized';
  } else if (finalScore < 0.45) {
    status = 'underutilized';
  } else if (finalScore < 0.75) {
    status = 'optimal';
  } else if (finalScore < 0.9) {
    status = 'highly_utilized';
  } else {
    status = 'overutilized';
  }
  
  // Calculate confidence based on data completeness
  const confidence = calculateConfidence(employeeData);
  
  return {
    score: finalScore,
    status,
    confidence,
    showInfoTooltip: true,
    tooltipText: 'Utilization score is based on workload distribution, job intensity, and overtime hours. It may not account for all factors in your specific work environment.',
    factors: {
      toolComplexity,
      roleComplexity,
      jobIntensity,
      workloadFactor,
      totalHours,
      overtimeHours,
      standardHours
    }
  };
}

/**
 * Calculate employee attrition risk score
 * Simplified version of the attrition_score.py calculation
 */
export interface AttritionScoreResult {
  score: number;
  risk: string;
  showInfoTooltip: boolean;
  tooltipText: string;
  factors: {
    responsibilityMismatch: number;
    utilizationFactor: number;
    taskVariety: number;
    salarySatisfaction: number;
    jobIntensity: number;
    isPhysicalLabor: boolean;
    overtimeHours: number;
  };
}

export function calculateAttritionScore(employeeData: any): AttritionScoreResult {
  // Extract relevant data
  const jobTitle = employeeData.jobTitle || '';
  const jobDuties = employeeData.jobDuties || [];
  const tools = extractTools(jobDuties);
  const salary = parseInt(employeeData.salary) || 0;
  const workSetting = employeeData.workSetting || 'Hybrid';
  const officeLocation = employeeData.officeLocation || '';
  const industry = employeeData.industry || '';
  
  // Calculate total weekly hours
  const totalHours = jobDuties.reduce((acc: number, duty: any) => {
    return acc + (parseInt(duty.hours) || 0);
  }, 0);
  
  // 1. Calculate job intensity factor with physical labor consideration
  const isPhysicalLabor = jobDuties.some((duty: any) => 
    (duty.duty || '').toLowerCase().includes('construction') || 
    (duty.duty || '').toLowerCase().includes('manual labor') ||
    (duty.duty || '').toLowerCase().includes('heavy lifting')
  );
  
  const jobIntensity = calculateJobIntensity(jobDuties);
  const utilizationFactor = calculateUtilizationFactor(totalHours, jobIntensity, isPhysicalLabor);
  
  // Calculate overtime hours (over 40 hours/week)
  const overtimeHours = Math.max(0, totalHours - 40);
  
  // 2. Calculate role-seniority mismatch
  const seniorityLevel = calculateSeniorityLevel(jobTitle);
  const responsibilityMismatch = calculateResponsibilityMismatch(jobDuties, seniorityLevel);
  
  // 3. Calculate task variety index
  const taskVariety = calculateTaskVariety(jobDuties);
  
  // 4. Calculate salary satisfaction
  const salarySatisfaction = calculateSalarySatisfaction(
    salary, 
    seniorityLevel,
    jobTitle,
    officeLocation,
    industry
  );
  
  // Enhanced attrition risk calculation with physical labor consideration
  const physicalLaborFactor = isPhysicalLabor ? 1.2 : 1.0;
  const overtimeFactor = overtimeHours > 20 ? 1.3 : 
                       overtimeHours > 10 ? 1.15 : 1.0;
  
  // Adjust weights based on physical labor and overtime
  const adjustedUtilizationFactor = utilizationFactor * (isPhysicalLabor ? 1.2 : 1.0);
  const adjustedJobIntensity = jobIntensity * (isPhysicalLabor ? 1.3 : 1.0);
  
  // Calculate base score with adjusted factors
  let attritionScore = (
    0.15 * responsibilityMismatch +    // responsibility_mismatch
    0.12 * 0.5 +                       // tenure_factor (default value)
    0.18 * adjustedUtilizationFactor + // increased weight for utilization
    0.1 * calculateSeniorityFactor(seniorityLevel) + // seniority_factor
    0.1 * taskVariety +                // task_variety_index
    0.12 * adjustedJobIntensity +      // job_intensity with increased weight
    0.08 * 0.5 +                       // role_project_ratio (default)
    0.1 * 0.5 +                        // collaboration_index (default)
    0.15 * salarySatisfaction          // salary_satisfaction with increased weight
  );
  
  // Apply physical labor and overtime factors
  attritionScore = Math.min(1.0, attritionScore * physicalLaborFactor * overtimeFactor);
  
  // Normalize to 0-1 range
  const normalizedScore = Math.max(0, Math.min(1, attritionScore));
  
  // Determine risk level based on score
  let risk = 'low';
  if (normalizedScore > 0.7) {
    risk = 'high';
  } else if (normalizedScore > 0.4) {
    risk = 'medium';
  }
  
  return {
    score: normalizedScore,
    risk,
    showInfoTooltip: true,
    tooltipText: 'Attrition risk score considers workload, job satisfaction, and career growth factors. It may not account for all individual circumstances.',
    factors: {
      responsibilityMismatch,
      utilizationFactor: adjustedUtilizationFactor,
      taskVariety,
      salarySatisfaction,
      jobIntensity: adjustedJobIntensity,
      isPhysicalLabor,
      overtimeHours
    }
  };
}

// Helper functions

function extractTools(jobDuties: any[]): string[] {
  // Extract unique tools from job duties
  const toolsSet = new Set<string>();
  
  jobDuties.forEach(duty => {
    if (duty.tools) {
      const toolsList = duty.tools
        .split(',')
        .map((tool: string) => tool.trim())
        .filter(Boolean);
      
      toolsList.forEach((tool: string) => toolsSet.add(tool));
    }
  });
  
  return Array.from(toolsSet);
}

function calculateToolComplexity(tools: string[]): number {
  // More tools = higher complexity, but with diminishing returns
  const toolCount = tools.length;
  if (toolCount === 0) return 0.3;
  if (toolCount < 3) return 0.5;
  if (toolCount < 5) return 0.6;
  if (toolCount < 8) return 0.7;
  if (toolCount < 12) return 0.8;
  return 0.9;
}

function calculateRoleComplexity(jobTitle: string): number {
  // Assess role complexity based on job title keywords
  const title = jobTitle.toLowerCase();
  
  // Leadership roles
  if (title.includes('chief') || title.includes('cto') || title.includes('cio') || 
      title.includes('ceo') || title.includes('director') || title.includes('head')) {
    return 0.9;
  }
  
  // Senior roles
  if (title.includes('senior') || title.includes('lead') || 
      title.includes('principal') || title.includes('architect')) {
    return 0.8;
  }
  
  // Mid-level roles
  if (title.includes('manager') || title.includes('supervisor') || 
      title.includes('coordinator') || title.includes('specialist')) {
    return 0.7;
  }
  
  // Technical roles
  if (title.includes('engineer') || title.includes('developer') || 
      title.includes('analyst') || title.includes('designer')) {
    return 0.65;
  }
  
  // Default for other roles
  return 0.5;
}

/**
 * Fuzzy string matching to find the best match from a set of candidates
 * Implements a simplified version of the fuzzy matching from Python scripts
 */
function fuzzyMatch(query: string, candidates: string[]): { match: string, score: number } {
  if (!query || !candidates.length) return { match: '', score: 0 };
  
  query = query.toLowerCase();
  let bestMatch = '';
  let bestScore = 0;
  
  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase();
    
    // Exact match
    if (candidateLower === query) {
      return { match: candidate, score: 1.0 };
    }
    
    // Contains match
    if (candidateLower.includes(query) || query.includes(candidateLower)) {
      const containsScore = candidateLower.includes(query) ? 
        0.8 * (query.length / candidateLower.length) : 
        0.7 * (candidateLower.length / query.length);
      
      if (containsScore > bestScore) {
        bestScore = containsScore;
        bestMatch = candidate;
      }
    }
    
    // Word match (check if words in query appear in candidate)
    const queryWords = query.split(/\s+/);
    const candidateWords = candidateLower.split(/\s+/);
    
    let matchedWords = 0;
    for (const word of queryWords) {
      if (word.length < 3) continue; // Skip very short words
      if (candidateWords.some(cw => cw.includes(word) || word.includes(cw))) {
        matchedWords++;
      }
    }
    
    if (queryWords.length > 0) {
      const wordScore = 0.6 * (matchedWords / queryWords.length);
      if (wordScore > bestScore) {
        bestScore = wordScore;
        bestMatch = candidate;
      }
    }
    
    // Character similarity (simplified Levenshtein-like approach)
    const maxLength = Math.max(query.length, candidateLower.length);
    if (maxLength > 0) {
      let sameChars = 0;
      const minLength = Math.min(query.length, candidateLower.length);
      
      for (let i = 0; i < minLength; i++) {
        if (query[i] === candidateLower[i]) {
          sameChars++;
        }
      }
      
      const charScore = 0.4 * (sameChars / maxLength);
      if (charScore > bestScore) {
        bestScore = charScore;
        bestMatch = candidate;
      }
    }
  }
  
  return { match: bestMatch, score: bestScore };
}

/**
 * Call the Claude LLM API for task intensity estimation
 * Similar to the call_gemini_llm function in attrition_score.py
 */
async function callLlmForTaskIntensity(duty: string): Promise<number> {
  try {
    const response = await fetch('/api/claude-query-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        query: `Analyze this job duty: "${duty}". On a scale of 0.1 to 1.0, what is the intensity/complexity level of this task? Return only a number.`,
        session_id: `task_intensity_${Date.now()}`,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('LLM API error:', data);
      return 0.5; // Default on error
    }

    // Extract number from response
    const match = data.response?.match(/([0-9]\.[0-9])/);
    if (match && match[1]) {
      return parseFloat(match[1]);
    }
    
    return 0.5; // Default if no number found
  } catch (error) {
    console.error('Error calling LLM API:', error);
    return 0.5; // Default on error
  }
}

function calculateJobIntensity(jobDuties: any[]): number {
  if (!jobDuties.length) return 0.5;
  
  // Comprehensive benchmark tasks from employee_utilization_analyzer.py
  const BENCHMARK_TASKS: Record<string, number> = {
    // Standard corporate tasks
    'weekly status reporting': 0.3,
    'team meetings': 0.4,
    'email communication': 0.3,
    'corporate compliance training': 0.4,
    'performance reviews': 0.6,
    'budget planning': 0.7,
    'strategic planning': 0.8,
    'vendor management': 0.5,
    'risk assessment': 0.7,
    'policy development': 0.6,
    'corporate governance': 0.7,
    'business continuity planning': 0.7,
    'internal auditing': 0.6,
    'process improvement': 0.6,
    'cross-functional collaboration': 0.5,
    
    // Consulting tasks
    'client discovery meetings': 0.7,
    'stakeholder interviews': 0.6,
    'business requirements gathering': 0.7,
    'process mapping': 0.7,
    'gap analysis': 0.8,
    'client presentations': 0.7,
    'change management': 0.7,
    'management consulting': 0.8,
    'business transformation': 0.9,
    'strategy consulting': 0.9,
    
    // Banking tasks
    'loan processing': 0.5,
    'credit analysis': 0.7,
    'financial compliance': 0.7,
    'anti-money laundering': 0.7,
    'customer onboarding': 0.4,
    'mortgage underwriting': 0.7,
    'fraud detection': 0.7,
    'regulatory reporting': 0.6,
    'branch operations': 0.5,
    'treasury management': 0.8,
    
    // Investment/Hedge fund tasks
    'portfolio management': 0.9,
    'investment research': 0.8,
    'financial modeling': 0.8,
    'market analysis': 0.8,
    'risk modeling': 0.9,
    'algorithmic trading': 0.9,
    'investor relations': 0.7,
    'due diligence': 0.8,
    'fund administration': 0.6,
    'asset allocation': 0.8,
    
    // Sales tasks
    'lead generation': 0.5,
    'cold calling': 0.6,
    'sales presentations': 0.6,
    'client relationship management': 0.6,
    'sales forecasting': 0.5,
    'contract negotiation': 0.7,
    'proposal writing': 0.6,
    'sales territory management': 0.5,
    'competitive analysis': 0.6,
    'closing deals': 0.7,
    
    // Marketing tasks
    'brand strategy': 0.7,
    'content marketing': 0.6,
    'social media management': 0.5,
    'email marketing': 0.5,
    'seo optimization': 0.6,
    'marketing analytics': 0.7,
    'campaign management': 0.7,
    'market research': 0.6,
    'product marketing': 0.7,
    'event planning': 0.6,
    
    // Data tasks
    'data cleaning': 0.5,
    'data visualization': 0.6,
    'statistical analysis': 0.8,
    'predictive modeling': 0.9,
    'business intelligence': 0.7,
    'data pipeline development': 0.8,
    'database administration': 0.7,
    'data governance': 0.6,
    'data mining': 0.7,
    'etl development': 0.7,
    
    // Creative tasks
    'graphic design': 0.7,
    'ux design': 0.7,
    'video editing': 0.7,
    'content creation': 0.6,
    'animation work': 0.8,
    'illustration': 0.7,
    'copywriting': 0.6,
    'art direction': 0.8,
    'creative brainstorming': 0.6,
    'brand identity design': 0.7,
    
    // Legal tasks
    'legal research': 0.7,
    'contract review': 0.6,
    'legal writing': 0.7,
    'case preparation': 0.8,
    'legal consultation': 0.7,
    'regulatory compliance': 0.7,
    'litigation management': 0.8,
    'intellectual property': 0.7,
    'corporate law': 0.7,
    'court appearances': 0.9,
    'depositions': 0.8,
    'document drafting': 0.6,
    'legal analysis': 0.8,
    'client representation': 0.7,
    
    // Physical intensive tasks
    'heavy lifting': 0.9,
    'construction work': 0.9,
    'manual labor': 0.8,
    'warehouse operations': 0.7,
    'walking long distances': 0.6,
    'standing for long periods': 0.5,
    
    // Emotional labor tasks
    'handling customer complaints': 0.8,
    'crisis intervention': 0.9,
    'counseling': 0.8,
    'customer service': 0.6,
    'conflict resolution': 0.7,
    'reception duties': 0.4,
    'answering phone calls': 0.2,
    
    // Mental/cognitive load tasks
    'algorithm design': 0.9,
    'complex debugging': 0.8,
    'solving complex problems': 0.9,
    'data analysis': 0.7,
    'software architecture': 0.8,
    'financial analysis': 0.8,
    'project management': 0.6,
    'documentation writing': 0.4,
    'data entry': 0.3,
    'administrative tasks': 0.3,
    
    // Programming specific tasks
    'c++ programming': 0.8,
    'machine learning implementation': 0.9,
    'front-end development': 0.6,
    'back-end development': 0.7,
    'database management': 0.6,
    'code review': 0.5,
    'testing and qa': 0.4,
    
    // Education industry tasks
    'curriculum development': 0.6,
    'lesson planning': 0.5,
    'student assessment': 0.6,
    'grading assignments': 0.4,
    'parent-teacher meetings': 0.5,
    'educational research': 0.7,
    'classroom management': 0.6,
    'online teaching': 0.5,
    'accreditation compliance': 0.6,
    'professional development': 0.5,
    
    // Media industry tasks
    'content ideation': 0.6,
    'script writing': 0.7,
    'video production': 0.8,
    'audio editing': 0.7,
    'voice-over recording': 0.6,
    'broadcasting coordination': 0.7,
    'media buying': 0.6,
    'audience analytics': 0.5,
    'social media campaigns': 0.6,
    'post-production': 0.7,
    
    // Logistics tasks
    'shipment tracking': 0.4,
    'inventory management': 0.6,
    'warehouse scheduling': 0.5,
    'route optimization': 0.7,
    'supply chain coordination': 0.8,
    'customs documentation': 0.6,
    'freight negotiation': 0.7,
    'load planning': 0.6,
    'quality inspection': 0.5,
    'delivery scheduling': 0.5,
    
    // Healthcare tasks
    'patient care': 0.8,
    'medical diagnosis': 0.9,
    'treatment planning': 0.8,
    'medical research': 0.8,
    'clinical documentation': 0.6,
    'medical coding': 0.5,
    'healthcare compliance': 0.7,
    'patient consultation': 0.7,
    'medical testing': 0.6,
    'surgical assistance': 0.9,
    
    // Management tasks
    'team leadership': 0.8,
    'performance management': 0.7,
    'resource allocation': 0.7,
    'strategic decision making': 0.9,
    'employee coaching': 0.6,
    'operational oversight': 0.7,
    'budget administration': 0.6,
    'executive reporting': 0.7,
    'stakeholder management': 0.8,
    'organizational development': 0.8
  };
  
  // Calculate weighted intensity based on duty descriptions and hours
  let totalWeightedIntensity = 0;
  let totalHours = 0;
  
  jobDuties.forEach(duty => {
    const description = duty.duty?.toLowerCase() || '';
    let highestIntensity = 0;
    const hours = parseInt(duty.hours) || 0;
    
    // Use fuzzy matching to find best matching task
    const benchmarkTasks = Object.keys(BENCHMARK_TASKS);
    const { match, score } = fuzzyMatch(description, benchmarkTasks);
    
    // If we have a good fuzzy match (score > 0.6), use the benchmark intensity
    if (score > 0.6 && match) {
      highestIntensity = BENCHMARK_TASKS[match];
    } else {
      // Try to find exact keyword matches as fallback
      for (const [keyword, intensity] of Object.entries(BENCHMARK_TASKS)) {
        if (description.includes(keyword)) {
          highestIntensity = Math.max(highestIntensity, intensity);
        }
      }
      
      // If still no match, use logic from get_task_intensity in employee_utilization_analyzer.py
      if (highestIntensity === 0) {
        // Check for complexity indicators
        if (description.includes('complex') || 
            description.includes('advanced') || 
            description.includes('difficult') ||
            description.includes('challenging')) {
          highestIntensity = 0.8;
        }
        // Check for leadership indicators
        else if (description.includes('lead') || 
                description.includes('direct') || 
                description.includes('oversee') ||
                description.includes('manage')) {
          highestIntensity = 0.7;
        }
        // Try to use Claude LLM API for better accuracy (async, but fallback to sync for now)
        // In a real implementation, we would await this call, but for now we'll use a fallback
        else if (description.length > 10) {
          // This would be the ideal implementation, but we'll use fallback for now
          // const llmIntensity = await callLlmForTaskIntensity(description);
          // highestIntensity = llmIntensity;
          
          // For now, use more sophisticated heuristics
          const complexityWords = ['analyze', 'design', 'develop', 'architect', 'research', 'strategic', 'critical'];
          const highIntensityWords = ['urgent', 'critical', 'deadline', 'emergency', 'priority'];
          const lowIntensityWords = ['routine', 'basic', 'simple', 'standard', 'regular'];
          
          if (highIntensityWords.some(word => description.includes(word))) {
            highestIntensity = 0.8;
          } else if (complexityWords.some(word => description.includes(word))) {
            highestIntensity = 0.7;
          } else if (lowIntensityWords.some(word => description.includes(word))) {
            highestIntensity = 0.4;
          } else {
            // Default based on hours (from Python implementation)
            highestIntensity = hours > 15 ? 0.7 : 
                              hours > 10 ? 0.6 : 
                              hours > 5 ? 0.5 : 0.4;
          }
        }
        // Default based on hours (from Python implementation)
        else {
          highestIntensity = hours > 15 ? 0.7 : 
                            hours > 10 ? 0.6 : 
                            hours > 5 ? 0.5 : 0.4;
        }
      }
    }
    
    // Weight intensity by hours (exactly like Python version)
    totalWeightedIntensity += highestIntensity * (hours > 0 ? hours : 1);
    totalHours += (hours > 0 ? hours : 1);
  });
  
  // Calculate weighted average intensity
  let weightedIntensity = totalHours > 0 ? totalWeightedIntensity / totalHours : 0.5;
  
  // Apply additional factors from Python implementation
  // Adjust for number of duties (many duties with hours suggests higher intensity)
  const dutyCountFactor = jobDuties.length > 5 ? 1.1 : 
                         jobDuties.length > 3 ? 1.05 : 1.0;
  
  // Adjust for tools complexity
  const tools = extractTools(jobDuties);
  const toolComplexityFactor = tools.length > 8 ? 1.15 :
                              tools.length > 5 ? 1.1 :
                              tools.length > 3 ? 1.05 : 1.0;
  
  // Final intensity with adjustments
  weightedIntensity = Math.min(1.0, weightedIntensity * dutyCountFactor * toolComplexityFactor);
  
  return weightedIntensity;
}

function calculateConfidence(employeeData: any): number {
  // Calculate confidence score based on data completeness
  let score = 0.3; // Base score
  
  // Add confidence for each field with data
  if (employeeData.jobTitle) score += 0.1;
  
  const duties = employeeData.jobDuties || [];
  if (duties.length > 0) {
    score += 0.1;
    if (duties.length > 2) score += 0.1;
    
    // Check if hours are provided for duties
    const hasHours = duties.some((duty: any) => duty.hours && parseInt(duty.hours) > 0);
    if (hasHours) score += 0.1;
    
    // Check if tools are provided
    const hasTools = duties.some((duty: any) => duty.tools && duty.tools.trim() !== '');
    if (hasTools) score += 0.1;
  }
  
  if (employeeData.workSetting) score += 0.05;
  if (employeeData.officeLocation) score += 0.05;
  if (employeeData.salary) score += 0.05;
  if (employeeData.industry) score += 0.05;
  
  // Cap at 1.0
  return Math.min(1.0, score);
}

function calculateSeniorityLevel(jobTitle: string): number {
  // Determine seniority level based on job title keywords
  const title = jobTitle.toLowerCase();
  
  if (title.includes('intern') || title.includes('trainee') || title.includes('junior')) {
    return 0.2;
  }
  
  if (title.includes('associate')) {
    return 0.3;
  }
  
  if (title.includes('senior') || title.includes('sr.') || title.includes('sr')) {
    return 0.7;
  }
  
  if (title.includes('lead') || title.includes('principal')) {
    return 0.8;
  }
  
  if (title.includes('manager') || title.includes('supervisor')) {
    return 0.7;
  }
  
  if (title.includes('director') || title.includes('head')) {
    return 0.9;
  }
  
  if (title.includes('chief') || title.includes('c-suite') || 
      title.includes('ceo') || title.includes('cto') || 
      title.includes('cfo') || title.includes('cio')) {
    return 1.0;
  }
  
  // Default for most positions
  return 0.5;
}

function calculateResponsibilityMismatch(jobDuties: any[], seniorityLevel: number): number {
  if (!jobDuties.length) return 0.3;
  
  // Calculate average duty complexity
  const dutyComplexity = jobDuties.map(duty => {
    const description = duty.duty?.toLowerCase() || '';
    
    // Leadership keywords indicate higher complexity
    if (description.includes('lead') || description.includes('manage') || 
        description.includes('direct') || description.includes('supervise')) {
      return 0.8;
    }
    
    // Strategic keywords indicate higher complexity
    if (description.includes('strategy') || description.includes('architect') || 
        description.includes('design') || description.includes('plan')) {
      return 0.7;
    }
    
    // Technical tasks have medium complexity
    if (description.includes('develop') || description.includes('implement') || 
        description.includes('code') || description.includes('program')) {
      return 0.6;
    }
    
    // Administrative tasks have lower complexity
    if (description.includes('document') || description.includes('report') || 
        description.includes('support') || description.includes('assist')) {
      return 0.4;
    }
    
    return 0.5; // Default
  });
  
  const avgComplexity = dutyComplexity.reduce((sum, val) => sum + val, 0) / dutyComplexity.length;
  
  // Calculate mismatch as the absolute difference between seniority and average duty complexity
  const mismatch = Math.abs(seniorityLevel - avgComplexity);
  
  return mismatch;
}

function calculateUtilizationFactor(totalHours: number, jobIntensity: number, isPhysicalLabor: boolean = false): number {
  // Calculate utilization factor based on total hours and job intensity
  // Following the logic from calculate_utilization_factor in attrition_score.py
  if (totalHours === 0) return 0.5; // No data
  
  // Get a base workload factor
  let baseWorkload = totalHours / 40; // 40-hour work week standard
  const intensityAdjusted = baseWorkload * (0.5 + jobIntensity * 0.5);
  
  // Adjust thresholds based on physical labor
  const overUtilizationThreshold = isPhysicalLabor ? 1.0 : 1.15;
  const underUtilizationThreshold = isPhysicalLabor ? 0.85 : 0.80;
  
  // Both over and under utilization increase attrition risk (U-curve)
  if (intensityAdjusted > overUtilizationThreshold) {
    // Overutilized - high risk
    const overageFactor = Math.min((intensityAdjusted - overUtilizationThreshold) / (2.0 - overUtilizationThreshold), 1.0);
    return 0.7 + overageFactor * 0.3; // 0.7-1.0 range
  }
  
  if (intensityAdjusted < underUtilizationThreshold) {
    // Underutilized - moderate to high risk
    const underageFactor = Math.min((underUtilizationThreshold - intensityAdjusted) / underUtilizationThreshold, 1.0);
    return 0.5 + underageFactor * 0.2; // 0.5-0.7 range
  }
  
  // Optimal utilization - lowest risk
  // The closer to perfect 1.0, the better
  const optimalPoint = isPhysicalLabor ? 0.9 : 1.0;
  const maxDeviation = isPhysicalLabor ? 
    Math.max(optimalPoint - underUtilizationThreshold, overUtilizationThreshold - optimalPoint) :
    overUtilizationThreshold - 1.0;
    
  const deviation = Math.abs(intensityAdjusted - optimalPoint);
  return 0.3 + (1 - (deviation / maxDeviation)) * 0.4; // 0.3-0.7 range
}

function calculateTaskVariety(jobDuties: any[]): number {
  // This exactly matches calculate_task_variety_index from attrition_score.py
  if (!jobDuties.length) return 0.7; // No data - higher risk
  if (jobDuties.length === 1) return 0.7; // Single task - higher risk
  
  // Extract unique task types
  const taskTypes = new Set<string>();
  let totalHours = 0;
  
  jobDuties.forEach(duty => {
    const description = duty.duty?.toLowerCase() || '';
    const hours = parseInt(duty.hours) || 0;
    totalHours += hours;
    
    // Simplified task type extraction
    if (description.includes('manage') || description.includes('lead') || 
        description.includes('supervise') || description.includes('direct')) {
      taskTypes.add('management');
    }
    if (description.includes('develop') || description.includes('code') || 
        description.includes('program') || description.includes('implement')) {
      taskTypes.add('development');
    }
    if (description.includes('design') || description.includes('architect')) {
      taskTypes.add('design');
    }
    if (description.includes('test') || description.includes('qa') || 
        description.includes('quality')) {
      taskTypes.add('testing');
    }
    if (description.includes('research') || description.includes('study') || 
        description.includes('analyze') || description.includes('investigate')) {
      taskTypes.add('research');
    }
    if (description.includes('customer') || description.includes('support') || 
        description.includes('help') || description.includes('service')) {
      taskTypes.add('support');
    }
    if (description.includes('document') || description.includes('report') || 
        description.includes('write')) {
      taskTypes.add('documentation');
    }
    if (description.includes('meet') || description.includes('communicate') || 
        description.includes('coordinate') || description.includes('collaborate')) {
      taskTypes.add('coordination');
    }
    
    // If no match found, add a generic task type
    if (taskTypes.size === 0) {
      taskTypes.add('other');
    }
  });
  
  // Calculate variety score based on number of task types and hourly distribution
  const uniqueTaskTypes = taskTypes.size;
  
  // Task type variety - follows the Python implementation
  if (uniqueTaskTypes >= 4) {
    // Good variety of task types - lowest risk
    return 0.25;
  } else if (uniqueTaskTypes === 3) {
    // Moderate variety - low risk
    return 0.35;
  } else if (uniqueTaskTypes === 2) {
    // Some variety - moderate risk
    return 0.5;
  } else {
    // Very limited variety - higher risk
    return 0.7;
  }
}

/**
 * Calculate seniority factor based on attrition_score.py
 * Mid-level seniority has highest attrition risk 
 */
function calculateSeniorityFactor(seniorityLevel: number): number {
  // Mid-seniority (around 0.4-0.7) has highest attrition risk
  // This follows a bell curve with peak around 0.55
  if (seniorityLevel < 0.3) {
    // Junior staff - lower attrition risk
    return 0.3;
  } else if (seniorityLevel > 0.8) {
    // Senior staff - lower attrition risk
    return 0.4;
  } else {
    // Mid-level staff - higher attrition risk
    // Calculate position in the bell curve
    const distFromMid = Math.abs(seniorityLevel - 0.55);
    // Map to 0.6-0.9 range (peak risk at exact middle seniority)
    return 0.9 - Math.min(0.3, distFromMid * 2);
  }
}

function calculateSalarySatisfaction(
  salary: number, 
  seniorityLevel: number, 
  jobTitle: string,
  location: string = '',
  industry: string = ''
): number {
  if (!salary) return 0.5; // No data
  
  // Baseline expected salary ranges by seniority
  const baseSalaryByLevel: Record<string, [number, number]> = {
    'entry': [40000, 70000],
    'mid': [70000, 110000],
    'senior': [100000, 160000],
    'lead': [130000, 190000],
    'management': [140000, 220000],
    'executive': [180000, 300000]
  };
  
  // Determine salary level category
  let levelCategory = 'mid';
  if (seniorityLevel <= 0.25) levelCategory = 'entry';
  else if (seniorityLevel <= 0.6) levelCategory = 'mid';
  else if (seniorityLevel <= 0.75) levelCategory = 'senior';
  else if (seniorityLevel <= 0.85) levelCategory = 'lead';
  else if (seniorityLevel <= 0.95) levelCategory = 'management';
  else levelCategory = 'executive';
  
  // Get expected salary range
  const [minExpected, maxExpected] = baseSalaryByLevel[levelCategory];
  
  // Adjust for location cost of living
  const locationFactor = getLocationFactor(location);
  const industrySalaryFactor = getIndustrySalaryFactor(industry);
  
  const adjustedMinExpected = minExpected * locationFactor * industrySalaryFactor;
  const adjustedMaxExpected = maxExpected * locationFactor * industrySalaryFactor;
  
  // Calculate satisfaction based on how salary compares to expected range
  // This follows the Python implementation's pattern but with simplified logic
  if (salary < adjustedMinExpected) {
    // Under-compensated increases attrition risk
    const deficit = (adjustedMinExpected - salary) / adjustedMinExpected;
    
    // Exactly matching the Python formula
    // The more underpaid, the higher the attrition risk
    if (deficit > 0.4) {
      // Severely underpaid - highest risk
      return 0.9;
    } else if (deficit > 0.2) {
      // Significantly underpaid
      return 0.7 + (deficit - 0.2) * 1.0; // 0.7-0.9 range
    } else {
      // Somewhat underpaid
      return 0.5 + deficit * 1.0; // 0.5-0.7 range
    }
  }
  
  if (salary > adjustedMaxExpected) {
    // Over-compensation actually slightly increases risk (golden handcuffs syndrome)
    // This matches the Python implementation's reasoning
    const excess = (salary - adjustedMaxExpected) / adjustedMaxExpected;
    
    if (excess > 0.5) {
      // Extremely overpaid - moderate risk (golden handcuffs)
      return 0.5;
    } else {
      // Somewhat overpaid - reduced risk but not lowest
      return 0.35 + excess * 0.3; // 0.35-0.5 range
    }
  }
  
  // Within expected range - lowest attrition risk
  // Calculate where in the range the salary falls
  const positionInRange = (salary - adjustedMinExpected) / (adjustedMaxExpected - adjustedMinExpected);
  
  // Best satisfaction (lowest risk) when salary is near upper end of range
  // This matches the Python implementation exactly
  return 0.35 - (positionInRange * 0.2); // 0.15-0.35 range
}

function getLocationFactor(location: string): number {
  // Simplified location cost of living adjustment
  if (!location) return 1.0;
  
  const normalized = location.toLowerCase();
  
  if (normalized.includes('san francisco') || normalized.includes('nyc') || 
      normalized.includes('new york') || normalized.includes('manhattan')) {
    return 2.0;
  }
  
  if (normalized.includes('los angeles') || normalized.includes('boston') || 
      normalized.includes('seattle') || normalized.includes('washington dc')) {
    return 1.7;
  }
  
  if (normalized.includes('chicago') || normalized.includes('austin') || 
      normalized.includes('denver') || normalized.includes('miami')) {
    return 1.3;
  }
  
  if (normalized.includes('remote')) {
    return 1.2; // Remote work commands slightly higher salaries
  }
  
  return 1.0; // Default for other locations
}

function getIndustrySalaryFactor(industry: string): number {
  // Industry-specific salary adjustment factors
  if (!industry) return 1.0;
  
  const normalized = industry.toLowerCase();
  
  if (normalized.includes('tech') || normalized.includes('software') || 
      normalized.includes('it') || normalized.includes('cyber')) {
    return 1.3;
  }
  
  if (normalized.includes('finance') || normalized.includes('banking') || 
      normalized.includes('investment') || normalized.includes('trading')) {
    return 1.4;
  }
  
  if (normalized.includes('healthcare') || normalized.includes('medical') || 
      normalized.includes('pharma') || normalized.includes('biotech')) {
    return 1.2;
  }
  
  if (normalized.includes('education') || normalized.includes('non-profit') || 
      normalized.includes('government')) {
    return 0.8;
  }
  
  return 1.0; // Default
} 