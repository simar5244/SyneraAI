import { MongoClient } from 'mongodb';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || "org_sim_db";
const DATA_COLLECTION_NAME = "merged_output";
const HISTORY_COLLECTION_NAME = "conversation_history";
const ATLAS_SEARCH_INDEX = process.env.ATLAS_SEARCH_INDEX || "default";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_NAME = "gemini-2.0-flash-001";

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

    // Implement a cascading search approach
    let searchResults;
    let response;
    
    try {
      // First attempt: Generate search parameters with Gemini
      const searchParams = await generateMongoDBQueryWithGemini(model, query, history);
      searchResults = await executeMongoDBSearch(dataCollection, searchParams);
      
      // Check if we got valid results
      if (!isValidSearchResult(searchResults)) {
        // Second attempt: Try with simplified search query
        const simplifiedParams = generateSimplifiedSearchQuery(query);
        searchResults = await executeMongoDBSearch(dataCollection, simplifiedParams);
        
        // If still no valid results, try fuzzy search as last resort
        if (!isValidSearchResult(searchResults)) {
          const fuzzyParams = generateFuzzySearchQuery(query);
          searchResults = await executeMongoDBSearch(dataCollection, fuzzyParams);
        }
      }
      
      // Generate response with Gemini
      response = await generateNaturalLanguageResponseWithGemini(model, query, history, searchResults);
    } catch (searchError) {
      // Final fallback if all search attempts fail
      response = "I couldn't find specific information related to your query. Could you please rephrase or provide more details?";
    }

    // Save conversation
    await saveConversation(historyCollection, session_id, query, response);

    // Return response
    return res.status(200).json({ response });

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

// Check if search result is valid and contains meaningful data
function isValidSearchResult(results) {
  if (!results || typeof results !== 'object') return false;
  if (Array.isArray(results) && results.length > 0) return true;
  if ('error' in results || 'warning' in results) return false;
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

// Generate MongoDB query parameters using Gemini
async function generateMongoDBQueryWithGemini(model, userQuery, chatHistory) {
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
  - supervisor (object)
  `;

  // Format chat history for Gemini
  const geminiHistory = chatHistory.slice(-5).map(entry => ({
    role: entry.role === 'user' ? 'user' : 'model',
    parts: [{ text: entry.text }]
  }));

  // Construct the prompt for Gemini
  const prompt = `You are an AI assistant specialized in creating MongoDB Atlas Search queries. Your job is to translate natural language queries into MongoDB search parameters.

${schemaDescription}

IMPORTANT: Create a search query that will work well with MongoDB Atlas Search. Focus on:
1. Working with nested fields correctly - use dot notation (e.g., "projects.project_title")
2. For flexible search across multiple fields, use compound operators (must, should)
3. For exact matches, use equals or compound operators
4. For partial matching or search across all fields, use text search with wildcard paths

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
      return generateSimplifiedSearchQuery(userQuery);
    }
  } catch (error) {
    // Fallback for API failures
    return generateSimplifiedSearchQuery(userQuery);
  }
}

// Generate simplified search query as fallback
function generateSimplifiedSearchQuery(query) {
  const cleanQuery = query.replace(/[^\w\s]/gi, ' ').trim();
  
  return {
    index: ATLAS_SEARCH_INDEX,
    compound: {
      should: [
        {
          text: {
            query: cleanQuery,
            path: { wildcard: "*" },
            fuzzy: { maxEdits: 1 }
          }
        },
        {
          text: {
            query: cleanQuery,
            path: ["name", "email", "projects.project_title", "projects.project_description", "role", "department"],
            score: { boost: { value: 3 } }
          }
        }
      ]
    }
  };
}

// Generate fuzzy search query as final fallback
function generateFuzzySearchQuery(query) {
  const cleanQuery = query.replace(/[^\w\s]/gi, ' ').trim();
  const keywords = cleanQuery.split(/\s+/).filter(word => word.length > 2);
  
  return {
    index: ATLAS_SEARCH_INDEX,
    compound: {
      should: [
        {
          text: {
            query: cleanQuery,
            path: { wildcard: "*" },
            fuzzy: { maxEdits: 2 }
          }
        },
        ...keywords.map(keyword => ({
          text: {
            query: keyword,
            path: { wildcard: "*" },
            fuzzy: { maxEdits: 1 }
          }
        }))
      ],
      minimumShouldMatch: 1
    }
  };
}

// Execute MongoDB search
async function executeMongoDBSearch(collection, searchParams) {
  if (!searchParams || typeof searchParams !== 'object' || !searchParams.index) {
    return { error: "Invalid search parameters generated." };
  }
  
  try {
    const pipeline = [
      { $search: searchParams },
      { $limit: 15 }, 
      {
        $project: {
          _id: 0,
          score: { $meta: "searchScore" },
          email: 1, name: 1, firstName: 1, lastName: 1,
          role: 1, department: 1, employee_department: 1, hierarchy: 1,
          user_status: 1, company_name: 1, supervisor: 1,
          projects: 1,
          user_createdAt: 1, user_updatedAt: 1
        }
      }
    ];

    const results = await collection.aggregate(pipeline).toArray();
    
    if (results.length === 0) {
      return { warning: "No results found for your query." };
    }
    
    return results;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes("atlas search not enabled")) {
      return { error: "Atlas Search is not enabled on this database." };
    } else if (errorMsg.includes("failed to parse search query")) {
      return { error: "Invalid search query structure." };
    } else {
      return { error: "Database query failed." };
    }
  }
}

// Generate natural language response using Gemini
async function generateNaturalLanguageResponseWithGemini(model, userQuery, chatHistory, searchResults) {
  // Handle potential error/warning/info objects from searchResults
  if (typeof searchResults === 'object' && searchResults !== null && !Array.isArray(searchResults)) {
     if ('error' in searchResults) {
        return `I encountered an issue retrieving that information: ${searchResults.error}`;
      } else if ('warning' in searchResults) {
        return `I couldn't find information matching your query. Could you please try rephrasing your question?`;
      } else if ('info' in searchResults) {
        return searchResults.info;
      }
  }
  
  // Ensure searchResults is an array for the prompt
  const resultsForPrompt = Array.isArray(searchResults) ? searchResults : [];
  const resultsString = JSON.stringify(resultsForPrompt, null, 2);

  // Format chat history for Gemini (only last 3 exchanges)
  const geminiHistory = chatHistory.slice(-3).map(entry => ({
    role: entry.role === 'user' ? 'user' : 'model',
    parts: [{ text: entry.text }]
  }));

  // Construct the prompt for Gemini
  const prompt = `You are an AI assistant explaining database search results to a user.

User query: "${userQuery}"

Search results JSON:
${resultsString}

Instructions:
1. Provide a clear, concise answer based only on the search results provided
2. If the search results contain no relevant information, say you couldn't find specific information
3. For employee or project data, highlight the relevant details that answer the query
4. Your response must be conversational but information-dense
5. Do not mention the database, JSON, or the search mechanism - just provide the information naturally
6. Focus only on information present in the results

Generate a natural language response:`;

  try {
     // Start chat session with history
     const chat = model.startChat({ history: geminiHistory });
     const result = await chat.sendMessage(prompt);
     return result.response.text().trim();
  } catch (error) {
    // Fallback if the API call fails
    const simpleResponse = generateSimpleResponse(userQuery, resultsForPrompt);
    return simpleResponse || "I found some information that might help, but I'm having trouble formatting it clearly. Could you try asking in a different way?";
  }
}

// Generate a simple response as fallback when Gemini fails
function generateSimpleResponse(query, results) {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }
  
  // Extract basic information from results
  const count = results.length;
  const mainFields = ['name', 'email', 'role', 'department'];
  
  // Create a simple response
  let response = `I found ${count} result${count !== 1 ? 's' : ''} that might answer your question.`;
  
  // Add details from first result
  const firstResult = results[0];
  if (firstResult) {
    const details = mainFields
      .filter(field => firstResult[field])
      .map(field => `${field}: ${firstResult[field]}`)
      .join(', ');
      
    if (details) {
      response += ` Here's the most relevant match: ${details}`;
    }
    
    // Check for project information
    if (firstResult.projects && firstResult.projects.length > 0) {
      response += ` They are involved in ${firstResult.projects.length} project(s).`;
    }
  }
  
  return response;
}