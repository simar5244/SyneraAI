import { MongoClient } from 'mongodb';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || "org_sim_db";
const DATA_COLLECTION_NAME = "merged_output";
const HISTORY_COLLECTION_NAME = "conversation_history";
const ATLAS_SEARCH_INDEX = process.env.ATLAS_SEARCH_INDEX || "default";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const GEMINI_MODEL_NAME = "gemini-2.0-flash-001";
const CLAUDE_MODEL = "claude-3-7-sonnet-20250219";

// Configure safety settings for Gemini
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Main handler function
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let client;
  try {
    const { query, session_id } = req.body;

    if (!query || !session_id) {
      return res.status(400).json({ error: 'Query and session_id are required' });
    }

    // Initialize Google Generative AI client
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME, safetySettings });

    // Initialize Claude client
    if (!CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY environment variable is not set.');
    }
    const claudeClient = new Anthropic({
      apiKey: CLAUDE_API_KEY,
    });

    // Connect to MongoDB
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    const dataCollection = db.collection(DATA_COLLECTION_NAME);
    const historyCollection = db.collection(HISTORY_COLLECTION_NAME);

    // Get conversation history
    const history = await getConversationHistory(historyCollection, session_id);

    // Comprehensive search approach with multiple retries
    let searchResults = null;
    let allAttempts = [];
    let responseText = null;
    
    // Step 1: Try with Gemini (4 attempts with different approaches)
    const geminiAttempts = await tryGeminiSearches(model, query, history, dataCollection, 4);
    allAttempts.push(...geminiAttempts);
    
    // Check if any Gemini attempt was successful
    for (const attempt of geminiAttempts) {
      if (isValidSearchResult(attempt.results)) {
        searchResults = attempt.results;
        break;
      }
    }
    
    // Step 2: If Gemini failed, try with Claude (4 attempts with different approaches)
    if (!searchResults) {
      const claudeAttempts = await tryClaudeSearches(claudeClient, query, history, dataCollection, geminiAttempts, 4);
      allAttempts.push(...claudeAttempts);
      
      // Check if any Claude attempt was successful
      for (const attempt of claudeAttempts) {
        if (isValidSearchResult(attempt.results)) {
          searchResults = attempt.results;
          break;
        }
      }
    }
    
    // Step 3: Last resort - try with Gemini again with broader queries
    if (!searchResults) {
      const broadGeminiAttempts = await tryBroadGeminiSearches(model, query, history, dataCollection, allAttempts, 2);
      allAttempts.push(...broadGeminiAttempts);
      
      // Check if any broad Gemini attempt was successful
      for (const attempt of broadGeminiAttempts) {
        if (isValidSearchResult(attempt.results)) {
          searchResults = attempt.results;
          break;
        }
      }
    }
    
    // Generate final response based on available results
    if (searchResults) {
      // Use the AI that provided the successful search to generate the response
      const lastSuccessfulAttempt = allAttempts.find(attempt => 
        attempt.results === searchResults || 
        (Array.isArray(attempt.results) && Array.isArray(searchResults) && 
         JSON.stringify(attempt.results) === JSON.stringify(searchResults)));
      
      if (lastSuccessfulAttempt && lastSuccessfulAttempt.ai === 'claude') {
        responseText = await generateNaturalLanguageResponseWithClaude(claudeClient, query, history, searchResults);
      } else {
        responseText = await generateNaturalLanguageResponseWithGemini(model, query, history, searchResults);
      }
    } else {
      // If all attempts failed, generate a response based on database schema knowledge
      responseText = await generateFallbackResponse(model, claudeClient, query, history, allAttempts);
    }

    // Save conversation
    await saveConversation(historyCollection, session_id, query, responseText);

    // Return response
    return res.status(200).json({ 
      response: responseText,
      debug: { 
        attempts: allAttempts.length,
        lastAttempt: allAttempts[allAttempts.length - 1]?.approach || 'none'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      details: errorMessage,
      response: "I'm sorry, I encountered an unexpected error processing your request. Please try again with a different query."
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Try multiple search approaches with Gemini
async function tryGeminiSearches(model, query, history, dataCollection, maxAttempts) {
  const attempts = [];
  const approaches = [
    { name: "comprehensive", method: generateComprehensiveMongoDBQuery },
    { name: "specific-fields", method: generateSpecificFieldsMongoDBQuery },
    { name: "simplified", method: generateSimplifiedSearchQuery },
    { name: "fuzzy", method: generateFuzzySearchQuery },
    { name: "aggregation", method: generateAggregationQuery },
    { name: "term-based", method: generateTermBasedQuery }
  ];
  
  let previousErrors = [];
  
  for (let i = 0; i < maxAttempts && i < approaches.length; i++) {
    const approach = approaches[i];
    try {
      // Generate search parameters with current approach
      const searchParams = await approach.method(model, query, history, previousErrors);
      
      // Execute search
      const results = await executeMongoDBSearch(dataCollection, searchParams);
      
      // Record attempt
      const attempt = {
        ai: 'gemini',
        approach: approach.name,
        query: searchParams,
        results: results,
        success: isValidSearchResult(results)
      };
      attempts.push(attempt);
      
      // If successful, we can stop trying
      if (attempt.success) {
        break;
      }
      
      // Record error for next attempt
      if (results && results.error) {
        previousErrors.push({
          approach: approach.name,
          error: results.error
        });
      }
      
    } catch (error) {
      // Record failed attempt
      attempts.push({
        ai: 'gemini',
        approach: approach.name,
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
      
      previousErrors.push({
        approach: approach.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return attempts;
}

// Try multiple search approaches with Claude
async function tryClaudeSearches(claudeClient, query, history, dataCollection, previousAttempts, maxAttempts) {
  const attempts = [];
  const approaches = [
    { name: "claude-comprehensive", method: generateComprehensiveMongoDBQueryWithClaude },
    { name: "claude-adaptive", method: generateAdaptiveMongoDBQueryWithClaude },
    { name: "claude-simplified", method: generateSimplifiedMongoDBQueryWithClaude },
    { name: "claude-fuzzy", method: generateFuzzyMongoDBQueryWithClaude }
  ];
  
  for (let i = 0; i < maxAttempts && i < approaches.length; i++) {
    const approach = approaches[i];
    try {
      // Generate search parameters with current approach
      const searchParams = await approach.method(claudeClient, query, history, previousAttempts);
      
      // Execute search
      const results = await executeMongoDBSearch(dataCollection, searchParams);
      
      // Record attempt
      const attempt = {
        ai: 'claude',
        approach: approach.name,
        query: searchParams,
        results: results,
        success: isValidSearchResult(results)
      };
      attempts.push(attempt);
      
      // If successful, we can stop trying
      if (attempt.success) {
        break;
      }
      
    } catch (error) {
      // Record failed attempt
      attempts.push({
        ai: 'claude',
        approach: approach.name,
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
  
  return attempts;
}

// Try broader search approaches with Gemini as last resort
async function tryBroadGeminiSearches(model, query, history, dataCollection, previousAttempts, maxAttempts) {
  const attempts = [];
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Generate broader search parameters based on previous attempts
      const searchParams = await generateBroadenedMongoDBQuery(model, query, history, previousAttempts, i);
      
      // Execute search
      const results = await executeMongoDBSearch(dataCollection, searchParams);
      
      // Record attempt
      const attempt = {
        ai: 'gemini-broad',
        approach: `broad-attempt-${i+1}`,
        query: searchParams,
        results: results,
        success: isValidSearchResult(results)
      };
      attempts.push(attempt);
      
      // If successful, we can stop trying
      if (attempt.success) {
        break;
      }
      
    } catch (error) {
      // Record failed attempt
      attempts.push({
        ai: 'gemini-broad',
        approach: `broad-attempt-${i+1}`,
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
  
  return attempts;
}

// Check if search result is valid and contains meaningful data
function isValidSearchResult(results) {
  if (!results) return false;
  
  if (Array.isArray(results) && results.length > 0) {
    return true;
  }
  
  if (typeof results === 'object' && !('error' in results) && !('warning' in results)) {
    // Check if results have at least one property that's not error or warning
    const hasValidKeys = Object.keys(results)
      .filter(key => key !== 'error' && key !== 'warning')
      .length > 0;
    
    return hasValidKeys;
  }
  
  return false;
}

// --- Helper Functions ---

// Get conversation history
async function getConversationHistory(collection, sessionId, limit = 10) {
  try {
    const history = await collection.find({ session_id: sessionId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    return history.reverse(); // Chronological order
  } catch (error) {
    return []; // Return empty array on error
  }
}

// Save conversation
async function saveConversation(collection, sessionId, userQuery, aiResponse) {
  try {
    await collection.insertOne({
      session_id: sessionId,
      role: "user",
      text: userQuery,
      timestamp: new Date()
    });

    await collection.insertOne({
      session_id: sessionId,
      role: "assistant",
      text: aiResponse,
      timestamp: new Date()
    });
  } catch (error) {
    // Continue without throwing - saving history is secondary
  }
}

// APPROACH 1: Generate comprehensive MongoDB query with Gemini
async function generateComprehensiveMongoDBQuery(model, userQuery, chatHistory, previousErrors = []) {
  const schemaDescription = `
  The MongoDB collection 'merged_output' contains deeply nested documents about employees and projects. The schema includes:
  - email (string, unique identifier like "person14@company.com")
  - company_name (string)
  - employee_department (string) 
  - firstName, lastName, name (strings)
  - hierarchy (string representing organizational level)
  - projects (array of objects): Each project contains:
      - project_title (string)
      - project_description (string)
      - project_department (string)
      - project_status (string like "planning")
      - project_priority (string like "critical")
      - collaborators (array of objects): Each collaborator has:
          - email (string)
          - name (string)
          - department (string)
          - tasks (array)
          - hours_per_week (number)
  - role (string like "Program Assistant (Tier 3)")
  - user_status (string like "active")
  - department (string)
  - supervisor (object with email, name)
  - skills (array of strings)
  - location (string)
  - team (string)
  - contact_information (object with phone, email, address)
  - performance_metrics (object with various metrics)
  - certifications (array of objects)
  - education (array of objects)
  `;

  // Format chat history for Gemini
  const geminiHistory = chatHistory.slice(-3).map(entry => ({
    role: entry.role === 'user' ? 'user' : 'model',
    parts: [{ text: entry.text }]
  }));

  // Add info about previous errors
  let errorInfo = '';
  if (previousErrors.length > 0) {
    errorInfo = `Previous search attempts encountered these errors: ${JSON.stringify(previousErrors)}. Avoid these issues in your query.`;
  }

  // Construct the prompt for Gemini
  const prompt = `You are an AI assistant specialized in creating MongoDB Atlas Search queries. Your job is to translate natural language queries into MongoDB search parameters.

${schemaDescription}

${errorInfo}

IMPORTANT: Create a comprehensive search query that will work well with MongoDB Atlas Search. Focus on:
1. Working with nested fields correctly - use dot notation (e.g., "projects.project_title")
2. Search across ALL relevant fields - don't just focus on project fields
3. For flexible search across multiple fields, use compound operators (must, should)
4. For exact matches, use equals or compound operators
5. For partial matching or search across all fields, use text search with wildcard paths
6. Consider ALL fields in the schema, not just projects

User query: "${userQuery}"

Generate ONLY a valid MongoDB Atlas Search query JSON object. Return ONLY the JSON object that would go in the $search stage, nothing else:`;

  try {
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();

    try {
      // Clean up potential markdown code block fences
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const searchParams = JSON.parse(cleanedResponse);

      // Ensure the index name is correct
      searchParams.index = ATLAS_SEARCH_INDEX;
      return searchParams;
    } catch (jsonError) {
      // Fallback to simple text search
      throw new Error(`Failed to parse Gemini's response: ${jsonError.message}`);
    }
  } catch (error) {
    throw new Error(`Gemini API failed: ${error.message}`);
  }
}

// APPROACH 2: Generate specific fields MongoDB query with Gemini
async function generateSpecificFieldsMongoDBQuery(model, userQuery, chatHistory, previousErrors = []) {
  // Format chat history for Gemini
  const geminiHistory = chatHistory.slice(-3).map(entry => ({
    role: entry.role === 'user' ? 'user' : 'model',
    parts: [{ text: entry.text }]
  }));

  // Add info about previous errors
  let errorInfo = '';
  if (previousErrors.length > 0) {
    errorInfo = `Previous search attempts encountered these errors: ${JSON.stringify(previousErrors)}. Avoid these issues in your query.`;
  }

  // Construct the prompt for Gemini
  const prompt = `You are an AI assistant specialized in creating MongoDB Atlas Search queries. Your job is to translate natural language queries into MongoDB search parameters.

We need to create a MongoDB search query that focuses on specific fields most relevant to this query. The database contains employee and project information with these fields:
- Top-level fields: email, name, firstName, lastName, role, department, employee_department, hierarchy, user_status, company_name, supervisor, skills, location, team
- Projects fields: projects.project_title, projects.project_description, projects.project_department, projects.project_status, projects.project_priority
- Collaborators fields: projects.collaborators.email, projects.collaborators.name, projects.collaborators.department, projects.collaborators.tasks

${errorInfo}

User query: "${userQuery}"

Analyze the query and create a focused MongoDB Atlas Search query that:
1. Identifies the most relevant fields for this specific query
2. Uses appropriate search operators (text, equals, exists, etc.)
3. Properly handles nested document structures
4. Uses compound operators to combine multiple search conditions

Generate ONLY a valid MongoDB Atlas Search query JSON object. Return ONLY the JSON object that would go in the $search stage, nothing else:`;

  try {
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();

    try {
      // Clean up potential markdown code block fences
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const searchParams = JSON.parse(cleanedResponse);

      // Ensure the index name is correct
      searchParams.index = ATLAS_SEARCH_INDEX;
      return searchParams;
    } catch (jsonError) {
      throw new Error(`Failed to parse Gemini's response: ${jsonError.message}`);
    }
  } catch (error) {
    throw new Error(`Gemini API failed: ${error.message}`);
  }
}

// APPROACH 3: Generate simplified search query
function generateSimplifiedSearchQuery(model, query, chatHistory = [], previousErrors = []) {
  const cleanQuery = query.replace(/[^\w\s]/gi, ' ').trim();
  
  return {
    index: ATLAS_SEARCH_INDEX,
    compound: {
      should: [
        // Look in all fields
        {
          text: {
            query: cleanQuery,
            path: { wildcard: "*" },
            fuzzy: { maxEdits: 1 }
          }
        },
        // Give higher weight to common fields
        {
          text: {
            query: cleanQuery,
            path: ["name", "email", "role", "department", "employee_department", 
                   "projects.project_title", "projects.project_description", 
                   "projects.project_department", "skills", "team", "location"],
            score: { boost: { value: 3 } }
          }
        },
        // Give even higher weight to exact matches
        {
          text: {
            query: cleanQuery,
            path: ["name", "email", "projects.project_title"],
            score: { boost: { value: 5 } }
          }
        }
      ]
    }
  };
}

// APPROACH 4: Generate fuzzy search query
function generateFuzzySearchQuery(model, query, chatHistory = [], previousErrors = []) {
  const cleanQuery = query.replace(/[^\w\s]/gi, ' ').trim();
  const keywords = cleanQuery.split(/\s+/).filter(word => word.length > 2);
  
  return {
    index: ATLAS_SEARCH_INDEX,
    compound: {
      should: [
        // Main query with high fuzzy tolerance
        {
          text: {
            query: cleanQuery,
            path: { wildcard: "*" },
            fuzzy: { maxEdits: 2 }
          }
        },
        // Individual keywords with fuzzy matching
        ...keywords.map(keyword => ({
          text: {
            query: keyword,
            path: { wildcard: "*" },
            fuzzy: { maxEdits: 1 }
          }
        })),
        // Search specifically in employee fields
        {
          text: {
            query: cleanQuery,
            path: ["name", "email", "role", "department", "employee_department", "skills", "team", "location"],
            fuzzy: { maxEdits: 2 },
            score: { boost: { value: 2 } }
          }
        },
        // Search specifically in project fields
        {
          text: {
            query: cleanQuery,
            path: ["projects.project_title", "projects.project_description", "projects.project_department", 
                  "projects.project_status", "projects.project_priority"],
            fuzzy: { maxEdits: 2 },
            score: { boost: { value: 2 } }
          }
        }
      ],
      minimumShouldMatch: 1
    }
  };
}

// APPROACH 5: Generate aggregation-based query
function generateAggregationQuery(model, query, chatHistory = [], previousErrors = []) {
  const cleanQuery = query.replace(/[^\w\s]/gi, ' ').trim();
  
  return {
    index: ATLAS_SEARCH_INDEX,
    compound: {
      must: [
        {
          text: {
            query: cleanQuery,
            path: { wildcard: "*" }
          }
        }
      ],
      should: [
        // Boost employee-specific fields
        {
          text: {
            query: cleanQuery,
            path: ["name", "email", "role", "department"],
            score: { boost: { value: 2 } }
          }
        },
        // Boost project-specific fields
        {
          text: {
            query: cleanQuery,
            path: ["projects.project_title", "projects.project_description"],
            score: { boost: { value: 2 } }
          }
        }
      ]
    }
  };
}

// APPROACH 6: Generate term-based query
function generateTermBasedQuery(model, query, chatHistory = [], previousErrors = []) {
  const cleanQuery = query.replace(/[^\w\s]/gi, ' ').trim();
  const keywords = cleanQuery.split(/\s+/).filter(word => word.length > 2);
  
  if (keywords.length === 0) {
    return generateSimplifiedSearchQuery(model, query);
  }
  
  return {
    index: ATLAS_SEARCH_INDEX,
    compound: {
      should: [
        // Main query
        {
          text: {
            query: cleanQuery,
            path: { wildcard: "*" }
          }
        },
        // Individual term searches
        ...keywords.map(keyword => ({
          text: {
            query: keyword,
            path: ["name", "email", "role", "department", "employee_department", 
                  "projects.project_title", "projects.project_description", 
                  "projects.project_department", "skills", "team", "location"],
            score: { boost: { value: 1 } }
          }
        }))
      ],
      minimumShouldMatch: 1
    }
  };
}

// Generate MongoDB query using Claude
async function generateComprehensiveMongoDBQueryWithClaude(claudeClient, userQuery, chatHistory, previousAttempts) {
  const schemaDescription = `
  The MongoDB collection 'merged_output' contains deeply nested documents about employees and projects. The schema includes:
  - email (string, unique identifier like "person14@company.com")
  - company_name (string)
  - employee_department (string) 
  - firstName, lastName, name (strings)
  - hierarchy (string representing organizational level)
  - projects (array of objects): Each project contains:
      - project_title (string)
      - project_description (string)
      - project_department (string)
      - project_status (string like "planning")
      - project_priority (string like "critical")
      - collaborators (array of objects): Each collaborator has:
          - email (string)
          - name (string)
          - department (string)
          - tasks (array)
          - hours_per_week (number)
  - role (string like "Program Assistant (Tier 3)")
  - user_status (string like "active")
  - department (string)
  - supervisor (object with email, name)
  - skills (array of strings)
  - location (string)
  - team (string)
  - contact_information (object with phone, email, address)
  - performance_metrics (object with various metrics)
  - certifications (array of objects)
  - education (array of objects)
  `;
  
  // Get information about previous failed attempts
  const previousAttemptsInfo = previousAttempts.map(attempt => {
    if (attempt.error) {
      return `Approach: ${attempt.approach}, Error: ${attempt.error}`;
    }
    if (attempt.results && attempt.results.error) {
      return `Approach: ${attempt.approach}, Error: ${attempt.results.error}`;
    }
    return `Approach: ${attempt.approach}, No results found`;
  }).join('\n');

  const prompt = `You are an AI assistant specialized in creating MongoDB Atlas Search queries. Your job is to translate natural language queries into MongoDB search parameters.

${schemaDescription}

Previous search attempts failed with these issues:
${previousAttemptsInfo}

User query: "${userQuery}"

IMPORTANT: Create a comprehensive search query that will work well with MongoDB Atlas Search, avoiding the issues from previous attempts. Focus on:
1. Working with nested fields correctly - use dot notation (e.g., "projects.project_title")
2. Search across ALL relevant fields - don't just focus on project fields
3. For flexible search across multiple fields, use compound operators (must, should)
4. For exact matches, use equals or compound operators
5. For partial matching or search across all fields, use text search with wildcard paths
6. Consider ALL fields in the schema, not just projects

Generate ONLY a valid MongoDB Atlas Search query JSON object. Return ONLY the JSON object that would go in the $search stage, nothing else:`;

  try {
    const response = await claudeClient.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].text;
    
    try {
      // Clean up potential markdown code block fences
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const searchParams = JSON.parse(cleanedResponse);

      // Ensure the index name is correct
      searchParams.index = ATLAS_SEARCH_INDEX;
      return searchParams;
    } catch (jsonError) {
      throw new Error(`Failed to parse Claude's response: ${jsonError.message}`);
    }
  } catch (error) {
    throw new Error(`Claude API failed: ${error.message}`);
  }
}

// Generate adaptive MongoDB query using Claude with insights from previous attempts
async function generateAdaptiveMongoDBQueryWithClaude(claudeClient, userQuery, chatHistory, previousAttempts) {
  // Extract query structures from previous attempts
  const previousQueries = previousAttempts
    .filter(attempt => attempt.query)
    .map(attempt => JSON.stringify(attempt.query, null, 2));
  
  // Extract errors from previous attempts
  const previousErrors = previousAttempts
    .filter(attempt => attempt.error || (attempt.results && attempt.results.error))
    .map(attempt => attempt.error || attempt.results.error);
  
  const prompt = `You are an AI assistant specialized in creating MongoDB Atlas Search queries. Your job is to translate natural language queries into MongoDB search parameters.

The MongoDB collection contains deeply nested documents about employees and projects, with fields like:
- email, name, firstName, lastName, role, department, employee_department, hierarchy, user_status, company_name
- supervisor (object with email, name)
- skills (array of strings), location, team
- projects (array of objects with fields like project_title, project_description, project_department, etc.)
- projects.collaborators (array of objects with fields like email, name, department, tasks, etc.)

Previous search attempts failed with these errors:
${previousErrors.join('\n')}

Here are some previous search queries that didn't work:
${previousQueries.join('\n\n')}

User query: "${userQuery}"

Based on this information, generate a completely new MongoDB Atlas Search query that:
1. Avoids the issues in previous attempts
2. Takes a different approach than those already tried
3. Ensures all relevant fields are searched (not just project fields)
4. Uses appropriate MongoDB operators
5. Properly handles nested document structures

Generate ONLY a valid MongoDB Atlas Search query JSON object. Return ONLY the JSON object that would go in the $search stage, nothing else:`;

  try {
    const response = await claudeClient.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].text;
    
    try {
      // Clean up potential markdown code block fences
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const searchParams = JSON.parse(cleanedResponse);

      // Ensure the index name is correct
      searchParams.index = ATLAS_SEARCH_INDEX;
      return searchParams;
    } catch (jsonError) {
      throw new Error(`Failed to parse Claude's response: ${jsonError.message}`);
    }
  } catch (error) {
    throw new Error(`Claude API failed: ${error.message}`);
  }
}

// Generate simplified MongoDB query using Claude
async function generateSimplifiedMongoDBQueryWithClaude(claudeClient, userQuery, chatHistory, previousAttempts) {
  const prompt = `You are an AI assistant specialized in creating MongoDB Atlas Search queries. Your job is to translate natural language queries into MongoDB search parameters.

The user query is: "${userQuery}"

Previous approaches failed. Create a SIMPLIFIED MongoDB Atlas Search query that focuses on essential search functionality:
1. Use a compound query with "should" clauses to search across multiple fields
2. Include text search with wildcard paths for comprehensive coverage
3. Add fuzzy matching for better tolerance of typos and variations
4. Ensure proper field path notation for nested documents

Generate ONLY a valid MongoDB Atlas Search query JSON object. Return ONLY the JSON object that would go in the $search stage, nothing else:`;

  try {
    const response = await claudeClient.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].text;
    
    try {
      // Clean up potential markdown code block fences
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const searchParams = JSON.parse(cleanedResponse);

      // Ensure the index name is correct
      searchParams.index = ATLAS_SEARCH_INDEX;
      return searchParams;
    } catch (jsonError) {
      throw new Error(`Failed to parse Claude's response: ${jsonError.message}`);
    }
  } catch (error) {
    throw new Error(`Claude API failed: ${error.message}`);
  }
}

// Generate fuzzy MongoDB query using Claude
async function generateFuzzyMongoDBQueryWithClaude(claudeClient, userQuery, chatHistory, previousAttempts) {
  const prompt = `You are an AI assistant specialized in creating MongoDB Atlas Search queries. Your job is to translate natural language queries into MongoDB search parameters.

The user query is: "${userQuery}"

Create a highly fuzzy MongoDB Atlas Search query that maximizes the chance of finding relevant results:
1. Use high fuzzy tolerance (maxEdits: 2) across all text searches
2. Split the query into keywords and search for each individually
3. Search across all fields using wildcard paths
4. Use a compound query with minimumShouldMatch set to 1
5. Include both employee and project fields explicitly

Generate ONLY a valid MongoDB Atlas Search query JSON object. Return ONLY the JSON object that would go in the $search stage, nothing else:`;

  try {
    const response = await claudeClient.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].text;
    
    try {
      // Clean up potential markdown code block fences
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const searchParams = JSON.parse(cleanedResponse);

      // Ensure the index name is correct
      searchParams.index = ATLAS_SEARCH_INDEX;
      return searchParams;
    } catch (jsonError) {
      throw new Error(`Failed to parse Claude's response: ${jsonError.message}`);
    }
  } catch (error) {
    throw new Error(`Claude API failed: ${error.message}`);
  }
}

// Generate broadened MongoDB query using Gemini as a last resort
async function generateBroadenedMongoDBQuery(model, userQuery, chatHistory, previousAttempts, attemptIndex) {
  // Format chat history for Gemini
  const geminiHistory = chatHistory.slice(-3).map(entry => ({
    role: entry.role === 'user' ? 'user' : 'model',
    parts: [{ text: entry.text }]
  }));

  // Extract information about all previous attempts
  const attemptsInfo = previousAttempts.map(attempt => {
    if (attempt.query && attempt.results) {
      return {
        approach: attempt.approach,
        ai: attempt.ai,
        query: attempt.query,
        resultCount: Array.isArray(attempt.results) ? attempt.results.length : 0,
        error: attempt.results.error || attempt.error || null
      };
    }
    return {
      approach: attempt.approach,
      ai: attempt.ai,
      error: attempt.error || null
    };
  });

  // Construct the prompt for Gemini
  const prompt = `You are an AI assistant specialized in creating MongoDB Atlas Search queries. Your job is to translate natural language queries into MongoDB search parameters.

The MongoDB collection contains employee and project data with these main fields:
- email, name, firstName, lastName, role, department, employee_department, hierarchy, user_status, company_name
- supervisor (object with email, name)
- skills (array of strings), location, team
- projects (array of objects with fields like project_title, project_description, project_department, etc.)
- projects.collaborators (array of objects with fields like email, name, department, tasks, etc.)

User query: "${userQuery}"

ALL PREVIOUS SEARCH ATTEMPTS FAILED. Here's a summary of what was tried:
${JSON.stringify(attemptsInfo, null, 2)}

Now create a MUCH BROADER MongoDB Atlas Search query that:
1. Uses very permissive search criteria with high fuzzy tolerance
2. Searches ALL fields with wildcard paths
3. Ensures both employee AND project data is searched
4. Uses minimal required operators to reduce complexity
5. Sets minimumShouldMatch to 1 if using compound queries
${attemptIndex > 0 ? '6. Uses a completely different approach than previous broad attempts' : ''}

Generate ONLY a valid MongoDB Atlas Search query JSON object. Return ONLY the JSON object that would go in the $search stage, nothing else:`;

  try {
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();

    try {
      // Clean up potential markdown code block fences
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const searchParams = JSON.parse(cleanedResponse);

      // Ensure the index name is correct
      searchParams.index = ATLAS_SEARCH_INDEX;
      return searchParams;
    } catch (jsonError) {
      // If we can't parse the JSON, use an extremely simple query as last resort
      return {
        index: ATLAS_SEARCH_INDEX,
        text: {
          query: userQuery,
          path: { wildcard: "*" },
          fuzzy: { maxEdits: 2 }
        }
      };
    }
  } catch (error) {
    // Ultimate fallback for any error
    const queryTerms = userQuery.split(/\s+/).filter(word => word.length > 2);
    return {
      index: ATLAS_SEARCH_INDEX,
      compound: {
        should: [
          {
            text: {
              query: userQuery,
              path: { wildcard: "*" },
              fuzzy: { maxEdits: 2 }
            }
          },
          ...queryTerms.map(term => ({
            text: {
              query: term,
              path: { wildcard: "*" },
              fuzzy: { maxEdits: 2 }
            }
          }))
        ],
        minimumShouldMatch: 1
      }
    };
  }
}
// Execute MongoDB search
async function executeMongoDBSearch(collection, searchParams) {
    try {
      if (!searchParams || typeof searchParams !== 'object') {
        return { error: 'Invalid search parameters' };
      }
  
      // Create pipeline with search stage
      const pipeline = [
        { $search: searchParams },
        { $limit: 20 } // Limit results for performance
      ];
  
      // Execute search and return results
      const results = await collection.aggregate(pipeline).toArray();
      
      // Check if we got results
      if (results.length === 0) {
        return { warning: 'No results found', results: [] };
      }
      
      return results;
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : String(error),
        query: searchParams 
      };
    }
  }
  
  // Generate natural language response with Gemini
  async function generateNaturalLanguageResponseWithGemini(model, query, history, searchResults) {
    const geminiHistory = history.slice(-3).map(entry => ({
      role: entry.role === 'user' ? 'user' : 'model',
      parts: [{ text: entry.text }]
    }));
  
    // Identify most important fields for context
    const simplifiedResults = searchResults.map(result => {
      const simplified = {
        name: result.name || `${result.firstName || ''} ${result.lastName || ''}`.trim(),
        email: result.email,
        role: result.role,
        department: result.department || result.employee_department,
        projects: []
      };
  
      // Include projects if available
      if (result.projects && Array.isArray(result.projects)) {
        simplified.projects = result.projects.map(project => ({
          title: project.project_title,
          description: project.project_description,
          department: project.project_department,
          status: project.project_status,
          priority: project.project_priority,
          collaborators: project.collaborators ? project.collaborators.length : 0
        }));
      }
  
      // Include other important fields if relevant to query
      const queryLower = query.toLowerCase();
      if (queryLower.includes('skill') && result.skills) {
        simplified.skills = result.skills;
      }
      if (queryLower.includes('location') && result.location) {
        simplified.location = result.location;
      }
      if (queryLower.includes('supervisor') && result.supervisor) {
        simplified.supervisor = result.supervisor;
      }
      if (queryLower.includes('team') && result.team) {
        simplified.team = result.team;
      }
      if (queryLower.includes('certification') && result.certifications) {
        simplified.certifications = result.certifications;
      }
      if (queryLower.includes('education') && result.education) {
        simplified.education = result.education;
      }
  
      return simplified;
    });
  
    // Create prompt for Gemini
    const prompt = `You are an AI assistant providing information from a company database. I will give you the user's query and the search results from our database.
  
  User query: "${query}"
  
  Search results (${searchResults.length} items):
  ${JSON.stringify(simplifiedResults, null, 2)}
  
  Create a natural language response that:
  1. Directly answers the user's query based on the search results
  2. Summarizes the key information from the results
  3. Provides specific details that answer the question
  4. Is conversational and helpful
  5. If the results have multiple items, summarize the patterns or provide a clear count
  6. If the results seem irrelevant to the query, note that and provide what information you can
  
  DO NOT mention that you're using a database or search results. Just provide the information as if you knew it directly.`;
  
    try {
      const chat = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(prompt);
      return result.response.text();
    } catch (error) {
      // Fallback to a simpler approach if the AI response fails
      return generateBasicResponse(query, searchResults);
    }
  }
  
  // Generate natural language response with Claude
  async function generateNaturalLanguageResponseWithClaude(claudeClient, query, history, searchResults) {
    // Identify most important fields for context
    const simplifiedResults = searchResults.map(result => {
      const simplified = {
        name: result.name || `${result.firstName || ''} ${result.lastName || ''}`.trim(),
        email: result.email,
        role: result.role,
        department: result.department || result.employee_department,
        projects: []
      };
  
      // Include projects if available
      if (result.projects && Array.isArray(result.projects)) {
        simplified.projects = result.projects.map(project => ({
          title: project.project_title,
          description: project.project_description,
          department: project.project_department,
          status: project.project_status,
          priority: project.project_priority,
          collaborators: project.collaborators ? project.collaborators.length : 0
        }));
      }
  
      // Include other important fields if relevant to query
      const queryLower = query.toLowerCase();
      if (queryLower.includes('skill') && result.skills) {
        simplified.skills = result.skills;
      }
      if (queryLower.includes('location') && result.location) {
        simplified.location = result.location;
      }
      if (queryLower.includes('supervisor') && result.supervisor) {
        simplified.supervisor = result.supervisor;
      }
      if (queryLower.includes('team') && result.team) {
        simplified.team = result.team;
      }
      if (queryLower.includes('certification') && result.certifications) {
        simplified.certifications = result.certifications;
      }
      if (queryLower.includes('education') && result.education) {
        simplified.education = result.education;
      }
  
      return simplified;
    });
  
    // Create prompt for Claude
    const prompt = `You are an AI assistant providing information from a company database. I will give you the user's query and the search results from our database.
  
  User query: "${query}"
  
  Search results (${searchResults.length} items):
  ${JSON.stringify(simplifiedResults, null, 2)}
  
  Create a natural language response that:
  1. Directly answers the user's query based on the search results
  2. Summarizes the key information from the results
  3. Provides specific details that answer the question
  4. Is conversational and helpful
  5. If the results have multiple items, summarize the patterns or provide a clear count
  6. If the results seem irrelevant to the query, note that and provide what information you can
  
  DO NOT mention that you're using a database or search results. Just provide the information as if you knew it directly.`;
  
    try {
      const response = await claudeClient.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      });
  
      return response.content[0].text;
    } catch (error) {
      // Fallback to a simpler approach if the AI response fails
      return generateBasicResponse(query, searchResults);
    }
  }
  
  // Fallback response generator when AI fails
  function generateBasicResponse(query, searchResults) {
    if (!searchResults || searchResults.length === 0) {
      return "I couldn't find any information related to your query. Could you try rephrasing your question or provide more details?";
    }
  
    // Count employees found
    const employeeCount = searchResults.length;
    
    // Count projects
    const projectsSet = new Set();
    let projectCount = 0;
    
    // Count departments
    const departmentsSet = new Set();
    
    // Extract high-level information
    searchResults.forEach(result => {
      // Add department
      if (result.department) {
        departmentsSet.add(result.department);
      } else if (result.employee_department) {
        departmentsSet.add(result.employee_department);
      }
      
      // Count projects
      if (result.projects && Array.isArray(result.projects)) {
        projectCount += result.projects.length;
        
        // Add project titles to set
        result.projects.forEach(project => {
          if (project.project_title) {
            projectsSet.add(project.project_title);
          }
        });
      }
    });
    
    // Generate a basic response
    let response = `I found information about ${employeeCount} employee${employeeCount !== 1 ? 's' : ''}`;
    
    if (departmentsSet.size > 0) {
      const departments = Array.from(departmentsSet);
      if (departments.length <= 3) {
        response += ` in the ${departments.join(', ')} department${departments.length !== 1 ? 's' : ''}`;
      } else {
        response += ` across ${departments.length} different departments`;
      }
    }
    
    if (projectsSet.size > 0) {
      response += `, working on ${projectsSet.size} unique project${projectsSet.size !== 1 ? 's' : ''}`;
    }
    
    response += '.';
    
    // Add first result details
    const firstResult = searchResults[0];
    if (firstResult) {
      response += `\n\nHere's some information about ${firstResult.name || firstResult.email}: `;
      
      if (firstResult.role) {
        response += `Their role is ${firstResult.role}. `;
      }
      
      if (firstResult.department || firstResult.employee_department) {
        response += `They work in the ${firstResult.department || firstResult.employee_department} department. `;
      }
      
      if (firstResult.skills && firstResult.skills.length > 0) {
        response += `Their skills include ${firstResult.skills.slice(0, 3).join(', ')}${firstResult.skills.length > 3 ? ', and more' : ''}. `;
      }
      
      if (firstResult.projects && firstResult.projects.length > 0) {
        const project = firstResult.projects[0];
        response += `\n\nThey are involved in the project "${project.project_title}" (${project.project_status} status, ${project.project_priority} priority), which `;
        
        if (project.project_description) {
          response += `is described as: "${project.project_description.substring(0, 100)}${project.project_description.length > 100 ? '...' : ''}". `;
        } else {
          response += `is in the ${project.project_department} department. `;
        }
      }
    }
    
    return response;
  }
  
  // Generate fallback response when all search attempts fail
  async function generateFallbackResponse(model, claudeClient, query, history, allAttempts) {
    // First try using Claude
    try {
      const prompt = `You are an AI assistant helping users get information about employees and projects in a company database. All search attempts to find information related to this query have failed:
  
  User query: "${query}"
  
  The database contains information about:
  - Employees (name, email, role, department, skills, etc.)
  - Projects (title, description, department, status, priority, etc.)
  - Organization structure (supervisors, departments, teams, etc.)
  
  Please generate a helpful, conversational response that:
  1. Acknowledges that you couldn't find specific information
  2. Suggests potential reasons why (perhaps the query is too specific, uses unusual terminology, etc.)
  3. Recommends ways to rephrase the query to get better results
  4. Is empathetic and helpful
  
  DO NOT mention that you're using a database or search results. Just respond as if you were directly answering their question.`;
  
      const response = await claudeClient.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      });
  
      return response.content[0].text;
    } catch (claudeError) {
      // If Claude fails, try Gemini
      try {
        const geminiHistory = history.slice(-3).map(entry => ({
          role: entry.role === 'user' ? 'user' : 'model',
          parts: [{ text: entry.text }]
        }));
  
        const prompt = `You are an AI assistant helping users get information about employees and projects in a company database. All search attempts to find information related to this query have failed:
  
  User query: "${query}"
  
  Generate a helpful response that:
  1. Acknowledges that you couldn't find specific information
  2. Suggests potential reasons why (perhaps the query is too specific, uses unusual terminology, etc.)
  3. Recommends ways to rephrase the query to get better results
  4. Is empathetic and helpful
  
  DO NOT mention that you're using a database or search results. Just respond as if you were directly answering their question.`;
  
        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessage(prompt);
        return result.response.text();
      } catch (geminiError) {
        // Ultimate fallback response if all AI calls fail
        return `I don't have enough information to answer your query about "${query}". Could you try rephrasing your question or providing more details about what you're looking for? For example, you could specify if you're looking for information about a particular employee, project, department, or skill set.`;
      }
    }
  }