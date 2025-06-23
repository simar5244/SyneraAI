#!/usr/bin/env node

/**
 * This script checks MongoDB data for issues with successor data and risk factors
 * Use it to diagnose data format problems
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

// MongoDB connection settings
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cluster0.nen0dzs.mongodb.net/';
const USERS_COLLECTION = 'users';

// Parse command line arguments
const args = process.argv.slice(2);
let companyCode = null;
let detailed = false;

args.forEach((arg, index) => {
  if (arg === '--company' && args[index + 1]) {
    companyCode = args[index + 1];
  }
  if (arg === '--detailed') {
    detailed = true;
  }
});

if (!companyCode) {
  console.error('Error: Company code is required. Use --company [code]');
  process.exit(1);
}

async function main() {
  console.log(`Checking MongoDB data for company_${companyCode.toLowerCase()}`);
  
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
    const successorAnalysisCount = await collection.countDocuments({
      "successorAnalysisData": { $exists: true }
    });
    console.log(`Users with successorAnalysisData: ${successorAnalysisCount}`);
    
    // Check primaryRiskFactors format issues
    const malformedRiskFactorsCount = await collection.countDocuments({
      $or: [
        { "attritionAssessment.primary_risk_factors": { $exists: true, $not: { $type: "array" } } },
        { "attritionAssessment.primary_risk_factors.0": { $exists: true, $not: { $type: "object" } } },
        { "primary_risk_factors": { $exists: true, $not: { $type: "array" } } },
        { "primary_risk_factors.0": { $exists: true, $not: { $type: "object" } } }
      ]
    });
    console.log(`Users with malformed primaryRiskFactors: ${malformedRiskFactorsCount}`);
    
    // Check for high attrition risk employees
    const highRiskCount = await collection.countDocuments({
      $or: [
        { "attritionAssessment.attrition_risk": "high" },
        { "attritionAssessment.attrition_risk": "very_high" },
        { "attritionAssessment.attrition_score": { $gte: 0.7 } },
        { "attrition_risk": "high" },
        { "attrition_risk": "very_high" },
        { "attrition_score": { $gte: 0.7 } }
      ]
    });
    console.log(`High risk employees: ${highRiskCount}`);
    
    // Check for users with successors
    const withSuccessorsCount = await collection.countDocuments({
      $or: [
        { "successorAnalysisData.successor_candidates.0": { $exists: true } },
        { "successorCandidates.0": { $exists: true } },
        { "successors.0": { $exists: true } }
      ]
    });
    console.log(`Employees with successors: ${withSuccessorsCount}`);
    
    // If detailed mode is enabled, show sample documents
    if (detailed) {
      console.log("\n--- DETAILED ANALYSIS ---\n");
      
      // Show a sample high risk employee
      const highRiskSample = await collection.findOne({
        $or: [
          { "attritionAssessment.attrition_risk": "high" },
          { "attritionAssessment.attrition_risk": "very_high" },
          { "attritionAssessment.attrition_score": { $gte: 0.7 } },
          { "attrition_risk": "high" },
          { "attrition_risk": "very_high" },
          { "attrition_score": { $gte: 0.7 } }
        ]
      });
      
      if (highRiskSample) {
        console.log("Sample high risk employee:");
        console.log(`Email: ${highRiskSample.email}`);
        console.log(`Name: ${highRiskSample.fullName || highRiskSample.firstName + ' ' + highRiskSample.lastName}`);
        console.log(`Attrition Assessment: ${JSON.stringify(highRiskSample.attritionAssessment || {}, null, 2)}`);
        console.log(`Primary Risk Factors: ${JSON.stringify(highRiskSample.attritionAssessment?.primary_risk_factors || highRiskSample.primary_risk_factors || [], null, 2)}`);
      }
      
      // Show a sample employee with successors
      const withSuccessorsSample = await collection.findOne({
        $or: [
          { "successorAnalysisData.successor_candidates.0": { $exists: true } },
          { "successorCandidates.0": { $exists: true } },
          { "successors.0": { $exists: true } }
        ]
      });
      
      if (withSuccessorsSample) {
        console.log("\nSample employee with successors:");
        console.log(`Email: ${withSuccessorsSample.email}`);
        console.log(`Name: ${withSuccessorsSample.fullName || withSuccessorsSample.firstName + ' ' + withSuccessorsSample.lastName}`);
        
        // Check and display successor data fields
        if (withSuccessorsSample.successorAnalysisData?.successor_candidates) {
          console.log("Has successorAnalysisData.successor_candidates with length:", 
                     withSuccessorsSample.successorAnalysisData.successor_candidates.length);
          
          if (withSuccessorsSample.successorAnalysisData.successor_candidates.length > 0) {
            console.log("First successor candidate:", 
                       JSON.stringify(withSuccessorsSample.successorAnalysisData.successor_candidates[0], null, 2));
          }
        }
        
        if (withSuccessorsSample.successorCandidates) {
          console.log("Has successorCandidates with length:", withSuccessorsSample.successorCandidates.length);
        }
        
        if (withSuccessorsSample.successors) {
          console.log("Has successors with length:", withSuccessorsSample.successors.length);
        }
      }
    }
    
    console.log('\nData check complete. If issues were found, run fix_mongodb_connection.js with --fix flag to repair.');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

main().catch(console.error); 