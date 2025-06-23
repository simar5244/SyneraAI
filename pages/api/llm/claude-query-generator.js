const { Anthropic } = require('@anthropic-ai/sdk');
const { MongoClient } = require('mongodb');
const { verifyAuth } = require('@/lib/auth');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, schemas } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Get token from request
    const token = req.cookies.token || 
                 req.headers.authorization?.split(' ')[1] || 
                 '';
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify token and get company code
    const payload = await verifyAuth(token);
    
    if (!payload || !payload.companyCode) {
      return res.status(401).json({ error: 'Invalid authentication or missing company code' });
    }
    
    // Get company-specific database name
    const companyDbName = `company_${payload.companyCode.toLowerCase()}`;

    // Get database schema if not provided
    let dbSchemas = schemas;
    if (!dbSchemas) {
      dbSchemas = await getDBSchemas(companyDbName);
    }

    // Generate MongoDB query using Claude
    const mongoQuery = await generateMongoDBQuery(prompt, dbSchemas);

    // Execute the query against MongoDB
    const queryResults = await executeMongoDBQuery(mongoQuery, companyDbName);

    return res.status(200).json({
      success: true,
      prompt,
      generatedQuery: mongoQuery,
      results: queryResults
    });
  } catch (error) {
    console.error('Error generating or executing query:', error);
    return res.status(500).json({
      error: 'An error occurred while processing your request',
      details: error.message
    });
  }
}

async function getDBSchemas(companyDbName) {
  let client;
  try {
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(companyDbName);
    
    // Get all collections in the database
    const collections = await db.listCollections().toArray();
    
    // For each collection, get a sample document to infer schema
    const schemas = {};
    
    for (const collection of collections) {
      const collectionName = collection.name;
      const sampleDocs = await db.collection(collectionName).find().limit(2).toArray();
      
      if (sampleDocs.length > 0) {
        // Infer schema from sample documents
        schemas[collectionName] = {
          fields: Object.keys(sampleDocs[0]),
          sampleDocument: sampleDocs[0]
        };
      }
    }
    
    return schemas;
  } catch (error) {
    console.error('Error fetching database schemas:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

async function generateMongoDBQuery(prompt, schemas) {
  try {
    const systemPrompt = `You are a MongoDB query expert. Your task is to convert natural language prompts into valid MongoDB queries. 
    
    Here is the database schema information:
    ${JSON.stringify(schemas, null, 2)}
    
    Based on this schema, generate a MongoDB query that would answer the user's request. 
    Return ONLY the executable MongoDB query as a JavaScript object without any explanation or markdown. 
    The query should include the collection name, the find/aggregate parameters, and any projection, sort, or limit operations needed.
    
    IMPORTANT: Format your response as a valid JavaScript object that can be directly parsed and executed.
    IMPORTANT: DO NOT include any commentary or explanation - just the query object.
    IMPORTANT: If the request is ambiguous, make reasonable assumptions based on the schema.
    `;

    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1000,
      temperature: 0,
      system: systemPrompt,
      messages: [
        { role: "user", content: prompt }
      ]
    });

    // Extract and parse the query from Claude's response
    const queryText = response.content[0].text;
    
    // Clean up the response to ensure it's valid JavaScript
    const cleanedQuery = queryText.replace(/```javascript|```js|```|^\s*\{|\}\s*$/g, '').trim();
    
    // Parse the query
    const mongoQuery = eval(`(${cleanedQuery})`);
    return mongoQuery;
  } catch (error) {
    console.error('Error generating MongoDB query:', error);
    throw error;
  }
}

async function executeMongoDBQuery(queryObj, companyDbName) {
  let client;
  try {
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(companyDbName);
    
    const { collection, operation, query, options } = queryObj;
    
    if (!collection || !operation) {
      throw new Error('Invalid query: missing collection or operation');
    }
    
    const coll = db.collection(collection);
    
    // Execute the appropriate MongoDB operation
    switch (operation) {
      case 'find':
        return await coll.find(query || {}, options || {}).toArray();
      
      case 'findOne':
        return await coll.findOne(query || {}, options || {});
      
      case 'aggregate':
        return await coll.aggregate(query || []).toArray();
      
      case 'count':
        return await coll.countDocuments(query || {});
      
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  } catch (error) {
    console.error('Error executing MongoDB query:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
} 