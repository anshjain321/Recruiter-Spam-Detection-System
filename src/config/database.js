const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// Create Sequelize instance
const sequelize = new Sequelize({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'recruiter_spam_detection',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  dialect: 'mysql',
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

const connectDB = async () => {
  try {
    // Test the connection
    await sequelize.authenticate();
    logger.info('✅ MySQL connected successfully');
    
    // Sync database (create tables if they don't exist)
    // Use force: false and alter: false to avoid schema conflicts
    await sequelize.sync({ 
      force: false,
      alter: false,
      logging: false // Reduce log noise
    });
    logger.info('✅ Database tables synchronized');
    
  } catch (error) {
    logger.error('❌ MySQL connection failed:', error.message);
    
    // For demo purposes, don't exit - just warn
    if (process.env.NODE_ENV === 'development') {
      logger.warn('⚠️  Continuing without database for demo purposes');
    } else {
      process.exit(1);
    }
  }
};

// Initialize model associations (called after all models are loaded)
const initializeAssociations = () => {
  try {
    const Recruiter = require('../models/Recruiter');
    const VerificationResult = require('../models/VerificationResult');
    
    // Create models object for associations
    const models = { Recruiter, VerificationResult };
    
    // Initialize associations if they exist
    if (Recruiter.associate) Recruiter.associate(models);
    if (VerificationResult.associate) VerificationResult.associate(models);
    
    logger.info('✅ Model associations initialized');
    return true;
  } catch (error) {
    logger.warn('⚠️  Model associations skipped:', error.message);
    return false;
  }
};

// Graceful close function
const closeDB = async () => {
  try {
    await sequelize.close();
    logger.info('📤 MySQL connection closed');
  } catch (error) {
    logger.error('Error closing MySQL connection:', error);
  }
};

module.exports = { connectDB, sequelize, initializeAssociations };
