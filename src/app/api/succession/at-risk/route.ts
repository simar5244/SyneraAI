import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, Document } from 'mongodb';
import { authMiddleware } from '@/lib/auth';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cluster0.nen0dzs.mongodb.net/';
const USERS_COLLECTION = 'users'; // Primary collection for all employee data

// Define a more flexible employee type to avoid TypeScript errors
type EmployeeDocument = Document & {
  [key: string]: any;
};

/**
 * Get employees at risk of attrition
 * Returns a list of employees with attrition assessments, sorted by attrition risk
 */
export async function GET(req: NextRequest) {
  // Authenticate and enforce multi-tenancy
  const authResult = await authMiddleware(req);
  if (authResult) return authResult;
  const user = (req as any).user;
  if (!user?.companyCode) return NextResponse.json({ error: 'Company not found' }, { status: 403 });
  const companyCode = user.companyCode;

  const client = new MongoClient(MONGODB_URI);
  
  try {
    try {
      await client.connect();
    } catch (error) {
      console.warn('Cloud MongoDB connection failed, falling back to local:', error);
      const localClient = new MongoClient(process.env.MONGODB_LOCAL_URI || 'mongodb://127.0.0.1:27017');
      await localClient.connect();
      return handleRequest(localClient, companyCode);
    }
    
    return await handleRequest(client, companyCode);
  } catch (error) {
    console.error('Error retrieving at-risk employees:', error);
    return NextResponse.json(
      { error: 'Error retrieving at-risk employees' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}

/**
 * Handles the core request logic with the provided MongoDB client
 */
async function handleRequest(client: MongoClient, companyCode: string) {
  try {
    console.log('Connected to MongoDB for at-risk employees search');
    
    // Only use company-specific database
    const dbName = `company_${companyCode.toLowerCase()}`;
    
    let atRiskEmployees: EmployeeDocument[] = [];
    
    try {
      const db = client.db(dbName);
      console.log(`Searching for at-risk employees in ${dbName}`);
      
      // Only use users collection since that's the reliable source
      const collectionName = USERS_COLLECTION;
      
      if (await db.listCollections({ name: collectionName }).hasNext()) {
        console.log(`Checking ${dbName}.${collectionName} for at-risk employees`);
        
        // Find all employees regardless of attrition assessment first
        // We'll sort and filter properly after processing
        const allEmployees = await db.collection(collectionName)
          .find({})
          .toArray() as EmployeeDocument[];
        
        console.log(`Found ${allEmployees.length} employees in ${dbName}.${collectionName}`);
        
        // Add to our list, avoiding duplicates based on email
        for (const employee of allEmployees) {
          if (!atRiskEmployees.some(e => e.email === employee.email)) {
            atRiskEmployees.push(employee);
          }
        }
      } else {
        console.log(`Collection ${collectionName} not found in ${dbName}`);
      }
    } catch (dbError) {
      console.error(`Error processing database ${dbName}: ${(dbError as Error).message}`);
    }
    
    // If no employees found, return empty list
    if (atRiskEmployees.length === 0) {
      console.log(`No employees found in ${dbName}`);
      return NextResponse.json({ 
        atRiskEmployees: [],
        count: 0
      });
    }
    
    // Format all employees with attrition assessments
    const formattedEmployees = atRiskEmployees.map(employee => {
      // Get attrition assessment data - carefully check all possible field locations
      const attritionAssessment = employee.attritionAssessment || {};
      
      // Get primary attrition score with careful fallbacks
      const attritionScore = 
        attritionAssessment.attrition_score !== undefined ? attritionAssessment.attrition_score :
        employee.attrition_score !== undefined ? employee.attrition_score : 
        0.5; // Default to medium risk
      
      // Get attrition risk level
      const attritionRisk = 
        attritionAssessment.attrition_risk || 
        employee.attrition_risk || 
        (attritionScore >= 0.7 ? 'high' : 
         attritionScore >= 0.4 ? 'medium' : 'low');
      
      // Get primary explanation
      const primaryExplanation = 
        attritionAssessment.primary_explanation || 
        employee.primary_explanation || 
        'Multiple factors contributing to attrition risk';
      
      // Get factor scores with careful fallbacks
      const factorScores = attritionAssessment.factor_scores || employee.factor_scores || {};
      
      // Calculate primary risk factors from factor scores
      let primaryRiskFactors = attritionAssessment.primary_risk_factors || employee.primary_risk_factors || [];
      
      // If no primary risk factors, generate from factor_scores
      if (!primaryRiskFactors || !primaryRiskFactors.length) {
        primaryRiskFactors = Object.entries(factorScores)
          .map(([key, value]) => ({
            factor: key,
            score: typeof value === 'number' ? value : 0.5,
            explanation: `${key.replace(/_/g, ' ')} is a significant factor in this employee's attrition risk.`
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3); // Take top 3 risk factors
      }
      
      // Ensure every risk factor has the proper format
      primaryRiskFactors = primaryRiskFactors.map((factor: any) => {
        // Handle case where factor might be a string or missing properties
        if (typeof factor === 'string') {
          return {
            factor: factor,
            score: 0.5,
            explanation: `${factor} is a contributing factor to this employee's attrition risk.`
          };
        }
        
        // Handle case where factor might be an object without required properties
        if (typeof factor === 'object' && factor !== null) {
          // If it already has the correct structure, just ensure all fields exist
          if (factor.factor && typeof factor.score === 'number' && factor.explanation) {
            return factor;
          }
          
          // Otherwise, construct a proper object
          return {
            factor: factor.factor || factor.name || factor.key || "Unknown Factor",
            score: typeof factor.score === 'number' ? factor.score : 
                   typeof factor.value === 'number' ? factor.value : 0.5,
            explanation: factor.explanation || factor.description || 
                        `${factor.factor || factor.name || "This factor"} contributes to attrition risk.`
          };
        }
        
        // Default for any other case
        return {
          factor: "Unknown Factor",
          score: 0.5,
          explanation: "This is a contributing factor to attrition risk."
        };
      });
      
      // Final safety check - ensure we have at least one risk factor
      if (!primaryRiskFactors.length) {
        primaryRiskFactors = [{
          factor: "Generic Risk",
          score: 0.5,
          explanation: "Multiple factors contributing to attrition risk."
        }];
      }
      
      // Get successor data - prioritize successorAnalysisData field which is the correct schema
      let successors: {
        id: string;
        name: string;
        email: string;
        jobTitle: string;
        score: number;
        isViable: boolean;
        explanation: string;
        viableExplanation: string;
        strengths: string[];
        developmentAreas: string[];
        factorScores: Record<string, number>;
        factorDetails: Record<string, any>;
      }[] = [];
      
      // Try to get successors from successorAnalysisData first (the correct and primary field)
      if (employee.successorAnalysisData && employee.successorAnalysisData.successor_candidates) {
        const candidatesArray = employee.successorAnalysisData.successor_candidates;
        if (Array.isArray(candidatesArray) && candidatesArray.length > 0) {
          console.log(`Found ${candidatesArray.length} successors in successorAnalysisData for ${employee.email}`);
          
          successors = candidatesArray.map((s) => ({
            id: s.candidate_email || `successor-${Math.random().toString(36).substring(2)}`,
            name: s.candidate_name || 'Unknown',
            email: s.candidate_email || '',
            jobTitle: s.candidate_title || s.candidate_jobTitle || 'Employee',
            score: s.successor_score || 0,
            isViable: s.viability === 'viable',
            explanation: s.summary || s.viability_explanation || 'No explanation available',
            viableExplanation: s.viability_explanation || '',
            strengths: s.strengths || [],
            developmentAreas: s.development_areas || [],
            factorScores: s.factor_scores || {},
            factorDetails: s.factor_details || {}
          }));
        }
      } 
      // Only fall back to successorCandidates if successorAnalysisData is not available
      else if (Array.isArray(employee.successorCandidates) && employee.successorCandidates.length > 0) {
        console.log(`Found ${employee.successorCandidates.length} successors in successorCandidates for ${employee.email}`);
        successors = employee.successorCandidates.map((s) => ({
          id: s.candidate_id || s.candidate_email || `successor-${Math.random().toString(36).substring(2)}`,
          name: s.candidate_name || 'Unknown',
          email: s.candidate_email || '',
          jobTitle: s.candidate_jobTitle || s.candidate_role || 'Employee',
          score: s.successor_score || 0,
          isViable: s.viability === 'viable' || s.is_viable === true,
          explanation: s.summary || s.viability_explanation || 'No explanation available',
          viableExplanation: s.viability_explanation || '',
          strengths: s.strengths || [],
          developmentAreas: s.development_areas || [],
          factorScores: s.factor_scores || {},
          factorDetails: s.factor_details || {}
        }));
      }
      
      return {
        id: employee._id.toString(),
        name: employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email.split('@')[0],
        email: employee.email,
        jobTitle: employee.jobTitle || employee.role || 'Employee',
        department: employee.department || 'Unknown',
        attritionRisk: attritionRisk,
        attritionScore: attritionScore,
        primaryExplanation: primaryExplanation,
        primaryRiskFactors: primaryRiskFactors,
        factorScores: {
          responsibilityMismatch: factorScores.responsibility_mismatch || factorScores.responsibilityMismatch || 0.5,
          tenureFactor: factorScores.tenure_factor || factorScores.tenureFactor || 0.5,
          utilizationFactor: factorScores.utilization_factor || factorScores.utilizationFactor || 0.5,
          seniorityFactor: factorScores.seniority_factor || factorScores.seniorityFactor || 0.5,
          taskVarietyIndex: factorScores.task_variety_index || factorScores.taskVarietyIndex || 0.5,
          jobIntensity: factorScores.job_intensity || factorScores.jobIntensity || 0.5,
          roleProjectRatio: factorScores.role_project_ratio || factorScores.roleProjectRatio || 0.5,
          collaborationIndex: factorScores.collaboration_index || factorScores.collaborationIndex || 0.5
        },
        successors: successors,
        successorCount: successors.length
      };
    });
    
    // Now properly filter based on attrition risk level
    // Filter for high risk employees first
    const highRiskEmployees = formattedEmployees.filter(emp => 
      emp.attritionRisk === 'high' || 
      emp.attritionRisk === 'very_high' || 
      emp.attritionScore >= 0.7
    );
    
    console.log(`Found ${highRiskEmployees.length} high-risk employees out of ${formattedEmployees.length} total`);
    
    // If no high risk employees, fall back to medium risk
    const employeesToReturn = highRiskEmployees.length > 0 
      ? highRiskEmployees 
      : formattedEmployees.filter(emp => 
          emp.attritionRisk === 'medium' || 
          (emp.attritionScore >= 0.4 && emp.attritionScore < 0.7)
        );
    
    // If still no employees, return all employees sorted by attrition score
    if (employeesToReturn.length === 0) {
      console.log("No high or medium risk employees found, returning all employees sorted by attrition score");
      employeesToReturn.push(...formattedEmployees);
    }
    
    // Sort by attrition score (descending)
    employeesToReturn.sort((a, b) => b.attritionScore - a.attritionScore);
    
    // Limit to 10 employees to avoid overwhelming the UI
    const limitedEmployees = employeesToReturn.slice(0, 10);
    
    console.log(`Returning ${limitedEmployees.length} at-risk employees (${highRiskEmployees.length} high risk, ${formattedEmployees.filter(emp => emp.attritionRisk === 'medium' || (emp.attritionScore >= 0.4 && emp.attritionScore < 0.7)).length} medium risk)`);
    
    return NextResponse.json({ 
      atRiskEmployees: limitedEmployees,
      count: limitedEmployees.length
    });
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return NextResponse.json(
      { error: 'Error retrieving at-risk employees' },
      { status: 500 }
    );
  }
} 