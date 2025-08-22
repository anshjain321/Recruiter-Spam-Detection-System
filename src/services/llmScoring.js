const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

class LLMScoringService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    this.model = process.env.GEMINI_MODEL || 'gemini-pro';
    this.maxTokens = parseInt(process.env.GEMINI_MAX_TOKENS) || 500;
    this.temperature = parseFloat(process.env.GEMINI_TEMPERATURE) || 0.3;
  }

  /**
   * Main LLM scoring method
   * @param {Object} recruiterData - The recruiter data to analyze
   * @param {Object} ruleBasedResults - Results from rule-based scoring for context
   * @returns {Object} - LLM scoring results
   */
  async scoreRecruiter(recruiterData, ruleBasedResults = null) {
    const timer = logger.startTimer('LLM scoring');
    const startTime = Date.now();

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
      }

      const model = this.genAI.getGenerativeModel({ 
        model: this.model,
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: this.maxTokens,
        }
      });

      const prompt = this.buildPrompt(recruiterData, ruleBasedResults);
      
      logger.info('Sending request to Gemini', {
        model: this.model,
        promptLength: prompt.length,
        recruiterId: recruiterData._id || 'unknown'
      });

      const result = await model.generateContent(prompt);
      logger.info("----",result);
      const response = result.response;

      const processingTime = Date.now() - startTime;
      const responseText = response.text();
      
      // Parse the JSON response
      let parsedResult;
      try {
        parsedResult = JSON.parse(responseText);
      } catch (parseError) {
        logger.error('Failed to parse Gemini response as JSON', {
          response: responseText,
          error: parseError.message
        });
        throw new Error('Invalid JSON response from Gemini');
      }

      // Validate and normalize the response
      const normalizedResult = this.normalizeResponse(parsedResult);
      
      // Add metadata
      normalizedResult.model = this.model;
      normalizedResult.processingTime = processingTime;
      
      // Gemini token usage (if available)
      const usageMetadata = response.usageMetadata;
      normalizedResult.tokenUsage = {
        promptTokens: usageMetadata?.promptTokenCount || 0,
        completionTokens: usageMetadata?.candidatesTokenCount || 0,
        totalTokens: usageMetadata?.totalTokenCount || 0
      };

      timer.end();

      logger.info('LLM scoring completed', {
        score: normalizedResult.score,
        confidence: normalizedResult.confidence,
        processingTime,
        tokenUsage: normalizedResult.tokenUsage
      });

      return normalizedResult;
    } catch (error) {
      timer.end();
      logger.error('LLM scoring failed', { 
        error: error.message,
        processingTime: Date.now() - startTime
      });
      
      // Return fallback score instead of throwing
      return this.getFallbackScore(error.message);
    }
  }

  /**
   * Build the main prompt for analysis
   */
  buildPrompt(recruiterData, ruleBasedResults) {
    const ruleBasedContext = ruleBasedResults 
      ? `\n\nRule-based analysis found ${ruleBasedResults.details.flags.length} potential issues with a preliminary score of ${ruleBasedResults.score}/100.`
      : '';

    return `You are an expert fraud detection specialist with extensive experience in recruiting industry verification. Your role is to analyze recruiter signup data and assess legitimacy with high accuracy.

KEY PRINCIPLES:
- Be thorough but not overly suspicious of legitimate variations
- Consider cultural and regional differences in business practices  
- Focus on genuine red flags rather than minor inconsistencies
- Provide actionable insights for manual reviewers
- Balance automated efficiency with accuracy

SCORING GUIDELINES:
- 0-30: Clear spam/fraud indicators, immediate rejection
- 31-50: Multiple concerning factors, likely fraudulent
- 51-70: Some red flags, requires manual review
- 71-85: Generally legitimate with minor concerns
- 86-100: High confidence legitimate recruiter

CONFIDENCE LEVELS:
- 90-100: Very certain of assessment
- 70-89: Confident but some uncertainty remains
- 50-69: Moderate confidence, could benefit from additional data
- Below 50: Low confidence, recommend manual review regardless of score

Please analyze the following recruiter signup data for authenticity and legitimacy. Provide a comprehensive assessment focusing on professional credibility, data consistency, and spam likelihood.

RECRUITER DATA:
- Full Name: "${recruiterData.fullName}"
- Company: "${recruiterData.companyName}"
- Website: "${recruiterData.websiteUrl}"
- Business Email: "${recruiterData.businessEmail}"
- Phone: "${recruiterData.phoneNumber}"
- Role: "${recruiterData.role}"
- Industry: "${recruiterData.industry}"${ruleBasedContext}

ANALYSIS FOCUS:
1. Professional Credibility: Does this appear to be a legitimate business professional?
2. Data Consistency: Do the company name, website, email domain, and industry align?
3. Contact Information: Are the email and phone number professional and believable?
4. Role Appropriateness: Is the stated role reasonable for someone doing recruitment?
5. Spam Indicators: Any red flags suggesting this might be spam or fake?

Please provide your assessment as a JSON object with exactly this structure:
{
  "score": <number between 0-100>,
  "confidence": <number between 0-100>,
  "reasoning": "<detailed explanation of your assessment>",
  "redFlags": [<array of concerning elements found>],
  "positiveIndicators": [<array of good signs found>],
  "recommendation": "<approve/flag/manual_review>"
}

Always return valid JSON in the exact format specified. Be concise but comprehensive in your reasoning.`;
  }



  /**
   * Normalize and validate the Gemini response
   */
  normalizeResponse(response) {
    const result = {
      score: 50, // default fallback
      confidence: 50,
      reasoning: 'No reasoning provided',
      redFlags: [],
      positiveIndicators: [],
      recommendation: 'manual_review'
    };

    // Validate score
    if (typeof response.score === 'number' && response.score >= 0 && response.score <= 100) {
      result.score = Math.round(response.score);
    } else {
      logger.warn('Invalid score in LLM response, using default', { receivedScore: response.score });
    }

    // Validate confidence
    if (typeof response.confidence === 'number' && response.confidence >= 0 && response.confidence <= 100) {
      result.confidence = Math.round(response.confidence);
    } else {
      logger.warn('Invalid confidence in LLM response, using default', { receivedConfidence: response.confidence });
    }

    // Validate reasoning
    if (typeof response.reasoning === 'string' && response.reasoning.trim()) {
      result.reasoning = response.reasoning.trim();
    }

    // Validate arrays
    if (Array.isArray(response.redFlags)) {
      result.redFlags = response.redFlags.filter(flag => typeof flag === 'string');
    }

    if (Array.isArray(response.positiveIndicators)) {
      result.positiveIndicators = response.positiveIndicators.filter(indicator => typeof indicator === 'string');
    }

    // Validate recommendation
    const validRecommendations = ['approve', 'flag', 'manual_review'];
    if (validRecommendations.includes(response.recommendation)) {
      result.recommendation = response.recommendation;
    }

    return result;
  }

  /**
   * Get fallback score when LLM fails
   */
  getFallbackScore(errorMessage) {
    return {
      score: 50, // Neutral score when we can't analyze
      confidence: 0, // No confidence since analysis failed
      reasoning: `LLM analysis failed: ${errorMessage}. Manual review recommended.`,
      redFlags: ['LLM_ANALYSIS_FAILED'],
      positiveIndicators: [],
      recommendation: 'manual_review',
      model: this.model,
      processingTime: 0,
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      error: true
    };
  }

  /**
   * Test the LLM connection and configuration
   */
  async testConnection() {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.model,
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 10,
        }
      });

      const result = await model.generateContent('Reply with just "OK" to confirm connection.');
      const response = result.response.text().trim();
      
      logger.info('Gemini connection test successful', { response });
      return { success: true, response };
    } catch (error) {
      logger.error('Gemini connection test failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get available models (for configuration)
   */
  async getAvailableModels() {
    try {
      // Gemini available models (static list)
      const geminiModels = [
        {
          id: 'gemini-pro',
          description: 'Best model for text-only prompts',
          maxTokens: 32768,
          recommended: true
        },
        {
          id: 'gemini-pro-vision',
          description: 'Best model for text and image prompts',
          maxTokens: 16384,
          recommended: false
        }
      ];
      
      return geminiModels;
    } catch (error) {
      logger.error('Failed to get available models', { error: error.message });
      throw error;
    }
  }
}

module.exports = new LLMScoringService();
