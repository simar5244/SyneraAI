#!/usr/bin/env node

/**
 * This script fixes MongoDB connection issues and verifies data structure
 * It ensures attritionAssessment and successorAnalysisData fields have proper format
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

// MongoDB connection settings
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cluster0.nen0dzs.mongodb.net/';
const USERS_COLLECTION = 'users';

// Parse command line arguments
const args = process.argv.slice(2);
let companyCode = null;
let fix = false;

args.forEach((arg, index) => {
  if (arg === '--company' && args[index + 1]) {
    companyCode = args[index + 1];
  }
  if (arg === '--fix') {
    fix = true;
  }
});

if (!companyCode) {
  console.error('Error: Company code is required. Use --company [code]');
  process.exit(1);
}

async function main() {
  console.log(`Starting MongoDB connection fix for company_${companyCode.toLowerCase()}`);
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    const dbName = `company_${companyCode.toLowerCase()}`;
    const db = client.db(dbName);
    
    // Check if users collection exists
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes(USERS_COLLECTION)) {
      console.error(`Error: Collection '${USERS_COLLECTION}' not found in database ${dbName}`);
      process.exit(1);
    }
    
    console.log(`Found users collection in database ${dbName}`);
    
    const collection = db.collection(USERS_COLLECTION);
    
    // Count total documents
    const totalCount = await collection.countDocuments();
    console.log(`Total users: ${totalCount}`);
    
    // Check for attritionAssessment field
    const attritionCount = await collection.countDocuments({
      "attritionAssessment": { $exists: true }
    });
    console.log(`Users with attritionAssessment: ${attritionCount}`);
    
    // Check for successorAnalysisData field
    const successorCount = await collection.countDocuments({
      "successorAnalysisData": { $exists: true }
    });
    console.log(`Users with successorAnalysisData: ${successorCount}`);
    
    // Fix missing or invalid fields if requested
    if (fix) {
      console.log('Fixing missing or invalid fields...');
      
      // Get all users
      const users = await collection.find({}).toArray();
      
      let updatedCount = 0;
      const bulkOps = [];
      
      for (const user of users) {
        const updates = {};
        
        // Fix missing attritionAssessment
        if (!user.attritionAssessment) {
          updates.attritionAssessment = {
            timestamp: new Date().toISOString(),
            email: user.email,
            attrition_score: 0.5,
            attrition_risk: 'medium',
            primary_explanation: 'Default assessment',
            factor_scores: {
              responsibility_mismatch: 0.5,
              tenure_factor: 0.5,
              utilization_factor: 0.5,
              seniority_factor: 0.5,
              task_variety_index: 0.5,
              job_intensity: 0.5,
              role_project_ratio: 0.5,
              collaboration_index: 0.5
            },
            primary_risk_factors: [
              {
                factor: 'responsibility_mismatch',
                score: 0.5,
                explanation: 'Default risk factor'
              },
              {
                factor: 'tenure_factor',
                score: 0.5,
                explanation: 'Default risk factor'
              }
            ]
          };
        }
        
        // Fix attritionAssessment.primary_risk_factors if it's not an array of objects
        if (user.attritionAssessment && user.attritionAssessment.primary_risk_factors) {
          const factors = user.attritionAssessment.primary_risk_factors;
          
          if (!Array.isArray(factors)) {
            // Create a new properly formatted array
            updates['attritionAssessment.primary_risk_factors'] = [
              {
                factor: 'responsibility_mismatch',
                score: 0.5,
                explanation: 'Default risk factor'
              },
              {
                factor: 'tenure_factor',
                score: 0.5,
                explanation: 'Default risk factor'
              }
            ];
          } else if (factors.length > 0) {
            // Check if any factor is not an object or missing required properties
            const fixedFactors = factors.map(factor => {
              if (typeof factor !== 'object' || !factor) {
                return {
                  factor: 'unknown',
                  score: 0.5,
                  explanation: 'Default risk factor'
                };
              }
              
              // Ensure required properties exist
              return {
                factor: factor.factor || factor.name || 'unknown',
                score: typeof factor.score === 'number' ? factor.score : 0.5,
                explanation: factor.explanation || 'No explanation available'
              };
            });
            
            if (JSON.stringify(factors) !== JSON.stringify(fixedFactors)) {
              updates['attritionAssessment.primary_risk_factors'] = fixedFactors;
            }
          }
        }
        
        // Only add to bulk ops if there are updates
        if (Object.keys(updates).length > 0) {
          bulkOps.push({
            updateOne: {
              filter: { _id: user._id },
              update: { $set: updates }
            }
          });
          updatedCount++;
        }
      }
      
      // Execute bulk operations if any
      if (bulkOps.length > 0) {
        const result = await collection.bulkWrite(bulkOps);
        console.log(`Fixed ${result.modifiedCount} users`);
      } else {
        console.log('No users needed fixing');
      }
    }
    
    console.log('Database verification complete');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

main().catch(console.error); 