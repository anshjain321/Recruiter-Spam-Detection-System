const express = require('express');
const router = express.Router();

// Controllers
const recruiterController = require('../controllers/recruiterController');

// Middleware
const rateLimiter = require('../middleware/rateLimiter');
const {
  validateRecruiterSignup,
  validateObjectId,
  validateStatusUpdate,
  validateBatchOperation,
  validateRecruitersList,
  sanitizeInput,
  handleValidationErrors
} = require('../middleware/validation');

// Apply sanitization to all routes
router.use(sanitizeInput);

/**
 * @route   POST /api/recruiters/signup
 * @desc    Register a new recruiter and trigger verification workflow
 * @access  Public
 * @rateLimit 5 requests per hour per IP
 */
router.post('/signup',
  rateLimiter.signup,
  validateRecruiterSignup,
  handleValidationErrors,
  recruiterController.signup
);

/**
 * @route   GET /api/recruiters/:id
 * @desc    Get recruiter profile with verification status
 * @access  Public
 * @params  id - Integer ID of recruiter
 */
router.get('/:id',
  rateLimiter.general,
  validateObjectId('id'),
  handleValidationErrors,
  recruiterController.getProfile
);

/**
 * @route   GET /api/recruiters/:id/verification
 * @desc    Get detailed verification status and results
 * @access  Public
 * @params  id - Integer ID of recruiter
 */
router.get('/:id/verification',
  rateLimiter.general,
  validateObjectId('id'),
  handleValidationErrors,
  recruiterController.getVerificationStatus
);

/**
 * @route   GET /api/recruiters/:id/verification/details
 * @desc    Get complete verification details including all scoring components
 * @access  Public
 * @params  id - Integer ID of recruiter
 */
router.get('/:id/verification/details',
  rateLimiter.general,
  validateObjectId('id'),
  handleValidationErrors,
  recruiterController.getVerificationDetails
);

/**
 * @route   POST /api/recruiters/:id/rescore
 * @desc    Manually trigger re-scoring/re-verification
 * @access  Public
 * @params  id - Integer ID of recruiter
 * @rateLimit 10 requests per hour per IP
 */
router.post('/:id/rescore',
  rateLimiter.scoring,
  validateObjectId('id'),
  handleValidationErrors,
  recruiterController.triggerRescoring
);

/**
 * @route   PUT /api/recruiters/:id/status
 * @desc    Update recruiter status (admin functionality)
 * @access  Admin (in production, add authentication middleware)
 * @params  id - Integer ID of recruiter
 * @body    status, notes
 */
router.put('/:id/status',
  rateLimiter.general,
  validateObjectId('id'),
  validateStatusUpdate,
  handleValidationErrors,
  recruiterController.updateStatus
);

/**
 * @route   GET /api/recruiters
 * @desc    List recruiters with filtering, sorting, and pagination
 * @access  Public
 * @query   page, limit, status, company, industry, scoreRange, sortBy, sortOrder
 */
router.get('/',
  rateLimiter.general,
  validateRecruitersList,
  handleValidationErrors,
  recruiterController.getRecruiters
);

/**
 * @route   POST /api/recruiters/batch
 * @desc    Perform batch operations on multiple recruiters
 * @access  Admin (in production, add authentication middleware)
 * @body    operation, recruiterIds, data
 */
router.post('/batch',
  rateLimiter.general,
  validateBatchOperation,
  handleValidationErrors,
  recruiterController.batchOperations
);

// Route-specific error handling
router.use((error, req, res, next) => {
  // Log recruiter-specific errors
  const logger = require('../utils/logger');
  logger.error('Recruiter route error', {
    path: req.path,
    method: req.method,
    params: req.params,
    error: error.message
  });
  
  next(error); // Pass to global error handler
});

module.exports = router;
