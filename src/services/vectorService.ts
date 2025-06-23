import axios from 'axios';

// Vector service for handling embeddings and similarity search
export class VectorService {
  private readonly embeddingModel = 'models/embedding-001'; // Gemini's embedding model
  private readonly similarityThreshold = 0.75;
  private readonly secondaryThreshold = 0.6;
  private readonly apiKey: string;

  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }
    this.apiKey = apiKey;
  }

  // Generate embeddings for text using Gemini's embedding API
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.log('Generating embedding for text:', text.substring(0, 50) + '...');
      
      console.log('Making request to Gemini API...');
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/${this.embeddingModel}:embedContent?key=${this.apiKey}`,
        {
          model: this.embeddingModel,
          content: {
            parts: [{
              text: text
            }]
          },
          taskType: 'RETRIEVAL_DOCUMENT'
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );
      
      if (!response.data?.embedding?.values) {
        console.error('Unexpected response format from Gemini API:', response.data);
        throw new Error('Invalid response format from Gemini API');
      }
      
      console.log('Successfully generated embedding');
      return response.data.embedding.values;
    } catch (error: any) {
      console.error('Error generating embedding with Gemini:', error);
      console.error('Error details:', error.response?.data || 'No response data');
      console.error('Error status:', error.response?.status || 'No status code');
      
      throw new Error(`Failed to generate text embedding: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Find similar employees based on vector similarity
  async findSimilarEmployees(
    projectEmbedding: number[],
    companyCode: string,
    limit: number = 10
  ): Promise<{ employees: any[]; needsLLMAnalysis: boolean }> {
    try {
      console.log(`Finding similar employees for company: ${companyCode}, limit: ${limit}`);
      
      // Get auth token from localStorage
      let token = '';
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('token') || '';
        console.log('Auth token available:', token ? 'Yes' : 'No');
      }
      
      // Call the vector search API
      console.log('Calling vector-search API endpoint...');
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/api/vector-search`;
      const response = await axios.post(
        url,
        { embedding: projectEmbedding, companyCode, limit },
        { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
      );
      
      console.log(`Vector search API response status: ${response.status}`);
      console.log(`Found ${response.data.employees?.length || 0} employees`);
      
      // Check if we need LLM analysis (if scores are below threshold)
      const needsLLMAnalysis = response.data.employees.some(
        (result: any) => result.score < this.similarityThreshold && result.score >= this.secondaryThreshold
      );
      
      return {
        employees: response.data.employees || [],
        needsLLMAnalysis: (response.data.employees?.length || 0) > 0
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error('Vector search endpoint not found (404). Check API route /api/vector-search.');
        throw new Error('Vector search endpoint not found (404). Ensure /api/vector-search exists.');
      }
      console.error('Failed to find similar employees. Please check your API key and network connection.');
      throw new Error(`Failed to find similar employees: ${error.message}`);
    }
  }

  // Calculate cosine similarity between two vectors
  calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same dimensions');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }

  // No need for connection closing in frontend
}

export default new VectorService();
