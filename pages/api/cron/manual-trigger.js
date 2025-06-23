// This endpoint allows administrators to manually trigger the report generation process
// Typically, this would be handled by a cron job on the server
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Simple admin password check for demo purposes
  // In production, proper authentication would be required
  const { adminKey } = req.body;
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // Call the scheduled reports endpoint
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cron/run-scheduled-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.INTERNAL_API_KEY
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to run scheduled reports: ${errorData.error || response.statusText}`);
    }
    
    const result = await response.json();
    
    return res.status(200).json({
      success: true,
      message: 'Scheduled reports processed successfully',
      details: result
    });
  } catch (error) {
    console.error('Error triggering scheduled reports:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 