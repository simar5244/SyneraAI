/**
 * Successor Analysis Cron Job
 * 
 * This script runs the successor identification analysis every 24 hours
 * and updates the MongoDB collection with the results.
 * 
 * Run with: node successor_cron.js
 */

const { exec } = require('child_process');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

// Configuration
const CRON_SCHEDULE = '0 0 * * *'; // Run once a day at midnight (24 hours)
const LOG_FILE = path.join(process.cwd(), 'successor_cron.log');
const MAX_BATCH_SIZE = 10; // Process up to 10 employees at a time to prevent excessive iterations

// Helper function to log messages
function logMessage(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  // Log to console and file
  console.log(message);
  fs.appendFileSync(LOG_FILE, logEntry);
}

// Run the successor identification with error handling
function runSuccessorIdentification() {
  logMessage('Starting successor identification process...');
  
  // Set the correct environment variables for Gemini
  process.env.GEMINI_MODEL = 'gemini-2.0-flash-001';
  
  // Run the successor identification script with batch size limit
  exec(`python3 ${path.join(process.cwd(), 'successor_identification.py')} --refresh --batch-size ${MAX_BATCH_SIZE}`, 
  (error, stdout, stderr) => {
    if (error) {
      logMessage(`Error running successor identification: ${error.message}`);
      return;
    }
    
    if (stderr) {
      logMessage(`Script errors: ${stderr}`);
    }
    
    logMessage('Successor identification completed successfully.');
    logMessage(stdout);
  });
}

// Initialize
logMessage('Successor cron job initialized. Will run once per day.');

// Schedule the cron job
cron.schedule(CRON_SCHEDULE, () => {
  logMessage('Running scheduled successor identification...');
  try {
    runSuccessorIdentification();
  } catch (error) {
    logMessage(`Uncaught error in cron job: ${error.message}`);
  }
});

// Run once immediately on startup
try {
  logMessage('Running initial successor identification...');
  runSuccessorIdentification();
} catch (error) {
  logMessage(`Error running initial job: ${error.message}`);
}

console.log('Successor analysis cron job started. Running every 24 hours.');
console.log(`Logs are being written to ${LOG_FILE}`);
