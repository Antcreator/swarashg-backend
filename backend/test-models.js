// TEST SCRIPT - Run this to check models
// Save as: backend/test-models.js
// Run with: node backend/test-models.js

console.log('\n=== TESTING MODELS ===\n');

try {
  const models = require('./models');
  
  console.log('✓ Models loaded successfully');
  console.log('\nAvailable models:', Object.keys(models));
  
  console.log('\nChecking required models:');
  console.log('Deposit:', typeof models.Deposit);
  console.log('SeedCapital:', typeof models.SeedCapital);
  console.log('Member:', typeof models.Member);
  console.log('Loan:', typeof models.Loan);
  console.log('Savings:', typeof models.Savings);
  console.log('LoanPayment:', typeof models.LoanPayment);
  console.log('User:', typeof models.User);
  console.log('sequelize:', typeof models.sequelize);
  
  if (typeof models.Deposit === 'undefined') {
    console.log('\n✗ ERROR: Deposit model is undefined!');
    console.log('You need to add it to models/index.js');
  }
  
  if (typeof models.SeedCapital === 'undefined') {
    console.log('\n✗ ERROR: SeedCapital model is undefined!');
    console.log('You need to add it to models/index.js');
  }
  
  console.log('\n=== TEST COMPLETE ===\n');
  
} catch (error) {
  console.log('\n✗ ERROR loading models:');
  console.log(error.message);
  console.log('\nFull error:');
  console.log(error);
}