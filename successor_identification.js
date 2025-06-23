/**
 * Successor Identification Module
 * 
 * This module provides functions to identify potential successors for employees
 * based on competency matching, project complexity, cognitive load adaptability,
 * and other factors.
 */

import { MongoClient } from 'mongodb';
import axios from 'axios';

// Mathematical modeling parameters
const SUCCESSOR_FACTOR_WEIGHTS = {
  stabilityIndex: 0.20,           // Weight for attrition risk (inverted)
  projectComplexity: 0.15,        // Weight for project complexity exposure
  cognitiveLoad: 0.20,            // Weight for cognitive load adaptability
  promotionVelocity: 0.15,        // Weight for career growth momentum
  competencySimilarity: 0.30      // Weight for skill/competency overlap
};

// Tool complexity scores - used to measure technical skill proficiency
const TOOL_COMPLEXITY = {
  // Design tools
  "adobe photoshop": 0.7,
  "adobe illustrator": 0.7,
  "figma": 0.6,
  "sketch": 0.6,
  "invision": 0.5,
  
  // Development tools
  "visual studio code": 0.5,
  "intellij": 0.7,
  "xcode": 0.7,
  "android studio": 0.7,
  "github": 0.4,
  "gitlab": 0.4,
  "bitbucket": 0.4,
  "sourcetree": 0.3,
  
  // Project management
  "jira": 0.5,
  "asana": 0.4,
  "trello": 0.4,
  "microsoft project": 0.6,
  "monday.com": 0.4,
  "clickup": 0.4,
  
  // Data/Analytics
  "tableau": 0.7,
  "power bi": 0.6,
  "looker": 0.7,
  "google analytics": 0.6,
  "mixpanel": 0.6,
  "amplitude": 0.6,
  
  // Business/Office
  "microsoft excel": 0.5,
  "microsoft word": 0.3,
  "microsoft powerpoint": 0.4,
  "google sheets": 0.5,
  "google docs": 0.3,
  "google slides": 0.4,
  "airtable": 0.5,
  "notion": 0.4,
  
  // Engineering/Technical
  "autocad": 0.9,
  "solidworks": 0.9,
  "matlab": 0.8,
  "labview": 0.8,
  "unity": 0.8,
  "unreal engine": 0.9,
  "blender": 0.8,
  
  // Databases
  "sql": 0.7,
  "mysql": 0.7,
  "postgresql": 0.7,
  "mongodb": 0.7,
  "firebase": 0.6,
  "dynamodb": 0.7,
  
  // Programming Languages (generally higher complexity)
  "javascript": 0.7,
  "typescript": 0.8,
  "python": 0.7,
  "java": 0.8,
  "c#": 0.8,
  "c++": 0.9,
  "rust": 0.9,
  "go": 0.8,
  "swift": 0.8,
  "kotlin": 0.8,
  "php": 0.6,
  "ruby": 0.7,
  
  // Cloud/DevOps
  "aws": 0.8,
  "azure": 0.8,
  "google cloud": 0.8,
  "docker": 0.7,
  "kubernetes": 0.9,
  "terraform": 0.8,
  "jenkins": 0.7,
  "circleci": 0.7,
  "ansible": 0.7,
  
  // Marketing
  "hubspot": 0.5,
  "mailchimp": 0.4,
  "google ads": 0.6,
  "facebook ads": 0.6,
  "semrush": 0.6,
  "ahrefs": 0.6,
  
  // Finance
  "quickbooks": 0.5,
  "xero": 0.5,
  "sap": 0.8,
  "salesforce": 0.7,
  "netsuite": 0.7,
  "bloomberg terminal": 0.8
};

// Job role complexity mapping - determines inherent complexity of roles
const ROLE_COMPLEXITY = {
  // C-Suite
  "ceo": 0.95,
  "cto": 0.90,
  "cfo": 0.90,
  "coo": 0.90,
  "chief product officer": 0.90,
  "chief marketing officer": 0.85,
  "chief data officer": 0.85,
  "chief information officer": 0.85,
  "chief security officer": 0.85,
  
  // Technical Leadership
  "vp of engineering": 0.85,
  "engineering director": 0.80,
  "technical director": 0.80,
  "director of data science": 0.80,
  "head of infrastructure": 0.80,
  "head of data": 0.80,
  "head of ai": 0.85,
  "architecture lead": 0.80,
  
  // Management
  "engineering manager": 0.75,
  "product manager": 0.70,
  "project manager": 0.65,
  "program manager": 0.70,
  "technical lead": 0.75,
  "team lead": 0.70,
  "scrum master": 0.60,
  
  // Individual Contributors - Technical
  "principal engineer": 0.85,
  "staff engineer": 0.80,
  "senior engineer": 0.75,
  "software engineer": 0.70,
  "junior engineer": 0.60,
  "data scientist": 0.75,
  "machine learning engineer": 0.80,
  "devops engineer": 0.75,
  "site reliability engineer": 0.75,
  "security engineer": 0.75,
  "qa engineer": 0.65,
  
  // Design
  "design director": 0.75,
  "ux director": 0.75,
  "lead designer": 0.70,
  "senior designer": 0.65,
  "product designer": 0.65,
  "ui designer": 0.60,
  "ux designer": 0.65,
  "graphic designer": 0.60,
  
  // Product
  "director of product": 0.80,
  "product director": 0.80,
  "senior product manager": 0.75,
  "product manager": 0.70,
  "associate product manager": 0.65,
  "product owner": 0.65,
  
  // Marketing
  "marketing director": 0.75,
  "marketing manager": 0.65,
  "marketing specialist": 0.55,
  "brand manager": 0.65,
  "content strategist": 0.60,
  "seo specialist": 0.60,
  
  // Business/Operations
  "director of operations": 0.75,
  "operations manager": 0.65,
  "business analyst": 0.60,
  "data analyst": 0.65,
  "financial analyst": 0.70,
  "hr manager": 0.65,
  "recruiter": 0.55,
  
  // General
  "director": 0.75,
  "manager": 0.65,
  "senior": 0.70,
  "junior": 0.50,
  "intern": 0.40,
  "associate": 0.55,
  "assistant": 0.45
};

/**
 * Calculate stability index from employee attrition assessment
 * @param {Object} employee - Employee document
 * @return {Object} Stability index assessment
 */
const calculateStabilityIndex = (employee) => {
  let attritionScore = employee.attritionAssessment?.attrition_score;
  
  // If no attrition score is available, estimate one based on tenure
  if (attritionScore === undefined) {
    const tenureMonths = employee.timeInCurrentRoleMonths || 0;
    // Higher tenure generally indicates lower attrition risk
    attritionScore = Math.max(0, 1 - (tenureMonths / 48)); // 4 years tenure = low risk
    // Cap it to reasonable range
    attritionScore = Math.min(Math.max(attritionScore, 0.2), 0.8);
  }
  
  // Stability is inverse of attrition risk
  const stabilityScore = 1 - attritionScore;
  
  return {
    score: stabilityScore,
    factors: {
      attritionScore: attritionScore,
      tenureMonths: employee.timeInCurrentRoleMonths || 0,
      companyTenureMonths: employee.timeWithCompanyMonths || 0
    },
    insights: `Stability score of ${(stabilityScore * 100).toFixed(0)}% indicates ${
      stabilityScore > 0.7 ? 'high retention probability' :
      stabilityScore > 0.5 ? 'moderate retention probability' :
      'potential flight risk'
    }`
  };
};

/**
 * Calculate competency similarity between incumbent and candidate
 * @param {Object} incumbent - Employee being replaced
 * @param {Object} candidate - Potential successor candidate
 * @return {Object} Competency similarity assessment
 */
const calculateCompetencySimilarity = (incumbent, candidate) => {
  // Extract tools proficiency
  const incumbentTools = new Set(
    (incumbent.toolsProficient || [])
      .map(tool => typeof tool === 'string' ? tool.toLowerCase() : 
            (tool.name || '').toLowerCase())
  );
  
  const candidateTools = new Set(
    (candidate.toolsProficient || [])
      .map(tool => typeof tool === 'string' ? tool.toLowerCase() : 
            (tool.name || '').toLowerCase())
  );
  
  // Calculate tool similarity
  const commonTools = [...incumbentTools].filter(tool => candidateTools.has(tool));
  const toolSimilarityScore = incumbentTools.size > 0 ? 
    commonTools.length / incumbentTools.size : 0;
  
  // Get responsibilities
  const incumbentDuties = (incumbent.jobDuties || [])
    .concat(incumbent.jobResponsibilities || [])
    .map(duty => typeof duty === 'string' ? duty : duty.description || '')
    .filter(Boolean);
  
  const candidateDuties = (candidate.jobDuties || [])
    .concat(candidate.jobResponsibilities || [])
    .map(duty => typeof duty === 'string' ? duty : duty.description || '')
    .filter(Boolean);
  
  // Simple text matching for duties (would use embeddings in real implementation)
  let dutyMatchCount = 0;
  if (incumbentDuties.length > 0 && candidateDuties.length > 0) {
    for (const incumbentDuty of incumbentDuties) {
      const words = incumbentDuty.toLowerCase().split(/\s+/);
      for (const candidateDuty of candidateDuties) {
        const candidateWords = candidateDuty.toLowerCase().split(/\s+/);
        // Check for word overlap
        const commonWords = words.filter(word => candidateWords.includes(word) && word.length > 3);
        if (commonWords.length >= 3) {
          dutyMatchCount++;
          break;
        }
      }
    }
  }
  
  const dutySimilarityScore = incumbentDuties.length > 0 ? 
    dutyMatchCount / incumbentDuties.length : 0;
  
  // Combine for overall competency similarity score
  const similarityScore = (toolSimilarityScore * 0.6) + (dutySimilarityScore * 0.4);
  
  return {
    score: similarityScore,
    factors: {
      toolSimilarity: toolSimilarityScore,
      dutySimilarity: dutySimilarityScore,
      commonTools: commonTools
    },
    insights: `Competency similarity of ${(similarityScore * 100).toFixed(0)}% indicates ${
      similarityScore > 0.7 ? 'strong skill overlap' :
      similarityScore > 0.5 ? 'moderate skill overlap' :
      'limited skill overlap'
    } between incumbent and candidate.`
  };
};

/**
 * Calculate project complexity exposure score
 * @param {Object} employee - Employee document
 * @return {Object} Project complexity assessment
 */
const calculateProjectComplexity = (employee) => {
  const projects = Array.isArray(employee.projects) ? employee.projects : [];
  
  if (projects.length === 0) {
    return {
      score: 0.5, // Default middle score with no data
      factors: {
        averageBudget: 0,
        maxTeamSize: 0,
        projectCount: 0
      },
      insights: "No project data available for complexity assessment"
    };
  }
  
  // Extract budget values and normalize
  const budgets = projects
    .map(p => {
      if (typeof p.budget === 'number') return p.budget;
      if (typeof p.budget === 'string') {
        // Extract number from string like "$100,000" or "100k"
        const match = p.budget.match(/\$?([0-9,.]+)[k|K|M]?/);
        if (match) {
          let value = parseFloat(match[1].replace(/,/g, ''));
          if (p.budget.includes('k') || p.budget.includes('K')) value *= 1000;
          if (p.budget.includes('M')) value *= 1000000;
          return value;
        }
      }
      return 0;
    })
    .filter(budget => budget > 0);
  
  // Team sizes
  const teamSizes = projects
    .map(p => typeof p.teamSize === 'number' ? p.teamSize : 
         (typeof p.teamSize === 'string' ? parseInt(p.teamSize, 10) : 0))
    .filter(size => !isNaN(size) && size > 0);
  
  // Calculate metrics
  const averageBudget = budgets.length > 0 ? 
    budgets.reduce((sum, budget) => sum + budget, 0) / budgets.length : 0;
  
  const maxTeamSize = teamSizes.length > 0 ? 
    Math.max(...teamSizes) : 0;
  
  // Normalize budget score (0.0-1.0)
  const budgetScore = Math.min(averageBudget / 500000, 1);
  
  // Normalize team size score (0.0-1.0)
  const teamSizeScore = Math.min(maxTeamSize / 20, 1);
  
  // Overall complexity score
  const complexityScore = (budgetScore * 0.6) + (teamSizeScore * 0.4);
  
  return {
    score: complexityScore,
    factors: {
      averageBudget,
      maxTeamSize,
      projectCount: projects.length,
      budgetScore,
      teamSizeScore
    },
    insights: `Project complexity score of ${(complexityScore * 100).toFixed(0)}% indicates ${
      complexityScore > 0.7 ? 'high complexity exposure' :
      complexityScore > 0.5 ? 'moderate complexity exposure' :
      'limited complexity exposure'
    }`
  };
};

/**
 * Calculate cognitive load adaptability
 * @param {Object} employee - Employee document
 * @return {Object} Cognitive load assessment
 */
const calculateCognitiveLoad = (employee) => {
  // Use utilization assessment if available
  if (employee.utilizationAssessment) {
    // Higher utilization correlates with higher cognitive load handling
    const utilizationScore = employee.utilizationAssessment.utilization_score || 0.5;
    
    // We want to measure adaptability - very high utilization may indicate poor adaptability
    // Best adaptability is in the 0.6-0.8 range (challenged but not overloaded)
    const adaptabilityScore = utilizationScore > 0.8 ? 
      1 - ((utilizationScore - 0.8) * 5) : // Penalize overutilization
      utilizationScore > 0.4 ? 
        0.5 + ((utilizationScore - 0.4) * 1.25) : // Reward healthy utilization
        utilizationScore * 1.25; // Lower scores get proportional rating
        
    return {
      score: Math.max(0, Math.min(1, adaptabilityScore)),
      factors: {
        utilizationScore,
        adaptabilityAdjustment: adaptabilityScore - utilizationScore
      },
      insights: `Cognitive load adaptability of ${(adaptabilityScore * 100).toFixed(0)}% indicates ${
        adaptabilityScore > 0.7 ? 'strong ability to handle complex workloads' :
        adaptabilityScore > 0.5 ? 'moderate ability to handle complexity' :
        'potential challenges with high cognitive load'
      }`
    };
  }
  
  // Fallback if utilization assessment not available
  // Here we could analyze job intensity data
  if (employee.job_intensity_analysis) {
    const intensityScore = employee.job_intensity_analysis.overall_intensity || 0.5;
    // Similar logic as above - moderate-high intensity is optimal for demonstrating adaptability
    const adaptabilityScore = intensityScore > 0.8 ? 
      1 - ((intensityScore - 0.8) * 5) : 
      intensityScore > 0.4 ? 
        0.5 + ((intensityScore - 0.4) * 1.25) : 
        intensityScore * 1.25;
        
    return {
      score: Math.max(0, Math.min(1, adaptabilityScore)),
      factors: {
        intensityScore,
        adaptabilityAdjustment: adaptabilityScore - intensityScore
      },
      insights: `Cognitive load adaptability inferred from job intensity (${(intensityScore * 100).toFixed(0)}%) indicates ${
        adaptabilityScore > 0.7 ? 'strong ability to handle complex workloads' :
        adaptabilityScore > 0.5 ? 'moderate ability to handle complexity' :
        'potential challenges with high cognitive load'
      }`
    };
  }
  
  // Default value as fallback
  return {
    score: 0.5,
    factors: {
      defaultAssessment: true
    },
    insights: "Insufficient data for cognitive load adaptability assessment"
  };
};

/**
 * Calculate promotion velocity (career growth speed)
 * @param {Object} employee - Employee document
 * @return {Object} Promotion velocity assessment
 */
const calculatePromotionVelocity = (employee) => {
  const careerPath = employee.careerPath || employee.careeerProgression || []; // Note typo in field name
  const performanceReviews = employee.performanceReviews || [];
  
  if (careerPath.length <= 1 && performanceReviews.length === 0) {
    return {
      score: 0.5, // Default middle score
      factors: {
        defaultAssessment: true,
      },
      insights: "Insufficient career progression data for assessment"
    };
  }
  
  // Calculate promotion frequency if career path data exists
  let promotionScore = 0.5;
  if (careerPath.length > 1) {
    // Sort by date if available
    const sortedPath = [...careerPath].sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateA - dateB;
    });
    
    // Calculate time between roles in months
    const timeBetweenRoles = [];
    for (let i = 1; i < sortedPath.length; i++) {
      const prevDate = sortedPath[i-1].date ? new Date(sortedPath[i-1].date) : null;
      const currDate = sortedPath[i].date ? new Date(sortedPath[i].date) : null;
      
      if (prevDate && currDate) {
        const monthsDiff = (currDate.getFullYear() - prevDate.getFullYear()) * 12 + 
                           (currDate.getMonth() - prevDate.getMonth());
        if (monthsDiff > 0) {
          timeBetweenRoles.push(monthsDiff);
        }
      }
    }
    
    if (timeBetweenRoles.length > 0) {
      const avgMonthsBetweenPromotions = timeBetweenRoles.reduce((sum, time) => sum + time, 0) / 
                                        timeBetweenRoles.length;
      
      // Score based on promotion speed (24 months = 0.5, 12 months = 0.75, 36 months = 0.25)
      // Extremely fast promotions (< 12 months) might be too quick for proper skill development
      promotionScore = avgMonthsBetweenPromotions < 12 ? 
        0.5 + ((12 - avgMonthsBetweenPromotions) / 24) : 
        0.5 - ((avgMonthsBetweenPromotions - 24) / 48);
      
      // Cap between 0-1
      promotionScore = Math.max(0, Math.min(1, promotionScore));
    }
  }
  
  // Consider performance reviews if available
  let performanceScore = 0.5;
  if (performanceReviews.length > 0) {
    // Extract ratings and normalize to 0-1 scale
    const ratings = performanceReviews.map(review => {
      if (typeof review.rating === 'number') {
        return review.rating / 5; // Assuming 5-point scale
      } else if (typeof review.rating === 'string') {
        // Map text ratings to scores
        const rating = review.rating.toLowerCase();
        if (rating.includes('excellent') || rating.includes('outstanding')) return 0.9;
        if (rating.includes('exceed')) return 0.8;
        if (rating.includes('meet') && rating.includes('expect')) return 0.6;
        if (rating.includes('improvement')) return 0.4;
        if (rating.includes('poor') || rating.includes('unacceptable')) return 0.2;
      }
      return 0.5; // Default
    });
    
    performanceScore = ratings.reduce((sum, score) => sum + score, 0) / ratings.length;
  }
  
  // Combined velocity score - weighting promotion history more heavily
  const velocityScore = (promotionScore * 0.7) + (performanceScore * 0.3);
  
  return {
    score: velocityScore,
    factors: {
      promotionScore,
      performanceScore,
      careerPathLength: careerPath.length,
      reviewCount: performanceReviews.length
    },
    insights: `Promotion velocity score of ${(velocityScore * 100).toFixed(0)}% indicates ${
      velocityScore > 0.7 ? 'rapid career progression' :
      velocityScore > 0.5 ? 'steady career progression' :
      'slower than average career progression'
    }`
  };
};

/**
 * Calculate overall successor score based on all factors
 * @param {Object} incumbent - Employee being replaced
 * @param {Object} candidate - Potential successor candidate
 * @return {Object} Comprehensive successor assessment
 */
const calculateSuccessorScore = (incumbent, candidate) => {
  // Calculate individual factors
  const stabilityAssessment = calculateStabilityIndex(candidate);
  const competencyAssessment = calculateCompetencySimilarity(incumbent, candidate);
  const complexityAssessment = calculateProjectComplexity(candidate);
  const cognitiveAssessment = calculateCognitiveLoad(candidate);
  const velocityAssessment = calculatePromotionVelocity(candidate);
  
  // Apply weights to each factor
  const weightedScores = {
    stabilityIndex: stabilityAssessment.score * SUCCESSOR_FACTOR_WEIGHTS.stabilityIndex,
    competencySimilarity: competencyAssessment.score * SUCCESSOR_FACTOR_WEIGHTS.competencySimilarity,
    projectComplexity: complexityAssessment.score * SUCCESSOR_FACTOR_WEIGHTS.projectComplexity,
    cognitiveLoad: cognitiveAssessment.score * SUCCESSOR_FACTOR_WEIGHTS.cognitiveLoad,
    promotionVelocity: velocityAssessment.score * SUCCESSOR_FACTOR_WEIGHTS.promotionVelocity
  };
  
  // Calculate total successor score
  const totalScore = Object.values(weightedScores).reduce((sum, score) => sum + score, 0);
  
  // Get readiness assessment based on scores
  let readiness = "Ready Now";
  if (competencyAssessment.score < 0.6 || totalScore < 0.6) {
    readiness = competencyAssessment.score < 0.4 || totalScore < 0.4 ? 
      "24+ months" : "12-24 months";
  } else if (competencyAssessment.score < 0.7 || totalScore < 0.7) {
    readiness = "6-12 months";
  }
  
  // Create explanation summary
  const summary = `${
    competencyAssessment.score > 0.7 ? 'Strong' : 
    competencyAssessment.score > 0.5 ? 'Good' : 'Moderate'
  } competency match with ${
    complexityAssessment.score > 0.7 ? 'high' : 
    complexityAssessment.score > 0.5 ? 'good' : 'developing'
  } project complexity experience`;
  
  return {
    successor_score: totalScore,
    candidate_name: candidate.fullName || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
    candidate_email: candidate.email,
    candidate_title: candidate.jobTitle || candidate.role || '',
    readiness,
    factors: {
      stabilityIndex: {
        score: stabilityAssessment.score,
        weight: SUCCESSOR_FACTOR_WEIGHTS.stabilityIndex,
        insights: stabilityAssessment.insights
      },
      competencySimilarity: {
        score: competencyAssessment.score,
        weight: SUCCESSOR_FACTOR_WEIGHTS.competencySimilarity,
        insights: competencyAssessment.insights,
        commonTools: competencyAssessment.factors.commonTools
      },
      projectComplexity: {
        score: complexityAssessment.score,
        weight: SUCCESSOR_FACTOR_WEIGHTS.projectComplexity,
        insights: complexityAssessment.insights
      },
      cognitiveLoad: {
        score: cognitiveAssessment.score,
        weight: SUCCESSOR_FACTOR_WEIGHTS.cognitiveLoad,
        insights: cognitiveAssessment.insights
      },
      promotionVelocity: {
        score: velocityAssessment.score,
        weight: SUCCESSOR_FACTOR_WEIGHTS.promotionVelocity,
        insights: velocityAssessment.insights
      }
    },
    summary
  };
};

/**
 * Generate detailed explanation of successor match using LLM
 * @param {Object} incumbent - Employee document being replaced
 * @param {Object} successor - Potential successor document
 * @return {Promise<String>} Detailed explanation text
 */
const generateSuccessorExplanation = async (incumbent, successor) => {
  try {
    // Calculate all metrics using the real employee data
    const competencyAnalysis = calculateCompetencySimilarity(incumbent, successor);
    const complexityAnalysis = calculateProjectComplexity(successor);
    const cognitiveAnalysis = calculateCognitiveLoad(successor);
    const velocityAnalysis = calculatePromotionVelocity(successor);
    const stabilityAnalysis = calculateStabilityIndex(successor);
    
    // Extract scores for the prompt
    const competencySimilarity = (competencyAnalysis.score * 100).toFixed(0) + "%";
    const projectComplexity = (complexityAnalysis.score * 100).toFixed(0) + "%";
    const cognitiveLoad = (cognitiveAnalysis.score * 100).toFixed(0) + "%";
    const promotionVelocity = (velocityAnalysis.score * 100).toFixed(0) + "%";
    const stabilityIndex = (stabilityAnalysis.score * 100).toFixed(0) + "%";
    
    // Build a comprehensive explanation
    // In a production environment, we would use an LLM API here
    const explanation = `This candidate shows strong succession potential based on five key factors:

1. **Competency Similarity (${competencySimilarity})**: ${
  competencyAnalysis.score > 0.7 ? 
    `The candidate shares a strong overlap of skills with the incumbent, including ${competencyAnalysis.factors.commonTools.slice(0, 3).join(', ')}.` :
    `The candidate has a moderate overlap of skills with the incumbent, with some gaps that may require training.`
}

2. **Project Complexity Exposure (${projectComplexity})**: ${
  complexityAnalysis.score > 0.7 ?
    `They've led complex projects with substantial budget and team responsibilities.` :
    `They have experience with project complexity similar to what this role requires.`
}

3. **Cognitive Load Adaptability (${cognitiveLoad})**: ${
  cognitiveAnalysis.score > 0.7 ?
    `Demonstrated strong ability to handle multiple simultaneous high-priority projects with tight deadlines.` :
    `Shows ability to manage the cognitive demands of the role with appropriate support.`
}

4. **Promotion Velocity (${promotionVelocity})**: ${
  velocityAnalysis.score > 0.7 ?
    `Has shown rapid and consistent career progression with appropriate skill acquisition.` :
    `Has shown steady career progression indicating readiness for this next step.`
}

5. **Stability Index (${stabilityIndex})**: ${
  stabilityAnalysis.score > 0.7 ?
    `High retention probability indicates long-term potential in this role.` :
    `Moderate retention indicators suggest this role could be a good fit to increase engagement.`
}

${competencyAnalysis.score > 0.7 && complexityAnalysis.score > 0.7 ? 
  `The high competency overlap and demonstrated ability to handle complex projects make this candidate an excellent succession match.` :
  `The candidate shows promising attributes for succession with appropriate development and support.`}`;

    return explanation;
  } catch (error) {
    console.error('Error generating successor explanation:', error);
    return "Unable to generate detailed explanation at this time due to an error analyzing the data.";
  }
};

/**
 * Find successor candidates for an employee
 * @param {Object} incumbent - Employee document
 * @param {number} limit - Maximum number of candidates to return
 * @param {boolean} forceRefresh - Whether to force a refresh of the analysis
 * @return {Promise<Array>} Array of successor candidates with scores
 */
async function findSuccessorCandidates(incumbent, limit = 5, forceRefresh = false) {
  try {
    // Connect to MongoDB
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    
    // Perform DB operations within a try block
    try {
      await client.connect();
      const db = client.db(process.env.MONGODB_DATABASE || "org_sim_db");
      const collection = db.collection("merged_output");
      
      // Check if we should use cached results or force a refresh
      if (!forceRefresh && incumbent.successorAnalysis && 
          incumbent.successorAnalysis.top_successors && 
          incumbent.successorAnalysis.top_successors.length > 0) {
        
        console.log("Using cached successor analysis results");
        
        // Return the cached results
        const cachedResults = incumbent.successorAnalysis.top_successors
          .slice(0, limit)
          .map(successor => ({
            successor_score: successor.successor_score,
            candidate_name: successor.candidate_name,
            candidate_email: successor.candidate_email,
            candidate_title: successor.candidate_title,
            readiness: getReadinessFromScore(successor.successor_score, successor.competency_score),
            factors: {
              stabilityIndex: { score: successor.stability_score || 0.5 },
              competencySimilarity: { score: successor.competency_score || 0.5 },
              projectComplexity: { score: successor.complexity_score || 0.5 },
              cognitiveLoad: { score: successor.cognitive_score || 0.5 },
              promotionVelocity: { score: successor.velocity_score || 0.5 }
            },
            summary: successor.explanation || "Cached successor analysis result"
          }));
          
        return cachedResults;
      }
      
      // If we need to refresh or there's no cached data, perform live analysis
      console.log("Performing live successor analysis");
      
      // Get potential candidates
      // Exclude the incumbent and get employees with similar roles or departments
      const query = {
        email: { $ne: incumbent.email }
      };
      
      // Add role/department filters if available
      if (incumbent.department) {
        query.department = incumbent.department;
      }
      
      // Get candidates
      const candidates = await collection.find(query).limit(50).toArray();
      
      // Calculate successor scores for all candidates
      const scoredCandidates = candidates.map(candidate => 
        calculateSuccessorScore(incumbent, candidate)
      );
      
      // Sort by score and limit results
      const topCandidates = scoredCandidates
        .sort((a, b) => b.successor_score - a.successor_score)
        .slice(0, limit);
      
      if (forceRefresh) {
        // Store the results back to the database for future use
        const successorAnalysis = {
          top_successors: topCandidates.map(candidate => ({
            candidate_email: candidate.candidate_email,
            candidate_name: candidate.candidate_name,
            candidate_title: candidate.candidate_title,
            successor_score: candidate.successor_score,
            competency_score: candidate.factors.competencySimilarity.score,
            stability_score: candidate.factors.stabilityIndex.score,
            complexity_score: candidate.factors.projectComplexity.score,
            cognitive_score: candidate.factors.cognitiveLoad.score,
            velocity_score: candidate.factors.promotionVelocity.score,
            explanation: candidate.summary,
            analysis_date: new Date()
          })),
          last_updated: new Date(),
          analysis_version: "2.0"
        };
        
        // Update the incumbent's document with the new analysis
        await collection.updateOne(
          { email: incumbent.email },
          { $set: { successorAnalysis: successorAnalysis }}
        );
        
        console.log("Updated successor analysis in database");
      }
      
      if (topCandidates.length === 0) {
        console.log("No suitable successors found. Check data quality or matching criteria.");
      }
      
      return topCandidates;
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('Error finding successor candidates:', error);
    throw error; // Re-throw to be handled by the caller
  }
}

/**
 * Helper function to determine readiness level from scores
 */
function getReadinessFromScore(totalScore, competencyScore) {
  if (competencyScore < 0.6 || totalScore < 0.6) {
    return competencyScore < 0.4 || totalScore < 0.4 ? 
      "24+ months" : "12-24 months";
  } else if (competencyScore < 0.7 || totalScore < 0.7) {
    return "6-12 months";
  }
  return "Ready Now";
}

/**
 * Refresh successor analysis for a specific employee
 * @param {string} email - Email of the employee to refresh analysis for
 * @return {Promise<Object>} Result of the refresh operation
 */
async function refreshSuccessorAnalysis(email) {
  try {
    if (!email || typeof email !== 'string') {
      throw new Error('Email is required for refresh operation');
    }
    
    // Connect to MongoDB
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    
    try {
      await client.connect();
      const db = client.db(process.env.MONGODB_DATABASE || "org_sim_db");
      const collection = db.collection("merged_output");
      
      // Find the incumbent by email
      const incumbent = await collection.findOne({ email: email });
      
      if (!incumbent) {
        throw new Error(`Employee not found with email: ${email}`);
      }
      
      // Force a refresh of the successor analysis
      const successors = await findSuccessorCandidates(incumbent, 5, true);
      
      return {
        success: true,
        message: `Successfully refreshed successor analysis for ${incumbent.firstName || ''} ${incumbent.lastName || ''}`,
        successors: successors,
        timestamp: new Date()
      };
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('Error refreshing successor analysis:', error);
    return {
      success: false,
      message: `Error refreshing successor analysis: ${error.message}`,
      timestamp: new Date()
    };
  }
}

export const successorIdentification = {
  findSuccessorCandidates,
  calculateSuccessorScore,
  generateSuccessorExplanation,
  refreshSuccessorAnalysis
}; 