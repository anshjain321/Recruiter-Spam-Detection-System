const express = require('express');
const router = express.Router();

// Import route modules
const recruiterRoutes = require('./recruiterRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const systemRoutes = require('./systemRoutes');

// API versioning and documentation
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Recruiter Spam Detection API',
    version: '1.0.0',
    documentation: {
      postman: '/api/docs/postman',
      swagger: '/api/docs/swagger'
    },
    endpoints: {
      recruiters: '/api/recruiters',
      dashboard: '/api/dashboard',
      system: '/api/system'
    },
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// API Documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    message: 'API Documentation',
    version: '1.0.0',
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    endpoints: {
      // Recruiter endpoints
      'POST /recruiters/signup': {
        description: 'Register a new recruiter and trigger verification',
        rateLimit: '5 requests per hour per IP',
        requiredFields: ['fullName', 'companyName', 'websiteUrl', 'businessEmail', 'phoneNumber', 'role', 'industry', 'password'],
        response: 'Immediate response with recruiter ID, verification runs in background'
      },
      'GET /recruiters/:id': {
        description: 'Get recruiter profile information',
        parameters: { id: 'Integer ID' },
        response: 'Recruiter profile with verification status'
      },
      'GET /recruiters/:id/verification': {
        description: 'Get verification status and results',
        parameters: { id: 'Integer ID' },
        response: 'Detailed verification results including scores and breakdown'
      },
      'POST /recruiters/:id/rescore': {
        description: 'Manually trigger re-verification',
        parameters: { id: 'Integer ID' },
        rateLimit: '10 requests per hour per IP'
      },
      'GET /recruiters': {
        description: 'List recruiters with filtering and pagination',
        queryParams: ['page', 'limit', 'status', 'company', 'industry', 'scoreRange', 'sortBy', 'sortOrder'],
        response: 'Paginated list of recruiters with verification data'
      },
      
      // Dashboard endpoints
      'GET /dashboard/overview': {
        description: 'Get dashboard overview statistics',
        queryParams: ['timeframe'],
        response: 'Summary statistics, status counts, recent activity'
      },
      'GET /dashboard/analytics/scores': {
        description: 'Get score distribution and trends',
        queryParams: ['timeframe'],
        response: 'Score analytics including distribution and trends over time'
      },
      'GET /dashboard/analytics/performance': {
        description: 'Get system performance metrics',
        queryParams: ['timeframe'],
        response: 'Processing times, API usage, error rates'
      },
      'GET /dashboard/analytics/flags': {
        description: 'Analyze flagged recruiters and common issues',
        queryParams: ['timeframe', 'limit'],
        response: 'Flagged recruiter analysis and common flag reasons'
      },
      'GET /dashboard/export': {
        description: 'Export verification data',
        queryParams: ['format', 'timeframe', 'includePersonalData'],
        response: 'JSON or CSV export of verification data'
      },
      
      // System endpoints
      'GET /system/health': {
        description: 'Get system health status',
        response: 'Overall system health including database and external services'
      },
      'GET /system/stats': {
        description: 'Get system statistics',
        response: 'Performance stats, uptime, memory usage'
      },
      'POST /system/test-connections': {
        description: 'Test external API connections',
        response: 'Connection status for all external services'
      }
    },
    schemas: {
      Recruiter: {
        fullName: 'string (2-100 chars)',
        companyName: 'string (2-200 chars)',
        websiteUrl: 'string (valid URL)',
        businessEmail: 'string (valid email)',
        phoneNumber: 'string (10-15 digits)',
        role: 'string (2-100 chars)',
        industry: 'string (2-100 chars)',
        password: 'string (8+ chars, complex)',
        status: 'enum: pending|approved|flagged|rejected',
        verificationScore: 'number (0-100)'
      },
      VerificationResult: {
        finalScore: 'number (0-100)',
        decision: 'enum: approved|flagged|pending_review',
        confidence: 'number (0-100)',
        ruleBasedScore: 'object',
        llmScore: 'object', 
        externalVerification: 'object',
        processingMetrics: 'object'
      }
    },
    authentication: {
      type: 'None for public endpoints',
      note: 'Rate limiting applied based on IP address'
    },
    rateLimit: {
      general: '100 requests per 15 minutes',
      signup: '5 requests per hour',
      scoring: '10 requests per hour'
    }
  });
});

// Mount route modules
router.use('/recruiters', recruiterRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/system', systemRoutes);

// Catch-all for undefined routes under /api
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl,
    availableEndpoints: ['/api/recruiters', '/api/dashboard', '/api/system'],
    documentation: '/api/docs'
  });
});

module.exports = router;
