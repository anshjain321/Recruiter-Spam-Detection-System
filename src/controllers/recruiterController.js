const Recruiter = require('../models/Recruiter');
const VerificationResult = require('../models/VerificationResult');
const scoringWorkflow = require('../services/scoringWorkflow');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

class RecruiterController {
  /**
   * Register a new recruiter and trigger scoring workflow
   */
  signup = asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      fullName,
      companyName,
      websiteUrl,
      businessEmail,
      phoneNumber,
      role,
      industry,
      password
    } = req.body;

    // Check if recruiter already exists
    const existingRecruiter = await Recruiter.findByEmail(businessEmail);
    if (existingRecruiter) {
      throw new AppError('A recruiter with this email already exists', 409, 'DUPLICATE_EMAIL');
    }

    // Create new recruiter
    const recruiterData = {
      fullName,
      companyName,
      websiteUrl,
      businessEmail,
      phoneNumber,
      role,
      industry,
      password,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      registrationSource: 'api'
    };

    const recruiter = await Recruiter.create(recruiterData);

    logger.info('New recruiter registered', {
      recruiterId: recruiter.id,
      email: recruiter.businessEmail,
      company: recruiter.companyName,
      ip: req.ip
    });

    // Trigger scoring workflow asynchronously
    scoringWorkflow.scoreRecruiter(recruiter.id.toString())
      .then(result => {
        logger.info('Automatic scoring completed', {
          recruiterId: recruiter.id,
          score: result.finalScore,
          decision: result.decision
        });
      })
      .catch(error => {
        logger.error('Automatic scoring failed', {
          recruiterId: recruiter.id,
          error: error.message
        });
      });

    // Return immediate response (scoring happens in background)
    res.status(201).json({
      success: true,
      message: 'Recruiter registered successfully. Verification is in progress.',
      data: {
        id: recruiter.id,
        email: recruiter.businessEmail,
        status: recruiter.status,
        registeredAt: recruiter.createdAt
      },
      meta: {
        verificationInProgress: true,
        estimatedProcessingTime: '30-60 seconds'
      }
    });
  });

  /**
   * Get recruiter profile
   */
  getProfile = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const recruiter = await Recruiter.findByPk(id);
    if (!recruiter) {
      throw new AppError('Recruiter not found', 404, 'RECRUITER_NOT_FOUND');
    }

    // Get latest verification result
    const verificationResult = await VerificationResult.findOne({
      where: { recruiterId: id },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        recruiter: recruiter.toSafeObject(),
        verification: verificationResult ? {
          score: verificationResult.finalScore,
          decision: verificationResult.decision,
          confidence: verificationResult.confidence,
          lastVerified: verificationResult.createdAt,
          breakdown: verificationResult.getScoreBreakdown()
        } : null
      }
    });
  });

  /**
   * Get verification status for a recruiter
   */
  getVerificationStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const recruiter = await Recruiter.findByPk(id);
    if (!recruiter) {
      throw new AppError('Recruiter not found', 404, 'RECRUITER_NOT_FOUND');
    }

    const verificationResult = await VerificationResult.findOne({
      where: { recruiterId: id },
      order: [['created_at', 'DESC']]
    });

    if (!verificationResult) {
      return res.json({
        success: true,
        data: {
          status: 'pending',
          message: 'Verification is in progress',
          recruiterId: id,
          estimatedTimeRemaining: '30-60 seconds'
        }
      });
    }

    res.json({
      success: true,
      data: {
        status: 'completed',
        recruiterId: id,
        verificationId: verificationResult.id,
        finalScore: verificationResult.finalScore,
        decision: verificationResult.decision,
        confidence: verificationResult.confidence,
        completedAt: verificationResult.createdAt,
        processingTime: verificationResult.processingMetrics?.totalProcessingTime || 0,
        breakdown: {
          ruleBasedScore: verificationResult.ruleBasedScore.score,
          llmScore: verificationResult.llmScore.score,
          externalScore: verificationResult.getExternalAPIWeightedScore()
        }
      }
    });
  });

  /**
   * Get detailed verification results
   */
  getVerificationDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const verificationResult = await VerificationResult.findOne({
      where: { recruiterId: id },
      order: [['created_at', 'DESC']],
      include: [{
        model: Recruiter,
        as: 'recruiter',
        attributes: ['fullName', 'businessEmail', 'companyName']
      }]
    });

    if (!verificationResult) {
      throw new AppError('Verification result not found', 404, 'VERIFICATION_NOT_FOUND');
    }

    res.json({
      success: true,
      data: verificationResult
    });
  });

  /**
   * Manually trigger re-scoring for a recruiter
   */
  triggerRescoring = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const recruiter = await Recruiter.findByPk(id);
    if (!recruiter) {
      throw new AppError('Recruiter not found', 404, 'RECRUITER_NOT_FOUND');
    }

    logger.info('Manual re-scoring triggered', {
      recruiterId: id,
      triggeredBy: req.ip
    });

    // Trigger scoring workflow
    const result = await scoringWorkflow.scoreRecruiter(id);

    res.json({
      success: true,
      message: 'Re-scoring completed successfully',
      data: {
        verificationId: result.verificationId,
        finalScore: result.finalScore,
        decision: result.decision,
        confidence: result.confidence,
        processingTime: result.processingTime
      }
    });
  });

  /**
   * Update recruiter status (admin only)
   */
  updateStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'approved', 'flagged', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid status value', 400, 'INVALID_STATUS');
    }

    const recruiter = await Recruiter.findByPk(id);
    if (!recruiter) {
      throw new AppError('Recruiter not found', 404, 'RECRUITER_NOT_FOUND');
    }

    // Update recruiter status
    recruiter.status = status;
    await recruiter.save();

    // Update verification result if exists
    if (notes) {
      await VerificationResult.update(
        { 
          notes,
          reviewedBy: 'admin', // In real app, use actual admin ID
          reviewedAt: new Date()
        },
        {
          where: { recruiterId: id },
          order: [['created_at', 'DESC']],
          limit: 1
        }
      );
    }

    logger.info('Recruiter status updated', {
      recruiterId: id,
      newStatus: status,
      updatedBy: 'admin',
      notes: notes || 'No notes'
    });

    res.json({
      success: true,
      message: 'Recruiter status updated successfully',
      data: {
        id: recruiter.id,
        status: recruiter.status,
        updatedAt: recruiter.updatedAt
      }
    });
  });

  /**
   * Get list of recruiters with pagination and filtering
   */
  getRecruiters = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status,
      company,
      industry,
      scoreRange,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const { Op } = require('sequelize');

    // Map camelCase field names to snake_case database columns
    const sortFieldMap = {
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      'fullName': 'full_name',
      'companyName': 'company_name',
      'businessEmail': 'business_email',
      'phoneNumber': 'phone_number',
      'verificationScore': 'verification_score'
    };
    
    // Use mapped field name or fallback to original
    const mappedSortBy = sortFieldMap[sortBy] || sortBy;

    // Build query filter
    const where = {};
    if (status) where.status = status;
    if (company) where.companyName = { [Op.iLike]: `%${company}%` };
    if (industry) where.industry = { [Op.iLike]: `%${industry}%` };
    if (scoreRange) {
      const [min, max] = scoreRange.split('-').map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        where.verificationScore = { [Op.between]: [min, max] };
      } else if (!isNaN(min)) {
        where.verificationScore = { [Op.gte]: min };
      } else if (!isNaN(max)) {
        where.verificationScore = { [Op.lte]: max };
      }
    }

    // Execute query with pagination
    const options = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      order: [[mappedSortBy, sortOrder.toUpperCase()]]
    };

    const { count, rows: recruiters } = await Recruiter.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: options.order,
      limit: options.limit,
      offset: (options.page - 1) * options.limit
    });

    // Get verification results for these recruiters
    const recruiterIds = recruiters.map(r => r.id);
    const verificationResults = await VerificationResult.findAll({
      where: { recruiterId: { [Op.in]: recruiterIds } },
      order: [['created_at', 'DESC']]
    });

    // Create a map for faster lookup
    const verificationMap = {};
    verificationResults.forEach(v => {
      if (!verificationMap[v.recruiterId]) {
        verificationMap[v.recruiterId] = v;
      }
    });

    // Merge data
    const recruitersWithVerification = recruiters.map(recruiter => {
      const verification = verificationMap[recruiter.id];
      
      return {
        ...recruiter.toSafeObject(),
        verification: verification ? {
          score: verification.finalScore,
          decision: verification.decision,
          confidence: verification.confidence,
          verifiedAt: verification.createdAt
        } : null
      };
    });

    res.json({
      success: true,
      data: recruitersWithVerification,
      pagination: {
        page: options.page,
        limit: options.limit,
        total: count,
        pages: Math.ceil(count / options.limit),
        hasNext: options.page < Math.ceil(count / options.limit),
        hasPrev: options.page > 1
      },
      filters: {
        status,
        company,
        industry,
        scoreRange,
        sortBy,
        sortOrder
      }
    });
  });

  /**
   * Batch operations for multiple recruiters
   */
  batchOperations = asyncHandler(async (req, res) => {
    const { operation, recruiterIds, data } = req.body;

    if (!Array.isArray(recruiterIds) || recruiterIds.length === 0) {
      throw new AppError('Recruiter IDs array is required', 400, 'MISSING_RECRUITER_IDS');
    }

    if (recruiterIds.length > 50) {
      throw new AppError('Cannot process more than 50 recruiters at once', 400, 'BATCH_SIZE_LIMIT');
    }

    let results;

    switch (operation) {
      case 'score':
        results = await scoringWorkflow.batchScoreRecruiters(recruiterIds);
        break;
        
      case 'updateStatus':
        if (!data || !data.status) {
          throw new AppError('Status is required for batch update', 400, 'MISSING_STATUS');
        }
        results = await this.batchUpdateStatus(recruiterIds, data.status);
        break;
        
      default:
        throw new AppError('Invalid batch operation', 400, 'INVALID_OPERATION');
    }

    logger.info('Batch operation completed', {
      operation,
      recruiterCount: recruiterIds.length,
      results: results
    });

    res.json({
      success: true,
      message: `Batch ${operation} completed`,
      data: results
    });
  });

  /**
   * Helper method for batch status updates
   */
  async batchUpdateStatus(recruiterIds, status) {
    const validStatuses = ['pending', 'approved', 'flagged', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid status value', 400, 'INVALID_STATUS');
    }

    const { Op } = require('sequelize');

    const [affectedCount] = await Recruiter.update(
      { status, updatedAt: new Date() },
      { 
        where: { id: { [Op.in]: recruiterIds } },
        returning: true 
      }
    );

    return {
      matched: affectedCount,
      modified: affectedCount,
      status
    };
  }
}

module.exports = new RecruiterController();
