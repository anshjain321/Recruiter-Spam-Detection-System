const { RateLimiterMemory } = require('rate-limiter-flexible');
const logger = require('../utils/logger');

// Create multiple rate limiters for different endpoints
const rateLimiters = {
  // General API rate limiter
  general: new RateLimiterMemory({
    keyGenerator: (req) => req.ip,
    points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Number of requests
    duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 || 900, // Per 15 minutes (900 seconds)
    blockDuration: 900, // Block for 15 minutes
  }),
  
  // Strict rate limiter for signup endpoint
  signup: new RateLimiterMemory({
    keyGenerator: (req) => req.ip,
    points: 5, // 5 signups per hour
    duration: 3600, // 1 hour
    blockDuration: 3600, // Block for 1 hour
  }),
  
  // Rate limiter for scoring endpoint (more restrictive)
  scoring: new RateLimiterMemory({
    keyGenerator: (req) => req.ip,
    points: 10, // 10 scoring requests per hour
    duration: 3600, // 1 hour
    blockDuration: 1800, // Block for 30 minutes
  })
};

const createRateLimitMiddleware = (limiterType = 'general') => {
  return async (req, res, next) => {
    const limiter = rateLimiters[limiterType];
    
    if (!limiter) {
      logger.warn(`Rate limiter '${limiterType}' not found, using general limiter`);
      limiter = rateLimiters.general;
    }
    
    try {
      await limiter.consume(req.ip);
      next();
    } catch (rateLimiterRes) {
      const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
      
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        endpoint: req.path,
        userAgent: req.get('User-Agent'),
        remainingPoints: rateLimiterRes.remainingPoints,
        msBeforeNext: rateLimiterRes.msBeforeNext
      });
      
      res.set('Retry-After', String(secs));
      res.set('X-RateLimit-Limit', limiter.points);
      res.set('X-RateLimit-Remaining', rateLimiterRes.remainingPoints || 0);
      res.set('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext));
      
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later',
        retryAfter: secs,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          details: `Rate limit exceeded. Try again in ${secs} seconds.`
        }
      });
    }
  };
};

// Export individual middleware functions
module.exports = createRateLimitMiddleware();
module.exports.general = createRateLimitMiddleware('general');
module.exports.signup = createRateLimitMiddleware('signup');
module.exports.scoring = createRateLimitMiddleware('scoring');
module.exports.createRateLimitMiddleware = createRateLimitMiddleware;
