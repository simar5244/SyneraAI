import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getCompanyDbFromRequest } from '@/lib/api-utils';
import { MongoClient } from 'mongodb';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client for Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: NextRequest) {
  let client: MongoClient | null = null;
  
  try {
    // Verify authentication and get company-specific database connection
    const { client: mongoClient, companyDb, companyCode } = await getCompanyDbFromRequest(request);
    client = mongoClient;
    
    // Parse request body
    const { query, session_id } = await request.json();
    
    if (!query || !session_id) {
      return NextResponse.json({ error: 'Query and session_id are required' }, { status: 400 });
    }
    
    // Get the company-specific collections
    const usersCollection = companyDb.collection('users');
    const projectsCollection = companyDb.collection('projects');
    const departmentsCollection = companyDb.collection('departments');
    
    // Store conversation history in company-specific collection
    const historyCollection = companyDb.collection('conversation_history');
    
    // Step 1: First Claude call - Generate database query parameters
    const queryGenPrompt = `
You are a database query assistant. Your task is to convert a natural language query into MongoDB query parameters.
The database contains company-specific information for company code: ${companyCode}.

Collections available:
- users: Contains employee data (name, email, job_title, department, skills, etc.)
- projects: Contains project data (title, description, team members, status, etc.)
- departments: Contains department data (name, head, budget, etc.)

User query: ${query}

Generate a MongoDB query that will retrieve the relevant information. Return only the JSON for the query parameters.
`;

    // First Claude call to generate the query
    const queryGenResponse = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      messages: [{ role: 'user', content: queryGenPrompt }],
    });
    
    // Parse the generated query (handle potential JSON formatting issues)
    let dbQuery;
    try {
      // Extract JSON from potential markdown code blocks
      const queryContent = queryGenResponse.content[0];
      // Check if the content is text type
      if (queryContent.type === 'text') {
        const queryText = queryContent.text;
        const jsonMatch = queryText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || queryText.match(/{[\s\S]*}/);
        const jsonString = jsonMatch ? jsonMatch[0].replace(/```(?:json)?|```/g, '') : queryText;
        dbQuery = JSON.parse(jsonString);
      } else {
        // Fallback if not text content
        throw new Error('Unexpected content type in response');
      }
    } catch (e) {
      console.error('Failed to parse query JSON:', e);
      // Fallback to a simple text search if parsing fails
      dbQuery = { $text: { $search: query } };
    }
    
    // Step 2: Execute the query against the company-specific database
    let results = [];
    try {
      // Determine which collection to query based on the query content
      let targetCollection = usersCollection; // Default to users collection
      
      if (query.toLowerCase().includes('project')) {
        targetCollection = projectsCollection;
      } else if (query.toLowerCase().includes('department')) {
        targetCollection = departmentsCollection;
      }
      
      // Execute the query with a limit for performance
      results = await targetCollection.find(dbQuery).limit(20).toArray();
      
      // If no results found in primary collection, try secondary collections
      if (results.length === 0) {
        // Try users collection if we didn't already
        if (targetCollection !== usersCollection) {
          const userResults = await usersCollection.find(dbQuery).limit(10).toArray();
          results = [...results, ...userResults];
        }
        
        // Try projects collection if we didn't already
        if (targetCollection !== projectsCollection) {
          const projectResults = await projectsCollection.find(dbQuery).limit(10).toArray();
          results = [...results, ...projectResults];
        }
      }
    } catch (error) {
      console.error('Database query execution error:', error);
      
      // Convert unknown error to string for the prompt
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Step 3: Second Claude call - Troubleshoot query if it fails
      const troubleshootPrompt = `
I tried to execute the following MongoDB query but encountered an error:
${JSON.stringify(dbQuery)}

Error: ${errorMessage}

Please provide a corrected MongoDB query that will work. Return only the JSON for the corrected query.
`;

      const troubleshootResponse = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: troubleshootPrompt }],
      });
      
      // Parse the corrected query
      try {
        const correctedContent = troubleshootResponse.content[0];
        // Check if the content is text type
        if (correctedContent.type === 'text') {
          const correctedText = correctedContent.text;
          const jsonMatch = correctedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || correctedText.match(/{[\s\S]*}/);
          const jsonString = jsonMatch ? jsonMatch[0].replace(/```(?:json)?|```/g, '') : correctedText;
          const correctedQuery = JSON.parse(jsonString);
          
          // Try the corrected query
          results = await usersCollection.find(correctedQuery).limit(20).toArray();
        } else {
          throw new Error('Unexpected content type in response');
        }
      } catch (retryError) {
        console.error('Failed to execute corrected query:', retryError);
        // If still failing, use a simple text search as last resort
        results = await usersCollection.find({ $text: { $search: query } }).limit(20).toArray();
      }
    }
    
    // Step 4: Third Claude call - Generate natural language response from results
    const responsePrompt = `
You are an AI assistant providing information from a company database. 
You are only authorized to access and discuss data for company code: ${companyCode}.

The user asked: "${query}"

Here are the database results:
${JSON.stringify(results, null, 2)}

Please provide a helpful, natural language response based on these results. 
If the results are empty, suggest alternative queries.
Always remind the user that this information is specific to their company (${companyCode}).
`;

    const nlResponse = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1500,
      messages: [{ role: 'user', content: responsePrompt }],
    });
    
    // Extract the final response
    let finalResponse = "I couldn't generate a response. Please try again.";
    const responseContent = nlResponse.content[0];
    if (responseContent.type === 'text') {
      finalResponse = responseContent.text;
    }
    
    // Save the conversation history to the company-specific database
    await historyCollection.insertMany([
      {
        session_id,
        role: 'user',
        text: query,
        timestamp: new Date()
      },
      {
        session_id,
        role: 'assistant',
        text: finalResponse,
        timestamp: new Date()
      }
    ]);
    
    return NextResponse.json({ 
      response: finalResponse,
      session_id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error in web query:', error);
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