import { MongoClient } from 'mongodb';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
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

// Sample Claude query response for testing
const SAMPLE_CLAUDE_RESPONSE = {
  response: `Here's a comprehensive business report on the employees of company10, based on the most recent data available.

**1. Current Status and Overview**

Currently, company10 has a small team comprised of Sim Singh (admin, Software Engineer), Anthony (legal aid), user2 (employee_tier_3), user4 (call receptionist), and S S (Software engineer). All employees currently have an "active" employment status as of May 2025. The IT department appears to be a common link, although specific department assignments for all roles are not consistently documented. The company utilizes a tiered employee structure.

**2. Key Metrics and Statistics**

*   **Feedback Metrics:** Feedback data is somewhat limited, but we can see that Sim Singh has given feedback with an average rating of 3.2 in Q2 2025. User2 received feedback averaging a score of 5 in Q2 2025. S S received feedback of 3.4.

*   **Utilization Scores:** Utilization scores, indicating workload and efficiency, vary across the team. Sim Singh has a utilization score of 0.25, while Anthony has a score of 0.1. user3 has a score of 0.12 and user4 has a score of 0.078. User2 has the lowest utilization score, sitting at 0.05.

*   **Succession Planning:** Succession analyses have been conducted for each employee. For example, Sim Singh has "S S" listed as a potential successor, although currently deemed "non-viable" due to insufficient competency overlap. A similar analysis for Anthony, finds Sim Singh, S S, user2, and user4 as potential successors.

* **Attrition Assessment:** While the provided data doesn't offer concrete attrition risk scores for each employee, the "stability_index" found within their analysis data points towards potential retention risks that could impact the company's stability.

**3. Trends and Patterns**

*   **IT Department Centralization:** A pattern emerges with most employees listed under the IT department, suggesting a possible centralization of roles within this area. Further investigation into departmental structure is recommended.

*   **Limited Feedback Data:** There's a trend of limited feedback data across the company. While some employees have given or received feedback, overall activity appears low. This may indicate a need to encourage more regular feedback practices.

**4. Challenges and Opportunities**

*   **Succession Viability:** A challenge lies in identifying viable successors for key roles. Current successor analyses reveal several "non-viable" candidates, highlighting potential skill gaps. The opportunity here is to invest in targeted training and development programs to bridge these gaps and foster internal talent.

*   **Skill Gaps and Development:** There's a need to address individual development areas. Many succession candidates are flagged for "limited skill overlap" or needing experience with more complex projects. Opportunities exist to create personalized development plans, mentorship programs, and project assignments to grow employee skills.

*   **Low Stability Index:** Some employees exhibit a low stability index, indicating potential retention risks. Investigating the underlying causes (e.g., mismatch between responsibilities and seniority) and addressing them proactively can improve employee retention.

**5. Recommendations and Next Steps**

*   **Enhance Feedback Culture:** Implement regular feedback mechanisms, training, and tools to encourage employees to provide and receive constructive feedback.
*   **Succession Planning Investment:** Focus on developing internal talent.
*   **Investigate Attrition Risks:**
*   **Clarify Departmental Structure:** Conduct a review of departmental structure to ensure alignment and optimal organization.

By taking these steps, company10 can strategically develop its employees, mitigate risks, and build a stronger, more resilient workforce for the future.`
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  console.log("=== NEW TEST REPORT GENERATION API CALLED ===");
  
  try {
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
    
    // Extract report parameters from request or use defaults
    const reportParams = req.body || {};
    console.log("Report parameters:", reportParams);
    
    // Use default parameters if not provided
    if (!reportParams.reportTopic) {
      reportParams.reportTopic = "Employee Analysis";
    }
    
    if (!reportParams.company) {
      reportParams.company = "Company10";
    }
    
    // Generate a unique report ID
    const reportId = reportParams.reportId || new Date().getTime().toString();
    
    // Allow client to pass their own Claude response (from claude-query.js)
    const claudeResponse = reportParams.claudeResponse || SAMPLE_CLAUDE_RESPONSE;
    console.log("Claude response length:", claudeResponse.response.length);
    
    // Create source info
    const dbSourceInfo = {
      description: `${reportParams.company} database`,
      type: 'database'
    };
    
    // Web context simulation
    const webData = {
      url: `https://${reportParams.company.toLowerCase().replace(/\s+/g, '')}.com`,
      title: `${reportParams.company} - Business Data`,
      description: "Provider of services"
    };
    
    //-------------------------------------------------------------------------
    // Generate Report (Gemini with Claude fallback, no validation loop)
    //-------------------------------------------------------------------------
    console.log("Generating report with Gemini (Claude fallback if needed)");
    
    let reportContent = null;
    
    // Gemini Report Generation
    const reportPrompt = `
You are an expert business report writer. Create a detailed, well-structured report based on the following data.

REPORT TOPIC: ${reportParams.reportTopic}
COMPANY: ${reportParams.company}
TARGET AUDIENCE: ${reportParams.targetAudience || "Business executives"}

DATA FROM AI ANALYSIS:
${claudeResponse.response}

REQUIREMENTS:
1. Create a comprehensive business report with a clear title, executive summary, and structured sections
2. Include specific data points, metrics, and findings from the provided information
3. Maintain a professional tone appropriate for business executives
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
    if (!reportContent) {
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
    
    // Last resort if all attempts fail
    if (!reportContent) {
      console.log("Both LLMs failed to generate report, using fallback");
      reportContent = {
        title: reportParams.reportTopic,
        content: claudeResponse.response
      };
    }
    
    // Ensure references section exists
    if (!reportContent.content.includes("# References")) {
      reportContent.content += `

# References

1. ${dbSourceInfo.description} (Generated on ${new Date().toLocaleDateString()})
`;
    }
    
    console.log("Report content generated successfully");
    
    //-------------------------------------------------------------------------
    // Generate visualizations (Gemini with Claude fallback, no validation loop)
    //-------------------------------------------------------------------------
    console.log("Generating visualizations (Gemini with Claude fallback)");
    
    let visualizationConfigs = [];
    
    const vizPrompt = `
You are an expert data scientist specializing in data visualization and Chart.js.

TASK:
Analyze the following text, extract structured data, and create JSON configurations for Chart.js visualizations.

TEXT TO ANALYZE:
${claudeResponse.response}

REQUIREMENTS:
1. Carefully analyze the text to identify meaningful data that can be visualized
2. Design visualizations that provide genuine business insights
3. Create complete Chart.js configuration objects for each visualization
4. Use appropriate chart types based on the data characteristics
5. DO NOT make up or invent any data not present in the text
6. Extract only explicit numerical data from the text - NEVER invent values
7. ONLY create visualizations for data that has clear numeric values in the text

CHART TYPES:
- bar charts for comparing categories
- pie/doughnut charts for showing proportions
- line charts for trends or time series
- radar charts for multi-dimension comparisons
- scatter plots for correlations

Each visualization configuration should be a valid Chart.js configuration object with:
1. type: Chart type (bar, line, pie, doughnut, radar, scatter)
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
          const parsedViz = JSON.parse(arrayMatch[0]);
          
          if (Array.isArray(parsedViz) && parsedViz.length > 0) {
            visualizationConfigs = parsedViz;
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
    if (visualizationConfigs.length === 0) {
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
    
    console.log(`Final visualization count: ${visualizationConfigs.length}`);
    
    //-------------------------------------------------------------------------
    // STEP 3: Return the final report with visualizations
    //-------------------------------------------------------------------------
    console.log("STEP 3: Returning the final report with visualizations");
    
    return res.status(200).json({
      reportId,
      title: reportContent.title,
      content: reportContent.content,
      charts: visualizationConfigs,
      visualizations: visualizationConfigs,
      webData: webData,
      dbSourceInfo: dbSourceInfo
    });
    
  } catch (error) {
    console.error("Test report generation error:", error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
