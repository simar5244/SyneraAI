import { MongoClient, ObjectId } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize MongoDB connection parameters
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || "org_sim_db";
const AUTOMATED_REPORTS_COLLECTION_NAME = "automated_reports";
const GENERATED_REPORTS_COLLECTION_NAME = "generated_reports";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // API key validation for security when called by cron
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  let client;
  
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }
    
    // Parse request body
    const { reportId } = req.body;
    
    if (!reportId) {
      return res.status(400).json({ error: 'Report ID is required' });
    }
    
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    const automatedReportsCollection = db.collection(AUTOMATED_REPORTS_COLLECTION_NAME);
    const generatedReportsCollection = db.collection(GENERATED_REPORTS_COLLECTION_NAME);
    
    // Find the report configuration
    const reportConfig = await automatedReportsCollection.findOne({
      _id: new ObjectId(reportId)
    });
    
    if (!reportConfig) {
      return res.status(404).json({ error: 'Report configuration not found' });
    }
    
    console.log(`Generating report: ${reportConfig.title}`);
    
    // Step 1: Get database schema
    const dbSchemas = await getDBSchemas(client, DB_NAME);
    
    // Step 2: Generate database queries using Claude
    const reportSpec = reportConfig.reportSpecification;
    const queries = await generateQueries(reportSpec, dbSchemas);
    
    // Step 3: Execute each query and collect results
    const queryResults = await executeQueries(client, db, queries);
    
    // Step 4: Generate the report using Gemini
    const report = await generateReport(reportConfig, queryResults);
    
    // Step 5: Save the generated report
    const now = new Date();
    const generatedReport = {
      automatedReportId: new ObjectId(reportId),
      title: reportConfig.title,
      content: report.content,
      charts: report.charts || [],
      queryResults: queryResults,
      generatedAt: now,
      createdAt: now,
      updatedAt: now
    };
    
    const result = await generatedReportsCollection.insertOne(generatedReport);
    
    // Step 6: Update the automated report with next generation date
    await automatedReportsCollection.updateOne(
      { _id: new ObjectId(reportId) },
      {
        $set: {
          lastGeneratedAt: now,
          nextGenerationDate: calculateNextGenerationDate(reportConfig.frequency, reportConfig.customFrequency),
          lastGeneratedReportId: result.insertedId,
          updatedAt: now
        }
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Report generated successfully',
      reportId: result.insertedId.toString()
    });
    
  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({
      error: 'An error occurred while generating the report',
      details: error instanceof Error ? error.message : String(error)
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Function to get database schemas
async function getDBSchemas(client, dbName) {
  try {
    const db = client.db(dbName);
    
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
  }
}

// Function to generate queries using Claude
async function generateQueries(reportSpec, dbSchemas) {
  try {
    // Make request to Claude query generator endpoint
    const claudeQueries = [
      // Main organization queries
      { 
        prompt: `Generate a query to get overall employee attrition risk metrics (high, medium, low risk counts)`,
        category: "attrition" 
      },
      { 
        prompt: `Generate a query to get detailed information on high-risk employees including their projects, skills, and performance ratings`,
        category: "high_risk_employees" 
      },
      { 
        prompt: `Generate a query to get employee utilization scores, grouped by department, with average, min, and max values`,
        category: "utilization" 
      },
      { 
        prompt: `Generate a query to get project data including project status, timeline, and assigned employees`,
        category: "projects" 
      },
      // Department specific queries (for each department section of the report)
      { 
        prompt: `Generate a query to get all departments with their manager names and employee counts`,
        category: "departments" 
      },
      // Time period analysis
      { 
        prompt: `Generate a query to get KPI trends over the last year, grouped by quarter`,
        category: "trends" 
      }
    ];
    
    // For each query prompt, call the Claude query generator
    const queryPromises = claudeQueries.map(async (querySpec) => {
      const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/llm/claude-query-generator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: querySpec.prompt,
          schemas: dbSchemas
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to generate query for ${querySpec.category}: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      return {
        ...querySpec,
        generatedQuery: data.generatedQuery
      };
    });
    
    return await Promise.all(queryPromises);
  } catch (error) {
    console.error('Error generating queries with Claude:', error);
    throw error;
  }
}

// Function to execute the generated queries
async function executeQueries(client, db, queries) {
  try {
    const results = {};
    
    for (const querySpec of queries) {
      const { category, generatedQuery } = querySpec;
      
      // Execute the query
      const { collection, operation, query, options } = generatedQuery;
      const coll = db.collection(collection);
      
      let data;
      // Execute the appropriate MongoDB operation
      switch (operation) {
        case 'find':
          data = await coll.find(query || {}, options || {}).toArray();
          break;
        
        case 'findOne':
          data = await coll.findOne(query || {}, options || {});
          break;
        
        case 'aggregate':
          data = await coll.aggregate(query || []).toArray();
          break;
        
        case 'count':
          data = await coll.countDocuments(query || {});
          break;
        
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
      
      results[category] = {
        data,
        query: generatedQuery
      };
    }
    
    return results;
  } catch (error) {
    console.error('Error executing queries:', error);
    throw error;
  }
}

// Function to generate the report using Gemini
async function generateReport(reportConfig, queryResults) {
  try {
    // Configure the Gemini model for report generation
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Create a structured prompt for Gemini
    const reportPrompt = `
You are tasked with generating a comprehensive executive-level report on organizational metrics. 
This report should be detailed, well-structured, and provide actionable insights.

REPORT SPECIFICATION:
Title: ${reportConfig.title}
Description: ${reportConfig.description || "Comprehensive organizational report"}

AVAILABLE DATA:
${JSON.stringify(queryResults, null, 2)}

REPORT REQUIREMENTS:
1. Create a comprehensive 10+ page report with the following sections:
   - Executive Summary (1 page)
   - Overall Organizational Health (2-3 pages)
   - Department-Specific Analysis (2 pages per department)
   - Employee Attrition Risk Analysis (2 pages)
   - Project Status and Timeline (1-2 pages)
   - Recommendations and Action Items (1 page)

2. For each section:
   - Include relevant metrics and KPIs
   - Provide analysis of trends and patterns
   - Highlight areas of concern or opportunity
   - Include specific examples of high-risk employees or critical projects

3. For visualizations:
   - Suggest chart configurations for key metrics
   - Specify chart type, labels, data points, and colors
   - For each chart, provide a data structure compatible with Chart.js

4. Include time period analysis:
   - Overall metrics
   - Year-to-date comparison
   - Quarter-over-quarter trends

5. Format the report with appropriate headings, subheadings, bullet points, and tables.

RESPONSE FORMAT:
Return a JSON object with the following structure:
{
  "title": "Report title",
  "content": "Full report content with markdown formatting",
  "charts": [
    {
      "id": "unique-chart-id",
      "title": "Chart title",
      "type": "bar|line|pie|etc",
      "data": {
        // Chart.js compatible data structure
      },
      "options": {
        // Chart.js options
      }
    }
  ]
}
`;

    // Generate the report with Gemini
    const result = await model.generateContent(reportPrompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse the JSON response
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('Error parsing Gemini response as JSON:', error);
      // Return a basic structure if parsing fails
      return {
        title: reportConfig.title,
        content: text,
        charts: []
      };
    }
  } catch (error) {
    console.error('Error generating report with Gemini:', error);
    throw error;
  }
}

// Helper function to calculate next generation date
function calculateNextGenerationDate(frequency, customFrequency) {
  const now = new Date();
  let nextDate = new Date(now);
  
  switch(frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'custom':
      if (customFrequency?.value && customFrequency?.unit) {
        switch(customFrequency.unit) {
          case 'days':
            nextDate.setDate(nextDate.getDate() + customFrequency.value);
            break;
          case 'weeks':
            nextDate.setDate(nextDate.getDate() + (customFrequency.value * 7));
            break;
          case 'months':
            nextDate.setMonth(nextDate.getMonth() + customFrequency.value);
            break;
          default:
            nextDate.setDate(nextDate.getDate() + 30); // Default to 30 days
        }
      } else {
        nextDate.setDate(nextDate.getDate() + 30); // Default to 30 days
      }
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1); // Default to monthly
  }
  
  return nextDate;
} 