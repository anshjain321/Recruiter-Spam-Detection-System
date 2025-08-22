const winston = require('winston');
const path = require('path');

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'recruiter-spam-detection' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat
    })
  ]
});

// Add request ID to logs if available
logger.addRequestId = (requestId) => {
  return logger.child({ requestId });
};

// Performance monitoring helpers
logger.startTimer = (label) => {
  const start = Date.now();
  return {
    end: () => {
      const duration = Date.now() - start;
      logger.info(`⏱️  ${label} completed in ${duration}ms`);
      return duration;
    }
  };
};

// Structured logging helpers
logger.logApiCall = (method, endpoint, statusCode, duration, metadata = {}) => {
  logger.info('API Call', {
    method,
    endpoint,
    statusCode,
    duration,
    ...metadata
  });
};

logger.logScoringResult = (recruiterId, finalScore, decision, breakdown) => {
  logger.info('Scoring Completed', {
    recruiterId,
    finalScore,
    decision,
    breakdown
  });
};

logger.logExternalApiCall = (provider, endpoint, success, duration, error = null) => {
  const logData = {
    provider,
    endpoint,
    success,
    duration
  };
  
  if (error) {
    logData.error = error.message;
    logger.error('External API Call Failed', logData);
  } else {
    logger.info('External API Call', logData);
  }
};

module.exports = logger;
