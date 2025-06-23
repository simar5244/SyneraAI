// Simple proxy to the claude-query endpoint
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For server-side fetch during development, directly use localhost:3000
    // For production, rely on relative paths or properly configured base URLs
    const isProduction = process.env.NODE_ENV === 'production';
    const targetUrl = isProduction 
      ? `/api/claude-query` // Use relative path in production (assuming same origin)
      : `http://localhost:3000/api/claude-query`; // Explicit for local dev

    console.log(`Proxying query to: ${targetUrl}`);

    // Forward the request to the claude-query endpoint using fetch
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward other relevant headers if needed
      },
      body: JSON.stringify(req.body),
    });

    // Pass the response status and body back to the client
    const responseBody = await response.text();
    // Ensure content-type is passed correctly, especially for JSON
    const contentType = response.headers.get("content-type");
    if (contentType) {
       res.setHeader("Content-Type", contentType);
    }
    res.status(response.status).send(responseBody);

  } catch (error) {
    console.error('Error in query proxy:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred in proxy',
      details: error.message,
      response: "I'm sorry, I encountered an internal error. Please try again or contact support."
    });
  }
} 