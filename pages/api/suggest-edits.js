import { MongoClient, ObjectId } from 'mongodb';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import claudeQuery from './claude-query.js';
import { verifyAuth } from '@/lib/auth';

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const CONVERSATION_COLLECTION_NAME = "edit_suggestions";
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

  let client;
  try {
    console.log('=== SUGGEST EDITS API HANDLER START ===');
    const { 
      message, 
      reportId, 
      reportContent, 
      reportTitle, 
      visualizations, 
      originalUserInput,
      conversationId,
      history = []
    } = req.body;

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
    
    // Ensure company code is standardized and lowercase
    const userCompanyCode = (payload.companyCode || payload.company_code).toString().toLowerCase();
    const userId = payload.userId || payload.user_id;

    if (!userCompanyCode) {
      return res.status(403).json({ error: 'Company context required' });
    }
    
    console.log('Authenticated user company code:', userCompanyCode);
    console.log('User ID:', userId);
    
    // Initialize Gemini client (primary)
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME, safetySettings });

    // Initialize Claude client (fallback)
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
    
    // Connect to the tenant's database
    const dbName = `company_${userCompanyCode}`;
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(dbName);
    const conversationCollection = db.collection(CONVERSATION_COLLECTION_NAME);
    
    // Create a unique conversation ID if not provided
    const currentConversationId = conversationId || `edit_${reportId}_${userId}_${Date.now()}`;
    
    // Get conversation history
    let conversationHistory = [];
    if (history.length > 0) {
      conversationHistory = history;
    } else if (conversationId) {
      const storedConversation = await conversationCollection.findOne({ conversationId: currentConversationId });
      if (storedConversation) {
        conversationHistory = storedConversation.messages || [];
      }
    }
    
    // Determine if we need to query the database
    const needsDbQuery = message.toLowerCase().includes('data') || 
                        message.toLowerCase().includes('numbers') || 
                        message.toLowerCase().includes('statistics') ||
                        message.toLowerCase().includes('information') ||
                        message.toLowerCase().includes('visualization') ||
                        message.toLowerCase().includes('chart') ||
                        message.toLowerCase().includes('graph');
    
    let dbQueryResults = null;
    
    // If needed, query the database using claude-query
    if (needsDbQuery) {
      const session_id = `edit_suggestion_${currentConversationId}`;
      
      // Call claude-query handler directly
      const mockReq = { 
        method: 'POST', 
        body: { 
          query: message,
          session_id
        },
        cookies: { token },
        headers: { authorization: `Bearer ${token}` }
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
    
    // Add user message to history
    conversationHistory.push({
      role: 'user',
      content: message
    });
    
    // Prepare the prompt for the LLM
    const prompt = `You are an expert report editor. The user has a business report and wants to make targeted edits or additions to specific sections of it. DO NOT regenerate the entire report - only modify the specific sections the user wants to change.

CURRENT REPORT:
Title: ${reportTitle || "Report"}
Content: ${reportContent}

ORIGINAL USER INPUT WHEN GENERATING REPORT:
${originalUserInput || "Not provided"}

USER REQUEST:
${message}

${dbQueryResults ? `ADDITIONAL DATA FROM DATABASE:
${dbQueryResults}` : ''}

EXISTING VISUALIZATIONS:
${visualizations ? JSON.stringify(visualizations.slice(0, 3)) : "No visualizations provided"}

CONVERSATION HISTORY:
${conversationHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}

TASK:
1. Understand what SPECIFIC changes the user wants to make to the report
2. Determine if the user is requesting:
   a) Text edits to a specific section of content
   b) Adding new data or information to a specific section
   c) Creating or modifying visualizations with specific parameters

3. For text edits:
   - Identify the EXACT portion of text to modify or remove (a paragraph, sentence, or section)
   - For modifications: Provide the EXACT replacement text
   - For removals: Set replacementContent to an empty string ""
   - DO NOT rewrite sections that don't need changes
   - Keep edits minimal and targeted

4. For new data requests:
   - Use the database query results to provide accurate information
   - Only add the specific data requested

5. For visualization requests:
   - Pay close attention to the user's specific requirements (e.g., "bar chart with employees on x-axis and hours worked on y-axis")
   - Use the exact data fields the user specifies
   - If user provides specific visualization parameters, use them exactly as specified

IMPORTANT: Be extremely precise and targeted with your edits. Do not regenerate content that doesn't need changing. This saves computational resources and ensures the user's report maintains its original style and structure except where changes are specifically requested.

Return a JSON object with:
{
  "response": "Your helpful response to the user explaining what specific changes you've made",
  "edits": {
    "type": "text_edit" | "data_addition" | "visualization" | "none",
    "textEdits": [
      {
        "targetContent": "The exact text to replace (must be an exact match to existing content)",
        "replacementContent": "The new text to insert in its place"
      }
    ],
    "newVisualization": {
      "type": "bar" | "line" | "pie" | "doughnut" | "polarArea" | "radar" | "scatter",
      "title": "Chart title based on user's request",
      "description": "Chart description explaining what the visualization shows",
      "data": {
        "labels": ["Label1", "Label2"],
        "datasets": [
          {
            "label": "Dataset label as specified by user",
            "data": [value1, value2],
            "backgroundColor": ["color1", "color2"]
          }
        ]
      }
    }
  }
}`;

    // Try with Gemini first
    let responseText;
    let responseJson;
    let usedModel = "gemini";
    
    try {
      console.log("Attempting to generate response with Gemini");
      // DEBUG: Log the prompt being sent to Gemini
      console.log('===== DEBUG: PROMPT SENT TO GEMINI =====');
      console.log(prompt);
      console.log('===== END PROMPT =====\n');

      // Get response from Gemini
      console.log('===== DEBUG: GETTING RESPONSE FROM GEMINI =====');
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
      
      // DEBUG: Log raw response
      console.log('===== DEBUG: RAW GEMINI RESPONSE =====');
      console.log('Response type:', typeof responseText);
      console.log('Response length:', responseText.length);
      console.log('First 500 chars:', responseText.substring(0, 500));
      console.log('Last 200 chars:', responseText.substring(responseText.length - 200));
      console.log('===== END RAW RESPONSE =====\n');
      
      if (!responseText) {
        console.error('ERROR: Empty response from Gemini');
        throw new Error("No response received from Gemini");
      }
      
      // DEBUG: First attempt to parse
      console.log('===== DEBUG: ATTEMPT 1 - DIRECT PARSE =====');
      try {
        responseJson = JSON.parse(responseText);
        console.log('✅ Success - Direct parse successful!');
        console.log('Parsed JSON structure:', JSON.stringify({
          type: typeof responseJson,
          keys: Object.keys(responseJson)
        }, null, 2));
      } catch (e) {
        console.log('❌ Direct parse failed, error:', e.message);
        console.log('===== DEBUG: ATTEMPT 2 - EXTRACT AND PARSE =====');
        
        // Try to find JSON in the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        console.log('JSON match result:', jsonMatch ? 'Found match' : 'No match found');
        
        if (!jsonMatch) {
          console.error('ERROR: No JSON content found in response');
          throw new Error("No JSON content found in response");
        }
        
        console.log('Extracted JSON string length:', jsonMatch[0].length);
        console.log('First 200 chars of extracted JSON:', jsonMatch[0].substring(0, 200));
        
        try {
          responseJson = JSON.parse(jsonMatch[0]);
          console.log('✅ Success - Extracted JSON parsed successfully!');
          console.log('Parsed JSON structure:', JSON.stringify({
            type: typeof responseJson,
            keys: Object.keys(responseJson)
          }, null, 2));
        } catch (fallbackError) {
          console.error('❌ Fallback parsing failed with error:', fallbackError.message);
          console.error('First 300 chars of problematic content:', jsonMatch[0].substring(0, 300));
          console.error('Last 200 chars of problematic content:', 
            jsonMatch[0].substring(Math.max(0, jsonMatch[0].length - 200)));
          throw new Error("Failed to parse JSON after multiple attempts");
        }
      }
    } catch (geminiError) {
      // Fall back to Claude if Gemini fails
      console.log("Gemini failed, falling back to Claude:", geminiError.message);
      usedModel = "claude";
      
      try {
        const claudeResponse = await claudeClient.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 4000,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        });
        
        responseText = claudeResponse.content[0].text;
        
        // Extract the JSON object from the response
        let jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          try {
            responseJson = JSON.parse(jsonMatch[0]);
            console.log("Successfully parsed JSON from Claude response");
          } catch (jsonError) {
            console.error("Failed to parse JSON from Claude response:", jsonError);
            responseJson = {
              response: "I apologize, but I encountered an error processing your request. Could you please rephrase or simplify your request?",
              edits: { type: "none" }
            };
          }
        } else {
          responseJson = {
            response: responseText,
            edits: { type: "none" }
          };
        }
      } catch (claudeError) {
        console.error("Claude also failed:", claudeError);
        responseJson = {
          response: "I apologize, but I encountered an error processing your request. Our AI services are currently experiencing issues. Please try again later.",
          edits: { type: "none" }
        };
      }
    }
    
    // Add AI response to history
    conversationHistory.push({
      role: 'assistant',
      content: responseJson.response
    });
    
    // Save conversation history to database
    await conversationCollection.updateOne(
      { conversationId: currentConversationId },
      { 
        $set: { 
          conversationId: currentConversationId,
          reportId,
          userId,
          lastUpdated: new Date(),
          messages: conversationHistory
        }
      },
      { upsert: true }
    );
    
    // Return response
    return res.status(200).json({
      conversationId: currentConversationId,
      response: responseJson.response,
      edits: responseJson.edits,
      history: conversationHistory,
      model: usedModel
    });
    
  } catch (error) {
    console.error('Error in suggest-edits API:', error);
    return res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: error.message
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}
