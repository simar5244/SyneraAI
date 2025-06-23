/**
 * Gemini LLM API Utility
 * 
 * This utility provides functions to interact with the Gemini API for
 * generating text, analyzing data, and other LLM-related operations.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API client
const initializeGeminiApi = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set in environment variables. LLM features will not work.');
    return null;
  }
  
  return new GoogleGenerativeAI(apiKey);
};

// Global instance of the Gemini API client
const genAI = initializeGeminiApi();

// Function to generate text using Gemini Pro
export async function generateText(prompt: string, maxTokens = 1024): Promise<string> {
  if (!genAI) {
    throw new Error('Gemini API is not initialized. Please check your API key.');
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    return text;
  } catch (error: any) {
    console.error('Error generating text with Gemini API:', error);
    throw new Error(`LLM API error: ${error.message}`);
  }
}

// Function to analyze organization data
export async function analyzeOrganizationData(data: any, question: string): Promise<string> {
  const prompt = `
    Analyze the following organization data and answer this question: "${question}"
    
    Data:
    ${JSON.stringify(data, null, 2)}
    
    Provide a concise and insightful analysis based on the data provided.
  `;
  
  return generateText(prompt, 2048);
}

// Function to suggest optimizations based on organizational structure
export async function suggestOptimizations(orgData: any): Promise<string> {
  const prompt = `
    You are an expert organizational consultant. Analyze the following organizational data 
    and suggest optimizations for team structure, reporting lines, and resource allocation.
    
    Data:
    ${JSON.stringify(orgData, null, 2)}
    
    Provide 3-5 specific, actionable suggestions for improving organizational efficiency.
  `;
  
  return generateText(prompt, 2048);
}

// Function to enhance an employee profile with AI-generated insights
export async function enhanceEmployeeProfile(employee: any): Promise<string> {
  const prompt = `
    Given the following employee profile, provide insights about:
    1. Potential career growth paths
    2. Skill development opportunities
    3. Team fit and collaboration potential
    
    Employee Data:
    ${JSON.stringify(employee, null, 2)}
    
    Format your response as JSON with sections for each insight category.
  `;
  
  return generateText(prompt, 1536);
}

// Create and export the LLM service instance
const llmService = {
  // Pass a string or object to be processed by the LLM
  process: async (input: string | object): Promise<any> => {
    // ... existing code ...
  },
  
  // Generate a chat response
  chat: async (messages: any[], options?: any): Promise<any> => {
    // ... existing code ...
  },
  
  // Analyze text using the LLM
  analyze: async (text: string, task: string): Promise<any> => {
    // ... existing code ...
  }
};

export default llmService; 