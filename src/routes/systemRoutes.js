const express = require('express');
const router = express.Router();

// Services
const externalVerification = require('../services/externalVerification');
const llmScoring = require('../services/llmScoring');
const scoringWorkflow = require('../services/scoringWorkflow');

// Models
const Recruiter = require('../models/Recruiter');
const VerificationResult = require('../models/VerificationResult');

// Middleware
const rateLimiter = require('../middleware/rateLimiter');
const { sanitizeInput } = require('../middleware/validation');
const logger = require('../utils/logger');

// Apply sanitization to all routes
router.use(sanitizeInput);

/**
 * @route   GET /api/system/health
 * @desc    Comprehensive system health check
 * @access  Public
 */
router.get('/health',
  rateLimiter.general,
  async (req, res) => {
    try {
      const startTime = Date.now();
      
      // Check database connectivity
      const dbHealth = await checkDatabaseHealth();
      
      // Check external services
      const externalHealth = await checkExternalServices();
      
      // Check recent system performance
      const performanceHealth = await checkPerformanceHealth();
      
      // Calculate overall health
      const overallHealth = calculateOverallHealth([
        dbHealth, externalHealth, performanceHealth
      ]);
      
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        status: overallHealth.status,
        data: {
          overall: overallHealth,
          components: {
            database: dbHealth,
            externalServices: externalHealth,
            performance: performanceHealth
          },
          system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version,
            environment: process.env.NODE_ENV,
            responseTime
          },
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        message: 'Health check failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @route   GET /api/system/stats
 * @desc    Get system statistics and metrics
 * @access  Public (in production, should be admin-only)
 */
router.get('/stats',
  rateLimiter.general,
  async (req, res) => {
    try {
      const [
        totalRecruiters,
        totalVerifications,
        recentActivity,
        systemStats
      ] = await Promise.all([
        Recruiter.count(),
        VerificationResult.count(),
        getRecentActivity(),
        getSystemStats()
      ]);
      
      res.json({
        success: true,
        data: {
          database: {
            recruiters: totalRecruiters,
            verifications: totalVerifications
          },
          activity: recentActivity,
          system: systemStats,
          generatedAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Stats retrieval failed', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve system statistics',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/system/test-connections
 * @desc    Test all external API connections
 * @access  Admin (in production, add authentication)
 */
router.post('/test-connections',
  rateLimiter.general,
  async (req, res) => {
    try {
      logger.info('Testing external connections', { triggeredBy: req.ip });
      
      // Test external verification services
      const externalTests = await externalVerification.testConnections();
      
      // Test LLM service
      const llmTest = await llmScoring.testConnection();
      
      // Combine results
      const allTests = {
        ...externalTests,
        gemini: llmTest
      };
      
      // Calculate overall status
      const successfulTests = Object.values(allTests).filter(test => test.status === 'success').length;
      const totalTests = Object.keys(allTests).length;
      const overallStatus = successfulTests === totalTests ? 'all_connected' :
                           successfulTests > totalTests / 2 ? 'partially_connected' : 'mostly_disconnected';
      
      res.json({
        success: true,
        data: {
          overall: {
            status: overallStatus,
            successful: successfulTests,
            total: totalTests,
            successRate: Math.round((successfulTests / totalTests) * 100)
          },
          services: allTests,
          testedAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Connection testing failed', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to test connections',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/system/config
 * @desc    Get system configuration (non-sensitive)
 * @access  Admin (in production, add authentication)
 */
router.get('/config',
  rateLimiter.general,
  (req, res) => {
    const config = {
      scoring: {
        weights: {
          ruleBased: parseFloat(process.env.RULE_BASED_WEIGHT) || 0.3,
          llm: parseFloat(process.env.LLM_WEIGHT) || 0.4,
          external: parseFloat(process.env.EXTERNAL_API_WEIGHT) || 0.3
        },
        threshold: parseInt(process.env.SPAM_THRESHOLD) || 70
      },
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
      },
      system: {
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        port: process.env.PORT || 3000
      },
      features: {
        geminiEnabled: !!process.env.GEMINI_API_KEY,
        hunterEnabled: !!process.env.HUNTER_API_KEY,
        clearbitEnabled: !!process.env.CLEARBIT_API_KEY,
        numverifyEnabled: !!process.env.NUMVERIFY_API_KEY
      }
    };
    
    res.json({
      success: true,
      data: config,
      note: 'Sensitive configuration values are hidden for security'
    });
  }
);

/**
 * @route   POST /api/system/cleanup
 * @desc    Cleanup old data (admin operation)
 * @access  Admin (in production, add authentication)
 */
router.post('/cleanup',
  rateLimiter.general,
  async (req, res) => {
    try {
      const { daysOld = 90, dryRun = true } = req.body;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const { Op } = require('sequelize');
      
      // Count records that would be affected
      const oldRecruiters = await Recruiter.count({
        where: {
          created_at: { [Op.lt]: cutoffDate },
          status: { [Op.in]: ['rejected', 'flagged'] }
        }
      });
      
      const oldVerifications = await VerificationResult.count({
        where: {
          created_at: { [Op.lt]: cutoffDate }
        }
      });
      
      let deletedRecruiters = 0;
      let deletedVerifications = 0;
      
      if (!dryRun) {
        // Perform actual cleanup
        const recruiterResult = await Recruiter.destroy({
          where: {
            created_at: { [Op.lt]: cutoffDate },
            status: { [Op.in]: ['rejected', 'flagged'] }
          }
        });
        
        const verificationResult = await VerificationResult.destroy({
          where: {
            created_at: { [Op.lt]: cutoffDate }
          }
        });
        
        deletedRecruiters = recruiterResult;
        deletedVerifications = verificationResult;
        
        logger.info('Data cleanup completed', {
          daysOld,
          deletedRecruiters,
          deletedVerifications,
          triggeredBy: req.ip
        });
      }
      
      res.json({
        success: true,
        data: {
          dryRun,
          daysOld,
          cutoffDate,
          found: {
            recruiters: oldRecruiters,
            verifications: oldVerifications
          },
          deleted: {
            recruiters: deletedRecruiters,
            verifications: deletedVerifications
          },
          message: dryRun ? 'Dry run completed - no data was deleted' : 'Cleanup completed'
        }
      });
      
    } catch (error) {
      logger.error('Data cleanup failed', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Cleanup operation failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/system/logs
 * @desc    Get recent system logs (last 100 entries)
 * @access  Admin (in production, add authentication)
 */
router.get('/logs',
  rateLimiter.general,
  (req, res) => {
    const { level = 'info', limit = 100 } = req.query;
    
    // In a real implementation, you'd read from log files
    // For now, return a message about log access
    res.json({
      success: true,
      message: 'Log access endpoint',
      note: 'In production, this would return actual log entries from log files',
      parameters: { level, limit },
      logFiles: {
        app: 'logs/app.log',
        error: 'logs/error.log',
        exceptions: 'logs/exceptions.log'
      }
    });
  }
);

// Helper functions

async function checkDatabaseHealth() {
  try {
    const start = Date.now();
    await Recruiter.findOne({ limit: 1 });
    const responseTime = Date.now() - start;
    
    return {
      status: responseTime < 1000 ? 'healthy' : 'slow',
      responseTime,
      message: `Database responding in ${responseTime}ms`
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: null,
      message: error.message
    };
  }
}

async function checkExternalServices() {
  const services = {
    gemini: !!process.env.GEMINI_API_KEY,
    hunter: !!process.env.HUNTER_API_KEY,
    clearbit: !!process.env.CLEARBIT_API_KEY,
    numverify: !!process.env.NUMVERIFY_API_KEY
  };
  
  const enabledServices = Object.values(services).filter(Boolean).length;
  const status = enabledServices >= 2 ? 'healthy' : enabledServices >= 1 ? 'limited' : 'none';
  
  return {
    status,
    enabled: services,
    enabledCount: enabledServices,
    message: `${enabledServices} external services configured`
  };
}

async function checkPerformanceHealth() {
  try {
    const { Op } = require('sequelize');
    const recentResults = await VerificationResult.findAll({
      where: {
        created_at: { [Op.gte]: new Date(Date.now() - 60 * 60 * 1000) }
      },
      attributes: ['processing_metrics'],
      limit: 50
    });
    
    if (recentResults.length === 0) {
      return {
        status: 'unknown',
        message: 'No recent activity to analyze'
      };
    }
    
    const avgProcessingTime = recentResults.reduce((sum, result) => 
      sum + (result.processing_metrics?.totalProcessingTime || 0), 0
    ) / recentResults.length;
    
    const status = avgProcessingTime < 30000 ? 'healthy' : 
                  avgProcessingTime < 60000 ? 'slow' : 'unhealthy';
    
    return {
      status,
      avgProcessingTime: Math.round(avgProcessingTime),
      recentSamples: recentResults.length,
      message: `Avg processing time: ${Math.round(avgProcessingTime)}ms`
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message
    };
  }
}

function calculateOverallHealth(components) {
  const healthyCount = components.filter(c => c.status === 'healthy').length;
  const totalComponents = components.length;
  const healthPercent = healthyCount / totalComponents;
  
  let status, message;
  if (healthPercent >= 1.0) {
    status = 'healthy';
    message = 'All systems operational';
  } else if (healthPercent >= 0.7) {
    status = 'degraded';
    message = 'Some systems experiencing issues';
  } else {
    status = 'unhealthy';
    message = 'Multiple systems experiencing issues';
  }
  
  return {
    status,
    message,
    healthyComponents: healthyCount,
    totalComponents,
    healthPercent: Math.round(healthPercent * 100)
  };
}

async function getRecentActivity() {
  const { Op } = require('sequelize');
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const [recentSignups, recentVerifications] = await Promise.all([
    Recruiter.count({ where: { created_at: { [Op.gte]: oneHourAgo } } }),
    VerificationResult.count({ where: { created_at: { [Op.gte]: oneHourAgo } } })
  ]);
  
  const [dailySignups, dailyVerifications] = await Promise.all([
    Recruiter.count({ where: { created_at: { [Op.gte]: oneDayAgo } } }),
    VerificationResult.count({ where: { created_at: { [Op.gte]: oneDayAgo } } })
  ]);
  
  return {
    lastHour: {
      signups: recentSignups,
      verifications: recentVerifications
    },
    last24Hours: {
      signups: dailySignups,
      verifications: dailyVerifications
    }
  };
}

function getSystemStats() {
  return {
    uptime: Math.round(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    cpu: {
      usage: process.cpuUsage()
    },
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };
}

module.exports = router;
