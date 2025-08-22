const express = require('express');
const router = express.Router();

// Controllers
const dashboardController = require('../controllers/dashboardController');

// Middleware
const rateLimiter = require('../middleware/rateLimiter');
const {
  validateDashboardQuery,
  sanitizeInput,
  handleValidationErrors
} = require('../middleware/validation');

// Apply sanitization to all routes
router.use(sanitizeInput);

/**
 * @route   GET /api/dashboard/overview
 * @desc    Get dashboard overview statistics
 * @access  Public (in production, should be admin-only)
 * @query   timeframe - 1h, 24h, 7d, 30d (default: 24h)
 */
router.get('/overview',
  rateLimiter.general,
  validateDashboardQuery,
  handleValidationErrors,
  dashboardController.getOverview
);

/**
 * @route   GET /api/dashboard/analytics
 * @desc    Get comprehensive analytics data
 * @access  Public (in production, should be admin-only)
 * @query   timeframe - 1h, 24h, 7d, 30d (default: 7d)
 */
router.get('/analytics',
  rateLimiter.general,
  validateDashboardQuery,
  handleValidationErrors,
  dashboardController.getScoreAnalytics
);

/**
 * @route   GET /api/dashboard/analytics/scores
 * @desc    Get score distribution and trend analytics
 * @access  Public (in production, should be admin-only)
 * @query   timeframe - 24h, 7d, 30d (default: 7d)
 */
router.get('/analytics/scores',
  rateLimiter.general,
  validateDashboardQuery,
  handleValidationErrors,
  dashboardController.getScoreAnalytics
);

/**
 * @route   GET /api/dashboard/analytics/performance
 * @desc    Get system performance metrics and API usage
 * @access  Public (in production, should be admin-only)
 * @query   timeframe - 24h, 7d, 30d (default: 7d)
 */
router.get('/analytics/performance',
  rateLimiter.general,
  validateDashboardQuery,
  handleValidationErrors,
  dashboardController.getPerformanceMetrics
);

/**
 * @route   GET /api/dashboard/analytics/flags
 * @desc    Analyze flagged recruiters and common issues
 * @access  Public (in production, should be admin-only)
 * @query   timeframe - 24h, 7d, 30d (default: 7d)
 * @query   limit - max flagged recruiters to return (default: 20)
 */
router.get('/analytics/flags',
  rateLimiter.general,
  validateDashboardQuery,
  handleValidationErrors,
  dashboardController.getFlaggedAnalysis
);

/**
 * @route   GET /api/dashboard/export
 * @desc    Export verification data for analysis
 * @access  Admin (in production, add authentication)
 * @query   format - json, csv (default: json)
 * @query   timeframe - 7d, 30d, 90d (default: 30d)
 * @query   includePersonalData - true, false (default: false)
 */
router.get('/export',
  rateLimiter.general,
  validateDashboardQuery,
  handleValidationErrors,
  dashboardController.exportData
);

/**
 * @route   GET /api/dashboard/health
 * @desc    Get system health status
 * @access  Public
 */
router.get('/health',
  rateLimiter.general,
  dashboardController.getSystemHealth
);

// Additional analytics endpoints for specific insights

/**
 * @route   GET /api/dashboard/trends/daily
 * @desc    Get daily trends for the dashboard
 * @access  Public (in production, should be admin-only)
 */
router.get('/trends/daily',
  rateLimiter.general,
  (req, res) => {
    // Set default timeframe for daily trends
    req.query.timeframe = '7d';
    dashboardController.getScoreAnalytics(req, res);
  }
);

/**
 * @route   GET /api/dashboard/trends/hourly
 * @desc    Get hourly trends for the dashboard (last 24h only)
 * @access  Public (in production, should be admin-only)
 */
router.get('/trends/hourly',
  rateLimiter.general,
  (req, res) => {
    // Set fixed timeframe for hourly trends
    req.query.timeframe = '24h';
    dashboardController.getScoreAnalytics(req, res);
  }
);

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get condensed summary for API responses or mobile apps
 * @access  Public (in production, should be admin-only)
 */
router.get('/summary',
  rateLimiter.general,
  async (req, res) => {
    try {
      // Set a short timeframe for summary
      req.query.timeframe = '24h';
      
      // Get overview data
      const overview = await dashboardController.getOverview(req, res);
      
      // If overview was successful, we're done
      // If not, the error was already handled
    } catch (error) {
      // Error already logged and handled by controller
      res.status(500).json({
        success: false,
        message: 'Failed to generate dashboard summary'
      });
    }
  }
);

// Real-time endpoints (for future WebSocket integration)

/**
 * @route   GET /api/dashboard/realtime/stats
 * @desc    Get real-time statistics (last 5 minutes)
 * @access  Public (in production, should be admin-only)
 */
router.get('/realtime/stats',
  rateLimiter.general,
  (req, res) => {
    // For now, return last hour data
    // In production, implement WebSocket or short polling
    req.query.timeframe = '1h';
    dashboardController.getOverview(req, res);
  }
);

// Route documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    message: 'Dashboard API Documentation',
    endpoints: {
      'GET /overview': 'Dashboard overview with key metrics',
      'GET /analytics': 'Comprehensive analytics data',
      'GET /analytics/scores': 'Score distribution and trends',
      'GET /analytics/performance': 'System performance metrics',
      'GET /analytics/flags': 'Flagged recruiters analysis',
      'GET /export': 'Export data in JSON or CSV format',
      'GET /health': 'System health check',
      'GET /trends/daily': 'Daily trends (7 days)',
      'GET /trends/hourly': 'Hourly trends (24 hours)',
      'GET /summary': 'Condensed dashboard summary',
      'GET /realtime/stats': 'Real-time statistics'
    },
    parameters: {
      timeframe: ['1h', '24h', '7d', '30d'],
      format: ['json', 'csv'],
      includePersonalData: ['true', 'false'],
      limit: 'Number (max results to return)'
    },
    note: 'In production, most endpoints should require admin authentication'
  });
});

// Route-specific error handling
router.use((error, req, res, next) => {
  // Log dashboard-specific errors
  const logger = require('../utils/logger');
  logger.error('Dashboard route error', {
    path: req.path,
    method: req.method,
    query: req.query,
    error: error.message
  });
  
  next(error); // Pass to global error handler
});

module.exports = router;
