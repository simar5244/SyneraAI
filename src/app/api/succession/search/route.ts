import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, Document } from 'mongodb';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '@/lib/auth';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cluster0.nen0dzs.mongodb.net/';
const USERS_COLLECTION = 'users'; // Primary collection for all employee data

// Define a more flexible employee type to avoid TypeScript errors
type EmployeeDocument = Document & {
  [key: string]: any;
};

/**
 * Search for employee and potential successors
 * This API endpoint provides searching by name, email or job title
 */
export async function GET(req: NextRequest) {
  // Authenticate and enforce multi-tenancy
  const authResult = await authMiddleware(req);
  if (authResult) return authResult;
  
  const user = (req as any).user;
  if (!user?.companyCode) {
    return NextResponse.json({ error: 'Company not found' }, { status: 403 });
  }
  
  const companyCode = user.companyCode;
  const dbName = `company_${companyCode.toLowerCase()}`;
  
  // Get search parameters
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const query = searchParams.get('query');
  
  if (!email && !query) {
    return NextResponse.json(
      { error: 'Email or query parameter required' },
      { status: 400 }
    );
  }
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB for succession search');
    
    // Only use the user's company database
    const db = client.db(dbName);
    console.log(`Searching for employee in ${dbName}`);
    
    let employee: any = null;
    
    // Search by email (exact match) if provided
    if (email) {
      employee = await db.collection(USERS_COLLECTION).findOne({ email });
      if (!employee) {
        return NextResponse.json(
          { error: `Employee with email ${email} not found` },
          { status: 404 }
        );
      }
    }
    // Otherwise search by name or job title
    else if (query) {
      // Create a case-insensitive regex for the search query
      const searchRegex = new RegExp(query, 'i');
      
      // Search by name, email, or job title
      employee = await db.collection(USERS_COLLECTION).findOne({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { fullName: searchRegex },
          { name: searchRegex },
          { email: searchRegex },
          { jobTitle: searchRegex }
        ]
      });
      
      if (!employee) {
        return NextResponse.json(
          { error: `No employee found matching "${query}"` },
          { status: 404 }
        );
      }
    }
    
    // At this point, employee should never be null due to our early returns above
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    
    // Get successor data for this employee
    let successors: any[] = [];
    
    // Try to get successors from successorAnalysisData first (the correct and primary field)
    if (employee.successorAnalysisData && employee.successorAnalysisData.successor_candidates) {
      const candidatesArray = employee.successorAnalysisData.successor_candidates;
      if (Array.isArray(candidatesArray) && candidatesArray.length > 0) {
        console.log(`Found ${candidatesArray.length} successors in successorAnalysisData for ${employee.email}`);
        
        successors = candidatesArray.map((successor) => {
          // Map the successor fields to a consistent format
          return {
            id: successor.candidate_id || successor.candidate_email || `successor-${Math.random().toString(36).substring(2, 9)}`,
            name: successor.candidate_name || 'Unknown',
            email: successor.candidate_email || '',
            jobTitle: successor.candidate_title || successor.candidate_jobTitle || 'Employee',
            score: typeof successor.successor_score === 'number' ? successor.successor_score : 0.5,
            isViable: successor.viability === 'viable' || successor.is_viable === true,
            explanation: successor.summary || successor.viability_explanation || 'No explanation available',
            viableExplanation: successor.viability_explanation || '',
            strengths: Array.isArray(successor.strengths) 
              ? successor.strengths.map((s: any) => typeof s === 'string' ? s : s.description || '') 
              : [],
            developmentAreas: Array.isArray(successor.development_areas) 
              ? successor.development_areas.map((d: any) => typeof d === 'string' ? d : d.area || '') 
              : [],
            factorScores: {
              stabilityIndex: successor.factor_scores?.stability_index || 0.5,
              projectComplexity: successor.factor_scores?.project_complexity || 0.5,
              cognitiveLoad: successor.factor_scores?.cognitive_load || 0.5,
              promotionVelocity: successor.factor_scores?.promotion_velocity || 0.5,
              competencySimilarity: successor.factor_scores?.competency_similarity || 0.5
            },
            factorDetails: successor.factor_details || {}
          };
        });
      }
    }
    // If no successors found yet, check for successorAnalysis object
    else if (successors.length === 0 && employee.successorAnalysis) {
      // Check if successorAnalysis is a string (JSON) that needs parsing
      if (typeof employee.successorAnalysis === 'string') {
        try {
          const analysisData = JSON.parse(employee.successorAnalysis);
          if (analysisData.successor_candidates && Array.isArray(analysisData.successor_candidates)) {
            // Convert to our expected format
            successors = analysisData.successor_candidates.map((s: any) => ({
              id: s.candidate_id || s.candidate_email || `successor-${Math.random().toString(36).substring(2, 9)}`,
              name: s.candidate_name || 'Unknown',
              email: s.candidate_email || '',
              jobTitle: s.candidate_title || s.candidate_jobTitle || 'Employee',
              score: typeof s.successor_score === 'number' ? s.successor_score : 0.5,
              isViable: s.viability === 'viable' || s.is_viable === true,
              explanation: s.summary || s.viability_explanation || 'No explanation available',
              viableExplanation: s.viability_explanation || '',
              strengths: Array.isArray(s.strengths) 
                ? s.strengths.map((str: any) => typeof str === 'string' ? str : str.description || '') 
                : [],
              developmentAreas: Array.isArray(s.development_areas) 
                ? s.development_areas.map((d: any) => typeof d === 'string' ? d : d.area || '') 
                : [],
              factorScores: {
                stabilityIndex: s.factor_scores?.stability_index || 0.5,
                projectComplexity: s.factor_scores?.project_complexity || 0.5,
                cognitiveLoad: s.factor_scores?.cognitive_load || 0.5,
                promotionVelocity: s.factor_scores?.promotion_velocity || 0.5,
                competencySimilarity: s.factor_scores?.competency_similarity || 0.5
              },
              factorDetails: s.factor_details || {}
            }));
            console.log(`Found ${successors.length} successors in parsed successorAnalysis.successor_candidates`);
          }
        } catch (error) {
          console.error('Error parsing successorAnalysis JSON:', error);
        }
      } 
      // Check if it's already an object
      else if (typeof employee.successorAnalysis === 'object') {
        if (employee.successorAnalysis.successor_candidates) {
          successors = employee.successorAnalysis.successor_candidates;
          console.log(`Found ${successors.length} successors in successorAnalysis.successor_candidates object`);
        } else if (employee.successorAnalysis.successorCandidates) {
          successors = employee.successorAnalysis.successorCandidates;
          console.log(`Found ${successors.length} successors in successorAnalysis.successorCandidates object`);
        }
      }
    }
    
    // If no successors found yet, check direct fields
    if (successors.length === 0) {
      if (employee.successorCandidates) {
        successors = employee.successorCandidates;
        console.log(`Found ${successors.length} successors in successorCandidates field`);
      } else if (employee.successors) {
        successors = employee.successors;
        console.log(`Found ${successors.length} successors in successors field`);
      } else {
        console.log("No successors found for employee");
      }
    }
    
    // Format employee data with proper fields from MongoDB structure
    const employeeData = {
      id: employee._id.toString(),
      name: employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email.split('@')[0],
      email: employee.email,
      jobTitle: employee.jobTitle || employee.role || 'Employee',
      department: employee.department || 'Unknown',
      workMode: employee.workMode || 'Not specified',
      salary: employee.salary || 'Confidential',
      timeWithCompany: employee.timeWithCompanyMonths 
        ? `${Math.floor(employee.timeWithCompanyMonths / 12)} years, ${employee.timeWithCompanyMonths % 12} months` 
        : 'Unknown',
      attritionRisk: employee.attritionAssessment?.attrition_risk || 'medium',
      attritionScore: employee.attritionAssessment?.attrition_score || 0.5,
      primaryExplanation: employee.attritionAssessment?.primary_explanation || 'Multiple factors contributing to attrition risk',
      primaryRiskFactors: employee.attritionAssessment?.primary_risk_factors || [],
      factorScores: {
        responsibilityMismatch: employee.attritionAssessment?.factor_scores?.responsibility_mismatch || 0.5,
        tenureFactor: employee.attritionAssessment?.factor_scores?.tenure_factor || 0.5,
        utilizationFactor: employee.attritionAssessment?.factor_scores?.utilization_factor || 0.5,
        seniorityFactor: employee.attritionAssessment?.factor_scores?.seniority_factor || 0.5,
        taskVarietyIndex: employee.attritionAssessment?.factor_scores?.task_variety_index || 0.5,
        jobIntensity: employee.attritionAssessment?.factor_scores?.job_intensity || 0.5,
        roleProjectRatio: employee.attritionAssessment?.factor_scores?.role_project_ratio || 0.5,
        collaborationIndex: employee.attritionAssessment?.factor_scores?.collaboration_index || 0.5
      },
      factorDetails: employee.attritionAssessment?.factor_details || {},
      feedbackMetrics: employee.feedbackMetrics || {
        received: {
          count: 0,
          averageRating: 0
        }
      },
      jobResponsibilities: employee.jobResponsibilities || [],
      toolsProficient: employee.toolsProficient || '',
      projects: employee.projects || [],
      industry: employee.industry || 'Not specified',
      officeLocation: employee.officeLocation || 'Not specified',
      utilization_score: employee.utilization_score || 0,
      successorCount: successors.length || 0,
      successors: successors.map((successor: any) => {
        // Ensure consistent format for all successors regardless of source
        // Get the successor's basic info
        const name = successor.name || successor.candidate_name || 'Unknown';
        const email = successor.email || successor.candidate_email || 'unknown@example.com';
        const score = typeof successor.score === 'number' ? successor.score : 
                     typeof successor.successor_score === 'number' ? successor.successor_score : 0.5;
        const isViable = (successor.readinessLevel === 'ready' || 
                         successor.readinessLevel === 'developing' || 
                         successor.viability === 'viable' ||
                         successor.is_viable === true ||
                         successor.isViable === true ||
                         successor.viability === 'ready' || 
                         successor.viability === 'developing');
                         
        // Extract explanation
        const explanation = successor.explanation || 
                           successor.summary || 
                           successor.viability_explanation || 
                           'Potential successor candidate';
                           
        // Get strengths and development areas
        const strengths = Array.isArray(successor.strengths) 
          ? successor.strengths.map((s: any) => typeof s === 'string' ? s : s.description || '')
          : [];
          
        const developmentAreas = Array.isArray(successor.developmentAreas) 
          ? successor.developmentAreas
          : Array.isArray(successor.development_areas) 
          ? successor.development_areas.map((d: any) => typeof d === 'string' ? d : d.area || '')
          : [];
          
        // Get the factor scores
        const factorScores = successor.factorScores || 
                            successor.factor_scores || 
                            successor.factors || 
                            {};
        
        // Return the formatted successor
        return {
          id: successor.id || successor.candidate_id || successor.candidate_email || `successor-${Math.random().toString(36).substring(2, 9)}`,
          name: name,
          email: email,
          jobTitle: successor.jobTitle || successor.candidate_jobTitle || successor.candidate_title || 'Employee',
          score: score,
          isViable: isViable,
          explanation: explanation,
          viableExplanation: successor.viableExplanation || '',
          strengths: strengths,
          developmentAreas: developmentAreas,
          factorScores: {
            stabilityIndex: factorScores.stabilityIndex || factorScores.stability_index || 0.5,
            projectComplexity: factorScores.projectComplexity || factorScores.project_complexity || 0.5,
            cognitiveLoad: factorScores.cognitiveLoad || factorScores.cognitive_load || 0.5,
            promotionVelocity: factorScores.promotionVelocity || factorScores.promotion_velocity || 0.5,
            competencySimilarity: factorScores.competencySimilarity || factorScores.competency_similarity || 0.5
          },
          factorDetails: successor.factorDetails || successor.factor_details || {}
        };
      })
    };
    
    console.log(`Successfully mapped employee data with ${employeeData.successors.length} successors`);
    return NextResponse.json(employeeData);
  } catch (error) {
    console.error('Error searching for employee:', error);
    return NextResponse.json(
      { error: 'Error searching for employee' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
} 