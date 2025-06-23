import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DATABASE || 'org_sim_db';

// Map factor names to their documentation sections
const factorDocumentation: { [key: string]: string } = {
  'responsibility_mismatch': 'Responsibility Mismatch Analysis',
  'tenure_factor': 'Tenure Factor Analysis',
  'utilization_factor': 'Utilization Factor Analysis',
  'seniority_factor': 'Seniority Factor Analysis',
  'task_variety_index': 'Task Variety Index',
  'job_intensity': 'Job Intensity Factor',
  'role_project_ratio': 'Role-Project Ratio Analysis',
  'collaboration_index': 'Collaboration Index'
};

/**
 * Get explanation for successor match
 * This API endpoint provides detailed explanations for why a particular successor is a good match
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const employeeId = searchParams.get('employee');
  const successorId = searchParams.get('successor');
  
  if (!employeeId || !successorId) {
    return NextResponse.json(
      { error: 'Both employee and successor IDs are required' },
      { status: 400 }
    );
  }
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('merged_output');
    
    // Find the employee by email or ID
    const employeeQuery = employeeId.includes('@') 
      ? { email: employeeId }
      : { _id: employeeId };
    
    const employee = await collection.findOne(employeeQuery);
    
    if (!employee) {
      await client.close();
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    
    // Find the successor candidate in the employee's successorCandidates array
    const successor = (employee.successorCandidates || []).find((s: any) => 
      s.candidate_id === successorId || s.candidate_email === successorId
    );
    
    if (!successor) {
      await client.close();
      return NextResponse.json(
        { error: 'Successor not found for this employee' },
        { status: 404 }
      );
    }
    
    // Format the employee data
    const employeeName = employee.fullName || 
                        (employee.firstName && employee.lastName ? 
                         `${employee.firstName} ${employee.lastName}` : 
                         employee.email.split('@')[0]);
    
    const successorName = successor.candidate_name || successor.candidate_email.split('@')[0];
    
    // Get attrition assessment data
    const attritionData = employee.attritionAssessment || {};
    const primaryFactors = attritionData.primary_risk_factors || [];
    const factorDetails = attritionData.factor_details || {};
    
    // Generate an explanation based on attrition factors and successor match
    let explanation = `# Succession Analysis: ${successorName} as a potential successor for ${employeeName}\n\n`;
    
    // Add employee's attrition risk
    if (attritionData.attrition_score) {
      const riskLevel = attritionData.attrition_risk || 
                        (attritionData.attrition_score >= 0.75 ? 'very high' :
                         attritionData.attrition_score >= 0.6 ? 'high' :
                         attritionData.attrition_score >= 0.4 ? 'medium' :
                         attritionData.attrition_score >= 0.3 ? 'low' : 'very low');
      
      explanation += `## Why we need a succession plan\n\n`;
      explanation += `${employeeName} currently has a ${riskLevel} attrition risk score of ${(attritionData.attrition_score * 100).toFixed(0)}%. `;
      
      if (primaryFactors.length > 0) {
        explanation += `The primary factors contributing to this risk are:\n\n`;
        primaryFactors.forEach((factor: any) => {
          explanation += `- **${factor.factor.replace(/_/g, ' ')}** (${(factor.score * 100).toFixed(0)}%): ${factor.explanation}\n`;
        });
      }
      
      explanation += `\n`;
    }
    
    // Add successor match explanation
    explanation += `## Why ${successorName} is a good match\n\n`;
    
    if (successor.successor_score) {
      explanation += `Overall succession match score: **${(successor.successor_score * 100).toFixed(0)}%**\n\n`;
    }
    
    if (successor.summary) {
      explanation += `${successor.summary}\n\n`;
    }
    
    if (successor.strengths && successor.strengths.length > 0) {
      explanation += `### Key strengths:\n\n`;
      successor.strengths.forEach((strength: string) => {
        explanation += `- ${strength}\n`;
      });
      explanation += `\n`;
    }
    
    if (successor.development_areas && successor.development_areas.length > 0) {
      explanation += `### Development areas:\n\n`;
      successor.development_areas.forEach((area: string) => {
        explanation += `- ${area}\n`;
      });
      explanation += `\n`;
    }
    
    if (successor.skill_match && successor.skill_match.length > 0) {
      explanation += `### Skill match details:\n\n`;
      successor.skill_match.forEach((skill: any) => {
        if (typeof skill === 'string') {
          explanation += `- ${skill}\n`;
        } else if (typeof skill === 'object') {
          const skillName = skill.name || skill.skill || 'Skill';
          const score = skill.score ? ` (${(skill.score * 100).toFixed(0)}% match)` : '';
          explanation += `- ${skillName}${score}\n`;
        }
      });
      explanation += `\n`;
    }
    
    // Add viability explanation if available
    if (successor.is_viable !== undefined) {
      explanation += `## Succession viability\n\n`;
      if (successor.is_viable) {
        explanation += `${successorName} is considered a **viable** successor candidate. `;
      } else {
        explanation += `${successorName} is currently considered a **non-viable** successor candidate. `;
      }
      
      if (successor.viability_reason) {
        explanation += successor.viability_reason;
      } else if (successor.successor_score) {
        explanation += successor.successor_score >= 0.7 
          ? `The succession match score exceeds the minimum threshold of 70%.`
          : `The succession match score is below the minimum threshold of 70%.`;
      }
      
      explanation += `\n\n`;
    }
    
    // Add recommendations if available
    if (successor.recommendations && successor.recommendations.length > 0) {
      explanation += `## Recommendations\n\n`;
      successor.recommendations.forEach((rec: string) => {
        explanation += `- ${rec}\n`;
      });
      explanation += `\n`;
    } else {
      // Generate generic recommendations
      explanation += `## Recommendations\n\n`;
      explanation += `- Develop a formal transition plan if ${employeeName} decides to leave\n`;
      explanation += `- Provide targeted training to ${successorName} in areas that need development\n`;
      explanation += `- Consider assigning ${successorName} to shadow ${employeeName} on key projects\n`;
      explanation += `- Ensure knowledge transfer through documentation and mentoring sessions\n\n`;
    }
    
    await client.close();
    
    return NextResponse.json({ explanation });
  } catch (error: any) {
    console.error('Error generating successor explanation:', error);
    
    // Ensure client is closed even if there's an error
    if (client) {
      await client.close().catch(console.error);
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate successor explanation',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 