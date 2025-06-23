// Simple test script to verify API endpoints
// Usage: node test_api_endpoints.js

const fetch = require('node-fetch');

async function testEndpoints() {
  console.log('Testing API endpoints...');
  
  // 1. Test successors endpoint with a known employee email
  try {
    const email = 'a@company.com'; // Replace with a known email in your database
    console.log(`\nTesting successors endpoint for ${email}...`);
    
    const response = await fetch(`http://localhost:3000/api/organization/employee/successors?email=${email}`);
    const status = response.status;
    const result = await response.json();
    
    console.log(`Status: ${status}`);
    console.log(`Has successor analysis: ${result.successorAnalysis ? 'Yes' : 'No'}`);
    
    if (result.successorAnalysis) {
      console.log(`- Top successors: ${result.successorAnalysis.top_successors?.length || 0}`);
      console.log(`- Non-viable options: ${result.successorAnalysis.nonViableOptions?.length || 0}`);
    }
  } catch (error) {
    console.error('Error testing successors endpoint:', error);
  }
  
  // 2. Test preview redistribution endpoint
  try {
    console.log('\nTesting preview redistribution endpoint...');
    
    const response = await fetch('http://localhost:3000/api/organization/preview-redistribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removedEmployeeEmail: 'a@company.com', // Replace with a known email
        selectedSuccessors: ['b@company.com', 'c@company.com'] // Replace with known successors
      }),
    });
    
    const status = response.status;
    const result = await response.json();
    
    console.log(`Status: ${status}`);
    console.log(`Duties redistributed: ${result.redistributedDuties || 0}`);
    console.log(`Duty assignments: ${(result.dutyAssignments || []).length}`);
  } catch (error) {
    console.error('Error testing preview redistribution endpoint:', error);
  }
  
  // 3. Test redistribute endpoint
  try {
    console.log('\nTesting redistribute endpoint...');
    
    const response = await fetch('http://localhost:3000/api/organization/redistribute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removedEmployeeEmail: 'a@company.com', // Replace with a known email
        selectedSuccessors: ['b@company.com', 'c@company.com'], // Replace with known successors
        updateDatabase: false // Set to false to avoid actual changes
      }),
    });
    
    const status = response.status;
    let result;
    
    try {
      result = await response.json();
    } catch (e) {
      result = { error: 'Failed to parse response' };
    }
    
    console.log(`Status: ${status}`);
    
    if (status === 200) {
      console.log(`Success: ${result.success}`);
      console.log(`Message: ${result.message}`);
    } else {
      console.log(`Error: ${result.error || 'Unknown error'}`);
      if (result.details) {
        console.log(`Details: ${result.details}`);
      }
    }
  } catch (error) {
    console.error('Error testing redistribute endpoint:', error);
  }
  
  console.log('\nAPI testing complete!');
}

testEndpoints().catch(console.error); 