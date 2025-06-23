import integrationDataMerger from '../utils/integrationDataMerger';

/**
 * Initialize server components and background services
 */
export async function initializeServer() {
  console.log('Initializing server components...');
  
  // Start integration data merger service
  try {
    console.log('Starting integration data merger service...');
    await integrationDataMerger.start();
    console.log('Integration data merger service started successfully');
  } catch (error) {
    console.error('Failed to start integration data merger service, continuing without it:', error);
  }
  
  // Register process shutdown handlers
  process.on('SIGTERM', handleGracefulShutdown);
  process.on('SIGINT', handleGracefulShutdown);
  
  console.log('Server initialization complete');
}

/**
 * Handle graceful shutdown of server components
 */
async function handleGracefulShutdown() {
  console.log('Shutting down server components...');
  
  try {
    console.log('Stopping integration data merger service...');
    await integrationDataMerger.shutdown();
    console.log('Integration data merger service stopped');
  } catch (error) {
    console.error('Error shutting down integration data merger service:', error);
  }
  
  console.log('Server shutdown complete');
  process.exit(0);
}

// Export a function to invoke from the server entry point
export default initializeServer; 