import { MongoClient } from 'mongodb';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_BASE;
const DATA_COLLECTION_NAME = "merged_output";
const HISTORY_COLLECTION_NAME = "conversation_history";
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
    const { query, session_id, company } = req.body;

    if (!query || !session_id) {
      return res.status(400).json({ error: 'Query and session_id are required' });
    }

    // Determine company code: request body or environment
    const companyCode = company || process.env.NEXT_PUBLIC_COMPANY_CODE;
    if (!companyCode) {
      return res.status(400).json({ error: 'company is required' });
    }
    const dbName = `company_${companyCode.toLowerCase()}`;

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
    const db = client.db(dbName);
    const historyCollection = db.collection(HISTORY_COLLECTION_NAME);

    // Get conversation history
    const history = await getConversationHistory(historyCollection, session_id);

    // Step 1: Introspect database schema and get sample data
    const { schema, sampleData } = await introspectDatabase(db);

    // Step 2: Handle "how many" queries directly with count operations
    const howManyMatch = query.toLowerCase().match(/how many (\\w+)/i);
    if (howManyMatch) {
      const name = howManyMatch[1];
      const collections = Object.keys(schema);
      const matchCols = collections.filter(c => 
        c.toLowerCase() === name || 
        c.toLowerCase() === `${name}s` || 
        c.toLowerCase().includes(name.toLowerCase())
      );
      
      if (matchCols.length) {
        const col = matchCols[0];
        const count = await db.collection(col).countDocuments();
        const resp = `There are ${count} documents in the '${col}' collection.`;
        await saveConversation(historyCollection, session_id, query, resp);
        return res.status(200).json({ response: resp });
      }
    }

    // Step 3: Check if query is analytical (requires aggregation)
    const isAnalytical = isAnalyticalQuery(query);
    
    let searchResults = [];
    let responseText = '';

    if (isAnalytical) {
      // Handle analytical queries with basic aggregations
      searchResults = await handleAnalyticalQuery(db, query, schema, sampleData);
    } else {
      // Handle text search queries with regex-based search
      searchResults = await handleTextSearchQuery(db, query, schema);
    }

    // Step 4: Generate natural language response
    if (searchResults && searchResults.length > 0) {
      responseText = await generateNaturalLanguageResponse(
        claudeClient, model, query, history, searchResults, schema, isAnalytical
      );
    } else {
      responseText = await generateFallbackResponse(
        claudeClient, model, query, history, schema, sampleData
      );
    }

    // Save conversation
    await saveConversation(historyCollection, session_id, query, responseText);

    // Return response
    return res.status(200).json({ 
      response: responseText,
      debug: { 
        resultsFound: searchResults ? searchResults.length : 0,
        searchType: isAnalytical ? 'analytical' : 'text_search'
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

// Check if query requires analytical processing (aggregation)
function isAnalyticalQuery(query) {
  const analyticalKeywords = [
    'most', 'least', 'top', 'bottom', 'highest', 'lowest',
    'count', 'total', 'sum', 'average', 'avg', 'maximum', 'minimum',
    'group by', 'grouped', 'summary', 'summarize', 'breakdown',
    'statistics', 'stats', 'analysis', 'trend', 'distribution',
    'rank', 'ranking', 'compare', 'comparison'
  ];
  
  const queryLower = query.toLowerCase();
  return analyticalKeywords.some(keyword => queryLower.includes(keyword));
}

// Handle analytical queries using basic MongoDB aggregations
async function handleAnalyticalQuery(db, query, schema, sampleData) {
  const results = [];
  
  try {
    // Try to get analytical results from all collections
    const collections = Object.keys(schema);
    
    for (const collectionName of collections) {
      if (collectionName === HISTORY_COLLECTION_NAME) continue;
      
      const collection = db.collection(collectionName);
      const collectionSchema = schema[collectionName];
      
      // Generate aggregation pipeline based on query
      const pipeline = await generateAnalyticalPipeline(query, collectionSchema, sampleData[collectionName]);
      
      if (pipeline && pipeline.length > 0) {
        try {
          const collectionResults = await collection.aggregate(pipeline).toArray();
          if (collectionResults.length > 0) {
            results.push(...collectionResults.map(r => ({ ...r, __collection: collectionName })));
          }
        } catch (aggregationError) {
          // Skip this collection if aggregation fails
          continue;
        }
      }
    }
  } catch (error) {
    console.error('Error in analytical query:', error);
  }
  
  return results;
}

// Generate aggregation pipeline for analytical queries
async function generateAnalyticalPipeline(query, collectionSchema, sampleDocs) {
  const queryLower = query.toLowerCase();
  const pipeline = [];
  
  // Basic patterns for different analytical queries
  if (queryLower.includes('count') || queryLower.includes('how many')) {
    // Simple count
    pipeline.push({ $count: "total" });
  } else if (queryLower.includes('group') || queryLower.includes('by department') || queryLower.includes('by role')) {
    // Group by common fields
    let groupField = null;
    
    if (queryLower.includes('department')) {
      groupField = collectionSchema.find(field => 
        field.includes('department') && !field.includes('.')
      ) || 'department';
    } else if (queryLower.includes('role')) {
      groupField = collectionSchema.find(field => 
        field.includes('role') && !field.includes('.')
      ) || 'role';
    } else if (queryLower.includes('status')) {
      groupField = collectionSchema.find(field => 
        field.includes('status') && !field.includes('.')
      ) || 'status';
    }
    
    if (groupField) {
      pipeline.push({
        $group: {
          _id: `$${groupField}`,
          count: { $sum: 1 }
        }
      });
      pipeline.push({ $sort: { count: -1 } });
    }
  } else if (queryLower.includes('most') || queryLower.includes('top')) {
    // Find most common values
    const textFields = collectionSchema.filter(field => 
      !field.includes('.') && 
      (field.includes('department') || field.includes('role') || field.includes('status') || field.includes('priority'))
    );
    
    if (textFields.length > 0) {
      pipeline.push({
        $group: {
          _id: `$${textFields[0]}`,
          count: { $sum: 1 }
        }
      });
      pipeline.push({ $sort: { count: -1 } });
      pipeline.push({ $limit: 10 });
    }
  }
  
  return pipeline;
}

// Handle text search queries using regex-based search
async function handleTextSearchQuery(db, query, schema) {
  const results = [];
  const queryTerms = extractSearchTerms(query);
  
  if (queryTerms.length === 0) return results;
  
  try {
    const collections = Object.keys(schema);
    
    for (const collectionName of collections) {
      if (collectionName === HISTORY_COLLECTION_NAME) continue;
      
      const collection = db.collection(collectionName);
      const collectionSchema = schema[collectionName];
      
      // Build regex search query
      const searchQuery = buildRegexSearchQuery(queryTerms, collectionSchema);
      
      if (searchQuery) {
        try {
          const collectionResults = await collection.find(searchQuery).limit(10).toArray();
          if (collectionResults.length > 0) {
            results.push(...collectionResults.map(r => ({ ...r, __collection: collectionName })));
          }
        } catch (searchError) {
          // Skip this collection if search fails
          continue;
        }
      }
      
      // Stop if we have enough results
      if (results.length >= 20) break;
    }
  } catch (error) {
    console.error('Error in text search query:', error);
  }
  
  return results;
}

// Extract meaningful search terms from query
function extractSearchTerms(query) {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'what', 'who', 'where', 'when', 'why', 'how']);
  
  const terms = query
    .toLowerCase()
    .replace(/[^\\w\\s@.-]/g, ' ') // Keep @ and . for emails and domains
    .split(/\\s+/)
    .filter(term => term.length > 2 && !stopWords.has(term));
  
  return terms;
}

// Build regex search query for MongoDB
function buildRegexSearchQuery(searchTerms, collectionSchema) {
  if (searchTerms.length === 0) return null;
  
  // Identify string fields that are good candidates for text search
  const textFields = collectionSchema.filter(field => {
    const fieldLower = field.toLowerCase();
    return (
      // Include common text fields
      fieldLower.includes('name') ||
      fieldLower.includes('email') || 
      fieldLower.includes('title') ||
      fieldLower.includes('description') ||
      fieldLower.includes('role') ||
      fieldLower.includes('department') ||
      fieldLower.includes('skill') ||
      fieldLower.includes('location') ||
      fieldLower.includes('team') ||
      fieldLower.includes('status') ||
      fieldLower.includes('priority') ||
      // Don't include deeply nested or array index fields
      (field.split('.').length <= 3 && !field.match(/\\.\\d+\\./))
    );
  });
  
  if (textFields.length === 0) return null;
  
  // Create OR conditions for each search term across all text fields
  const orConditions = [];
  
  searchTerms.forEach(term => {
    const termRegex = new RegExp(term, 'i'); // case-insensitive
    
    textFields.forEach(field => {
      orConditions.push({ [field]: termRegex });
    });
    
    // Also search for exact email matches if term looks like email
    if (term.includes('@')) {
      orConditions.push({ email: term });
    }
  });
  
  // If multiple search terms, require at least one match per term
  if (searchTerms.length === 1) {
    return { $or: orConditions };
  } else {
    // For multiple terms, create AND of OR conditions
    const andConditions = searchTerms.map(term => {
      const termRegex = new RegExp(term, 'i');
      const termConditions = textFields.map(field => ({ [field]: termRegex }));
      return { $or: termConditions };
    });
    
    return { $and: andConditions };
  }
}

// Generate natural language response using AI
async function generateNaturalLanguageResponse(claudeClient, geminiModel, query, history, searchResults, schema, isAnalytical) {
  // Prepare simplified results for AI processing
  const simplifiedResults = simplifyResultsForAI(searchResults, query);
  
  // Try Claude first
  try {
    return await generateResponseWithClaude(claudeClient, query, history, simplifiedResults, schema, isAnalytical);
  } catch (claudeError) {
    console.error('Claude failed, trying Gemini:', claudeError);
    
    // Fallback to Gemini
    try {
      return await generateResponseWithGemini(geminiModel, query, history, simplifiedResults, schema, isAnalytical);
    } catch (geminiError) {
      console.error('Both AI services failed:', geminiError);
      
      // Final fallback to basic response
      return generateBasicResponse(query, searchResults);
    }
  }
}

// Generate response using Claude
async function generateResponseWithClaude(claudeClient, query, history, simplifiedResults, schema, isAnalytical) {
  const contextInfo = {
    query,
    resultCount: simplifiedResults.length,
    searchType: isAnalytical ? 'analytical/aggregation' : 'text search',
    collections: Object.keys(schema),
    sampleFields: Object.entries(schema).reduce((acc, [col, fields]) => {
      acc[col] = fields.slice(0, 10); // Show first 10 fields per collection
      return acc;
    }, {})
  };

  const prompt = `You are an AI assistant providing information from a company database. 

Database Context:
- Collections available: ${contextInfo.collections.join(', ')}
- Search type used: ${contextInfo.searchType}
- Results found: ${contextInfo.resultCount}

User Query: "${query}"

Search Results:
${JSON.stringify(simplifiedResults, null, 2)}

Please provide a natural, conversational response that:
1. Directly answers the user's query based on the search results
2. Summarizes key information clearly
3. Provides specific details when available
4. Uses a helpful, professional tone
5. If results seem limited or empty, acknowledges this and suggests refinements

Do not mention the database structure, search methods, or technical details. Just provide the information as if you know it directly.`;

  const response = await claudeClient.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

// Generate response using Gemini
async function generateResponseWithGemini(model, query, history, simplifiedResults, schema, isAnalytical) {
  const geminiHistory = history.slice(-3).map(entry => ({
    role: entry.role === 'user' ? 'user' : 'model',
    parts: [{ text: entry.text }]
  }));

  const prompt = `You are an AI assistant providing information from a company database.

User Query: "${query}"

Search Results (${simplifiedResults.length} items found):
${JSON.stringify(simplifiedResults, null, 2)}

Please provide a natural, conversational response that:
1. Directly answers the user's query based on the search results
2. Summarizes key information clearly
3. Provides specific details when available
4. Uses a helpful, professional tone
5. If results seem limited or empty, acknowledges this and suggests refinements

Do not mention the database structure, search methods, or technical details. Just provide the information as if you know it directly.`;

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(prompt);
  return result.response.text();
}

// Simplify search results for AI processing
function simplifyResultsForAI(searchResults, query) {
  if (!searchResults || searchResults.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  
  return searchResults.slice(0, 15).map(result => {
    const simplified = {
      source_collection: result.__collection || 'unknown'
    };
    
    // Always include basic employee info if available
    if (result.name) simplified.name = result.name;
    if (result.firstName && result.lastName) {
      simplified.name = `${result.firstName} ${result.lastName}`;
    }
    if (result.email) simplified.email = result.email;
    if (result.role) simplified.role = result.role;
    if (result.department) simplified.department = result.department;
    if (result.employee_department) simplified.employee_department = result.employee_department;
    
    // Include context-relevant fields based on query
    if (queryLower.includes('skill') && result.skills) {
      simplified.skills = Array.isArray(result.skills) ? result.skills : [result.skills];
    }
    if (queryLower.includes('location') && result.location) {
      simplified.location = result.location;
    }
    if (queryLower.includes('team') && result.team) {
      simplified.team = result.team;
    }
    if (queryLower.includes('supervisor') && result.supervisor) {
      simplified.supervisor = result.supervisor;
    }
    if (queryLower.includes('project') && result.projects) {
      simplified.projects = Array.isArray(result.projects) ? 
        result.projects.slice(0, 3).map(p => ({
          title: p.project_title,
          description: p.project_description ? p.project_description.substring(0, 200) : null,
          department: p.project_department,
          status: p.project_status,
          priority: p.project_priority
        })) : [];
    }
    
    // For analytical results, include aggregation fields
    if (result.count !== undefined) simplified.count = result.count;
    if (result.total !== undefined) simplified.total = result.total;
    if (result._id !== undefined) simplified.category = result._id;
    
    return simplified;
  });
}

// Generate fallback response when no results found
async function generateFallbackResponse(claudeClient, geminiModel, query, history, schema, sampleData) {
  const contextInfo = {
    collections: Object.keys(schema),
    totalCollections: Object.keys(schema).length,
    fieldsAvailable: Object.entries(schema).reduce((acc, [col, fields]) => {
      acc[col] = fields.slice(0, 5); // Show sample fields
      return acc;
    }, {}),
    sampleDataAvailable: Object.keys(sampleData).length > 0
  };

  // Try Claude first for fallback
  try {
    const prompt = `You are an AI assistant helping users query a company database. The user's query returned no results.

User Query: "${query}"

Database Information:
- Available collections: ${contextInfo.collections.join(', ')}
- Sample fields per collection: ${JSON.stringify(contextInfo.fieldsAvailable, null, 2)}

Please provide a helpful response that:
1. Acknowledges that no specific results were found for their query
2. Suggests possible reasons (spelling, terminology, etc.)
3. Recommends how they might rephrase their query
4. Mentions what kind of information IS available in the database
5. Remains encouraging and helpful

Be conversational and don't mention technical database details.`;

    const response = await claudeClient.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content[0].text;
  } catch (claudeError) {
    // Fallback to Gemini
    try {
      const geminiHistory = history.slice(-2).map(entry => ({
        role: entry.role === 'user' ? 'user' : 'model',
        parts: [{ text: entry.text }]
      }));

      const prompt = `The user asked: "${query}" but no results were found in the company database.

The database contains information about employees, projects, departments, and organizational structure across ${contextInfo.totalCollections} collections.

Provide a helpful response that acknowledges no results were found and suggests how they might rephrase their query to get better results. Be encouraging and conversational.`;

      const chat = geminiModel.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(prompt);
      return result.response.text();
    } catch (geminiError) {
      // Ultimate fallback
      return generateBasicFallback(query, contextInfo);
    }
  }
}

// Ultimate fallback response when all else fails
function generateBasicFallback(query, contextInfo) {
  return `I couldn't find specific information about "${query}" in our database. 
Our database contains information about ${contextInfo.collections.join(', ')}. 
Could you try rephrasing your question or being more specific about what you're looking for?`;
}

// Basic fallback response generator
function generateBasicResponse(query, searchResults) {
  if (!searchResults || searchResults.length === 0) {
    return `I couldn't find any information related to your query "${query}". Could you try rephrasing your question or provide more specific details?`;
  }

  const resultCount = searchResults.length;
  const collections = [...new Set(searchResults.map(r => r.__collection).filter(Boolean))];

  let response = `I found ${resultCount} result${resultCount !== 1 ? 's' : ''}`;

  if (collections.length > 0) {
    response += ` across ${collections.length} data source${collections.length !== 1 ? 's' : ''}`;
  }

  response += '.';

  // Add details from first result if available
  const firstResult = searchResults[0];
  if (firstResult) {
    response += ` Here's a brief summary from the most relevant result:`;
    
    // Include key information from the first result based on what's available
    if (firstResult.name) {
      response += `\n- Name: ${firstResult.name}`;
    }
    if (firstResult.email) {
      response += `\n- Email: ${firstResult.email}`;
    }
    if (firstResult.role) {
      response += `\n- Role: ${firstResult.role}`;
    }
    if (firstResult.department || firstResult.employee_department) {
      response += `\n- Department: ${firstResult.department || firstResult.employee_department}`;
    }
  }

  return response;
}

// --- Core Helper Functions ---

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

// Introspect database to get schema and sample data
async function introspectDatabase(db) {
  const schema = {};
  const sampleData = {};
  
  try {
    const collections = await db.listCollections().toArray();
    
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      
      // Skip system collections and history
      if (collectionName === HISTORY_COLLECTION_NAME || collectionName.startsWith('system.')) {
        continue;
      }
      
      try {
        const collection = db.collection(collectionName);
        
        // Get sample documents (limit to 3 for performance)
        const samples = await collection.find({}).limit(3).toArray();
        sampleData[collectionName] = samples;
        
        // Extract schema from samples
        if (samples.length > 0) {
          const fields = new Set();
          samples.forEach(doc => {
            extractFieldPaths(doc, '', fields);
          });
          schema[collectionName] = Array.from(fields);
        } else {
          schema[collectionName] = [];
        }
      } catch (collectionError) {
        // Skip collections that can't be accessed
        schema[collectionName] = [];
        sampleData[collectionName] = [];
      }
    }
  } catch (error) {
    console.error('Error introspecting database:', error);
  }
  
  return { schema, sampleData };
}

// Extract field paths from nested documents
function extractFieldPaths(obj, prefix, fields, maxDepth = 3) {
  if (maxDepth <= 0) return;
  
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      // For arrays, just note the array field and sample first element if it exists
      if (prefix) fields.add(prefix);
      if (obj.length > 0 && typeof obj[0] === 'object') {
        extractFieldPaths(obj[0], prefix, fields, maxDepth - 1);
      }
    } else {
      // For objects, recurse into each field
      Object.keys(obj).forEach(key => {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        fields.add(fieldPath);
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          extractFieldPaths(obj[key], fieldPath, fields, maxDepth - 1);
        }
      });
    }
  }
}
