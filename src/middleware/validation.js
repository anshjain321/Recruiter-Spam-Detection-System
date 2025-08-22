const { body, param, query, validationResult } = require('express-validator');
const validator = require('validator');

// Custom validators
const customValidators = {
  isStrongPassword: (value) => {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
  },
  
  isValidPhone: (value) => {
    // Remove common phone formatting
    const cleanPhone = value.replace(/[\s\-\(\)\+]/g, '');
    return /^[\d]{10,15}$/.test(cleanPhone);
  },
  
  isBusinessEmail: (value) => {
    if (!validator.isEmail(value)) return false;
    
    // Check if it's not a common free email provider
    const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    const domain = value.split('@')[1].toLowerCase();
    
    // For demo purposes, we'll allow free emails but could flag them
    return true;
  }
};

// Recruiter signup validation
const validateRecruiterSignup = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, apostrophes, and dots'),
    
  body('companyName')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Company name must be between 2 and 200 characters')
    .matches(/^[a-zA-Z0-9\s\-&\.,'\(\)]+$/)
    .withMessage('Company name contains invalid characters'),
    
  body('websiteUrl')
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Please provide a valid website URL with protocol (http/https)')
    .isLength({ max: 500 })
    .withMessage('Website URL is too long'),
    
  body('businessEmail')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .custom(customValidators.isBusinessEmail)
    .withMessage('Please provide a business email address')
    .isLength({ max: 254 })
    .withMessage('Email address is too long'),
    
  body('phoneNumber')
    .trim()
    .custom(customValidators.isValidPhone)
    .withMessage('Please provide a valid phone number (10-15 digits)'),
    
  body('role')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Role must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-&\.,'/]+$/)
    .withMessage('Role contains invalid characters'),
    
  body('industry')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Industry must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-&\.,'/]+$/)
    .withMessage('Industry contains invalid characters'),
    
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .custom(customValidators.isStrongPassword)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

// MySQL Integer ID validation
const validateObjectId = (field = 'id') => [
  param(field)
    .isInt({ min: 1 })
    .withMessage(`Invalid ${field} format - must be a positive integer`)
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer (max 1000)')
    .toInt(),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt()
];

// Status update validation
const validateStatusUpdate = [
  body('status')
    .isIn(['pending', 'approved', 'flagged', 'rejected'])
    .withMessage('Status must be one of: pending, approved, flagged, rejected'),
    
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters')
    .trim()
];

// Batch operations validation
const validateBatchOperation = [
  body('operation')
    .isIn(['score', 'updateStatus'])
    .withMessage('Operation must be either "score" or "updateStatus"'),
    
  body('recruiterIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('Recruiter IDs must be an array with 1-50 items'),
    
  body('recruiterIds.*')
    .isInt({ min: 1 })
    .withMessage('All recruiter IDs must be positive integers'),
    
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object'),
    
  // Conditional validation for updateStatus operation
  body('data.status')
    .if(body('operation').equals('updateStatus'))
    .isIn(['pending', 'approved', 'flagged', 'rejected'])
    .withMessage('Status must be one of: pending, approved, flagged, rejected')
];

// Dashboard query validation
const validateDashboardQuery = [
  query('timeframe')
    .optional()
    .isIn(['1h', '24h', '7d', '30d'])
    .withMessage('Timeframe must be one of: 1h, 24h, 7d, 30d'),
    
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be either json or csv'),
    
  query('includePersonalData')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('includePersonalData must be true or false')
];

// List recruiters validation
const validateRecruitersList = [
  ...validatePagination,
  
  query('status')
    .optional()
    .isIn(['pending', 'approved', 'flagged', 'rejected'])
    .withMessage('Status must be one of: pending, approved, flagged, rejected'),
    
  query('company')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Company search must be 1-200 characters'),
    
  query('industry')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Industry search must be 1-100 characters'),
    
  query('scoreRange')
    .optional()
    .matches(/^\d+-\d+$/)
    .withMessage('Score range must be in format "min-max" (e.g., "50-80")'),
    
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'verificationScore', 'companyName'])
    .withMessage('Sort by must be one of: createdAt, updatedAt, verificationScore, companyName'),
    
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either asc or desc')
];

// Rate limiting bypass validation (for internal services)
const validateInternalRequest = [
  body('internalKey')
    .optional()
    .equals(process.env.INTERNAL_API_KEY || 'not-configured')
    .withMessage('Invalid internal API key')
];

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS payloads from string inputs
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, ''); // Remove event handlers
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj !== null && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    return sanitizeValue(obj);
  };

  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);
  
  next();
};

// Error handling middleware for validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value,
      location: error.location
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
      errorCount: formattedErrors.length
    });
  }
  
  next();
};

// Export validation rules and middleware
module.exports = {
  // Validation rules
  validateRecruiterSignup,
  validateObjectId,
  validatePagination,
  validateStatusUpdate,
  validateBatchOperation,
  validateDashboardQuery,
  validateRecruitersList,
  validateInternalRequest,
  
  // Middleware
  sanitizeInput,
  handleValidationErrors,
  
  // Custom validators for reuse
  customValidators
};
