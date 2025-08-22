const ruleBasedScoring = require('./ruleBasedScoring');
const llmScoring = require('./llmScoring');
const externalVerification = require('./externalVerification');
const VerificationResult = require('../models/VerificationResult');
const Recruiter = require('../models/Recruiter');
const logger = require('../utils/logger');

class ScoringWorkflowService {
  constructor() {
    // Scoring weights from environment variables
    this.weights = {
      ruleBased: parseFloat(process.env.RULE_BASED_WEIGHT) || 0.3,
      llm: parseFloat(process.env.LLM_WEIGHT) || 0.4,
      external: parseFloat(process.env.EXTERNAL_API_WEIGHT) || 0.3
    };
    
    this.spamThreshold = parseInt(process.env.SPAM_THRESHOLD) || 70;
    
    // Validate weights sum to 1.0
    const totalWeight = Object.values(this.weights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      logger.warn('Scoring weights do not sum to 1.0', { 
        weights: this.weights, 
        total: totalWeight 
      });
    }
  }

  /**
   * Execute complete scoring workflow for a recruiter
   * @param {string} recruiterId - MongoDB ObjectId of the recruiter
   * @returns {Object} - Complete scoring results
   */
  async scoreRecruiter(recruiterId) {
    const workflowTimer = logger.startTimer('Complete scoring workflow');
    const startTime = Date.now();
    
    try {
      // Fetch recruiter data
      const recruiter = await Recruiter.findByPk(recruiterId);
      if (!recruiter) {
        throw new Error(`Recruiter not found: ${recruiterId}`);
      }

      logger.info('Starting scoring workflow', {
        recruiterId,
        email: recruiter.businessEmail,
        company: recruiter.companyName
      });

      // Execute scoring methods in parallel for better performance
      const [ruleBasedResults, externalResults] = await Promise.allSettled([
        this.executeRuleBasedScoring(recruiter),
        this.executeExternalVerification(recruiter)
      ]);

      // Handle the results
      const processedRuleResults = this.handlePromiseResult(ruleBasedResults, 'rule-based');
      const processedExternalResults = this.handlePromiseResult(externalResults, 'external');

      // Execute LLM scoring with context from rule-based results
      const llmResults = await this.executeLLMScoring(recruiter, processedRuleResults);

      // Calculate final score
      const finalResults = this.calculateFinalScore({
        ruleBasedScore: processedRuleResults,
        llmScore: llmResults,
        externalVerification: processedExternalResults
      });

      // Make final decision
      const decision = this.makeDecision(finalResults.finalScore, finalResults.confidence);

      // Create comprehensive result object
      const verificationResult = {
        recruiterId: recruiter.id,
        finalScore: finalResults.finalScore,
        decision: decision.decision,
        confidence: finalResults.confidence,
        ruleBasedScore: {
          score: processedRuleResults.score,
          details: processedRuleResults.details
        },
        llmScore: {
          score: llmResults.score,
          model: llmResults.model,
          reasoning: llmResults.reasoning,
          confidence: llmResults.confidence,
          processingTime: llmResults.processingTime,
          tokenUsage: llmResults.tokenUsage
        },
        externalVerification: processedExternalResults,
        processingMetrics: {
          totalProcessingTime: Date.now() - startTime,
          ruleBasedTime: processedRuleResults.processingTime || 0,
          llmTime: llmResults.processingTime || 0,
          externalApiTime: processedExternalResults.processingTime || 0,
          apiCallsCount: processedExternalResults.apiCallsCount || 0,
          errors: this.collectAllErrors([processedRuleResults, llmResults, processedExternalResults])
        }
      };

      // Save verification result to database
      const savedResult = await VerificationResult.create(verificationResult);

      // Update recruiter status
      await this.updateRecruiterStatus(recruiterId, decision.decision, finalResults.finalScore);

      // Log final results
      logger.logScoringResult(
        recruiterId, 
        finalResults.finalScore, 
        decision.decision, 
        finalResults.breakdown
      );

      workflowTimer.end();

      return {
        success: true,
        recruiterId,
        verificationId: savedResult.id,
        finalScore: finalResults.finalScore,
        decision: decision.decision,
        confidence: finalResults.confidence,
        breakdown: finalResults.breakdown,
        recommendation: decision.recommendation,
        processingTime: Date.now() - startTime,
        details: verificationResult
      };

    } catch (error) {
      workflowTimer.end();
      logger.error('Scoring workflow failed', {
        recruiterId,
        error: error.message,
        stack: error.stack
      });
      
      // Save error result
      try {
        await this.saveErrorResult(recruiterId, error);
      } catch (saveError) {
        logger.error('Failed to save error result', { error: saveError.message });
      }
      
      throw error;
    }
  }

  /**
   * Execute rule-based scoring
   */
  async executeRuleBasedScoring(recruiter) {
    const timer = logger.startTimer('Rule-based scoring execution');
    try {
      const results = await ruleBasedScoring.scoreRecruiter(recruiter.toJSON());
      results.processingTime = timer.end();
      return results;
    } catch (error) {
      timer.end();
      throw error;
    }
  }

  /**
   * Execute LLM scoring
   */
  async executeLLMScoring(recruiter, ruleBasedContext = null) {
    const timer = logger.startTimer('LLM scoring execution');
    try {
      const results = await llmScoring.scoreRecruiter(recruiter.toJSON(), ruleBasedContext);
      if (!results.processingTime) {
        results.processingTime = timer.end();
      }
      return results;
    } catch (error) {
      timer.end();
      throw error;
    }
  }

  /**
   * Execute external verification
   */
  async executeExternalVerification(recruiter) {
    const timer = logger.startTimer('External verification execution');
    try {
      const results = await externalVerification.verifyAll(recruiter.toJSON());
      if (!results.processingTime) {
        results.processingTime = timer.end();
      }
      return results;
    } catch (error) {
      timer.end();
      throw error;
    }
  }

  /**
   * Calculate final weighted score
   */
  calculateFinalScore({ ruleBasedScore, llmScore, externalVerification }) {
    // Extract individual scores
    const ruleScore = ruleBasedScore.score || 50;
    const aiScore = llmScore.score || 50;
    const externalScore = this.calculateExternalScore(externalVerification);

    // Calculate weighted score
    const weightedScore = (
      ruleScore * this.weights.ruleBased +
      aiScore * this.weights.llm +
      externalScore * this.weights.external
    );

    // Calculate confidence based on score consistency and individual confidences
    const confidence = this.calculateConfidence({
      ruleScore,
      aiScore,
      externalScore,
      aiConfidence: llmScore.confidence || 50
    });

    const breakdown = {
      ruleBasedWeighted: ruleScore * this.weights.ruleBased,
      llmWeighted: aiScore * this.weights.llm,
      externalWeighted: externalScore * this.weights.external,
      weights: this.weights,
      rawScores: {
        ruleBased: ruleScore,
        llm: aiScore,
        external: externalScore
      }
    };

    return {
      finalScore: Math.round(Math.max(0, Math.min(100, weightedScore))),
      confidence: Math.round(confidence),
      breakdown
    };
  }

  /**
   * Calculate external verification score
   */
  calculateExternalScore(externalData) {
    if (!externalData) return 50;

    const scores = [];
    
    // Email verification score
    if (externalData.email && typeof externalData.email.score === 'number') {
      scores.push(externalData.email.score);
    }
    
    // Phone verification score
    if (externalData.phone && typeof externalData.phone.score === 'number') {
      scores.push(externalData.phone.score);
    }
    
    // Company verification score
    if (externalData.company && typeof externalData.company.score === 'number') {
      scores.push(externalData.company.score);
    }
    
    // Domain verification score
    if (externalData.domain && typeof externalData.domain.score === 'number') {
      scores.push(externalData.domain.score);
    }

    // Return average of available scores, or default if none
    return scores.length > 0 ? scores.reduce((sum, score) => sum + score) / scores.length : 50;
  }

  /**
   * Calculate overall confidence score
   */
  calculateConfidence({ ruleScore, aiScore, externalScore, aiConfidence }) {
    // Base confidence from AI model
    let confidence = aiConfidence;

    // Adjust based on score consistency
    const scores = [ruleScore, aiScore, externalScore];
    const avg = scores.reduce((sum, score) => sum + score) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);

    // Lower confidence if scores are inconsistent
    if (standardDeviation > 20) confidence -= 15;
    else if (standardDeviation > 10) confidence -= 8;

    // Higher confidence if all scores point in same direction
    const allHigh = scores.every(score => score > 70);
    const allLow = scores.every(score => score < 40);
    
    if (allHigh || allLow) confidence += 10;

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Make final decision based on score and confidence
   */
  makeDecision(finalScore, confidence) {
    let decision = 'pending_review'; // default
    let recommendation = 'Manual review recommended due to uncertain score';

    if (finalScore >= this.spamThreshold && confidence >= 70) {
      decision = 'approved';
      recommendation = 'Recruiter appears legitimate and can be auto-approved';
    } else if (finalScore < 40 && confidence >= 60) {
      decision = 'flagged';
      recommendation = 'High spam probability - recommend rejection';
    } else if (confidence < 50) {
      decision = 'pending_review';
      recommendation = 'Low confidence in assessment - requires human review';
    } else {
      decision = 'pending_review';
      recommendation = 'Score in uncertain range - manual review recommended';
    }

    return { decision, recommendation };
  }

  /**
   * Update recruiter status based on decision
   */
  async updateRecruiterStatus(recruiterId, decision, finalScore) {
    const statusMap = {
      'approved': 'approved',
      'flagged': 'flagged',
      'pending_review': 'pending'
    };

    await Recruiter.update({
      status: statusMap[decision] || 'pending',
      verificationScore: finalScore
    }, {
      where: { id: recruiterId }
    });
  }

  /**
   * Handle Promise.allSettled results
   */
  handlePromiseResult(result, source) {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      logger.error(`${source} scoring failed`, { error: result.reason.message });
      return {
        score: 50, // neutral score on failure
        error: result.reason.message,
        source,
        details: { error: true }
      };
    }
  }

  /**
   * Collect all errors from scoring components
   */
  collectAllErrors(results) {
    const errors = [];
    
    results.forEach((result, index) => {
      const sources = ['rule-based', 'llm', 'external'];
      if (result.error) {
        errors.push({
          source: sources[index] || 'unknown',
          error: result.error,
          timestamp: new Date()
        });
      }
      
      // Check for nested errors (like in external verification)
      if (result.errors && Array.isArray(result.errors)) {
        errors.push(...result.errors);
      }
    });

    return errors;
  }

  /**
   * Save error result when workflow fails
   */
  async saveErrorResult(recruiterId, error) {
    const errorResult = {
      recruiterId,
      finalScore: 50, // Neutral score for failed analysis
      decision: 'pending_review',
      confidence: 0,
      ruleBasedScore: { score: 50, details: { error: true } },
      llmScore: { score: 50, error: error.message },
      externalVerification: { error: error.message },
      processingMetrics: {
        totalProcessingTime: 0,
        errors: [{
          source: 'workflow',
          error: error.message,
          timestamp: new Date()
        }]
      }
    };

    await VerificationResult.create(errorResult);
  }

  /**
   * Get scoring statistics
   */
  async getScoringStats() {
    const { Op } = require('sequelize');
    const stats = await VerificationResult.getVerificationStats();
    
    const totalResults = await VerificationResult.count();
    const recentResults = await VerificationResult.count({
      where: {
        created_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });

    return {
      total: totalResults,
      recent24h: recentResults,
      byDecision: stats,
      weights: this.weights,
      threshold: this.spamThreshold
    };
  }

  /**
   * Batch score multiple recruiters
   */
  async batchScoreRecruiters(recruiterIds, options = {}) {
    const { concurrency = 3, continueOnError = true } = options;
    const results = [];
    
    logger.info('Starting batch scoring', { 
      count: recruiterIds.length, 
      concurrency 
    });

    // Process in batches to avoid overwhelming APIs
    for (let i = 0; i < recruiterIds.length; i += concurrency) {
      const batch = recruiterIds.slice(i, i + concurrency);
      const batchPromises = batch.map(async (recruiterId) => {
        try {
          const result = await this.scoreRecruiter(recruiterId);
          return { success: true, recruiterId, result };
        } catch (error) {
          logger.error('Batch scoring error', { recruiterId, error: error.message });
          if (continueOnError) {
            return { success: false, recruiterId, error: error.message };
          }
          throw error;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : r.reason));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info('Batch scoring completed', { 
      total: results.length, 
      successful, 
      failed 
    });

    return {
      total: results.length,
      successful,
      failed,
      results
    };
  }
}

module.exports = new ScoringWorkflowService();
