import { MongoClient } from 'mongodb';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import claudeQuery from './claude-query.js'; // Import the claude-query module with explicit extension
import { verifyAuth } from '@/lib/auth';
import { fetchWebsiteContext } from './website-utils.js';

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const DATA_COLLECTION_NAME = "users";
const REPORT_HISTORY_COLLECTION_NAME = "report_history";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_NAME = "gemini-2.0-flash-001";
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = "claude-3-7-sonnet-20250219";

// Configure safety settings for Gemini
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  console.log("=== REPORT GENERATION API CALLED ===");
  console.log("Operation:", req.body.operation || 'not specified');
  
  let client;
  try {
    const reportParams = req.body;
    
    // Check the operation type
    const operationType = reportParams.operation || 'prefetch';
    console.log(`Processing ${operationType} operation`);
    
    if (!reportParams || !reportParams.reportTopic && operationType !== 'modify' && operationType !== 'export' && operationType !== 'save') {
      console.log("Error: Missing report topic");
      return res.status(400).json({ error: 'Report topic is required' });
    }

    // Handle export requests
    if (operationType === 'export' || (reportParams.exportFormat && reportParams.reportContent)) {
      return await handleExport(reportParams, res);
    }
    
    // Handle save requests
    if (operationType === 'save') {
      // Pass the headers to ensure the token is available
      reportParams.headers = req.headers;
      return await handleSave(reportParams, res);
    }
    
    // Handle report modification requests
    if (operationType === 'modify') {
      await handleModification(reportParams, res);
      return;
    }

    // Initialize Google Generative AI client
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME, safetySettings });
    
    // Initialize Claude client if needed for fallback
    let claudeClient = null;
    if (CLAUDE_API_KEY) {
      claudeClient = new Anthropic({
        apiKey: CLAUDE_API_KEY,
      });
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

    // Connect to MongoDB
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }
    client = await MongoClient.connect(MONGODB_URI);
    
    // Get company-specific database
    const companyDbName = `company_${payload.companyCode.toLowerCase()}`;
    const companyDb = client.db(companyDbName);
    const dataCollection = companyDb.collection(DATA_COLLECTION_NAME);
    const reportHistoryCollection = companyDb.collection(REPORT_HISTORY_COLLECTION_NAME);

    // Generate a unique report ID
    const reportId = reportParams.reportId || new Date().getTime().toString();
    
    // Special session ID for this report generation
    const session_id = `report_${reportId}`;
    
    // STEP 1: PREFETCH - Use claude-query to get data from database
    if (operationType === 'prefetch') {
      // Use the predefined prompt if available, otherwise create a default one
      const reportQuery = reportParams.predefinedPrompt || `I need VERY comprehensive, detailed information for a report about: ${reportParams.reportTopic}. 
Please be extremely thorough and provide all available data including metrics, statistics, people details, project information, and performance indicators.
Include specific numbers, dates, status information, and detailed context that would be valuable for a professional business report. 
Be as specific and data-rich as possible.
Also cite your data by giving exact pinpoint references to exact data files in the database. Use either APA/MLA/Casual citing depending on the type of report
Also, mention the number of records you used briefly (without being too specific about implementation details).`;

      // Call claude-query handler directly (with a mock request/response)
      const mockReq = { 
        method: 'POST', 
        body: { 
          query: reportQuery,
          session_id
        },
        cookies: { token },
        headers: req.headers
      };
      
      let claudeResponse = { response: "", error: null };
      const mockRes = {
        status: (code) => ({ 
          json: (data) => {
            claudeResponse = data;
            return mockRes;
          }
        })
      };
      
      // Call claude-query to get the data
      await claudeQuery(mockReq, mockRes);
      
      // Track database sources for the report (from claude-query response)
      const dbSourceInfo = extractSourceInfo(claudeResponse.response);
      
      // Fetch contextual information from web if website is provided
      let webContext = null;
      let webData = null;
      if (reportParams.website) {
        try {
          const webResult = await fetchWebsiteContext(reportParams.website);
          webContext = webResult.content;
          webData = webResult.data;
        } catch (webError) {
          console.error("Error fetching website context:", webError);
          webContext = `Failed to fetch website context: ${webError.message || 'Unknown error'}`;
        }
      }
      
      // Extract structured data from the text response for visualization preview
      const extractedData = extractDataFromText(claudeResponse.response);
      
      // Return the prefetched data for approval
      return res.status(200).json({
        reportId,
        claudeResponse,
        webContext,
        webData,
        dbSourceInfo,
        previewVisualizations: [],
        extractedData
      });
    }
    
    // STEP 2: GENERATE - Generate the report using the approved data without querying the DB again
    else if (operationType === 'generate') {
      // Use the approved data from the request
      if (!reportParams.approvedData) {
        return res.status(400).json({ error: 'Approved data is required for report generation' });
      }
      
      console.log("Starting report generation with approved data");
      const finalResults = reportParams.approvedData;
      const approvedWebContext = reportParams.approvedWebContext || null;
      const approvedWebData = reportParams.approvedWebData || null;
      const approvedDbSourceInfo = reportParams.approvedDbSourceInfo || null;
      
      // Extract structured data from the text response
      console.log("Extracting structured data from approved data");
      const extractedData = extractDataFromText(finalResults);
      console.log("Extracted data structure:", Object.keys(extractedData));
      
      //-------------------------------------------------------------------------
      // Generate Report (Gemini with Claude fallback, no validation loop)
      //-------------------------------------------------------------------------
      console.log("Generating report with Gemini (Claude fallback if needed)");
      
      let reportContent = null;
      
      // Create report prompt
      const reportPrompt = `You are an expert business report writer. Create a detailed, well-structured report based on the following data.

REPORT TOPIC: ${reportParams.reportTopic}
COMPANY: ${reportParams.company || "The organization"}
TARGET AUDIENCE: ${reportParams.targetAudience || "Business executives"}
WORD COUNT: ${reportParams.wordCount || "500-800"} words
TIMEFRAME: ${reportParams.timeframe || "Current"}

DATA FROM AI ANALYSIS:
${finalResults}

${approvedWebContext ? `ADDITIONAL CONTEXT FROM WEBSITE:
${approvedWebContext.substring(0, 1000)}` : ""}

REQUIREMENTS:
1. Create a comprehensive business report with a clear title, executive summary, and structured sections
2. Include specific data points, metrics, and findings from the provided information
3. Maintain a professional tone appropriate for ${reportParams.targetAudience || "business executives"}
4. Format the report using markdown (# for main headings, ## for subheadings, etc.)
5. PRESERVE ALL FORMATTING from the original text, including bold and italic text
6. DO NOT make up or invent ANY additional data not explicitly mentioned in the source
7. Include a "References" section at the end citing the data sources
8. CRITICAL: Only use facts and figures that are explicitly stated in the provided data - do not invent numbers or statistics

Your response must be a valid JSON object with the following structure:
{
  "title": "The report title",
  "content": "The full report content in markdown format with preserved formatting"
}
`;

      try {
        console.log("Attempting report generation with Gemini");
        const reportResult = await model.generateContent(reportPrompt);
        const reportResponse = reportResult.response.text();
        
        // Extract JSON from response
        const jsonMatch = reportResponse.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          try {
            reportContent = JSON.parse(jsonMatch[0]);
            console.log("Gemini successfully generated report");
          } catch (parseError) {
            console.error("Error parsing report JSON from Gemini:", parseError);
          }
        }
      } catch (genError) {
        console.error("Error in Gemini report generation:", genError);
      }
      
      // If Gemini fails, try Claude
      if (!reportContent && claudeClient) {
        console.log("Gemini report generation failed, trying Claude");
        
        try {
          const claudeReportResponse = await claudeClient.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 4000,
            messages: [
              {
                role: "user",
                content: reportPrompt
              }
            ]
          });
          
          const claudeText = claudeReportResponse.content[0].text;
          const claudeJsonMatch = claudeText.match(/\{[\s\S]*\}/);
          
          if (claudeJsonMatch) {
            reportContent = JSON.parse(claudeJsonMatch[0]);
            console.log("Claude successfully generated report");
          } else {
            // Direct extraction if JSON parsing fails
            reportContent = {
              title: reportParams.reportTopic,
              content: claudeText
            };
            console.log("Using Claude's raw response as report content");
          }
        } catch (claudeError) {
          console.error("Error with Claude report generation:", claudeError);
        }
      }
      
      // Last resort if both LLMs fail
      if (!reportContent) {
        console.log("Both LLMs failed to generate report, using fallback");
        reportContent = {
          title: reportParams.reportTopic,
          content: finalResults
        };
      }
      
      // Ensure references section exists
      if (!reportContent.content.includes("# References")) {
        reportContent.content += `

# References

1. ${approvedDbSourceInfo?.description || 'Organizational database'} (Generated on ${new Date().toLocaleDateString()})
${approvedWebData ? `2. Website: ${approvedWebData.url || reportParams.website} (Title: ${approvedWebData.title || 'Not available'})` : ''}
`;
      }
      
      console.log("Report content generated successfully");
      
      //-------------------------------------------------------------------------
      // Generate visualizations (Gemini with Claude fallback, no validation loop)
      //-------------------------------------------------------------------------
      console.log("Generating visualizations (Gemini with Claude fallback)");
      
      let visualizationConfigs = [];
      
      if (reportParams.customVisualizations) {
        // Use custom visualizations if provided
        console.log("Using custom visualizations provided in request");
        visualizationConfigs = reportParams.customVisualizations;
      } else {
        // Check if additionalContext contains specific visualization requests
        let specificVisualizations = null;
        let visualizationCount = null;
        let skipVisualizations = false;
        
        if (reportParams.additionalContext) {
          const additionalContext = reportParams.additionalContext.toLowerCase();
          
          // Check for "no charts" or "no visualizations" in additionalContext
          if (
            additionalContext.includes("no chart") || 
            additionalContext.includes("no visualization") || 
            additionalContext.includes("no graphs") ||
            additionalContext.includes("without chart") ||
            additionalContext.includes("without visualization") ||
            additionalContext.includes("without graph") ||
            additionalContext.includes("don't include chart") ||
            additionalContext.includes("don't include visualization") ||
            additionalContext.includes("do not include chart") ||
            additionalContext.includes("do not include visualization")
          ) {
            console.log("User requested no visualizations in additionalContext");
            skipVisualizations = true;
          }
          
          // Check for specific chart types
          const chartTypes = ["bar", "pie", "line", "doughnut", "radar", "scatter", "polar"];
          const requestedCharts = [];
          
          chartTypes.forEach(chartType => {
            if (additionalContext.includes(`${chartType} chart`) || 
                additionalContext.includes(`${chartType} graph`) || 
                additionalContext.includes(`${chartType} visualization`)) {
              requestedCharts.push(chartType);
            }
          });
          
          if (requestedCharts.length > 0) {
            specificVisualizations = requestedCharts;
            console.log("User requested specific visualization types:", specificVisualizations);
          }
          
          // Check for visualization count
          const countRegex = /(\d+)\s+(charts|visualizations|graphs)/i;
          const countMatch = additionalContext.match(countRegex);
          
          if (countMatch) {
            visualizationCount = parseInt(countMatch[1], 10);
            console.log(`User requested ${visualizationCount} visualizations`);
          }
        }
        
        // Skip visualization generation if explicitly requested
        if (skipVisualizations) {
          console.log("Skipping visualization generation as per user request");
          visualizationConfigs = [];
        } else {
          const vizPrompt = `
You are an expert data scientist specializing in data visualization and Chart.js.

TASK:
Analyze the following text, extract structured data, and create JSON configurations for Chart.js visualizations.

TEXT TO ANALYZE:
${finalResults}

REQUIREMENTS:
1. Carefully analyze the text to identify meaningful data that can be visualized
2. Design visualizations that provide genuine business insights
3. Create complete Chart.js configuration objects for each visualization
4. Use appropriate chart types based on the data characteristics
5. DO NOT make up or invent any data not present in the text
6. Extract only explicit numerical data from the text - NEVER invent values
7. ONLY create visualizations for data that has clear numeric values in the text
${specificVisualizations ? `8. ONLY create visualizations of these specific types: ${specificVisualizations.join(', ')}` : ''}
${visualizationCount ? `8. Create EXACTLY ${visualizationCount} visualizations - no more, no less` : ''}

CHART TYPES:
${specificVisualizations ? 
  specificVisualizations.map(type => `- ${type} charts`).join('\n') : 
  `- bar charts for comparing categories
- pie/doughnut charts for showing proportions
- line charts for trends or time series
- radar charts for multi-dimension comparisons
- scatter plots for correlations`
}

Each visualization configuration should be a valid Chart.js configuration object with:
1. type: Chart type (bar, line, pie, etc.)
2. title: A descriptive title
3. description: Brief explanation of the insight this visualization provides
4. data: Object containing:
   - labels: Array of category labels
   - datasets: Array of dataset objects with data values
5. options: Chart.js configuration options

ONLY return an array of visualization configurations as a valid JSON array. Do not include any explanations or additional text.
`;

          try {
            // Try with Gemini first
            console.log("Attempting visualization generation with Gemini");
            const vizResult = await model.generateContent(vizPrompt);
            const vizResponse = vizResult.response.text();
            
            // Extract JSON array from response
            const arrayMatch = vizResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
            
            if (arrayMatch) {
              try {
                // Clean up the JSON string to fix common issues
                let jsonStr = arrayMatch[0];
                // Replace function references with string placeholders
                jsonStr = jsonStr.replace(/"label"\s*:\s*function\s*\([^)]*\)\s*\{[^}]*\}/g, '"label": "[Function]"');
                jsonStr = jsonStr.replace(/function\s*\([^)]*\)\s*\{[^}]*\}/g, '"[Function]"');
                
                const parsedViz = JSON.parse(jsonStr);
                
                if (Array.isArray(parsedViz) && parsedViz.length > 0) {
                  visualizationConfigs = parsedViz;
                  
                  // Limit to requested count if specified
                  if (visualizationCount && visualizationConfigs.length > visualizationCount) {
                    visualizationConfigs = visualizationConfigs.slice(0, visualizationCount);
                  }
                  
                  console.log(`Gemini generated ${visualizationConfigs.length} visualizations`);
                }
              } catch (parseError) {
                console.error("Error parsing visualization JSON from Gemini:", parseError);
              }
            }
          } catch (vizError) {
            console.error("Error in Gemini visualization generation:", vizError);
          }
          
          // If Gemini fails, try Claude
          if (visualizationConfigs.length === 0 && claudeClient) {
            console.log("Gemini visualization generation failed, trying Claude");
            
            try {
              const claudeVizResponse = await claudeClient.messages.create({
                model: CLAUDE_MODEL,
                max_tokens: 4000,
                messages: [
                  {
                    role: "user",
                    content: vizPrompt
                  }
                ]
              });
              
              const claudeVizText = claudeVizResponse.content[0].text;
              const claudeArrayMatch = claudeVizText.match(/\[\s*\{[\s\S]*\}\s*\]/);
              
              if (claudeArrayMatch) {
                try {
                  visualizationConfigs = JSON.parse(claudeArrayMatch[0]);
                  
                  // Limit to requested count if specified
                  if (visualizationCount && visualizationConfigs.length > visualizationCount) {
                    visualizationConfigs = visualizationConfigs.slice(0, visualizationCount);
                  }
                  
                  console.log(`Claude generated ${visualizationConfigs.length} visualizations`);
                } catch (parseError) {
                  console.error("Error parsing visualization JSON from Claude:", parseError);
                  visualizationConfigs = [];
                }
              }
            } catch (claudeVizError) {
              console.error("Error with Claude visualization generation:", claudeVizError);
            }
          }
        }
      }
      
      console.log(`Final visualization count: ${visualizationConfigs.length}`);
      
      // Save report to history
      await saveReportToHistory(reportHistoryCollection, reportId, reportParams, reportContent);
      
      // Return the generated report with all necessary data for rendering
      console.log("Sending report response to client");
      console.log("Report structure:", {
        title: reportContent.title ? "Present" : "Missing",
        contentLength: reportContent.content ? reportContent.content.length : 0,
        visualizationsCount: visualizationConfigs ? visualizationConfigs.length : 0
      });
      
      return res.status(200).json({ 
        reportId,
        title: reportContent.title,
        content: reportContent.content,
        charts: visualizationConfigs, // Use 'charts' for consistency with the ReportRenderer
        visualizations: visualizationConfigs, // Keep 'visualizations' for backward compatibility
        webData: approvedWebData,
        dbSourceInfo: approvedDbSourceInfo,
        extractedData,
        queryResults: { "searchResults": extractedData }
      });
    }
    
    // Unknown operation
    else {
      return res.status(400).json({ error: 'Invalid operation type' });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      details: errorMessage
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Handle report modification requests (chat interface)
async function handleModification(params, res) {
  // Alias for backward compatibility with existing code.
  const reportParams = params;

  // Ensure variables are declared to avoid ReferenceErrors in fallback paths
  let approvedDbSourceInfo = null;
  let approvedWebData = null;
  let visualizationConfigs = [];
  try {
    // Initialize Gemini
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME, safetySettings });
    
    // Initialize Claude if available
    let claudeClient = null;
    if (CLAUDE_API_KEY) {
      claudeClient = new Anthropic({
        apiKey: CLAUDE_API_KEY,
      });
    }
    
    // Check if we need to query the database
    const needsDbQuery = params.userMessage.toLowerCase().includes('data') || 
                        params.userMessage.toLowerCase().includes('numbers') || 
                        params.userMessage.toLowerCase().includes('statistics') ||
                        params.userMessage.toLowerCase().includes('information');
    
    let dbQueryResults = null;
    
    // If needed, query the database using claude-query
    if (needsDbQuery && params.token) {
      const session_id = `report_${params.reportId}_modification`;
      
      // Call claude-query handler directly
      const mockReq = { 
        method: 'POST', 
        body: { 
          query: params.userMessage,
          session_id
        },
        cookies: { token: params.token },
        headers: { authorization: `Bearer ${params.token}` }
      };
      
      let claudeResponse = { response: "", error: null };
      const mockRes = {
        status: (code) => ({ 
          json: (data) => {
            claudeResponse = data;
            return mockRes;
          }
        })
      };
      
      // Call claude-query to get the data
      await claudeQuery(mockReq, mockRes);
      dbQueryResults = claudeResponse.response;
    }
    
    // Prepare the prompt for the modification
    const prompt = `You are an expert report editor. The user has a business report and wants to make modifications to it.

CURRENT REPORT:
Title: ${params.reportTitle || "Report"}
Content: ${params.reportContent ? params.reportContent.substring(0, 3000) + "..." : "No content provided"}

USER REQUEST:
${params.userMessage}

${dbQueryResults ? `ADDITIONAL DATA FROM DATABASE:
${dbQueryResults}` : ''}

VISUALIZATIONS:
${params.visualizations ? JSON.stringify(params.visualizations.slice(0, 3)) : "No visualizations provided"}

TASK:
1. Understand what changes the user wants to make to the report
2. Provide a helpful response addressing their request
3. If they want content changes, suggest specific edits or additions
4. If they want visualization changes, suggest specific modifications to the charts
5. Be specific and actionable in your suggestions

Return a JSON object with:
{
  "response": "Your helpful response to the user",
  "contentEdits": {
    "shouldEdit": true/false,
    "newTitle": "New title if applicable",
    "newContent": "New content if applicable or null if no changes"
  },
  "visualizationEdits": {
    "shouldEdit": true/false,
    "editedVisualizations": [] // Array of edited visualizations if applicable
  }
}`;

    // Generate the response
    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Extract the JSON object from the response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      let reportJson = null;
      
      console.log("Attempting to parse LLM response into JSON");
      console.log("Response length:", responseText.length);
      console.log("First 100 chars:", responseText.substring(0, 100).replace(/\n/g, "\\n"));
      console.log("Last 100 chars:", responseText.substring(responseText.length - 100).replace(/\n/g, "\\n"));
      
      // If regex match found, try to parse it
      if (jsonMatch) {
        console.log("JSON match found, length:", jsonMatch[0].length);
        console.log("JSON match first 100 chars:", jsonMatch[0].substring(0, 100).replace(/\n/g, "\\n"));
        
        try {
          // Attempt to parse the JSON using our helper function
          reportJson = fixMalformedJson(jsonMatch[0]);
          console.log("Successfully parsed JSON from LLM response");
          console.log("JSON structure:", Object.keys(reportJson));
        } catch (jsonError) {
          console.error("Failed to parse JSON from Gemini response:", jsonError);
          console.log("Error position:", jsonError.message);
          // Continue to alternative extraction methods
        }
      } else {
        console.log("No JSON match found in LLM response");
      }
      
      // If we have a valid report JSON, add References section if needed
      if (reportJson && reportJson.content) {
        // Ensure the report has a References section if it doesn't already
        if (!reportJson.content.includes("# References")) {
          reportJson.content += `

# References

1. ${approvedDbSourceInfo?.description || 'Organizational database'} (Generated on ${new Date().toLocaleDateString()})
${approvedWebData ? `2. Website: ${approvedWebData.url || params.website} (Title: ${approvedWebData.title || 'Not available'})` : ''}
`;
        }
        
        return reportJson;
      }
      
      // If JSON parsing failed, try direct content extraction
      console.log("JSON parsing failed, trying direct content extraction");
      const extractedReport = extractContentFromResponse(responseText, reportParams, approvedDbSourceInfo, approvedWebData);
      extractedReport.visualizations = visualizationConfigs;
      return extractedReport;
    } catch (error) {
      console.error("Error generating report content:", error);
      // Return a default report on error
      return {
        title: `Report on ${reportParams.reportTopic}`,
        content: "# Executive Summary\n\nThis is a placeholder report. The report generation is currently unavailable.\n\n# References\n\n1. Organizational database",
        visualizations: visualizationConfigs
      };
    }
  } catch (error) {
    console.error("Error in report content generation:", error);
    return {
      title: `Report on ${reportParams.reportTopic}`,
      content: "# Error\n\nAn error occurred while generating this report.\n\n# References\n\n1. Organizational database",
      visualizations: []
    };
  }
}

// Save the generated report to history
async function saveReportToHistory(collection, reportId, reportParams, reportContent) {
  try {
    const reportRecord = {
      report_id: reportId,
      title: reportContent.title,
      topic: reportParams.reportTopic,
      company: reportParams.company,
      created_at: new Date(),
      word_count: reportParams.wordCount,
      target_audience: reportParams.targetAudience,
      timeframe: reportParams.timeframe,
      delivery_format: reportParams.deliveryFormat,
      has_visualizations: reportParams.includeVisuals,
      companyCode: reportParams.companyCode // Ensure company code is stored for multi-tenancy
    };
    
    await collection.insertOne(reportRecord);
    return true;
  } catch (error) {
    console.error("Error saving report to history:", error);
    return false;
  }
}

// Handle export requests
async function handleExport(params, res) {
  try {
    const { exportFormat, reportContent, reportTitle, visualizations } = params;
    
    if (!exportFormat || !reportContent) {
      return res.status(400).json({ error: 'Export format and report content are required' });
    }
    
    let result;
    
    switch (exportFormat.toLowerCase()) {
      case 'pdf':
        result = await generatePDF(reportContent, reportTitle, visualizations);
        
        // Return file as buffer
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        return res.status(200).send(result.buffer);
        
      case 'docx':
        result = await generateDOCX(reportContent, reportTitle, visualizations);
        
        // Return file as buffer
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        return res.status(200).send(result.buffer);
        
      default:
        return res.status(400).json({ error: `Unsupported export format: ${exportFormat}` });
    }
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate export',
      details: error.message || 'Unknown error'
    });
  }
}

// Generate PDF from report content - simplified approach that leverages DOCX export
async function generatePDF(reportContent, reportTitle, visualizations = []) {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const util = require('util');
  const exec = util.promisify(require('child_process').exec);
  
  try {
    // Pre-process the HTML content to remove tags
    const cleanedReportContent = cleanHtmlContent(reportContent);
    
    console.log('Generating PDF from DOCX for consistent formatting');
    
    // First generate the DOCX version
    const docxResult = await generateDOCX(cleanedReportContent, reportTitle, visualizations);
    
    // Create PDF filename
    const sanitizedTitle = sanitizeFilename(reportTitle || 'Report');
    const pdfFilename = `${sanitizedTitle}_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfPath = path.join(os.tmpdir(), pdfFilename);
    
    // Use libreoffice to convert DOCX to PDF if available
    try {
      // Check if libreoffice is installed
      await exec('which libreoffice');
      
      // Use libreoffice to convert DOCX to PDF
      await exec(`libreoffice --headless --convert-to pdf --outdir ${os.tmpdir()} ${docxResult.path}`);
      
      // Read the generated PDF
      const pdfBuffer = await fs.promises.readFile(pdfPath);
      
      return {
        buffer: pdfBuffer,
        filename: pdfFilename,
        path: pdfPath
      };
    } catch (conversionError) {
      console.log('LibreOffice not available, falling back to PDF generation from scratch');
      
      // If libreoffice is not available, use a PDF generation library
      const PDFDocument = require('pdfkit');
      
      return new Promise((resolve, reject) => {
        try {
          // Clean the content before processing
          let cleanedContent = cleanedReportContent;
          // Remove duplicate headings
          const mainTitle = reportTitle.trim();
          const shortTitleRegex = new RegExp(`^#+\s+${mainTitle.split(' ').slice(0, 3).join('\s+.*?')}.*?$`, 'gm');
          cleanedContent = cleanedContent.replace(shortTitleRegex, '');
          
          // Remove markdown formatting from headings and paragraphs
          cleanedContent = cleanedContent
            .replace(/\*\*\*Executive Summary\*\*\*/g, 'Executive Summary')
            .replace(/\*\*Executive Summary\*\*/g, 'Executive Summary')
            .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1');
          
          // Create a PDF document
          const doc = new PDFDocument({
            margins: { top: 72, bottom: 72, left: 72, right: 72 },
            info: { Title: reportTitle }
          });
          
          // Buffer to hold the PDF data
          const chunks = [];
          doc.on('data', chunk => chunks.push(chunk));
          
          // When the PDF is finished
          doc.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({
              buffer: buffer,
              filename: pdfFilename,
              path: pdfPath
            });
          });
          
          // Set font to Times New Roman
          doc.font('Times-Roman');
          doc.fontSize(12);
          
          // Add title - larger and bold
          doc.fontSize(20).font('Times-Bold').text(reportTitle, { align: 'center' });
          doc.moveDown(2);
          
          // Process the content - simplified version
          const lines = cleanedContent.split('\n');
          
          // Track if we're in the References section
          let inReferencesSection = false;
          
          lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
              doc.moveDown(0.5);
              return;
            }
            
            // Handle headings - ensure all headings are bold
            if (trimmedLine.startsWith('# ')) {
              // Check if this is the References section
              if (trimmedLine.replace(/^# /, '').trim() === 'References') {
                inReferencesSection = true;
              } else if (trimmedLine.replace(/^# /, '').trim() !== 'References' && inReferencesSection) {
                // We've moved to a new section after References
                inReferencesSection = false;
              }
              
              doc.font('Times-Bold').fontSize(16);
              doc.text(trimmedLine.replace(/^# /, ''));
              doc.font('Times-Roman').fontSize(12);
              doc.moveDown(1);
            } 
            else if (trimmedLine.startsWith('## ')) {
              // Check if this is the References section
              if (trimmedLine.replace(/^## /, '').trim() === 'References') {
                inReferencesSection = true;
              } else if (trimmedLine.replace(/^## /, '').trim() !== 'References' && inReferencesSection) {
                // We've moved to a new section after References
                inReferencesSection = false;
              }
              
              doc.font('Times-Bold').fontSize(14);
              doc.text(trimmedLine.replace(/^## /, ''));
              doc.font('Times-Roman').fontSize(12);
              doc.moveDown(1);
            } 
            else if (trimmedLine.startsWith('### ')) {
              // Check if this is the References section
              if (trimmedLine.replace(/^### /, '').trim() === 'References') {
                inReferencesSection = true;
              } else if (trimmedLine.replace(/^### /, '').trim() !== 'References' && inReferencesSection) {
                // We've moved to a new section after References
                inReferencesSection = false;
              }
              
              doc.font('Times-Bold').fontSize(13);
              doc.text(trimmedLine.replace(/^### /, ''));
              doc.font('Times-Roman').fontSize(12);
              doc.moveDown(1);
            }
            // Check for section headings that might not have markdown
            else if (trimmedLine === 'Executive Summary' || 
                     trimmedLine === 'Introduction' ||
                     trimmedLine === 'Background' ||
                     trimmedLine === 'Methodology' ||
                     trimmedLine === 'Findings' ||
                     trimmedLine === 'Results' ||
                     trimmedLine === 'Discussion' ||
                     trimmedLine === 'Conclusion' ||
                     trimmedLine === 'Recommendations' ||
                     trimmedLine === 'References' ||
                     trimmedLine === 'Appendix' ||
                     trimmedLine.includes('Analysis') ||
                     trimmedLine.includes('Summary')) {
              // This looks like a heading - make it bold
              doc.font('Times-Bold').fontSize(14);
              doc.text(trimmedLine);
              doc.font('Times-Roman').fontSize(12);
              doc.moveDown(1);
            }
            // Check if this is a title-case phrase that's not in the References section
            else if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+){0,3}$/.test(trimmedLine) && 
                     !inReferencesSection) {
              // This looks like a heading - make it bold
              doc.font('Times-Bold').fontSize(14);
              doc.text(trimmedLine);
              doc.font('Times-Roman').fontSize(12);
              doc.moveDown(1);
            }
            // Handle bullet points 
            else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
              // Make sure we're using the normal font (not bold) for bullet points, especially in References
              doc.font('Times-Roman').fontSize(12);
              doc.text('• ' + trimmedLine.substring(2), { indent: 20 });
              doc.moveDown(0.5);
            }
            // Regular paragraph
            else {
              doc.text(trimmedLine);
              doc.moveDown(0.5);
            }
          });
          
          // Add visualizations if available - simplified version
          if (visualizations && visualizations.length > 0) {
            // Add a page break before visualizations
            doc.addPage();
            doc.fontSize(16).font('Times-Bold').text('Visualizations', { align: 'center' });
            doc.moveDown(2);
            
            // Import required modules for chart rendering
            const { createCanvas } = require('canvas');
            const Chart = require('chart.js/auto');
            
            // Generate and add each visualization
            for (let i = 0; i < visualizations.length; i++) {
              const viz = visualizations[i];
              if (!viz || !viz.type || !viz.data) continue;
              
              // Add visualization title
              doc.fontSize(14).font('Times-Bold').text(viz.title || `Visualization ${i+1}`);
              doc.moveDown(1);
              
              try {
                // Create a canvas for the chart
                const canvas = createCanvas(600, 400);
                const ctx = canvas.getContext('2d');
                
                // Create the chart
                const chart = new Chart(ctx, {
                  type: viz.type.toLowerCase(),
                  data: viz.data,
                  options: {
                    animation: false,
                    responsive: false,
                    plugins: {
                      legend: {
                        display: true,
                        position: 'bottom'
                      }
                    }
                  }
                });
                
                // Get the chart as a buffer
                const imageBuffer = canvas.toBuffer('image/png');
                
                // Add the chart image to the PDF
                doc.image(imageBuffer, {
                  fit: [500, 300],
                  align: 'center'
                });
                
                doc.moveDown(2);
              } catch (chartError) {
                console.error('Error generating chart:', chartError);
                doc.text('Error generating visualization', { align: 'center' });
                doc.moveDown(1);
              }
            }
          }
          
          // Finalize the PDF
          doc.end();
        } catch (error) {
          console.error('Error in fallback PDF generation:', error);
          reject(error);
        }
      });
    }
  } catch (error) {
    console.error('Error in PDF generation:', error);
    throw error;
  }
}

// Generate DOCX from report content
async function generateDOCX(reportContent, reportTitle, visualizations = []) {
  const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType, convertInchesToTwip, TableLayoutType, ImageRun } = require('docx');
  const fs = require('fs').promises;
  const os = require('os');
  const path = require('path');
  const { createCanvas } = require('canvas');
  const Chart = require('chart.js/auto');
  
  try {
    // Pre-process the HTML content to remove tags if not already done
    const cleanedReportContent = cleanHtmlContent(reportContent);
    
    // Format title for a valid filename
    const sanitizedTitle = sanitizeFilename(reportTitle || 'Report');
    const filename = `${sanitizedTitle}_${new Date().toISOString().split('T')[0]}.docx`;
    const tempPath = path.join(os.tmpdir(), filename);
    
    // Set up Times New Roman as the default font
    const defaultFont = 'Times New Roman';
    const defaultFontSize = 24; // 12pt = 24 half-points in docx
    
    // Process markdown content
    const markdown = require('marked');
    const tokenizer = new markdown.Tokenizer();
    const lexer = new markdown.Lexer();
    
    // Clean content before processing - remove duplicate headings
    let processedContent = cleanedReportContent;
    const mainTitle = reportTitle.trim();
    const shortTitleRegex = new RegExp(`^#+\\s+${mainTitle.split(' ').slice(0, 3).join('\\s+.*?')}.*?$`, 'gm');
    processedContent = processedContent.replace(shortTitleRegex, '');
    
    const tokens = lexer.lex(processedContent);
    
    // Create document children elements
    const children = [];
    
    // Add report title (the big one we see at top)
    children.push(
      new Paragraph({
        text: reportTitle,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        font: defaultFont,
        size: 32 // 16pt
      })
    );
    
    // Process the main report content
    let currentToken = 0;
    let inReferencesSection = false; // Track if we're in the References section
    
    while (currentToken < tokens.length) {
      const token = tokens[currentToken];
      
      switch (token.type) {
        case 'heading':
          // Check if this is the References section
          if (token.text.trim() === 'References') {
            inReferencesSection = true;
          } else if (token.text.trim() !== 'References' && inReferencesSection) {
            // We've moved to a new section after References
            inReferencesSection = false;
          }
          
          children.push(
            new Paragraph({
              text: token.text,
              heading: token.depth <= 6 ? token.depth : HeadingLevel.HEADING_6,
              spacing: { before: 240, after: 120 },
              bold: true // Ensure all headings are bold
            })
          );
          break;
          
        case 'paragraph':
          // Remove markdown syntax and user input patterns
          const cleanText = token.text
            .replace(/\*\*\*Executive Summary\*\*\*/g, 'Executive Summary')
            .replace(/\*\*Executive Summary\*\*/g, 'Executive Summary')
            .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/Company:.*?(?=\n|$)/g, '')
            .replace(/Target Audience:.*?(?=\n|$)/g, '')
            .replace(/Timeframe:.*?(?=\n|$)/g, '')
            .trim();
          
          if (cleanText) {
            // Check if this paragraph looks like a section heading
            const isHeading = (
              cleanText === 'Executive Summary' || 
              cleanText === 'Introduction' ||
              cleanText === 'Background' ||
              cleanText === 'Methodology' ||
              cleanText === 'Findings' ||
              cleanText === 'Results' ||
              cleanText === 'Discussion' ||
              cleanText === 'Conclusion' ||
              cleanText === 'Recommendations' ||
              cleanText === 'References' ||
              cleanText === 'Appendix' ||
              cleanText.includes('Analysis') ||
              cleanText.includes('Summary') ||
              // Only apply title-case detection if we're not in the References section
              (!inReferencesSection && /^[A-Z][a-z]+(\s+[A-Z][a-z]+){0,3}$/.test(cleanText))
            );
            
            children.push(
              new Paragraph({
                text: cleanText,
                spacing: { after: 120 },
                font: defaultFont,
                size: defaultFontSize,
                bold: isHeading, // Make it bold if it looks like a heading
                heading: isHeading ? HeadingLevel.HEADING_2 : undefined // Apply heading style if it's a heading
              })
            );
          }
          break;
          
        case 'list':
          token.items.forEach((item, index) => {
            // Clean markdown syntax from bullet points
            const cleanBulletText = item.text
              .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
              .replace(/\*\*([^*]+)\*\*/g, '$1')
              .replace(/\*([^*]+)\*/g, '$1');
              
            children.push(
              new Paragraph({
                text: cleanBulletText,
                bullet: { level: 0 },
                spacing: { after: 80 },
                font: defaultFont,
                size: defaultFontSize
              })
            );
          });
          break;
      }
      
      currentToken++;
    }
    
    // Generate chart images for visualizations
    if (visualizations && visualizations.length > 0) {
      // Add a page break before visualizations
      children.push(
        new Paragraph({
          pageBreakBefore: true
        })
      );
      
      // Add visualizations heading
      children.push(
        new Paragraph({
          text: "Visualizations",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 }
        })
      );
      
      // Process each visualization
      for (let i = 0; i < visualizations.length; i++) {
        const viz = visualizations[i];
        if (!viz || !viz.type || !viz.data) continue;
        
        // Add visualization title
        children.push(
          new Paragraph({
            text: viz.title || `Visualization ${i+1}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          })
        );
        
        // Add description if available
        if (viz.description) {
          children.push(
            new Paragraph({
              text: viz.description,
              spacing: { after: 100 }
            })
          );
        }
        
        try {
          // Create a canvas for the chart
          const canvas = createCanvas(800, 500);
          const ctx = canvas.getContext('2d');
          
          // Configure Chart.js
          Chart.defaults.font.family = 'Arial';
          Chart.defaults.font.size = 12;
          
          // Create the chart
          const chart = new Chart(ctx, {
            type: viz.type.toLowerCase(),
            data: viz.data,
            options: {
              ...viz.options,
              animation: false,
              responsive: false,
              plugins: {
                legend: {
                  display: true,
                  position: 'bottom'
                }
              }
            }
          });
          
          // Render the chart
          await new Promise(resolve => setTimeout(resolve, 100)); // Give time for rendering
          
          // Get the chart as a buffer
          const imageBuffer = canvas.toBuffer('image/png');
          
          // Save the image to a temporary file
          const tempImagePath = path.join(os.tmpdir(), `chart_${i}.png`);
          await fs.writeFile(tempImagePath, imageBuffer);
          
          // Add the chart image to the document
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width: 600,
                    height: 375
                  },
                  alignment: AlignmentType.CENTER
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 240 }
            })
          );
          
          // Destroy the chart to free resources
          chart.destroy();
          
          // Add a page break after each visualization except the last one
          if (i < visualizations.length - 1) {
            children.push(
              new Paragraph({
                pageBreakBefore: true
              })
            );
          }
        } catch (chartError) {
          console.error('Error generating chart for DOCX:', chartError);
          children.push(
            new Paragraph({
              text: 'Error generating chart visualization.',
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 120 }
            })
          );
        }
      }
    }
    
    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: children
        }
      ],
      styles: {
        default: {
          document: {
            run: {
              font: defaultFont,
              size: defaultFontSize
            },
            paragraph: {
              spacing: {
                line: 276, // 1.15 line spacing
              }
            }
          }
        }
      }
    });
    
    // Create a buffer using Packer
    const Packer = require('docx').Packer;
    const buffer = await Packer.toBuffer(doc);
    await fs.writeFile(tempPath, buffer);
    
    return {
      path: tempPath,
      filename: filename,
      buffer: buffer
    };
  } catch (error) {
    console.error("Error generating DOCX:", error);
    throw error;
  }
}

// Helper to sanitize filenames
function sanitizeFilename(filename) {
  return filename.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 50);
}

// Add this function before the generateReportContent function
function extractContentFromResponse(responseText, reportParams, dbSourceInfo, webData) {
  console.log("Extracting content from raw response...");
  
  // Create a basic report structure to fill with extracted content
  let report = {
    title: `Report on ${reportParams.reportTopic}`,
    content: "",
  };
  

  
  // Look for markdown headings in the response
  const headingMatches = responseText.match(/# [^\n]+/g);
  if (headingMatches && headingMatches.length > 0) {
    console.log(`Found ${headingMatches.length} markdown headings`);
    
    // First try to extract the full markdown content
    let markdownContent = "";
    let startIdx = responseText.indexOf(headingMatches[0]);
    
    if (startIdx >= 0) {
      // Find where the JSON likely ends
      let endIdx = responseText.lastIndexOf('}');
      if (endIdx > startIdx) {
        markdownContent = responseText.substring(startIdx, endIdx);
      } else {
        markdownContent = responseText.substring(startIdx);
      }
      
      console.log("Extracted markdown content, length:", markdownContent.length);
    }
    
    if (markdownContent && markdownContent.length > 100) {
      // Preserve original formatting
      report.content = markdownContent
        .replace(/\\"/g, '"')
        .replace(/\\n/g, "\n")
        .replace(/\\\\/g, "\\");
    } else {
      // Try to extract sections individually
      let sections = [];
      for (let i = 0; i < headingMatches.length; i++) {
        const currentHeading = headingMatches[i];
        const nextHeading = (i < headingMatches.length - 1) ? headingMatches[i + 1] : null;
        
        let sectionStart = responseText.indexOf(currentHeading);
        let sectionEnd = nextHeading ? responseText.indexOf(nextHeading, sectionStart) : responseText.length;
        
        if (sectionStart >= 0 && sectionEnd > sectionStart) {
          sections.push(responseText.substring(sectionStart, sectionEnd).trim());
        }
      }
      
      if (sections.length > 0) {
        report.content = sections.join("\n\n")
          .replace(/\\"/g, '"')
          .replace(/\\n/g, "\n")
          .replace(/\\\\/g, "\\");
        console.log("Extracted content by sections, length:", report.content.length);
      }
    }
  }
  
  // If we couldn't extract content, try finding it in JSON structure
  if (!report.content || report.content.length < 100) {
    const contentMatch = responseText.match(/"content"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/);
    if (contentMatch && contentMatch[1]) {
      report.content = contentMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      console.log("Extracted content from JSON field, length:", report.content.length);
    }
  }
  
  // If we still have no content, use a fallback template
  if (!report.content || report.content.length < 100) {
    console.log("Content extraction failed. Using fallback template.");
    report.content = `# ${report.title}

## Executive Summary

This report provides an analysis on ${reportParams.reportTopic} for ${reportParams.company || "your organization"}.

## Key Findings

Analysis of the data shows several important trends:

- The organization has employees across multiple departments
- Performance metrics vary by department and role
- There are opportunities for improvement in resource allocation

## Detailed Analysis

The data reveals patterns in employee performance, project status, and departmental metrics.

## Recommendations

Based on the data analysis, we recommend:

1. Regular performance reviews across all departments
2. Focused training in key skill areas
3. Improved resource allocation based on project priorities`;
  }
  
  // Ensure the report has a References section if it doesn't already
  if (!report.content.includes("# References")) {
    report.content += `\n\n# References

1. ${dbSourceInfo?.description || 'Organizational database'} (Generated on ${new Date().toLocaleDateString()})
${webData ? `2. Website: ${webData.url || reportParams.website} (Title: ${webData.title || 'Not available'})` : ''}
`;
  }
  
  return report;
}

async function generateVisualizationConfigs(model, queryResults, reportParams, extractedData = null) {
  // Process text-based query results into structured data
  if (!extractedData && typeof queryResults === 'string') {
    extractedData = extractDataFromText(queryResults);
  }
  
  // If we have no extracted data, return empty array
  if (!extractedData) {
    return [];
  }
  
  console.log("Generating visualizations with extracted data keys:", Object.keys(extractedData));
  
  const prompt = `You are an expert in data visualization and business analytics. Your task is to generate highly insightful visualization configurations for a report based on extracted data.

REPORT TOPIC: ${reportParams.reportTopic}

EXTRACTED DATA:
${JSON.stringify(extractedData, null, 2)}

TASK:
Based on the extracted data about ${reportParams.reportTopic}, create EFFECTIVE, INSIGHTFUL visualizations that will provide genuine business value and actionable insights. Focus on:

1. Revealing meaningful patterns and relationships in the data
2. Highlighting key performance indicators and metrics
3. Comparing different categories (departments, roles, etc.) 
4. Showing trends over time where time data is available
5. Creating visualizations that will help executives make better decisions

IMPORTANT GUIDELINES:
- Create visualizations that tell a STORY about the data
- Each visualization must provide a clear, valuable insight
- Focus on quality over quantity - 3-4 excellent visualizations are better than many poor ones
- Use appropriate chart types for the data being displayed
- Ensure visualizations are easy to understand and interpret
- Include clear, descriptive titles and informative descriptions
- DO NOT create visualizations with random or meaningless data

IMPORTANT TECHNICAL REQUIREMENTS:
1. Only use chart types supported by Chart.js: 'bar', 'line', 'pie', 'doughnut', 'polarArea', 'radar', or 'scatter'
2. Use ONLY the data that was extracted from the query results - DO NOT invent data
3. Each chart must have properly formatted data that works with Chart.js
4. For each chart, you MUST include:
   - Properly formatted labels array with exact values from the data
   - Properly formatted datasets array with exact values from the data
   - Appropriate backgroundColor values for each dataset
5. Make sure numeric data is properly parsed as numbers, not strings
6. Ensure consistent data structure between labels and datasets

Return ONLY a JSON array of visualization configs. Each should have:
{
  "type": "chart type (bar, line, pie, etc.)",
  "title": "Insightful title that highlights the key finding",
  "description": "Clear explanation of what insight this visualization provides",
  "data": {
    "labels": ["Array of actual labels extracted from the data"],
    "datasets": [
      {
        "label": "Dataset label based on actual data",
        "data": [Array of actual numeric values extracted from the data],
        "backgroundColor": ["Array of colors for pie/doughnut or single color for bar/line"]
      }
    ]
  },
  "options": {
    // Additional chart.js options to improve visualization appearance
  }
}

CRITICAL: Return ONLY the JSON array with visualization configs - no explanations or additional text.
`;

  console.log("Starting visualization generation with validation loop");
  let visualizationConfigs = [];
  let vizValidationAttempts = 0;
  const MAX_VIZ_VALIDATION_ATTEMPTS = 2;
  
  // Get Claude client if possible
  let claudeClient = null;
  if (CLAUDE_API_KEY) {
    claudeClient = new Anthropic({
      apiKey: CLAUDE_API_KEY,
    });
  }
  
  // Visualization generation loop with validation
  while (visualizationConfigs.length === 0 && vizValidationAttempts < MAX_VIZ_VALIDATION_ATTEMPTS) {
    try {
      console.log(`Visualization generation attempt ${vizValidationAttempts + 1}`);
      
      // Try with Gemini first
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Extract the JSON array from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        try {
          const parsedViz = JSON.parse(jsonMatch[0]);
          
          if (Array.isArray(parsedViz) && parsedViz.length > 0) {
            // Validate visualizations with Gemini
            const vizValidationPrompt = `
You are a data visualization quality expert. Review these Chart.js visualization configurations and determine if they meet these criteria:
1. Based ONLY on data explicitly mentioned in the source
2. Use appropriate chart types for the data
3. Include complete and valid Chart.js configuration structure
4. Do not contain made-up or invented data values

SOURCE DATA (EXCERPT):
${JSON.stringify(extractedData, null, 2).substring(0, 500)}...

VISUALIZATION CONFIGS:
${JSON.stringify(parsedViz.slice(0, 2))}...

TASK:
Evaluate if these visualizations meet all criteria. Answer ONLY with "YES" or "NO" followed by a brief reason.
`;
            
            const vizValidationResult = await model.generateContent(vizValidationPrompt);
            const vizValidationResponse = vizValidationResult.response.text().trim();
            
            console.log(`Visualization validation result: ${vizValidationResponse.substring(0, 50)}...`);
            
            if (vizValidationResponse.startsWith("YES")) {
              // Visualizations are valid
              visualizationConfigs = parsedViz;
              console.log(`Gemini generated ${visualizationConfigs.length} valid visualizations`);
            } else if (vizValidationAttempts > 0 && claudeClient) {
              // Try Claude on second attempt
              console.log("Switching to Claude for visualization generation");
              
              const claudeVizResponse = await claudeClient.messages.create({
                model: CLAUDE_MODEL,
                max_tokens: 4000,
                messages: [
                  {
                    role: "user",
                    content: prompt
                  }
                ]
              });
              
              const claudeVizText = claudeVizResponse.content[0].text;
              const claudeArrayMatch = claudeVizText.match(/\[\s*\{[\s\S]*\}\s*\]/);
              
              if (claudeArrayMatch) {
                visualizationConfigs = JSON.parse(claudeArrayMatch[0]);
                console.log(`Claude generated ${visualizationConfigs.length} visualizations`);
              }
            }
          }
        } catch (parseError) {
          console.error("Error parsing visualization JSON:", parseError);
        }
      }
      
      vizValidationAttempts++;
      
    } catch (vizError) {
      console.error("Error in visualization generation attempt:", vizError);
      vizValidationAttempts++;
    }
  }
  
  // Final attempt with Claude if still no visualizations
  if (visualizationConfigs.length === 0 && claudeClient) {
    console.log("Making final visualization attempt with Claude");
    
    try {
      const claudeFinalVizResponse = await claudeClient.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });
      
      const claudeVizText = claudeFinalVizResponse.content[0].text;
      const claudeArrayMatch = claudeVizText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      
      if (claudeArrayMatch) {
        try {
          visualizationConfigs = JSON.parse(claudeArrayMatch[0]);
          console.log(`Claude final attempt generated ${visualizationConfigs.length} visualizations`);
        } catch (parseError) {
          console.error("Error parsing Claude's visualization JSON:", parseError);
          visualizationConfigs = [];
        }
      }
    } catch (claudeVizError) {
      console.error("Error with Claude visualization generation:", claudeVizError);
    }
  }
  
  console.log(`Final visualization count: ${visualizationConfigs.length}`);
  return visualizationConfigs;
}

// Generate visualizations from extracted data
function extractDataFromText(text) {
  console.log("Extracting data from text, length:", text?.length || 0);
  
  if (!text) return {};
  
  const data = {
    departmentLabels: [],
    departmentCounts: [],
    roleLabels: [],
    roleCounts: [],
    statusLabels: [],
    statusCounts: [],
    metricLabels: [],
    metricValues: [],
    timeSeriesLabels: [],
    timeSeriesValues: [],
    tables: []
  };
  
  try {
    // Look for employees and their roles first
    const employeeRegex = /([\w\s]+)\s+\(([\w\s,]+)\)/g;
    const employees = [];
    const roles = [];
    let match;
    
    while ((match = employeeRegex.exec(text)) !== null) {
      employees.push(match[1].trim());
      
      // Split roles by comma if multiple
      const employeeRoles = match[2].split(',').map(r => r.trim());
      employeeRoles.forEach(role => {
        if (!roles.includes(role)) {
          roles.push(role);
        }
      });
    }
    
    // Industry-agnostic approach - look for any kind of organizational divisions
    // This could be departments, teams, units, specialties, or other groupings
    const divisionPatterns = [
      { regex: /departments?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i, type: "Department" },
      { regex: /teams?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i, type: "Team" },
      { regex: /units?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i, type: "Unit" },
      { regex: /divisions?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i, type: "Division" },
      { regex: /specialties?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i, type: "Specialty" },
      { regex: /areas?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i, type: "Area" },
      { regex: /disciplines?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i, type: "Discipline" }
    ];
    
    // Try each pattern until we find some organizational divisions
    for (const pattern of divisionPatterns) {
      const divisionMatch = text.match(pattern.regex);
      
      if (divisionMatch && divisionMatch[1]) {
        const divisionText = divisionMatch[1];
        
        // Look for bullet list items with counts
        const divisionItems = divisionText.match(/[-*]\s*([\w\s&]+)\s*\(?(\d+)[^)]*\)?/g);
        
        if (divisionItems && divisionItems.length > 0) {
          divisionItems.forEach(item => {
            const itemMatch = item.match(/[-*]\s*([\w\s&]+)\s*\(?(\d+)[^)]*\)?/);
            if (itemMatch) {
              data.departmentLabels.push(itemMatch[1].trim());
              data.departmentCounts.push(parseInt(itemMatch[2], 10));
            }
          });
          
          if (data.departmentLabels.length > 0) {
            break; // Found divisions, no need to try other patterns
          }
        }
      }
    }
    
    // If no formal departments found, look for mentions of departments/teams/divisions in the text
    if (data.departmentLabels.length === 0) {
      // Common organizational terms across industries
      const divisionTerms = [
        "Department", "Team", "Unit", "Division", "Specialty", "Group",
        "Practice", "Center", "Ward", "Clinic", "Station", "Branch", "Section"
      ];
      
      // Look for these terms followed by specific names
      const divisionMentions = {};
      
      divisionTerms.forEach(term => {
        const termRegex = new RegExp(`${term}\\s+of\\s+([\\w\\s&]+)`, 'gi');
        let divMatch;
        
        while ((divMatch = termRegex.exec(text)) !== null) {
          const divName = divMatch[1].trim();
          divisionMentions[divName] = (divisionMentions[divName] || 0) + 1;
        }
        
        // Also look for "<Name> Department/Team/etc."
        const altRegex = new RegExp(`([\\w\\s&]+)\\s+${term}`, 'gi');
        let altMatch;
        
        while ((altMatch = altRegex.exec(text)) !== null) {
          const divName = altMatch[1].trim();
          divisionMentions[divName] = (divisionMentions[divName] || 0) + 1;
        }
      });
      
      // If we found at least two different organizational units
      if (Object.keys(divisionMentions).length >= 2) {
        data.departmentLabels = Object.keys(divisionMentions);
        // Create approximate counts - more frequently mentioned ones probably have more people
        data.departmentCounts = Object.values(divisionMentions).map(count => 
          Math.max(1, Math.round(count * (employees.length > 0 ? employees.length / 3 : 2)))
        );
      }
    }
    
    // Roles section - extract from various formats
    if (roles.length > 0) {
      // Count occurrences of each role
      const roleCounts = {};
      roles.forEach(role => {
        roleCounts[role] = (roleCounts[role] || 0) + 1;
      });
      
      data.roleLabels = Object.keys(roleCounts);
      data.roleCounts = Object.values(roleCounts);
    } else {
      // Look for role information in various formats
      const rolePatterns = [
        { regex: /roles?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i },
        { regex: /positions?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i },
        { regex: /titles?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i },
        { regex: /job\s+functions?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i }
      ];
      
      for (const pattern of rolePatterns) {
        const roleMatch = text.match(pattern.regex);
        
        if (roleMatch && roleMatch[1]) {
          const roleText = roleMatch[1];
          
          // Look for bullet list with counts
          const roleItems = roleText.match(/[-*]\s*([\w\s&]+)\s*\(?(\d+)[^)]*\)?/g);
          
          if (roleItems && roleItems.length > 0) {
            roleItems.forEach(item => {
              const roleItemMatch = item.match(/[-*]\s*([\w\s&]+)\s*\(?(\d+)[^)]*\)?/);
              if (roleItemMatch) {
                data.roleLabels.push(roleItemMatch[1].trim());
                data.roleCounts.push(parseInt(roleItemMatch[2], 10));
              }
            });
          }
          
          if (data.roleLabels.length > 0) {
            break; // Found roles, no need to try other patterns
          }
        }
      }
    }
    
    // If still no roles found, try to extract from common job titles in text
    if (data.roleLabels.length === 0) {
      // Common job titles across industries
      const commonTitles = [
        "Manager", "Director", "Supervisor", "Coordinator", "Specialist", "Analyst",
        "Officer", "Executive", "Administrator", "Assistant", "Associate", "Lead",
        "Engineer", "Developer", "Designer", "Consultant", "Advisor",
        "Doctor", "Nurse", "Physician", "Surgeon", "Therapist", "Technician",
        "Researcher", "Scientist", "Professor", "Teacher", "Instructor",
        "Representative", "Agent", "Advisor", "Counselor"
      ];
      
      const titleMatches = {};
      
      commonTitles.forEach(title => {
        const titleRegex = new RegExp(`\\b${title}s?\\b`, 'gi');
        const matches = text.match(titleRegex) || [];
        
        if (matches.length > 0) {
          titleMatches[title] = matches.length;
        }
      });
      
      if (Object.keys(titleMatches).length > 0) {
        data.roleLabels = Object.keys(titleMatches);
        data.roleCounts = Object.values(titleMatches);
      }
    }
    
    // Extract metrics in a generic way - look for numbers associated with labels
    const metricPatterns = [
      // Pattern for "X has a score of Y"
      { regex: /([\w\s]+) has a (?:score|rating|level|value|index) of ([\d.]+)/gi },
      // Pattern for "X score/rate/level is Y"
      { regex: /([\w\s]+) (?:score|rate|level|value|index) (?:is|was|of) ([\d.]+)/gi },
      // Pattern for "X: Y" or "X - Y" where Y is a number
      { regex: /([\w\s]+)(?:\:|-)?\s+([\d.]+)%?/gi }
    ];
    
    for (const pattern of metricPatterns) {
      let metricMatch;
      
      while ((metricMatch = pattern.regex.exec(text)) !== null) {
        const metricName = metricMatch[1].trim();
        const metricValue = parseFloat(metricMatch[2]);
        
        if (!isNaN(metricValue)) {
          data.metricLabels.push(metricName);
          data.metricValues.push(metricValue);
        }
      }
    }
    
    // Status data - try to extract categorical status information
    const statusPatterns = [
      { regex: /status(?:es)?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i },
      { regex: /categories?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i },
      { regex: /types?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i },
      { regex: /classifications?:?\s*([\s\S]*?)(?=\n\s*\n|\*\*\d|\#|$)/i }
    ];
    
    for (const pattern of statusPatterns) {
      const statusMatch = text.match(pattern.regex);
      
      if (statusMatch && statusMatch[1]) {
        const statusText = statusMatch[1];
        
        // Look for bullet list with counts
        const statusItems = statusText.match(/[-*]\s*([\w\s]+)(?:\:|-)?\s*(\d+)/g);
        
        if (statusItems && statusItems.length > 0) {
          statusItems.forEach(item => {
            const statusItemMatch = item.match(/[-*]\s*([\w\s]+)(?:\:|-)?\s*(\d+)/);
            if (statusItemMatch) {
              data.statusLabels.push(statusItemMatch[1].trim());
              data.statusCounts.push(parseInt(statusItemMatch[2], 10));
            }
          });
        }
        
        if (data.statusLabels.length > 0) {
          break; // Found statuses, no need to try other patterns
        }
      }
    }
    
    // If no formal status categories found, look for common status terms
    if (data.statusLabels.length === 0) {
      // Grouped by related concepts that might appear together
      const statusGroups = [
        // Project status
        ["Completed", "In Progress", "Planned", "On Hold", "Delayed", "Canceled"],
        // Performance status
        ["Exceeds Expectations", "Meets Expectations", "Needs Improvement", "Unsatisfactory"],
        // Risk levels
        ["High Risk", "Medium Risk", "Low Risk"],
        // Priority levels
        ["High Priority", "Medium Priority", "Low Priority"],
        // Satisfaction levels
        ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"]
      ];
      
      // Try each group to see if multiple terms from the group appear in the text
      for (const group of statusGroups) {
        const matchingTerms = {};
        
        group.forEach(term => {
          const termRegex = new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'gi');
          const matches = text.match(termRegex) || [];
          
          if (matches.length > 0) {
            matchingTerms[term] = matches.length;
          }
        });
        
        // If we found at least two terms from this group, use them as status categories
        if (Object.keys(matchingTerms).length >= 2) {
          data.statusLabels = Object.keys(matchingTerms);
          data.statusCounts = Object.values(matchingTerms);
          break; // Found a suitable status group
        }
      }
    }
    
    // Time series data - look for time periods with associated values
    const timePatterns = [
      // Quarters with values: "Q1 2023: 45" or "in Q2 2024, value was 3.2"
      { regex: /(?:Q[1-4]\s+\d{4})(?:\s*:|,\s*)\s*(?:value|score|number|amount)?\s*(?:was|is|of)?\s*(\d+\.?\d*)/gi },
      // Months with values: "January 2023: 45" or "in March 2024, value was 3.2"
      { regex: /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}(?:\s*:|,\s*)\s*(?:value|score|number|amount)?\s*(?:was|is|of)?\s*(\d+\.?\d*)/gi },
      // Years with values: "2023: 45" or "in 2024, value was 3.2"
      { regex: /(?:in\s+)?(\d{4})(?:\s*:|,\s*)\s*(?:value|score|number|amount)?\s*(?:was|is|of)?\s*(\d+\.?\d*)/gi }
    ];
    
    for (const pattern of timePatterns) {
      let timeMatch;
      
      while ((timeMatch = pattern.regex.exec(text)) !== null) {
        // Extract the time period and value
        const timePeriod = timeMatch[1].trim();
        const timeValue = parseFloat(timeMatch[2] || timeMatch[1]);
        
        if (!isNaN(timeValue)) {
          data.timeSeriesLabels.push(timePeriod);
          data.timeSeriesValues.push(timeValue);
        }
      }
    }
    
    // If we still don't have time series data, try the feedback data pattern specifically
    if (data.timeSeriesLabels.length === 0) {
      const feedbackRegex = /([\w\s]+) (?:has given|has received|received) feedback (?:with an average (?:rating|score) of|averaging a score of|of) ([\d.]+)/gi;
      let feedbackMatch;
      
      while ((feedbackMatch = feedbackRegex.exec(text)) !== null) {
        const name = feedbackMatch[1].trim();
        const score = parseFloat(feedbackMatch[2]);
        
        if (!isNaN(score)) {
          data.timeSeriesLabels.push(name);
        }
      }
    }
    
    console.log("Extracted data from text:", {
      departments: data.departmentLabels.length,
      roles: data.roleLabels.length,
      statuses: data.statusLabels.length,
      metrics: data.metricLabels.length,
      timeSeriesPoints: data.timeSeriesLabels.length
    });
    
    return data;
  } catch (error) {
    console.error("Error extracting data from text:", error);
    return data;
  }
}

// Extract source information from the response
function extractSourceInfo(text) {
  if (!text) return null;
  
  try {
    // Look for a DATA_SOURCE section
    const sourceMatch = text.match(/##DATA_SOURCE##\s*(.*?)(?=##|$)/);
    if (sourceMatch && sourceMatch[1]) {
      return {
        description: sourceMatch[1].trim(),
        type: 'database'
      };
    }
    
    // Look for "Used X records from" pattern
    const recordsMatch = text.match(/Used\s+(\d+)\s+records\s+from\s+(.*?)(?=\.|$)/i);
    if (recordsMatch) {
      return {
        description: `${recordsMatch[2].trim()} (${recordsMatch[1]} records)`,
        type: 'database',
        recordCount: parseInt(recordsMatch[1], 10)
      };
    }
    
    return {
      description: 'Organizational database',
      type: 'database'
    };
  } catch (error) {
    console.error("Error extracting source info:", error);
    return {
      description: 'Organizational database',
      type: 'database'
    };
  }
}

// Helper function to fix common JSON parsing issues
function fixMalformedJson(jsonString) {
  console.log("Attempting to fix malformed JSON");
  
  try {
    // First try to parse it directly
    return JSON.parse(jsonString);
  } catch (error) {
    console.log("Initial JSON parse failed, applying fixes...");
    
    // 1. Fix trailing commas in arrays and objects
    let fixedJson = jsonString
      .replace(/,\s*]/g, ']')
      .replace(/,\s*}/g, '}');
    
    // 2. Ensure property names are quoted
    fixedJson = fixedJson.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":');
    
    // 3. Fix missing quotes around string values
    // This is more complex, but we can handle simple cases
    fixedJson = fixedJson.replace(/:(\s*)([^",\{\[\]\}\s][^",\{\[\]\}]*?)(\s*)(,|}|])/g, ':"$2"$3$4');
    
    // 4. Ensure all single quotes are replaced with double quotes
    fixedJson = fixedJson.replace(/'/g, '"');
    
    try {
      return JSON.parse(fixedJson);
    } catch (secondError) {
      console.error("Error fixing JSON:", secondError.message);
      console.log("Error position:", secondError.message.match(/position (\d+)/)?.[1]);
      
      // If we can identify the position, try to log the problematic part
      const errorPosition = secondError.message.match(/position (\d+)/)?.[1];
      if (errorPosition) {
        const position = parseInt(errorPosition, 10);
        console.log("JSON excerpt near error:", fixedJson.substring(Math.max(0, position - 50), position + 50));
      }
      
      // Try a different approach - extract just the content property
      const contentMatch = jsonString.match(/"content"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/);
      if (contentMatch) {
        return { content: contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') };
      }
      
      throw new Error(`Failed to fix malformed JSON: ${secondError.message}`);
    }
  }
}

// Generate the report content using LLM
async function generateReportContent(model, claudeClient, reportParams, queryResults, visualizationConfigs, webContext, webData, dbSourceInfo) {
  console.log("Generating report content...");
  
  // Check if this is a scheduled report that should include updates
  const includeUpdatesSection = reportParams.includeUpdatesSection || false;
  const lastReportDate = reportParams.lastReportDate || null;
  
  // Add updates section to prompt if needed
  if (includeUpdatesSection && lastReportDate) {
    console.log("Adding Updates section to report prompt");
    reportParams.predefinedPrompt = reportParams.predefinedPrompt || `Generate a comprehensive business report on the following topic: "${reportParams.reportTopic}" with an UPDATES section highlighting what's changed since ${new Date(lastReportDate).toLocaleDateString()}.`;
  }
  
  console.log("Generating report content with parameters:", {
    reportTopic: reportParams.reportTopic,
    wordCount: reportParams.wordCount,
    audience: reportParams.targetAudience,
    hasVisualizations: visualizationConfigs && visualizationConfigs.length > 0
  });
  
  // Create a prompt for the report content
  const prompt = `You are an expert business report writer. Create a detailed, well-structured report on the following topic based on the provided data.

REPORT TOPIC: ${reportParams.reportTopic || "Company Analysis"}

COMPANY: ${reportParams.company || "The organization"}

TARGET AUDIENCE: ${reportParams.targetAudience || "Business executives"}

WORD COUNT: ${reportParams.wordCount || "500-800"} words

TIMEFRAME: ${reportParams.timeframe || "Current"}

INCLUDE VISUALS: ${reportParams.includeVisuals ? "Yes" : "No"}

DELIVERY FORMAT: ${reportParams.deliveryFormat || "Web"}

DATA FROM DATABASE:
${queryResults?.substring(0, 3000) || "No database data available"}

${webContext ? `ADDITIONAL CONTEXT FROM WEBSITE:
${webContext.substring(0, 1000)}` : ""}

${visualizationConfigs && visualizationConfigs.length > 0 ? 
`VISUALIZATIONS TO BE INCLUDED (ALREADY CREATED):
${JSON.stringify(visualizationConfigs.map(viz => ({ 
  type: viz.type, 
  title: viz.title, 
  description: viz.description 
})), null, 2)}` 
: "NO VISUALIZATIONS WILL BE INCLUDED."}

REQUIREMENTS:
1. Create a comprehensive business report with a clear title, executive summary, and structured sections
2. Include specific data points, metrics, and findings from the provided database information
3. Maintain a professional tone appropriate for ${reportParams.targetAudience || "business executives"}
4. Format the report using markdown (# for main headings, ## for subheadings, etc.)
5. If visualizations are included, refer to them in appropriate places in the report
6. Include a "References" section at the end citing the data sources
7. Focus on actionable insights and business value
8. CRITICAL: The report MUST specifically address the timeframe "${reportParams.timeframe || "Current"}" throughout the report. Make this timeframe a central focus of your analysis.
9. CRITICAL: Incorporate ALL additional context from web scraping and other sources provided above. This is real data that MUST be reflected in your report.

IMPORTANT: Your response must be a valid JSON object with the following structure:
{
  "title": "The report title",
  "content": "The full report content in markdown format"
}

The "content" field should contain properly formatted markdown with headers, lists, and paragraphs.
`;

  console.log("Starting report content generation with validation loop");
  let reportJson = null;
  let validationAttempts = 0;
  const MAX_VALIDATION_ATTEMPTS = 2;
  
  // Report generation loop with validation
  while (!reportJson && validationAttempts < MAX_VALIDATION_ATTEMPTS) {
    try {
      console.log(`Report generation attempt ${validationAttempts + 1}`);
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Extract the JSON object from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          // Parse the JSON
          const parsedReport = JSON.parse(jsonMatch[0]);
          
          // Validate the report with Gemini
          const validationPrompt = `
You are a quality assurance expert. Review the following business report and determine if it meets these criteria:
1. Has a clear title and executive summary
2. Contains specific data points from the source data
3. Is professionally formatted with proper markdown
4. Includes only information mentioned in the source
5. Contains a References section
6. CRITICAL: Specifically addresses and focuses on the timeframe "${reportParams.timeframe || "Current"}" throughout the report
7. CRITICAL: Incorporates all additional context from web scraping and other sources provided

SOURCE DATA (BRIEF EXCERPT):
${queryResults?.substring(0, 500) || "No database data available"}...

TIMEFRAME SPECIFIED: "${reportParams.timeframe || "Current"}"

${webContext ? `ADDITIONAL CONTEXT FROM WEBSITE (EXCERPT):
${webContext.substring(0, 300)}...` : ""}

GENERATED REPORT:
${parsedReport.content.substring(0, 1000)}...

TASK:
Evaluate if this report meets all criteria. Answer ONLY with "YES" or "NO" followed by a brief reason. If the report fails to properly incorporate the specified timeframe or additional context, the answer MUST be "NO".
`;
          
          const validationResult = await model.generateContent(validationPrompt);
          const validationResponse = validationResult.response.text().trim();
          
          console.log(`Validation result: ${validationResponse.substring(0, 50)}...`);
          
          if (validationResponse.startsWith("YES")) {
            // Report is valid
            reportJson = parsedReport;
            console.log("Gemini generated a valid report");
          } else if (validationAttempts > 0 && claudeClient) {
            // Try Claude on second attempt
            console.log("Switching to Claude for report generation");
            
            const claudeReportResponse = await claudeClient.messages.create({
              model: CLAUDE_MODEL,
              max_tokens: 4000,
              messages: [
                {
                  role: "user",
                  content: prompt
                }
              ]
            });
            
            const claudeText = claudeReportResponse.content[0].text;
            const claudeJsonMatch = claudeText.match(/\{[\s\S]*\}/);
            
            if (claudeJsonMatch) {
              reportJson = JSON.parse(claudeJsonMatch[0]);
              console.log("Claude generated a valid report");
            }
          }
        } catch (parseError) {
          console.error("Error parsing report JSON:", parseError);
        }
      }
      
      validationAttempts++;
      
    } catch (error) {
      console.error("Error in report generation attempt:", error);
      validationAttempts++;
    }
  }
  
  // Final attempt with Claude if we still don't have content
  if (!reportJson && claudeClient) {
    console.log("Making final report generation attempt with Claude");
    
    try {
      const claudeReportResponse = await claudeClient.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });
      
      const claudeText = claudeReportResponse.content[0].text;
      const claudeJsonMatch = claudeText.match(/\{[\s\S]*\}/);
      
      if (claudeJsonMatch) {
        reportJson = JSON.parse(claudeJsonMatch[0]);
      } else {
        // Direct extraction if JSON parsing fails
        reportJson = {
          title: reportParams.reportTopic,
          content: claudeText
        };
      }
    } catch (claudeError) {
      console.error("Error with Claude final report generation:", claudeError);
    }
  }
  
  // If we somehow still don't have valid content
  if (!reportJson || !reportJson.content) {
    console.error("All LLM attempts failed to produce a valid report");
    reportJson = {
      title: reportParams.reportTopic,
      content: ""
    };
  }
  
  // Ensure the report has a References section if it doesn't already
  if (!reportJson.content.includes("# References")) {
    reportJson.content += `

# References

1. ${dbSourceInfo?.description || 'Organizational database'} (Generated on ${new Date().toLocaleDateString()})
${webData ? `2. Website: ${webData.url || reportParams.website} (Title: ${webData.title || 'Not available'})` : ''}
`;
  }
  
  // Add visualizations to the report
  reportJson.visualizations = visualizationConfigs;
  
  console.log("Report content generation complete");
  console.log("Report title:", reportJson.title);
  console.log("Content length:", reportJson.content?.length || 0);
  
  return reportJson;
}

// These functions are used internally
// No need to export them as this is a CommonJS module


// Handle save requests
async function handleSave(params, res) {
  let client;
  try {
    // Extract token from Authorization header or request body
    let token = '';
    
    // Check if token is in the Authorization header
    if (params.headers?.authorization) {
      const authHeader = params.headers.authorization;
      token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    }
    
    // If not in header, check if it's in the request body
    if (!token && params.token) {
      token = params.token;
    }
    
    // Require authentication for saving reports
    if (!token) {
      console.error('No authentication token provided');
      return res.status(401).json({ error: 'Authentication token required' });
    }
    
    let payload;
    try {
      // Verify the token and extract user information
      payload = await verifyAuth(token);
      if (!payload || !payload.companyCode) {
        console.error('Invalid token payload:', payload);
        return res.status(401).json({ error: 'Invalid authentication token' });
      }
      console.log('Authentication successful for user:', payload.email, 'company:', payload.companyCode);
    } catch (authError) {
      console.error('Auth verification failed:', authError);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Connect to MongoDB
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }
    client = await MongoClient.connect(MONGODB_URI);
    
    // Use the authenticated user's company database
    const companyDbName = `company_${payload.companyCode.toLowerCase()}`;
    console.log('Saving report to database:', companyDbName);
    const companyDb = client.db(companyDbName);
    const savedReportsCollection = companyDb.collection("saved_reports");

    // Generate a unique ID if not provided
    const reportId = params.reportId || new Date().getTime().toString();
    
    // Get user ID from token payload
    const userId = payload.userId || payload.sub;
    
    // Prepare report data to save
    const reportToSave = {
      _id: reportId,
      userId,
      title: params.reportTitle,
      topic: params.reportTopic,
      createdAt: new Date(),
      content: params.reportContent,
      visualizations: params.visualizations || [],
      company: payload.companyCode, // Use payload.companyCode
      wordCount: params.wordCount,
      targetAudience: params.targetAudience,
      timeframe: params.timeframe,
      deliveryFormat: params.deliveryFormat,
      hasVisualizations: params.includeVisuals
    };
    
    // Upsert report: if exists, update; otherwise, insert
    const result = await savedReportsCollection.updateOne(
      { _id: reportId },
      { $set: reportToSave },
      { upsert: true }
    );
    
    if (result.acknowledged) {
      // Also save to report history for backward compatibility
      await saveReportToHistory(companyDb.collection(REPORT_HISTORY_COLLECTION_NAME), reportId, params, {
        title: params.reportTitle,
        content: params.reportContent
      });
      
      return res.status(200).json({ 
        success: true, 
        message: 'Report saved successfully', 
        reportId 
      });
    } else {
      return res.status(500).json({ error: 'Failed to save report' });
    }
  } catch (error) {
    console.error('Error saving report:', error);
    return res.status(500).json({ 
      error: 'Failed to save report',
      details: error.message || 'Unknown error'
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Helper function to clean HTML content for export
function cleanHtmlContent(htmlContent) {
  if (!htmlContent) return '';
  
  // Use a simple HTML parser if available, or fallback to regex
  try {
    // First convert common HTML entities
    let cleanedContent = htmlContent
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Remove HTML tags while preserving content
    cleanedContent = cleanedContent
      // Replace heading tags with markdown equivalents
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
      // Replace paragraph tags
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      // Replace line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      // Replace lists
      .replace(/<ul[^>]*>(.*?)<\/ul>/gis, '$1\n\n')
      .replace(/<ol[^>]*>(.*?)<\/ol>/gis, '$1\n\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '* $1\n')
      // Format text
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      // Remove any other tags but preserve their contents
      .replace(/<[^>]+>/g, '')
      // Fix excessive newlines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Trim whitespace
      .trim();
      
    return cleanedContent;
  } catch (error) {
    console.error('Error cleaning HTML content:', error);
    // Fallback to a more aggressive approach
    return htmlContent.replace(/<[^>]+>/g, '');
  }
}