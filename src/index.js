const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const { connectDB, initializeAssociations } = require('./config/database');
const routes = require('./routes');
const { globalErrorHandler } = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize app
const initializeApp = async () => {
  try {
    // Connect to database first
    await connectDB();
    
    // Initialize model associations after database connection
    initializeAssociations();
    
    logger.info('✅ App initialization completed');
  } catch (error) {
    logger.error('❌ App initialization failed:', error);
    process.exit(1);
  }
};

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Rate limiting
app.use(rateLimiter);

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use(globalErrorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const startServer = async () => {
  // Initialize app (database, associations, etc.)
  await initializeApp();
  
  // Start the server
  app.listen(PORT, () => {
    logger.info(`🚀 Recruiter Spam Detection Server running on port ${PORT}`);
    logger.info(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
    logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
  });
};

// Start the application
startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
