import integrationDataMerger from '../utils/integrationDataMerger';

/**
 * Initialize the Integration Data Merger service
 * This function starts the service that monitors all company databases
 * for changes in the integrations collection and automatically merges
 * the data into users collection matching by email.
 */
export async function initializeIntegrationDataMerger(): Promise<void> {
  try {
    console.log('Starting Integration Data Merger service...');
    
    // Start the merger service
    await integrationDataMerger.start();
    
    console.log('Integration Data Merger service started successfully');
    
    // Handle process termination signals to ensure clean shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down Integration Data Merger service...');
      await integrationDataMerger.shutdown();
      console.log('Integration Data Merger service shut down successfully');
    });
    
    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down Integration Data Merger service...');
      await integrationDataMerger.shutdown();
      console.log('Integration Data Merger service shut down successfully');
    });
    
  } catch (error) {
    console.error('Failed to start Integration Data Merger service:', error);
    throw error;
  }
}

// Default export for direct importing
export default initializeIntegrationDataMerger; 