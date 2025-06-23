import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getCompanyDbFromRequest } from '@/lib/api-utils';
import { MongoClient } from 'mongodb';
import Anthropic from '@anthropic-ai/sdk';

// This endpoint serves as a proxy to Claude API
export async function POST(request: NextRequest) {
  let client: MongoClient | null = null;
  
  try {
    // Get company database connection - respecting multi-tenancy
    const { client: mongoClient, companyDb, companyCode } = await getCompanyDbFromRequest(request);
    client = mongoClient;
    
    // Parse request body
    const { query, session_id } = await request.json();
    
    if (!query || !session_id) {
      return NextResponse.json({ error: 'Query and session_id are required' }, { status: 400 });
    }
    
    // Initialize Claude client
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY environment variable is not set');
    }
    
    const anthropic = new Anthropic({
      apiKey: CLAUDE_API_KEY,
    });
    
    // Check if this is a project recommendation request
    const isProjectRecommendation = session_id.startsWith('project_rec_');
    
    if (isProjectRecommendation) {
      // For project recommendations, use Claude directly
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: query
          }
        ],
        temperature: 0.7,
      });
      
      // Extract text from the response content
      const responseText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : 'I could not generate a proper recommendation.';
      
      return NextResponse.json({
        response: responseText,
        session_id,
        timestamp: new Date().toISOString()
      });
    }
    
    // For regular queries, use the existing search-based approach
    // Get the users collection from company database
    const usersCollection = companyDb.collection('users');
    
    // Create search parameters for MongoDB Atlas Search
    const searchParams = {
      index: 'default',
      text: {
        query: query,
        path: {
          wildcard: '*'
        }
      }
    };
    
    // Execute search
    const pipeline = [
      { $search: searchParams },
      { $limit: 20 }, // Limit results for performance
      {
        $project: {
          _id: 0,
          score: { $meta: 'searchScore' },
          email: 1,
          name: 1,
          firstName: 1,
          lastName: 1,
          job_title: 1,
          department: 1,
          hierarchy: 1,
          user_status: 1,
          supervisor: 1,
          projects: 1,
          job_duties: 1,
          responsibilities: 1
        }
      }
    ];
    
    const results = await usersCollection.aggregate(pipeline).toArray();
    
    if (results.length === 0) {
      // If no results from database search, use Claude directly
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `Query: ${query}\n\nPlease provide a helpful response based on your knowledge.`
          }
        ],
        temperature: 0.7,
      });
      
      // Extract text from the response content
      const responseText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : 'I could not generate a proper response.';
      
      return NextResponse.json({
        response: responseText,
        session_id,
        timestamp: new Date().toISOString()
      });
    }
    
    // Generate a natural language response based on the results
    const response = generateResponse(query, results, companyCode);
    
    return NextResponse.json({ 
      response,
      session_id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error in claude query:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred',
      details: error.message,
      response: "I'm sorry, I encountered an error while processing your query. Please try again or contact support if the problem persists."
    }, { status: 500 });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

function generateResponse(query: string, results: any[], companyCode: string): string {
  // Count results by department
  const departmentCounts = results.reduce((acc: any, user: any) => {
    const dept = user.department || 'Unknown';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {});
  
  // Count active users
  const activeUsers = results.filter(user => user.user_status === 'active').length;
  
  // Generate a natural language response
  let response = `I found ${results.length} relevant results in the database`;
  
  if (Object.keys(departmentCounts).length > 0) {
    response += `, including ${activeUsers} active users across ${Object.keys(departmentCounts).length} departments. `;
    
    // Add department breakdown
    const deptBreakdown = Object.entries(departmentCounts)
      .map(([dept, count]) => `${count} in ${dept}`)
      .join(', ');
    response += `The breakdown is: ${deptBreakdown}. `;
  }
  
  // Add specific details based on the query
  if (query.toLowerCase().includes('project')) {
    const projectUsers = results.filter(user => user.projects && user.projects.length > 0);
    if (projectUsers.length > 0) {
      response += `\n\nI found ${projectUsers.length} users who are currently assigned to projects. `;
      const totalProjects = projectUsers.reduce((sum, user) => sum + (user.projects?.length || 0), 0);
      response += `They are working on a total of ${totalProjects} projects.`;
    }
  }
  
  if (query.toLowerCase().includes('skill') || query.toLowerCase().includes('expertise')) {
    const usersWithSkills = results.filter(user => user.job_duties || user.responsibilities);
    if (usersWithSkills.length > 0) {
      response += `\n\nI found ${usersWithSkills.length} users with relevant skills and expertise.`;
    }
  }
  
  // Add a note about data scope
  response += `\n\nNote: This information is specific to your company (${companyCode}).`;
  
  return response;
}
