#!/usr/bin/env node

/**
 * Setup script for Recruiter Spam Detection System
 * 
 * This script helps initialize the project by:
 * 1. Checking environment variables
 * 2. Testing database connection
 * 3. Creating initial indexes
 * 4. Testing external API connections
 * 5. Running basic health checks
 */

const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');
require('dotenv').config();

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

async function main() {
  log('\n🚀 Recruiter Spam Detection System Setup', 'magenta');
  log('==========================================\n', 'magenta');
  
  try {
    // Step 1: Check environment file
    await checkEnvironmentFile();
    
    // Step 2: Validate required environment variables
    await checkEnvironmentVariables();
    
    // Step 3: Test database connection
    await testDatabaseConnection();
    
    // Step 4: Create database indexes
    await createDatabaseIndexes();
    
    // Step 5: Test external API connections
    await testExternalConnections();
    
    // Step 6: Create logs directory
    await createLogsDirectory();
    
    // Step 7: Run system health check
    await runHealthCheck();
    
    // Step 8: Display setup summary
    displaySetupSummary();
    
    log('\n🎉 Setup completed successfully!', 'green');
    log('You can now start the server with: npm start', 'blue');
    
  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    process.exit(1);
  }
}

async function checkEnvironmentFile() {
  logStep(1, 'Checking environment configuration...');
  
  const envPath = path.join(__dirname, '..', '.env');
  const examplePath = path.join(__dirname, '..', 'env.example');
  
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(examplePath)) {
      logWarning('.env file not found, copying from env.example');
      fs.copyFileSync(examplePath, envPath);
      logSuccess('.env file created from template');
    } else {
      throw new Error('.env file not found and no env.example available');
    }
  } else {
    logSuccess('.env file found');
  }
  
  // Check if .env has placeholder values
  const envContent = fs.readFileSync(envPath, 'utf8');
  const placeholders = envContent.match(/your_\w+_here/g);
  
  if (placeholders) {
    logWarning(`Found ${placeholders.length} placeholder values in .env file:`);
    placeholders.forEach(placeholder => {
      log(`   - ${placeholder}`, 'yellow');
    });
    log('   Please update these values before running the application', 'yellow');
  }
}

async function checkEnvironmentVariables() {
  logStep(2, 'Validating environment variables...');
  
  const required = [
    'PORT',
    'NODE_ENV',
    'DB_HOST',
    'DB_NAME',
    'JWT_SECRET',
    'SPAM_THRESHOLD'
  ];
  
  const optional = [
    'GEMINI_API_KEY',
    'HUNTER_API_KEY',
    'CLEARBIT_API_KEY',
    'NUMVERIFY_API_KEY'
  ];
  
  let missingRequired = [];
  let missingOptional = [];
  
  required.forEach(key => {
    if (!process.env[key]) {
      missingRequired.push(key);
    }
  });
  
  optional.forEach(key => {
    if (!process.env[key]) {
      missingOptional.push(key);
    }
  });
  
  if (missingRequired.length > 0) {
    logError(`Missing required environment variables: ${missingRequired.join(', ')}`);
    throw new Error('Required environment variables are missing');
  }
  
  if (missingOptional.length > 0) {
    logWarning(`Missing optional environment variables: ${missingOptional.join(', ')}`);
    log('   The system will work with reduced functionality', 'yellow');
  }
  
  logSuccess(`All required environment variables are set`);
  
  // Validate specific values
  const threshold = parseInt(process.env.SPAM_THRESHOLD);
  if (isNaN(threshold) || threshold < 0 || threshold > 100) {
    throw new Error('SPAM_THRESHOLD must be a number between 0 and 100');
  }
  
  const weights = [
    parseFloat(process.env.RULE_BASED_WEIGHT) || 0.3,
    parseFloat(process.env.LLM_WEIGHT) || 0.4,
    parseFloat(process.env.EXTERNAL_API_WEIGHT) || 0.3
  ];
  
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    logWarning(`Scoring weights sum to ${totalWeight.toFixed(2)} instead of 1.0`);
  }
}

async function testDatabaseConnection() {
  logStep(3, 'Testing database connection...');
  
  try {
    const { Sequelize } = require('sequelize');
    
    const sequelize = new Sequelize({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'recruiter_spam_detection',
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      dialect: 'mysql',
      logging: false // Disable logging during tests
    });
    
    // Test the connection
    await sequelize.authenticate();
    logSuccess('MySQL connection successful');
    
    // Test basic operations
    await sequelize.query('SELECT 1 + 1 AS result');
    logSuccess('Database operations test passed');
    
    await sequelize.close();
    
  } catch (error) {
    logError(`MySQL connection failed: ${error.message}`);
    
    // For demo purposes, show helpful message
    logWarning('💡 Make sure MySQL is running: brew services start mysql');
    logWarning('💡 Database will be created automatically when the app starts');
    
    // Don't fail setup for database issues in development
    if (process.env.NODE_ENV === 'development') {
      logWarning('⚠️  Continuing setup despite database connection issue');
    } else {
      throw error;
    }
  }
}

async function createDatabaseIndexes() {
  logStep(4, 'Setting up database tables...');
  
  try {
    const { sequelize } = require('../src/config/database');
    
    // Import models to register them with Sequelize
    require('../src/models/Recruiter');
    require('../src/models/VerificationResult');
    
    // Sync database (create tables and indexes)
    await sequelize.sync({ alter: true });
    
    logSuccess('Database tables and indexes created successfully');
    
    await sequelize.close();
    
  } catch (error) {
    logWarning(`Database table setup warning: ${error.message}`);
    // Don't fail setup for table creation issues
  }
}

async function testExternalConnections() {
  logStep(5, 'Testing external API connections...');
  
  const tests = [];
  
  // Test Gemini
  if (process.env.GEMINI_API_KEY) {
    tests.push(testGemini());
  } else {
    logWarning('Gemini API key not configured - LLM scoring will be disabled');
  }
  
  // Test Hunter.io
  if (process.env.HUNTER_API_KEY) {
    tests.push(testHunter());
  } else {
    logWarning('Hunter.io API key not configured - email verification will be limited');
  }
  
  // Test other APIs as needed
  if (process.env.NUMVERIFY_API_KEY) {
    logSuccess('Numverify API key configured');
  }
  
  if (process.env.CLEARBIT_API_KEY) {
    logSuccess('Clearbit API key configured');
  }
  
  if (tests.length === 0) {
    logWarning('No external APIs configured - system will use basic verification only');
    return;
  }
  
  try {
    await Promise.allSettled(tests);
    logSuccess('External API connection tests completed');
  } catch (error) {
    logWarning(`Some external API tests failed: ${error.message}`);
  }
}

async function testGemini() {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro',
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 10,
      }
    });
    
    // Simple test call
    const result = await model.generateContent('Say "OK" if you can hear me.');
    const response = result.response.text().trim();
    
    logSuccess('Gemini API connection successful');
  } catch (error) {
    logWarning(`Gemini API test failed: ${error.message}`);
  }
}

async function testHunter() {
  try {
    const axios = require('axios');
    
    const response = await axios.get('https://api.hunter.io/v2/account', {
      params: { api_key: process.env.HUNTER_API_KEY },
      timeout: 10000
    });
    logger.info("----",response);
    logger.info("----",process.env.HUNTER_API_KEY);
    if (response.data && response.data.data) {
      logSuccess('Hunter.io API connection successful');
    } else {
      throw new Error('Invalid response from Hunter.io API');
    }
  } catch (error) {
    logWarning(`Hunter.io API test failed: ${error.message}`);
  }
}

async function createLogsDirectory() {
  logStep(6, 'Setting up logs directory...');
  
  const logsDir = path.join(__dirname, '..', 'logs');
  
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    logSuccess('Logs directory created');
  } else {
    logSuccess('Logs directory already exists');
  }
  
  // Create .gitkeep file
  const gitkeepPath = path.join(logsDir, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, '');
  }
}

async function runHealthCheck() {
  logStep(7, 'Running system health check...');
  
  try {
    // Import services to test them
    const ruleBasedScoring = require('../src/services/ruleBasedScoring');
    const scoringWorkflow = require('../src/services/scoringWorkflow');
    
    // Test a simple scoring operation
    const testData = {
      fullName: 'Test User',
      companyName: 'Test Company',
      websiteUrl: 'https://example.com',
      businessEmail: 'test@example.com',
      phoneNumber: '1234567890',
      role: 'Recruiter',
      industry: 'Technology'
    };
    
    const result = await ruleBasedScoring.scoreRecruiter(testData);
    
    if (result && typeof result.score === 'number') {
      logSuccess('Core scoring system health check passed');
    } else {
      throw new Error('Invalid scoring result');
    }
    
  } catch (error) {
    logWarning(`Health check warning: ${error.message}`);
  }
}

function displaySetupSummary() {
  log('\n📋 Setup Summary', 'blue');
  log('================\n', 'blue');
  
  log('🔧 Configuration:', 'cyan');
  log(`   Environment: ${process.env.NODE_ENV}`);
  log(`   Port: ${process.env.PORT}`);
  log(`   MongoDB: ${process.env.MONGODB_URI ? 'Configured' : 'Not configured'}`);
  log(`   Spam Threshold: ${process.env.SPAM_THRESHOLD}%`);
  
  log('\n🔌 External Services:', 'cyan');
  log(`   Gemini: ${process.env.GEMINI_API_KEY ? '✅ Enabled' : '❌ Disabled'}`);
  log(`   Hunter.io: ${process.env.HUNTER_API_KEY ? '✅ Enabled' : '❌ Disabled'}`);
  log(`   Clearbit: ${process.env.CLEARBIT_API_KEY ? '✅ Enabled' : '❌ Disabled'}`);
  log(`   Numverify: ${process.env.NUMVERIFY_API_KEY ? '✅ Enabled' : '❌ Disabled'}`);
  
  log('\n📊 Scoring Configuration:', 'cyan');
  log(`   Rule-based weight: ${process.env.RULE_BASED_WEIGHT || '0.3'}`);
  log(`   LLM weight: ${process.env.LLM_WEIGHT || '0.4'}`);
  log(`   External API weight: ${process.env.EXTERNAL_API_WEIGHT || '0.3'}`);
  
  log('\n🚦 Next Steps:', 'cyan');
  log('   1. Review and update .env file with your API keys');
  log('   2. Start the server: npm start');
  log('   3. Test the API: curl http://localhost:3000/health');
  log('   4. View API docs: http://localhost:3000/api/docs');
  log('   5. Test recruiter signup: POST http://localhost:3000/api/recruiters/signup');
}

// Run setup if called directly
if (require.main === module) {
  main().catch(error => {
    logError(`Setup script failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  checkEnvironmentFile,
  checkEnvironmentVariables,
  testDatabaseConnection,
  createDatabaseIndexes,
  testExternalConnections
};
