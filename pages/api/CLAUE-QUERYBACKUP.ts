import { MongoClient, ObjectId } from 'mongodb';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import { verifyAuth } from '@/lib/auth';

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_BASE;
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
    console.log('=== CLAUDE QUERY API HANDLER START ===');
    console.log('Request body:', JSON.stringify(req.body));
    
    const { query, session_id, collection: specificCollection, insertTestData } = req.body;

    if (!query || !session_id) {
      return res.status(400).json({ error: 'Query and session_id are required' });
    }

    // SECURITY CHECK: Extract companyCode from auth token
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1] || req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    let payload;
    try {
      payload = await verifyAuth(token);
      if (!payload?.companyCode && !payload?.company_code) throw new Error();
    } catch {
      return res.status(401).json({ error: 'Invalid authentication' });
    }
    const userCompanyCode = (payload.companyCode || payload.company_code).toString();

    if (!userCompanyCode) {
      return res.status(403).json({ error: 'Company context required' });
    }
    
    console.log('Authenticated user company code:', userCompanyCode);
    
    // IMPORTANT: Always use the authenticated user's company code, NEVER from request
    const dbName = `company_${userCompanyCode.toLowerCase()}`;
    console.log('Target database name:', dbName);

    // Initialize Google Generative AI client
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    console.log('GEMINI_API_KEY is set');
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME, safetySettings });

    // Initialize Claude client
    if (!CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY environment variable is not set.');
    }
    console.log('CLAUDE_API_KEY is set');
    
    const claudeClient = new Anthropic({
      apiKey: CLAUDE_API_KEY,
    });

    // Connect to MongoDB
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }
    // Connect directly to the tenant's database by including the company database in the URI
    const baseUri = MONGODB_URI.endsWith('/') ? MONGODB_URI : `${MONGODB_URI}/`;
    const tenantUri = `${baseUri}${dbName}?retryWrites=true&w=majority`;
    console.log('Connecting to tenant MongoDB URI:', tenantUri.replace(/mongodb\+srv:\/\/.*:.*@/, 'mongodb+srv://***:***@'));
    client = await MongoClient.connect(tenantUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB tenant connection successful');
    const db = client.db(dbName);
    console.log('Connected to tenant database:', dbName);
    // List all collections for debugging
    const allCollections = await db.listCollections().toArray();
    console.log(`DEBUG: All collections in ${dbName}:`, allCollections.map(c => c.name).join(', '));
    
    // Insert test data if requested
    if (insertTestData === true) {
      console.log('Test data insertion requested');
      await insertSampleData(db);
      return res.status(200).json({ 
        response: "Test data has been inserted into the database. You can now query the test data.",
        debug: { testDataInserted: true }
      });
    }
    
    const historyCollection = db.collection(HISTORY_COLLECTION_NAME);
    console.log('History collection reference created');

    // Get conversation history
    console.log('Retrieving conversation history for session:', session_id);
    const history = await getConversationHistory(historyCollection, session_id);
    console.log(`Retrieved ${history.length} history entries`);

    // Step 1: Introspect database schema and get sample data
    console.log('Starting database introspection...');
    const { schema, sampleData, relationships } = await introspectDatabase(db);
    console.log('Database introspection complete');

    // Check if database is empty and provide helpful response
    const nonEmptyCollections = Object.entries(schema)
      .filter(([name, fields]) => fields.length > 0 && name !== HISTORY_COLLECTION_NAME)
      .map(([name]) => name);
    
    if (nonEmptyCollections.length === 0) {
      console.log('WARNING: No collections with data found in the database');
      const emptyDbResponse = `I couldn't find any data in the database. The database appears to be empty. You may need to:
1. Insert some data into the database first
2. Check your connection string and database name
3. Verify that you have the correct permissions
4. Try adding test data by setting "insertTestData": true in your request`;
      
      return res.status(200).json({ 
        response: emptyDbResponse,
        debug: { 
          databaseEmpty: true,
          collectionsFound: Object.keys(schema),
          allCollections: allCollections.map(c => c.name)
        }
      });
    }

    // Log available collections
    console.log(`Available collections: ${Object.keys(schema).join(', ')}`);
    console.log('Collection schema details:');
    Object.entries(schema).forEach(([collection, fields]) => {
      console.log(`- ${collection}: ${fields.length} fields`);
      if (fields.length > 0) {
        console.log(`  Sample fields: ${fields.slice(0, 5).join(', ')}${fields.length > 5 ? '...' : ''}`);
      }
    });

    let searchResults = [];
    let responseText = '';
    
    // Detect explicit collection queries via request or NLP alias (e.g., 'show me employees')
    console.log('Checking for explicit collection in query...');
    let targetCollection = specificCollection || extractCollectionFromQuery(query, schema);
    console.log('Initial collection match result:', targetCollection);
    if (!targetCollection) {
      const showMeMatch = query.toLowerCase().match(/show me (\w+)/i);
      if (showMeMatch) {
        const alias = showMeMatch[1];
        const aliasMap = {
          employee: 'users', employees: 'users', user: 'users', users: 'users',
          project: 'projects', projects: 'projects', integration: 'integrations', integrations: 'integrations',
          feedback: 'feedbacks', feedbacks: 'feedbacks', test: 'tests', tests: 'tests',
          integration_history: 'integration_history', auth: 'auth'
        };
        const mapped = aliasMap[alias];
        if (mapped && schema[mapped]) {
          targetCollection = mapped;
          console.log(`'Show me' detected, alias '${alias}' mapped to collection '${targetCollection}'`);
        }
      }
    }
    if (targetCollection) {
      // If user asked 'show me X', return count instead of detailed search
      const showMeCountMatch = query.toLowerCase().match(/show me (\w+)/i);
      if (showMeCountMatch) {
        const count = await db.collection(targetCollection).countDocuments();
        const alias = showMeCountMatch[1];
        const resp = `There are ${count} ${alias} in your company.`;
        await saveConversation(historyCollection, session_id, query, resp);
        return res.status(200).json({ response: resp });
      }
      console.log(`Searching in specific collection: ${targetCollection}`);
      searchResults = await searchSpecificCollection(db, targetCollection, query, schema[targetCollection]);
      console.log(`Found ${searchResults.length} results in ${targetCollection}`);
    } else {
      // Step 2: Handle "how many" queries directly with count operations
      const howManyMatch = query.toLowerCase().match(/how many (\\w+)/i);
      if (howManyMatch) {
        const name = howManyMatch[1];
        console.log(`"How many" query detected for: ${name}`);
        
        const collections = Object.keys(schema);
        const matchCols = collections.filter(c => 
          c.toLowerCase() === name || 
          c.toLowerCase() === `${name}s` || 
          c.toLowerCase().includes(name.toLowerCase())
        );
        
        console.log(`Matching collections for "${name}": ${matchCols.join(', ')}`);
        
        if (matchCols.length) {
          const col = matchCols[0];
          console.log(`Counting documents in collection: ${col}`);
          const count = await db.collection(col).countDocuments();
          console.log(`Count result: ${count}`);
          
          const resp = `There are ${count} documents in the '${col}' collection.`;
          await saveConversation(historyCollection, session_id, query, resp);
          return res.status(200).json({ response: resp });
        }
      }

      // Step 3: Check if query is analytical (requires aggregation)
      console.log('Checking if query is analytical...');
      // Force analytical path for complex queries (show me, where, list, etc.)
      const complexPattern = /show me|where|list|filtered|with|having/i;
      const isAnalytical = isAnalyticalQuery(query) || complexPattern.test(query);
      console.log(`Query is ${isAnalytical ? 'analytical' : 'text search'} type`);
      
      if (isAnalytical) {
        // Handle analytical queries with basic aggregations
        console.log('Processing analytical query across collections...');
        searchResults = await handleAnalyticalQuery(db, query, schema, sampleData);
        console.log(`Analytical query returned ${searchResults.length} results`);
      } else {
        // Handle text search queries with regex-based search
        console.log('Processing text search query across collections...');
        searchResults = await handleTextSearchQuery(db, query, schema);
        console.log(`Text search returned ${searchResults.length} results`);
      }
    }

    // Step 4: Generate natural language response
    console.log(`Generating response based on ${searchResults.length} results`);
    if (searchResults && searchResults.length > 0) {
      console.log('Using search results to generate response');
      responseText = await generateNaturalLanguageResponse(
        claudeClient, model, query, history, searchResults, schema, false
      );
    } else {
      console.log('No results found, generating fallback response');
      responseText = await generateFallbackResponse(
        claudeClient, model, query, history, schema, sampleData
      );
    }

    // Save conversation
    console.log('Saving conversation to history');
    await saveConversation(historyCollection, session_id, query, responseText);

    // Return response
    console.log('Request completed successfully');
    return res.status(200).json({ 
      response: responseText,
      debug: { 
        resultsFound: searchResults ? searchResults.length : 0,
        collectionsSearched: Object.keys(schema).length,
        collectionsAvailable: Object.keys(schema)
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("ERROR in claude-query handler:", errorMessage);
    if (error instanceof Error && error.stack) {
      console.error("Error stack:", error.stack);
    }
    return res.status(500).json({
      error: 'An unexpected error occurred',
      details: errorMessage,
      response: "I'm sorry, I encountered an unexpected error processing your request. Please try again with a different query."
    });
  } finally {
    if (client) {
      console.log('Closing MongoDB connection');
      await client.close();
    }
    console.log('=== CLAUDE QUERY API HANDLER END ===');
  }
}

// Extract collection name from query if directly mentioned
function extractCollectionFromQuery(query, schema) {
  const queryLower = query.toLowerCase();
  const collections = Object.keys(schema);
  
  // Check for direct collection mentions
  for (const collection of collections) {
    const collectionLower = collection.toLowerCase();
    
    // Direct mention patterns
    if (
      queryLower.includes(`in ${collectionLower}`) ||
      queryLower.includes(`from ${collectionLower}`) ||
      queryLower.includes(`the ${collectionLower} collection`) ||
      queryLower.includes(`${collectionLower} collection`) ||
      queryLower.includes(`in the ${collectionLower}`)
    ) {
      return collection;
    }
  }
  
  return null;
}

// Search within a specific collection
async function searchSpecificCollection(db, collectionName, query, collectionSchema) {
  try {
    const collection = db.collection(collectionName);
    const searchTerms = extractSearchTerms(query);
    
    // Check for ID-based lookup
    const idMatch = query.match(/id\s*[=:]\s*["']?([^"'\s]+)["']?/i) || 
                   query.match(/find\s+([a-f0-9]{24})/i) ||
                   query.match(/record\s+([a-f0-9]{24})/i);
                   
    if (idMatch) {
      const id = idMatch[1];
      console.log(`Attempting direct ID lookup: ${id}`);
      
      try {
        // Try ObjectId first
        if (id.match(/^[0-9a-f]{24}$/i)) {
          console.log(`ID ${id} looks like a valid ObjectId, attempting ObjectId lookup`);
          try {
            const result = await collection.findOne({ _id: new ObjectId(id) });
            console.log(`ObjectId lookup result: ${result ? 'Found' : 'Not found'}`);
            if (result) {
              return [{ ...result, __collection: collectionName }];
            }
          } catch (objIdError) {
            console.error(`Error in ObjectId lookup:`, objIdError);
          }
        }
        
        // Try string ID
        console.log(`Attempting string ID lookup for: ${id}`);
        const result = await collection.findOne({ _id: id });
        console.log(`String ID lookup result: ${result ? 'Found' : 'Not found'}`);
        if (result) {
          return [{ ...result, __collection: collectionName }];
        }
        
        // Try ID field
        console.log(`Attempting id field lookup for: ${id}`);
        const result2 = await collection.findOne({ id: id });
        console.log(`ID field lookup result: ${result2 ? 'Found' : 'Not found'}`);
        if (result2) {
          return [{ ...result2, __collection: collectionName }];
        }
      } catch (idError) {
        console.error("Error in ID lookup:", idError);
      }
    }
    
    // Regular search
    const searchQuery = buildRegexSearchQuery(searchTerms, collectionSchema);
    if (searchQuery) {
      console.log(`Searching specific collection ${collectionName} with query:`, JSON.stringify(searchQuery));
      const results = await collection.find(searchQuery).limit(20).toArray();
      console.log(`Found ${results.length} results in specific collection search`);
      return results.map(r => ({ ...r, __collection: collectionName }));
    }
    
    return [];
  } catch (error) {
    console.error(`Error searching collection ${collectionName}:`, error);
    return [];
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

async function handleAnalyticalQuery(db, query, schema, sampleData) {
  console.log('Processing complex analytical query...');
  
  // Extract key entities and filters from the query using NLP
  const queryAnalysis = analyzeQueryIntent(query, schema);
  console.log('Query analysis:', queryAnalysis);
  
  // Identify primary and secondary collections to search
  const primaryCollection = queryAnalysis.primaryCollection || 'users';
  const secondaryCollections = queryAnalysis.secondaryCollections || [];
  const allCollectionsToSearch = [primaryCollection, ...secondaryCollections].filter(Boolean);
  
  console.log(`Collections to search: Primary=${primaryCollection}, Secondary=${secondaryCollections.join(', ')}`);
  
  let results = [];
  
  // Check if this is an employee recommendation query
  const isRecommendationQuery = query.toLowerCase().includes('who should') ||
                               query.toLowerCase().includes('recommend') ||
                               query.toLowerCase().includes('best person') ||
                               query.toLowerCase().includes('trust') ||
                               query.toLowerCase().includes('suitable');
  
  // First get data from primary collection
  if (primaryCollection && schema[primaryCollection]) {
    try {
      const col = db.collection(primaryCollection);
      const filters = buildFiltersFromQueryTerms(
        queryAnalysis.filters, 
        schema[primaryCollection],
        queryAnalysis.domainKeywords,
        queryAnalysis.taskType
      );
      
      console.log(`Filters for ${primaryCollection}:`, filters);
      
      // Apply basic filters
      let baseQuery = {};
      if (Object.keys(filters).length) {
        baseQuery = { $and: [filters] };
      }
      
      const primaryResults = await col.find(baseQuery).limit(50).toArray();
      
      // Mark collection source
      primaryResults.forEach(r => r.__collection = primaryCollection);
      results = [...primaryResults];
      
      console.log(`Found ${primaryResults.length} results in primary collection ${primaryCollection}`);
      
      // If no results found with direct filters but this is a recommendation query,
      // try a more flexible approach
      if (primaryResults.length === 0 && isRecommendationQuery) {
        console.log('No direct matches found. Trying flexible recommendation approach...');
        
        // For employee recommendations, get all employees and then filter by skills later
        if (primaryCollection === 'users') {
          const allEmployees = await col.find({}).limit(50).toArray();
          allEmployees.forEach(r => r.__collection = primaryCollection);
          
          console.log(`Fetched ${allEmployees.length} employees for flexible matching`);
          results = [...allEmployees];
        }
      }
      
      // If looking for specific entities with qualifiers (like 'best', 'most experienced')
      if (queryAnalysis.sortCriteria.length > 0 && results.length > 0) {
        console.log(`Applying sort criteria: ${queryAnalysis.sortCriteria.join(', ')}`);
        
        // Try to sort results by relevant criteria
        results = sortResultsByCriteria(results, queryAnalysis.sortCriteria, schema);
      }
      
      // If query requires secondary collections, query them too
      if (secondaryCollections.length > 0) {
        // Get secondary data even if primary has no results (for improvisation)
        const enrichedResults = await enrichResultsWithSecondaryData(
          db, results.length > 0 ? results : [{ _id: 'dummy', __collection: primaryCollection }],
          primaryCollection, secondaryCollections, schema
        );
        
        if (enrichedResults.length > 0) {
          // Remove dummy entries if any
          const validResults = enrichedResults.filter(r => r._id !== 'dummy');
          
          if (validResults.length > 0) {
            results = validResults;
            console.log(`Enhanced results with data from secondary collections`);
          }
        }
      }
    } catch (error) {
      console.error(`Error in analytical query on ${primaryCollection}:`, error);
    }
  }
  
  // If no results but this is a recommendation query, try improvisational approach
  if (results.length === 0 && isRecommendationQuery) {
    console.log('No results with analytical approach. Trying improvisational approach...');
    
    try {
      results = await generateImprovisedRecommendation(
        db, 
        query, 
        schema, 
        queryAnalysis.domainKeywords, 
        queryAnalysis.taskType
      );
      
      console.log(`Generated ${results.length} improvised recommendations`);
    } catch (impError) {
      console.error('Error in improvisational approach:', impError);
    }
  }
  
  return results;
}

// Analyze user query intent for better collection/field targeting
function analyzeQueryIntent(query, schema) {
  const queryLower = query.toLowerCase();
  
  // Initialize analysis object
  const analysis = {
    primaryCollection: null,
    secondaryCollections: [],
    filters: [],
    sortCriteria: [],
    keywords: [],
    domainKeywords: [],  // New field for domain/sector keywords
    skills: [],          // New field for skills
    taskType: null       // New field for task type
  };
  
  // Extract entity types from query
  const entityMatches = [];
  
  // Map common terms to collections
  const entityMappings = {
    'employee': 'users', 'employees': 'users', 'user': 'users', 'users': 'users', 'person': 'users', 'people': 'users',
    'project': 'projects', 'projects': 'projects', 'task': 'projects', 'assignment': 'projects',
    'feedback': 'feedbacks', 'rating': 'feedbacks', 'review': 'feedbacks',
    'integration': 'integrations', 'connect': 'integrations',
    'test': 'tests', 'tests': 'tests'
  };
  
  // Identify primary collection from query terms
  Object.entries(entityMappings).forEach(([term, collection]) => {
    if (queryLower.includes(term) && schema[collection]) {
      entityMatches.push({ term, collection, position: queryLower.indexOf(term) });
    }
  });
  
  // For employee recommendation queries, force users as primary if not already determined
  if (queryLower.includes('who should') || 
      queryLower.includes('recommend') || 
      queryLower.includes('best person') || 
      queryLower.includes('trust') ||
      queryLower.includes('suitable')) {
    if (!entityMatches.some(m => m.collection === 'users')) {
      entityMatches.push({ term: 'person', collection: 'users', position: 0 });
    }
  }
  
  // Sort by position in query (earlier = more important)
  entityMatches.sort((a, b) => a.position - b.position);
  
  if (entityMatches.length > 0) {
    analysis.primaryCollection = entityMatches[0].collection;
    
    // Additional collections mentioned become secondary
    const secondaryCollections = entityMatches
      .slice(1)
      .map(m => m.collection)
      .filter(c => c !== analysis.primaryCollection);
    
    analysis.secondaryCollections = [...new Set(secondaryCollections)];
  } else {
    // Default to users for who/recommendation questions
    if (queryLower.includes('who') || 
        queryLower.includes('recommend') || 
        queryLower.includes('suitable') ||
        queryLower.includes('qualified')) {
      analysis.primaryCollection = 'users';
      analysis.secondaryCollections = ['projects', 'feedbacks'];
    }
  }
  
  // Extract filtering terms
  const filterTerms = ['where', 'with', 'has', 'having', 'contains', 'in', 'by', 'for'];
  filterTerms.forEach(term => {
    const regex = new RegExp(`${term}\\s+([\\w\\s"']+)`, 'i');
    const match = queryLower.match(regex);
    if (match && match[1]) {
      analysis.filters.push(match[1].trim());
    }
  });
  
  // Add quoted terms as specific filters
  const quotedTerms = queryLower.match(/["']([^"']+)["']/g);
  if (quotedTerms) {
    quotedTerms.forEach(term => {
      // Remove quotes
      const cleanTerm = term.replace(/["']/g, '');
      analysis.filters.push(cleanTerm);
      analysis.keywords.push(cleanTerm);
    });
  }
  
  // Extract sorting/ranking criteria
  const sortTerms = [
    'best', 'worst', 'top', 'highest', 'lowest', 'most', 'least',
    'experienced', 'skilled', 'qualified', 'recommended', 'suitable', 
    'trustworthy', 'trusted', 'reliable'
  ];
  
  sortTerms.forEach(term => {
    if (queryLower.includes(term)) {
      analysis.sortCriteria.push(term);
    }
  });
  
  // Domain/sector identification
  const domains = [
    'legal', 'law', 'attorney', 'counsel', 'paralegal',
    'financial', 'finance', 'accounting', 'tax',
    'technical', 'tech', 'engineering', 'software', 'hardware',
    'medical', 'healthcare', 'health', 'clinical',
    'marketing', 'sales', 'advertising',
    'hr', 'human resources', 'recruiting',
    'creative', 'design', 'artistic',
    'research', 'scientific', 'academic',
    'administrative', 'management', 'executive'
  ];
  
  domains.forEach(domain => {
    if (queryLower.includes(domain)) {
      analysis.domainKeywords.push(domain);
    }
  });
  
  // Skill identification
  const skills = [
    'programming', 'coding', 'development',
    'writing', 'editing', 'communication',
    'presentation', 'public speaking',
    'analysis', 'analytics', 'data',
    'leadership', 'management', 'supervision',
    'organization', 'planning', 'coordination',
    'negotiation', 'contracts', 'legal expertise',
    'compliance', 'regulation', 'regulatory'
  ];
  
  skills.forEach(skill => {
    if (queryLower.includes(skill)) {
      analysis.skills.push(skill);
    }
  });
  
  // Task type identification
  if (queryLower.includes('critical') || queryLower.includes('important') || queryLower.includes('high priority')) {
    analysis.taskType = 'critical';
  } else if (queryLower.includes('urgent') || queryLower.includes('emergency') || queryLower.includes('immediate')) {
    analysis.taskType = 'urgent';
  } else if (queryLower.includes('routine') || queryLower.includes('regular') || queryLower.includes('standard')) {
    analysis.taskType = 'routine';
  }
  
  // Extract general keywords for search
  const words = queryLower
    .replace(/[.,?!;:\-\[\]{}()]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3) // Skip short words
    .filter(word => !['show', 'tell', 'find', 'get', 'give', 'what', 'which', 'who', 'where', 'when', 'list', 'should', 'could', 'would', 'with', 'that', 'this', 'have', 'will'].includes(word));
  
  analysis.keywords = [...new Set([...analysis.keywords, ...words])];
  
  return analysis;
}

// Build MongoDB filters based on extracted query terms
function buildFiltersFromQueryTerms(filterTerms, collectionSchema, domainKeywords = [], taskType = null) {
  if (!filterTerms || !filterTerms.length) {
    filterTerms = [];
  }
  
  // Add domain keywords to filter terms if not already present
  if (domainKeywords && domainKeywords.length) {
    domainKeywords.forEach(domain => {
      if (!filterTerms.some(term => term.includes(domain))) {
        filterTerms.push(domain);
      }
    });
  }
  
  // Add task type to filter terms if not already present
  if (taskType && !filterTerms.some(term => term.includes(taskType))) {
    filterTerms.push(taskType);
  }
  
  if (!filterTerms.length) return {};
  
  // Identify text fields in schema for text search
  const textFields = collectionSchema.filter(field => {
    // Skip array indexes or deeply nested fields
    if (field.match(/\.\d+\./) || field.split('.').length > 3) return false;
    
    // Focus on fields likely to contain searchable text
    const fieldLower = field.toLowerCase();
    return (
      fieldLower.includes('name') ||
      fieldLower.includes('title') ||
      fieldLower.includes('description') ||
      fieldLower.includes('role') ||
      fieldLower.includes('department') ||
      fieldLower.includes('skill') ||
      fieldLower.includes('location') ||
      fieldLower.includes('team') ||
      fieldLower.includes('status') ||
      fieldLower.includes('priority') ||
      fieldLower.includes('id') ||
      fieldLower.includes('type') ||
      fieldLower.includes('category') ||
      fieldLower.includes('tag') ||
      fieldLower.includes('text') ||
      fieldLower.includes('comment') ||
      fieldLower.includes('tag') ||
      fieldLower.includes('skill') ||
      fieldLower.includes('technology') ||
      fieldLower.includes('expertise') ||
      fieldLower.includes('sector') ||
      fieldLower.includes('domain') ||
      fieldLower.includes('specialty') ||
      fieldLower.includes('experience')
    );
  });
  
  // Create OR conditions for each filter term across text fields
  const orConditions = [];
  
  filterTerms.forEach(term => {
    const termRegex = new RegExp(term, 'i');
    
    if (textFields.length > 0) {
      const fieldConditions = textFields.map(field => ({
        [field]: termRegex
      }));
      
      orConditions.push({ $or: fieldConditions });
    }
  });
  
  if (orConditions.length > 0) {
    return { $and: orConditions };
  }
  
  return {};
}

// Sort results by criteria extracted from query
function sortResultsByCriteria(results, criteria, schema) {
  if (!results.length || !criteria.length) return results;
  
  // Map sort terms to actual fields and sort directions
  const sortMappings = {
    'best': { fields: ['rating', 'score', 'skillLevel', 'experienceYears'], dir: -1 },
    'worst': { fields: ['rating', 'score', 'skillLevel', 'experienceYears'], dir: 1 },
    'most': { fields: ['count', 'quantity', 'amount', 'experienceYears'], dir: -1 },
    'least': { fields: ['count', 'quantity', 'amount', 'experienceYears'], dir: 1 },
    'highest': { fields: ['rating', 'score', 'level', 'tier', 'skillLevel'], dir: -1 },
    'lowest': { fields: ['rating', 'score', 'level', 'tier', 'skillLevel'], dir: 1 },
    'experienced': { fields: ['experienceYears', 'yearsOfExperience', 'tenure'], dir: -1 },
    'skilled': { fields: ['skillLevel', 'expertise', 'proficiency'], dir: -1 },
    'qualified': { fields: ['qualificationScore', 'matchScore', 'relevance'], dir: -1 },
    'recommended': { fields: ['recommendationScore', 'rating', 'feedback'], dir: -1 }
  };
  
  // Find relevant sort field that exists in our results
  for (const criterion of criteria) {
    const mapping = sortMappings[criterion];
    if (mapping) {
      for (const field of mapping.fields) {
        // Check if field exists in at least one result
        if (results.some(r => r[field] !== undefined)) {
          return results.sort((a, b) => {
            const valA = a[field] || 0;
            const valB = b[field] || 0;
            return (valA - valB) * mapping.dir;
          });
        }
      }
    }
  }
  
  return results;
}

// Enrich primary results with data from secondary collections
async function enrichResultsWithSecondaryData(db, primaryResults, primaryCollection, secondaryCollections, schema) {
  if (!primaryResults.length || !secondaryCollections.length) return primaryResults;
  
  const enriched = [...primaryResults];
  
  // Identify potential join fields between collections
  const potentialJoins = [];
  
  // Standard key patterns to try
  const joinPatterns = [
    // Primary collection field -> Secondary collection
    { primary: 'id', secondary: '_id' },
    { primary: '_id', secondary: 'id' },
    { primary: 'userId', secondary: '_id' },
    { primary: 'projectId', secondary: '_id' },
    { primary: 'feedbackId', secondary: '_id' }
  ];
  
  // Add collection-specific patterns
  if (primaryCollection === 'users') {
    joinPatterns.push(
      { primary: '_id', secondary: 'userId' },
      { primary: 'email', secondary: 'email' },
      { primary: '_id', secondary: 'evaluatedBy' },
      { primary: '_id', secondary: 'assignedTo' }
    );
  } else if (primaryCollection === 'projects') {
    joinPatterns.push(
      { primary: '_id', secondary: 'projectId' },
      { primary: '_id', secondary: 'project' }
    );
  }
  
  for (const secondaryCollection of secondaryCollections) {
    try {
      // Skip if schema not available
      if (!schema[secondaryCollection]) continue;
      
      const secondaryCol = db.collection(secondaryCollection);
      
      // Find viable join keys
      for (const pattern of joinPatterns) {
        const primaryKey = pattern.primary;
        const secondaryKey = pattern.secondary;
        
        // Check if fields exist in schemas
        const primaryHasKey = schema[primaryCollection].includes(primaryKey);
        const secondaryHasKey = schema[secondaryCollection].includes(secondaryKey);
        
        if (primaryHasKey && secondaryHasKey) {
          // Check if primary results have this key with values
          const validPrimaryValues = primaryResults
            .filter(r => r[primaryKey])
            .map(r => r[primaryKey] instanceof ObjectId ? r[primaryKey].toString() : r[primaryKey]);
          
          if (validPrimaryValues.length) {
            // Try to find matching secondary records
            const secondaryResults = await secondaryCol.find({
              [secondaryKey]: { $in: validPrimaryValues }
            }).toArray();
            
            if (secondaryResults.length) {
              // Mark records with source collection
              secondaryResults.forEach(r => r.__collection = secondaryCollection);
              
              // Create a lookup map for faster access
              const secondaryLookup = {};
              secondaryResults.forEach(r => {
                const key = r[secondaryKey] instanceof ObjectId ? 
                  r[secondaryKey].toString() : r[secondaryKey];
                
                if (!secondaryLookup[key]) secondaryLookup[key] = [];
                secondaryLookup[key].push(r);
              });
              
              // Enrich primary results
              enriched.forEach(primary => {
                const joinValue = primary[primaryKey] instanceof ObjectId ? 
                  primary[primaryKey].toString() : primary[primaryKey];
                
                if (joinValue && secondaryLookup[joinValue]) {
                  // Add related data from secondary collection
                  primary[`related_${secondaryCollection}`] = secondaryLookup[joinValue];
                }
              });
              
              console.log(`Enriched ${enriched.length} results with data from ${secondaryCollection}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error enriching data from ${secondaryCollection}:`, error);
    }
  }
  
  return enriched;
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
    response += `\n- Name: ${firstResult.name}`;
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

// Simplify search results for AI processing
function simplifyResultsForAI(searchResults, query) {
  if (!searchResults || searchResults.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  
  return searchResults.slice(0, 15).map(result => {
    const simplified = {
      source_collection: result.__collection || 'unknown'
    };
    
    // Include ID fields if available
    if (result._id) simplified._id = result._id.toString();
    if (result.id) simplified.id = result.id;
    
    // Always include basic employee info if available
    if (result.name) simplified.name = result.name;
    if (result.firstName && result.lastName) {
      simplified.name = `${result.firstName} ${result.lastName}`;
    }
    if (result.email) simplified.email = result.email;
    if (result.role) simplified.role = result.role;
    if (result.department) simplified.department = result.department;
    if (result.employee_department) simplified.employee_department = result.employee_department;
    
    // Include all other fields that aren't objects or arrays
    Object.entries(result).forEach(([key, value]) => {
      if (
        key !== '__collection' && 
        key !== '_id' &&
        !simplified[key] && 
        (typeof value === 'string' || 
         typeof value === 'number' || 
         typeof value === 'boolean')
      ) {
        simplified[key] = value;
      }
    });
    
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
        })) : 
        [result.projects];
    }
    
    return simplified;
  });
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
    await collection.updateOne(
      { session_id: sessionId },
      {
        $push: {
          messages: {
            role: 'user',
            text: userQuery,
            timestamp: new Date()
          }
        },
        $set: { last_updated: new Date() },
        $setOnInsert: { 
          session_id: sessionId,
          created_at: new Date()
        }
      },
      { upsert: true }
    );
    
    await collection.updateOne(
      { session_id: sessionId },
      {
        $push: {
          messages: {
            role: 'assistant',
            text: aiResponse,
            timestamp: new Date()
          }
        },
        $set: { last_updated: new Date() }
      }
    );
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
}

// Introspect database to get schema and sample data
async function introspectDatabase(db) {
  try {
    // List all collections in the database
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections in database`);
    
    const schema = {};
    const sampleData = {};
    const relationships = [];
    
    // Process each collection
    for (const collection of collections) {
      const collectionName = collection.name;
      
      // Skip system collections
      if (collectionName.startsWith('system.')) {
        console.log(`Skipping system collection: ${collectionName}`);
        continue;
      }
      
      await (async () => {
        try {
          const col = db.collection(collectionName);
          
          // Get sample documents (up to 5)
          const sampleDocs = await col.find({}).limit(5).toArray();
          
          // Initialize schema for this collection if it doesn't exist
          if (!schema[collectionName]) {
            schema[collectionName] = [];
          }
          
          // Extract schema from sample documents
          if (sampleDocs.length > 0) {
            const fields = new Set();
            const collectionRelationships = [];
            
            // Process each document to extract fields
            sampleDocs.forEach(doc => {
              Object.entries(doc).forEach(([key, value]) => {
                // Skip _id field
                if (key === '_id') return;
                
                // Add field to schema
                fields.add(key);
                
                // Check for potential relationships (fields ending with Id or _id)
                if (typeof value === 'string' && (key.endsWith('Id') || key.endsWith('_id'))) {
                  collectionRelationships.push({
                    from: collectionName,
                    fromField: key,
                    possibleTo: key.endsWith('Id') ? key.slice(0, -2) : key.slice(0, -3),
                    isArray: false
                  });
                }
                
                // Check for array of IDs
                if (Array.isArray(value) && value.length > 0 && 
                    (key.endsWith('Ids') || key.endsWith('_ids'))) {
                  collectionRelationships.push({
                    from: collectionName,
                    fromField: key,
                    possibleTo: key.replace('Ids', '').replace('_ids', ''),
                    isArray: true
                  });
                }
              });
            });
            
            // Store sample data for reference
            sampleData[collectionName] = sampleDocs;
            
            // Update schema with fields from this collection
            schema[collectionName] = Array.from(fields);
            
            // Add relationships to global relationships array
            relationships.push(...collectionRelationships);
            
            if (schema[collectionName].length > 0) {
              console.log(`Extracted ${schema[collectionName].length} fields from ${collectionName}`);
              console.log(`Sample fields from ${collectionName}: ${schema[collectionName].slice(0, 5).join(', ')}${schema[collectionName].length > 5 ? '...' : ''}`);
            } else {
              console.log(`No fields extracted from collection ${collectionName}`);
            }
          } else {
            console.log(`No documents found in collection ${collectionName}`);
            schema[collectionName] = [];
            sampleData[collectionName] = [];
          }
        } catch (collectionError) {
          console.error(`ERROR accessing collection ${collectionName}:`, collectionError);
          if (collectionError instanceof Error && collectionError.stack) {
            console.error(`Collection error stack for ${collectionName}:`, collectionError.stack);
          }
          // Skip collections that can't be accessed
          schema[collectionName] = [];
          sampleData[collectionName] = [];
        }
      })(); // Immediately invoked async function expression
    }
    
    return { schema, sampleData, relationships };
  } catch (error) {
    console.error('ERROR in database introspection:', error);
    if (error instanceof Error && error.stack) {
      console.error('Introspection error stack:', error.stack);
    }
    // Ensure we return a valid structure even in case of error
    return { schema: {}, sampleData: {}, relationships: [] };
  }
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

// Function to insert sample data for testing
async function insertSampleData(db) {
  try {
    console.log('Inserting sample data for testing...');
    
    // Create users collection with sample data
    const usersCollection = db.collection('users');
    await usersCollection.deleteMany({});  // Clear existing data
    
    const usersData = [
      {
        name: "John Doe",
        email: "john.doe@example.com",
        role: "Software Engineer",
        department: "Engineering",
        skills: ["JavaScript", "React", "Node.js"],
        location: "New York"
      },
      {
        name: "Jane Smith",
        email: "jane.smith@example.com",
        role: "Product Manager",
        department: "Product",
        skills: ["Strategy", "User Research", "Roadmapping"],
        location: "San Francisco"
      },
      {
        name: "Bob Johnson",
        email: "bob.johnson@example.com",
        role: "Data Scientist",
        department: "Data",
        skills: ["Python", "Machine Learning", "SQL"],
        location: "Boston"
      }
    ];
    
    await usersCollection.insertMany(usersData);
    console.log(`Inserted ${usersData.length} users`);
    
    // Create projects collection with sample data
    const projectsCollection = db.collection('projects');
    await projectsCollection.deleteMany({});  // Clear existing data
    
    const projectsData = [
      {
        title: "Website Redesign",
        description: "Redesign the company website for better user experience",
        department: "Marketing",
        status: "In Progress",
        team_members: ["John Doe", "Jane Smith"]
      },
      {
        title: "Data Pipeline",
        description: "Build a new data processing pipeline for analytics",
        department: "Data",
        status: "Planning",
        team_members: ["Bob Johnson"]
      }
    ];
    
    await projectsCollection.insertMany(projectsData);
    console.log(`Inserted ${projectsData.length} projects`);
    
    // Create departments collection with sample data
    const departmentsCollection = db.collection('departments');
    await departmentsCollection.deleteMany({});  // Clear existing data
    
    const departmentsData = [
      {
        name: "Engineering",
        head: "Alice Williams",
        budget: 1500000,
        location: "New York"
      },
      {
        name: "Product",
        head: "David Miller",
        budget: 1000000,
        location: "San Francisco"
      },
      {
        name: "Data",
        head: "Charlie Brown",
        budget: 800000,
        location: "Boston"
      },
      {
        name: "Marketing",
        head: "Eve Davis",
        budget: 750000,
        location: "Chicago"
      }
    ];
    
    await departmentsCollection.insertMany(departmentsData);
    console.log(`Inserted ${departmentsData.length} departments`);
    
    console.log('Sample data insertion complete');
    return true;
  } catch (error) {
    console.error('Error inserting sample data:', error);
    return false;
  }
}

// Function to get the user's company code from their session or auth token
// This ensures users can only access their own company's data
async function getUserCompanyFromSession(req) {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('No valid authorization header found');
      
      // DEVELOPMENT ONLY: Allow fallback to environment variable or request body
      // This should NEVER be enabled in production
      if (process.env.NODE_ENV !== 'production') {
        // Check request body first (but log a warning)
        if (req.body && req.body.company) {
          console.warn('⚠️ SECURITY WARNING: Using company code from request body. This is UNSAFE for production!');
          return req.body.company;
        }
        
        // Last resort: environment variable
        if (process.env.NEXT_PUBLIC_COMPANY_CODE) {
          console.warn('⚠️ SECURITY WARNING: Using company code from environment variable. This is UNSAFE for production!');
          return process.env.NEXT_PUBLIC_COMPANY_CODE;
        }
      }
      
      return null;
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    if (!token) {
      console.error('No token found in authorization header');
      return null;
    }
    
    console.log('Verifying auth token...');
    // Use the existing auth verification system
    const decodedToken = await verifyAuth(token);
    
    if (!decodedToken) {
      console.error('Token verification failed');
      return null;
    }
    
    // Check for company code in token
    if (decodedToken.companyCode) {
      console.log('Found company code in token:', decodedToken.companyCode);
      return decodedToken.companyCode;
    }
    
    // Fallback to company field if companyCode is not available
    if (decodedToken.company) {
      console.log('Using company field as fallback:', decodedToken.company);
      return decodedToken.company;
    }
    
    // If we reach here with a valid token but no company info, log an error
    console.error('Valid token but no company information found:', decodedToken);
    return null;
  } catch (error) {
    console.error('Error getting user company from token:', error);
    return null;
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

  // Check if we have improvised recommendations
  const hasImprovisedRecommendations = simplifiedResults.some(r => r.__score !== undefined && r.__matchReasons !== undefined);

  // Enhanced prompt for complex queries with improvisation capabilities
  let prompt = `You are an AI assistant providing information from a company database. 

Database Context:
- Collections available: ${contextInfo.collections.join(', ')}
- Search type used: ${contextInfo.searchType}
- Results found: ${contextInfo.resultCount}

User Query: "${query}"`;

  if (hasImprovisedRecommendations) {
    prompt += `\n\nIMPORTANT: These are IMPROVISED recommendations since no exact matches were found in the database. 
Each candidate has been scored based on their potential suitability for the task.
When responding, acknowledge that you're making an educated recommendation based on available employee data,
and explain why each person might be suitable based on their __matchReasons and other relevant attributes.

Scored Recommendations:
${JSON.stringify(simplifiedResults, null, 2)}

Please recommend suitable candidates by:
1. Explaining that you're making an educated recommendation as there's no exact match
2. Presenting the top candidates in order of suitability
3. For each candidate, explain WHY they might be a good fit (using their __matchReasons and other attributes)
4. Consider the specific domain mentioned in the query (e.g., legal, technical) and how it relates to their skills
5. Be conversational and helpful, suggesting next steps to validate these recommendations

Be honest about the limitations of the data but provide the most helpful answer possible.`;
  } else {
    prompt += `\n\nSearch Results:
${JSON.stringify(simplifiedResults, null, 2)}

For queries about finding the best person for a task or project:
1. Evaluate employees based on all available data including skills, experience, role, department, and past project performance
2. Consider workload, expertise match, seniority level, and domain knowledge
3. Provide a nuanced recommendation with reasoning for why certain employees might be suitable
4. Consider multiple factors beyond just keyword matches`;
  }

  prompt += `\n\nPlease provide a natural, conversational response that:
1. Directly answers the user's query based on the search results
2. Summarizes key information clearly and weighs multiple factors
3. Provides specific details when available
4. Uses a helpful, professional tone
5. If results seem limited, acknowledges this and explains your reasoning process

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

  // Check if we have improvised recommendations
  const hasImprovisedRecommendations = simplifiedResults.some(r => r.__score !== undefined && r.__matchReasons !== undefined);

  // Enhanced prompt for complex queries
  let prompt = `You are an AI assistant providing information from a company database.

User Query: "${query}"`;

  if (hasImprovisedRecommendations) {
    prompt += `\n\nIMPORTANT: These are IMPROVISED recommendations since no exact matches were found in the database. 
Each candidate has been scored based on their potential suitability for the task.
When responding, acknowledge that you're making an educated recommendation based on available employee data,
and explain why each person might be suitable based on their __matchReasons and other relevant attributes.

Scored Recommendations (${simplifiedResults.length} items found):
${JSON.stringify(simplifiedResults, null, 2)}

Please recommend suitable candidates by:
1. Explaining that you're making an educated recommendation as there's no exact match
2. Presenting the top candidates in order of suitability
3. For each candidate, explain WHY they might be a good fit (using their __matchReasons and other attributes)
4. Consider the specific domain mentioned in the query (e.g., legal, technical) and how it relates to their skills
5. Be conversational and helpful, suggesting next steps to validate these recommendations`;
  } else {
    prompt += `\n\nSearch Results (${simplifiedResults.length} items found):
${JSON.stringify(simplifiedResults, null, 2)}

For complex queries about finding suitable employees for projects or tasks:
1. Analyze employee data holistically considering skills, experience, project history, feedback, and current workload
2. Weigh factors like expertise relevance, project criticality, seniority level, and domain knowledge
3. Consider role-appropriate assignments (avoid suggesting CEO for routine tasks)
4. Make nuanced recommendations with reasoning for why specific employees are suitable`;
  }

  prompt += `\n\nPlease provide a natural, conversational response that:
1. Directly answers the user's query based on the search results
2. Summarizes key information clearly
3. Provides specific details and contextual analysis when available
4. Uses a helpful, professional tone
5. If results seem limited, acknowledges this and explains your reasoning process

Do not mention the database structure, search methods, or technical details. Just provide the information as if you know it directly.`;

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(prompt);
  return result.response.text();
}

// Improved text search query handler with expanded capabilities
async function handleTextSearchQuery(db, query, schema) {
  console.log('Processing text search query across collections...');
  
  const searchTerms = extractSearchTerms(query);
  console.log(`Extracted search terms: ${searchTerms.join(', ')}`);
  
  let results = [];
  
  // Prioritize collections based on query context
  const queryLower = query.toLowerCase();
  const prioritizedCollections = prioritizeCollectionsForQuery(queryLower, schema);
  console.log(`Prioritized collections: ${prioritizedCollections.join(', ')}`);
  
  // Get cross-collection results to satisfy complex queries
  for (const collectionName of prioritizedCollections) {
    try {
      if (!schema[collectionName] || schema[collectionName].length === 0) {
        console.log(`Skipping empty collection schema: ${collectionName}`);
        continue;
      }
      
      const collection = db.collection(collectionName);
      const searchQuery = buildRegexSearchQuery(searchTerms, schema[collectionName]);
      
      console.log(`Searching collection ${collectionName} with query:`, JSON.stringify(searchQuery));
      
      if (searchQuery && Object.keys(searchQuery).length > 0) {
        const collectionResults = await collection.find(searchQuery).limit(20).toArray();
        
        // Add collection source to each result
        collectionResults.forEach(r => r.__collection = collectionName);
        
        results.push(...collectionResults);
        console.log(`Found ${collectionResults.length} results in ${collectionName}`);
      }
    } catch (error) {
      console.error(`Error searching collection ${collectionName}:`, error);
    }
  }
  
  // For complex employee qualification queries, try to enrich with relevant data
  if (queryLower.includes('who should') || 
      queryLower.includes('best person') || 
      queryLower.includes('qualified') || 
      queryLower.includes('critical project') ||
      (queryLower.includes('project') && (queryLower.includes('assign') || queryLower.includes('handle')))) {
    
    console.log('Complex qualification query detected, enriching results...');
    
    // Get employees (users) first
    const userResults = results.filter(r => r.__collection === 'users');
    
    if (userResults.length > 0) {
      // Get additional data about each user
      const enhancedResults = await enrichEmployeeData(db, userResults, schema);
      
      // Replace user results with enhanced data
      results = [
        ...enhancedResults,
        ...results.filter(r => r.__collection !== 'users')
      ];
      
      console.log(`Enhanced ${enhancedResults.length} employee records with additional data`);
    }
  }
  
  return results;
}

// Prioritize collections based on query context
function prioritizeCollectionsForQuery(query, schema) {
  const collections = Object.keys(schema);
  
  // Define priority maps for different query types
  const priorityMaps = {
    // Employee-focused queries
    employee: [
      'users', 'employees', 'staff', 'team_members',
      'projects', 'assignments', 'skills', 'performance',
      'feedback', 'evaluations', 'departments'
    ],
    // Project-focused queries
    project: [
      'projects', 'assignments', 'tasks', 'milestones',
      'users', 'teams', 'departments', 'feedback'
    ],
    // Organization-focused queries
    organization: [
      'departments', 'teams', 'org_structure', 
      'users', 'employees', 'projects'
    ]
  };
  
  // Determine query type based on keywords
  let queryType = 'employee'; // Default
  
  if (query.includes('project') || 
      query.includes('task') || 
      query.includes('assignment') || 
      query.includes('milestone')) {
    queryType = 'project';
  } else if (query.includes('department') || 
             query.includes('organization') || 
             query.includes('structure') || 
             query.includes('company')) {
    queryType = 'organization';  
  }
  
  // Sort collections based on priority map
  const priorityMap = priorityMaps[queryType];
  
  return collections.sort((a, b) => {
    const aIndex = priorityMap.findIndex(p => a.toLowerCase().includes(p));
    const bIndex = priorityMap.findIndex(p => b.toLowerCase().includes(p));
    
    // If both collections are in priority map, sort by their position
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    
    // If only one collection is in priority map, prioritize it
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    // If neither collection is in priority map, maintain original order
    return 0;
  });
}

// Enhanced employee data enrichment for complex queries
async function enrichEmployeeData(db, employeeResults, schema) {
  if (!employeeResults.length) return [];
  
  const enhanced = [...employeeResults];
  const employeeIds = employeeResults.map(e => 
    e._id instanceof ObjectId ? e._id.toString() : e._id
  );
  
  // Collections to check for related data
  const relatedCollections = [
    'projects', 'feedback', 'evaluations', 'skills', 
    'performance', 'assignments', 'qualifications'
  ];
  
  // Fields that might reference an employee
  const employeeRefFields = [
    'userId', 'user_id', 'employeeId', 'employee_id', 
    'assignedTo', 'assigned_to', 'ownerId', 'owner_id',
    'evaluatedPerson', 'evaluated_person'
  ];
  
  for (const collName of relatedCollections) {
    // Skip if collection doesn't exist
    if (!schema[collName]) continue;
    
    try {
      const collection = db.collection(collName);
      
      // Build query to find related records
      const queryConditions = employeeRefFields.map(field => {
        return { [field]: { $in: employeeIds } };
      });
      
      if (queryConditions.length === 0) continue;
      
      const relatedData = await collection.find({ $or: queryConditions })
        .limit(50)
        .toArray();
      
      if (relatedData.length > 0) {
        console.log(`Found ${relatedData.length} related records in ${collName}`);
        
        // Add collection source
        relatedData.forEach(r => r.__collection = collName);
        
        // Organize by employee ID
        const dataByEmployee = {};
        
        relatedData.forEach(record => {
          // Find which employee this record belongs to
          let employeeId = null;
          
          for (const field of employeeRefFields) {
            if (record[field]) {
              employeeId = record[field];
              break;
            }
          }
          
          if (!employeeId) return;
          
          if (!dataByEmployee[employeeId]) {
            dataByEmployee[employeeId] = {};
          }
          
          if (!dataByEmployee[employeeId][collName]) {
            dataByEmployee[employeeId][collName] = [];
          }
          
          dataByEmployee[employeeId][collName].push(record);
        });
        
        // Enhance employee records with related data
        enhanced.forEach(employee => {
          const empId = employee._id instanceof ObjectId ? 
            employee._id.toString() : employee._id;
          
          if (dataByEmployee[empId]) {
            employee[`related_${collName}`] = dataByEmployee[empId][collName];
          }
        });
      }
    } catch (error) {
      console.error(`Error enriching employee data from ${collName}:`, error);
    }
  }
  
  return enhanced;
}

// Extract search terms from a query
function extractSearchTerms(query) {
  // Normalize query
  const normalizedQuery = query.toLowerCase()
    .replace(/[.,?!;:]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')       // Normalize spaces
    .trim();
  
  // Extract quoted terms first
  const quotedTerms = [];
  const quotedPattern = /"([^"]+)"|'([^']+)'/g;
  let quotedMatch;
  let queryWithoutQuotes = normalizedQuery;
  
  while ((quotedMatch = quotedPattern.exec(normalizedQuery)) !== null) {
    const term = quotedMatch[1] || quotedMatch[2];
    if (term && term.length > 1) {
      quotedTerms.push(term);
      // Remove quoted terms from query for keyword extraction
      queryWithoutQuotes = queryWithoutQuotes.replace(quotedMatch[0], ' ');
    }
  }
  
  // Extract keywords
  const stopWords = [
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 
    'by', 'about', 'as', 'into', 'like', 'through', 'after', 'before', 'between',
    'from', 'up', 'down', 'of', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will',
    'just', 'don', 'should', 'now', 'show', 'me', 'my', 'who', 'what', 'find',
    'get', 'list', 'give', 'tell', 'does', 'do', 'is', 'are', 'has', 'have', 'had',
    'query', 'search', 'looking', 'i', 'want', 'need', 'should', 'could', 'would'
  ];
  
  // Process the remaining query to extract keywords
  const keywordTerms = queryWithoutQuotes
    .split(' ')
    .filter(term => 
      term.length > 2 && 
      !stopWords.includes(term) && 
      !/^\d+$/.test(term) // Ignore pure numbers
    );
  
  // Prioritize quoted terms
  const allTerms = [...quotedTerms];
  
  // Add keywords that aren't already included in quoted terms
  keywordTerms.forEach(term => {
    if (!quotedTerms.some(qt => qt.includes(term))) {
      allTerms.push(term);
    }
  });
  
  // Handle special case for "employee" related terms to improve user collection searches
  const employeeTermMap = {
    'employee': 'user',
    'employees': 'user',
    'staff': 'user',
    'teammate': 'user',
    'team member': 'user',
    'team members': 'user',
    'coworker': 'user',
    'colleague': 'user',
    'worker': 'user',
    'person': 'user',
    'people': 'user',
    'individual': 'user'
  };
  
  // Add mapped terms for employee-related searches
  const mappedTerms = allTerms
    .filter(term => employeeTermMap[term])
    .map(term => employeeTermMap[term]);
  
  // Combine all terms, removing duplicates
  return [...new Set([...allTerms, ...mappedTerms])];
}

// Build regex search query based on extracted terms
function buildRegexSearchQuery(searchTerms, collectionSchema) {
  if (!searchTerms || searchTerms.length === 0 || !collectionSchema || collectionSchema.length === 0) {
    return null;
  }
  
  // Target fields that are likely to contain searchable text
  const textFieldPatterns = [
    /name/i, /title/i, /description/i, /content/i, /text/i, 
    /comment/i, /note/i, /message/i, /body/i, /summary/i,
    /role/i, /position/i, /job/i, /skill/i, /expertise/i,
    /location/i, /address/i, /city/i, /country/i, /state/i,
    /email/i, /contact/i, /phone/i, /mobile/i, 
    /tag/i, /category/i, /type/i, /status/i, /department/i,
    /project/i, /task/i, /assignment/i, /team/i
  ];
  
  // Filter schema fields to only include those that might contain text
  const textFields = collectionSchema.filter(field => {
    // Skip array indexes or deeply nested fields
    if (field.match(/\.\d+\./) || field.split('.').length > 3) return false;
    
    // Check if field matches any of our text field patterns
    return textFieldPatterns.some(pattern => pattern.test(field));
  });
  
  // If no suitable text fields found, try id fields
  if (textFields.length === 0) {
    const idFields = collectionSchema.filter(field => 
      /id$/i.test(field) || /^id/i.test(field) || field === '_id'
    );
    
    if (idFields.length > 0) {
      return { $or: buildOrConditionsForTerms(searchTerms, idFields) };
    }
    
    // If still no fields, return null
    return null;
  }
  
  // Build $or conditions for each field + term combination
  return { $or: buildOrConditionsForTerms(searchTerms, textFields) };
}

// Helper to build $or conditions for multiple terms and fields
function buildOrConditionsForTerms(terms, fields) {
  const conditions = [];
  
  // Create a condition for each term + field combination
  terms.forEach(term => {
    // Skip very short terms
    if (term.length < 2) return;
    
    // Handle quoted terms exactly, non-quoted terms with regex
    const isQuoted = term.includes(' ');
    
    fields.forEach(field => {
      if (isQuoted) {
        // For quoted/multi-word terms, use case-insensitive regex
        conditions.push({ [field]: { $regex: term, $options: 'i' } });
      } else {
        // For single words, use case-insensitive regex with word boundaries
        conditions.push({ [field]: { $regex: `\\b${term}`, $options: 'i' } });
      }
    });
  });
  
  return conditions;
}

// New function to generate improvised recommendations when no direct matches are found
async function generateImprovisedRecommendation(db, query, schema, domainKeywords, taskType) {
  // Default to users collection for recommendations
  if (!schema['users']) {
    return [];
  }
  
  console.log('Generating improvised recommendations...');
  
  const usersCol = db.collection('users');
  let candidateUsers = [];
  
  // Step 1: Get all employees first as candidates
  try {
    candidateUsers = await usersCol.find({}).limit(20).toArray();
    candidateUsers.forEach(u => u.__collection = 'users');
    console.log(`Found ${candidateUsers.length} candidate users`);
  } catch (error) {
    console.error('Error fetching candidate users:', error);
    return [];
  }
  
  if (candidateUsers.length === 0) {
    return [];
  }
  
  // Get the query text in lowercase for easier matching
  const queryLower = query.toLowerCase();
  
  // Step 2: Check for domain skills in any available fields
  const domainSkillFields = [
    'skills', 'expertise', 'specialization', 'background', 'department',
    'title', 'role', 'position', 'experience', 'qualifications'
  ];
  
  // Look for special terms in the query that affect our scoring strategy
  const queryContainsLegal = queryLower.includes('legal') || queryLower.includes('law') || 
                             queryLower.includes('attorney') || queryLower.includes('compliance');
  
  const queryContainsCritical = queryLower.includes('critical') || queryLower.includes('crucial') ||
                               queryLower.includes('important') || queryLower.includes('high-priority') ||
                               queryLower.includes('high priority');
  
  // Build scoring system for candidates
  const scoredCandidates = candidateUsers.map(user => {
    let score = 0;
    let matchReasons = [];
    let skillMatches = [];
    
    // Check domain keywords match
    if (domainKeywords && domainKeywords.length > 0) {
      domainKeywords.forEach(domain => {
        domainSkillFields.forEach(field => {
          if (user[field]) {
            const fieldValue = Array.isArray(user[field]) 
              ? user[field].join(' ').toLowerCase() 
              : String(user[field]).toLowerCase();
            
            if (fieldValue.includes(domain.toLowerCase())) {
              // Higher score for direct domain matches
              score += 10;
              matchReasons.push(`Domain expertise in ${domain}`);
              skillMatches.push(domain);
            }
          }
        });
      });
    }
    
    // Special case for legal sector projects
    if (queryContainsLegal) {
      // Check for legal-specific skills and terminology
      const legalTerms = [
        'legal', 'law', 'attorney', 'counsel', 'paralegal', 
        'compliance', 'regulatory', 'regulation', 'contract', 
        'litigation', 'corporate law', 'legal affairs'
      ];
      
      legalTerms.forEach(term => {
        domainSkillFields.forEach(field => {
          if (user[field]) {
            const fieldValue = Array.isArray(user[field]) 
              ? user[field].join(' ').toLowerCase() 
              : String(user[field]).toLowerCase();
            
            if (fieldValue.includes(term)) {
              score += 15;  // Higher score for legal expertise
              matchReasons.push(`Legal expertise: ${term}`);
              skillMatches.push(term);
            }
          }
        });
      });
      
      // Department-specific boost
      if (user.department && 
          ['legal', 'law', 'compliance'].some(dept => 
            user.department.toLowerCase().includes(dept))) {
        score += 20;
        matchReasons.push('Works in legal/compliance department');
      }
    }
    
    // Check for seniority (good for critical tasks)
    const seniorityTerms = ['senior', 'lead', 'manager', 'director', 'head', 'chief', 'vp', 'principal'];
    seniorityTerms.forEach(term => {
      if (user.title && String(user.title).toLowerCase().includes(term)) {
        score += 5;
        matchReasons.push(`Seniority (${term})`);
      }
      if (user.role && String(user.role).toLowerCase().includes(term)) {
        score += 5;
        matchReasons.push(`Senior role (${term})`);
      }
    });
    
    // Check for experience years if available
    if (user.experienceYears && !isNaN(parseFloat(user.experienceYears))) {
      const years = parseFloat(user.experienceYears);
      if (years > 5) {
        const expScore = Math.min(10, Math.floor(years / 2));
        score += expScore;
        matchReasons.push(`${years} years of experience (+${expScore})`);
      }
    }
    
    // For critical projects, adjust scoring
    if (queryContainsCritical || taskType === 'critical') {
      // Favor leadership positions for critical projects
      const leadershipTerms = ['director', 'manager', 'lead', 'chief', 'head', 'supervisor'];
      let hasLeadershipRole = false;
      
      leadershipTerms.forEach(term => {
        if ((user.title && String(user.title).toLowerCase().includes(term)) ||
            (user.role && String(user.role).toLowerCase().includes(term))) {
          hasLeadershipRole = true;
        }
      });
      
      if (hasLeadershipRole) {
        score += 15;
        matchReasons.push('Leadership position (good for critical projects)');
      }
      
      // Check for project management skills
      const pmTerms = ['project management', 'project manager', 'program manager', 
                       'pmp', 'agile', 'scrum', 'project lead', 'project coordination'];
      
      pmTerms.forEach(term => {
        domainSkillFields.forEach(field => {
          if (user[field]) {
            const fieldValue = Array.isArray(user[field]) 
              ? user[field].join(' ').toLowerCase() 
              : String(user[field]).toLowerCase();
            
            if (fieldValue.includes(term)) {
              score += 15;
              matchReasons.push(`Project management expertise: ${term}`);
              skillMatches.push(term);
            }
          }
        });
      });
      
      // For critical projects, avoid CEOs and very top executives unless query specifically asks
      if (!queryLower.includes('ceo') && !queryLower.includes('executive')) {
        const topExecTerms = ['ceo', 'chief executive', 'president'];
        if (topExecTerms.some(term => 
            (user.title && user.title.toLowerCase().includes(term)) || 
            (user.role && user.role.toLowerCase().includes(term)))) {
          score -= 15;
          matchReasons.push('Top executive might be overqualified for this project (-15)');
        }
      }
      
      // If critical task is in legal sector, look for both legal AND critical project skills
      if (queryContainsLegal) {
        // Look for legal+project management combination - ideal for critical legal projects
        if (skillMatches.some(s => ['legal', 'law', 'compliance', 'regulatory', 'attorney', 'counsel'].includes(s)) &&
            skillMatches.some(s => ['project', 'management', 'lead', 'coordination'].includes(s))) {
          score += 25;
          matchReasons.push('Has both legal expertise AND project management skills (+25)');
        }
        
        // Check past success with similar projects
        if (user.successfulProjects && Array.isArray(user.successfulProjects)) {
          const relevantProjects = user.successfulProjects.filter(p => 
            p.toLowerCase().includes('legal') || 
            p.toLowerCase().includes('compliance') || 
            p.toLowerCase().includes('regulatory')
          );
          
          if (relevantProjects.length > 0) {
            score += 20;
            matchReasons.push(`Past success with ${relevantProjects.length} relevant projects`);
          }
        }
      }
      
      // Look for performance indicators
      if (user.performance && !isNaN(parseFloat(user.performance))) {
        const perfScore = Math.min(15, Math.floor(parseFloat(user.performance) * 3));
        score += perfScore;
        matchReasons.push(`High performance rating (+${perfScore})`);
      }
      
      // Consider availability
      if (user.currentProjects && Array.isArray(user.currentProjects)) {
        if (user.currentProjects.length > 3) {
          score -= 10;
          matchReasons.push(`Currently working on ${user.currentProjects.length} projects (-10 for high workload)`);
        } else if (user.currentProjects.length < 2) {
          score += 5;
          matchReasons.push('Has availability for new projects (+5)');
        }
      }
    }
    
    // Consider feedback ratings if available
    if (user.feedbackScore && !isNaN(parseFloat(user.feedbackScore))) {
      const fbScore = Math.min(10, Math.floor(parseFloat(user.feedbackScore) * 2));
      score += fbScore;
      matchReasons.push(`Positive feedback from colleagues (+${fbScore})`);
    }
    
    // General project experience is valuable
    if (user.projectsCompleted && !isNaN(parseInt(user.projectsCompleted))) {
      const projectCount = parseInt(user.projectsCompleted);
      const projectScore = Math.min(10, Math.floor(projectCount / 2));
      if (projectScore > 0) {
        score += projectScore;
        matchReasons.push(`Completed ${projectCount} projects (+${projectScore})`);
      }
    }
    
    // Calculate a confidence score based on how much data we have to evaluate
    const availableDataPoints = matchReasons.length;
    let confidenceLevel = 'low';
    
    if (availableDataPoints >= 5) {
      confidenceLevel = 'high';
    } else if (availableDataPoints >= 3) {
      confidenceLevel = 'medium';
    }
    
    return {
      ...user,
      __score: score,
      __matchReasons: matchReasons,
      __confidenceLevel: confidenceLevel,
      __queryContext: {
        domainKeywords,
        isLegalSector: queryContainsLegal,
        isCriticalProject: queryContainsCritical,
        taskType
      }
    };
  });
  
  // Sort by score (descending)
  const sortedCandidates = scoredCandidates.sort((a, b) => b.__score - a.__score);
  
  // Return top candidates with their scores
  return sortedCandidates.slice(0, 5);
}
