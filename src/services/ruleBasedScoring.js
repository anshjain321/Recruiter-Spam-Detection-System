const validator = require('validator');
const logger = require('../utils/logger');

class RuleBasedScoringService {
  constructor() {
    // Suspicious keywords and patterns
    this.suspiciousKeywords = {
      company: [
        'fake', 'scam', 'test', 'xxx', '123', 'temp', 'sample',
        'demo', 'placeholder', 'example', 'null', 'undefined'
      ],
      role: [
        'CEO', 'founder', 'owner', 'president', 'VP', 'director'
      ],
      industry: [
        'adult', 'gambling', 'cryptocurrency', 'mlm', 'pyramid'
      ]
    };
    
    // Trusted email domains (corporate domains)
    this.trustedDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'company.com', 'corp.com', 'inc.com'
    ];
    
    // Free email providers (less trusted for business)
    this.freeEmailProviders = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'protonmail.com', 'mail.com', '10minutemail.com',
      'tempmail.org', 'guerrillamail.com'
    ];
    
    // Common spam patterns
    this.spamPatterns = {
      email: [
        /^[a-z]+[0-9]{3,}@/i, // email + many numbers
        /^(test|admin|info|contact)[\d]*@/i,
        /noreply|no-reply|donotreply/i
      ],
      phone: [
        /^(\+?1)?[0]{3,}/, // too many zeros
        /^(\+?1)?[1]{3,}/, // too many ones
        /^(\+?1)?[9]{3,}/  // too many nines
      ],
      website: [
        /localhost/i,
        /192\.168\./,
        /127\.0\.0\.1/,
        /example\.(com|org|net)/i,
        /test\.(com|org|net)/i
      ]
    };
  }

  /**
   * Main scoring method
   * @param {Object} recruiterData - The recruiter data to score
   * @returns {Object} - Scoring results
   */
  async scoreRecruiter(recruiterData) {
    const timer = logger.startTimer('Rule-based scoring');
    
    try {
      const results = {
        score: 0,
        maxScore: 100,
        details: {
          keywordScore: 0,
          emailDomainScore: 0,
          websiteScore: 0,
          phoneScore: 0,
          companyNameScore: 0,
          industryScore: 0,
          flags: []
        }
      };

      // Individual scoring components
      const keywordResult = this.checkKeywords(recruiterData);
      const emailResult = this.analyzeEmail(recruiterData.businessEmail);
      const websiteResult = await this.analyzeWebsite(recruiterData.websiteUrl);
      const phoneResult = this.analyzePhone(recruiterData.phoneNumber);
      const companyResult = this.analyzeCompanyName(recruiterData.companyName);
      const industryResult = this.analyzeIndustry(recruiterData.industry);

      // Combine results
      results.details.keywordScore = keywordResult.score;
      results.details.emailDomainScore = emailResult.score;
      results.details.websiteScore = websiteResult.score;
      results.details.phoneScore = phoneResult.score;
      results.details.companyNameScore = companyResult.score;
      results.details.industryScore = industryResult.score;

      // Combine flags
      results.details.flags = [
        ...keywordResult.flags,
        ...emailResult.flags,
        ...websiteResult.flags,
        ...phoneResult.flags,
        ...companyResult.flags,
        ...industryResult.flags
      ];

      // Calculate final score (weighted average)
      results.score = this.calculateFinalScore(results.details);
      
      const processingTime = timer.end();
      
      logger.info('Rule-based scoring completed', {
        score: results.score,
        flags: results.details.flags.length,
        processingTime
      });

      return results;
    } catch (error) {
      timer.end();
      logger.error('Rule-based scoring failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check for suspicious keywords
   */
  checkKeywords(data) {
    const flags = [];
    let score = 85; // Start with high score

    // Check company name for suspicious keywords
    const companyLower = data.companyName.toLowerCase();
    for (const keyword of this.suspiciousKeywords.company) {
      if (companyLower.includes(keyword)) {
        flags.push({
          type: 'suspicious_company_keyword',
          severity: 'high',
          message: `Company name contains suspicious keyword: "${keyword}"`,
          impact: -15
        });
        score -= 15;
      }
    }

    // Check if role sounds too senior for new signups
    const roleLower = data.role.toLowerCase();
    for (const keyword of this.suspiciousKeywords.role) {
      if (roleLower.includes(keyword)) {
        flags.push({
          type: 'senior_role_flag',
          severity: 'medium',
          message: `Role appears very senior: "${data.role}"`,
          impact: -5
        });
        score -= 5;
      }
    }

    // Check industry for high-risk sectors
    const industryLower = data.industry.toLowerCase();
    for (const keyword of this.suspiciousKeywords.industry) {
      if (industryLower.includes(keyword)) {
        flags.push({
          type: 'high_risk_industry',
          severity: 'high',
          message: `Industry flagged as high-risk: "${data.industry}"`,
          impact: -20
        });
        score -= 20;
      }
    }

    return { score: Math.max(0, score), flags };
  }

  /**
   * Analyze email address
   */
  analyzeEmail(email) {
    const flags = [];
    let score = 80; // Start with moderate score

    if (!email || !validator.isEmail(email)) {
      flags.push({
        type: 'invalid_email',
        severity: 'high',
        message: 'Invalid email format',
        impact: -50
      });
      return { score: 30, flags };
    }

    const domain = email.split('@')[1].toLowerCase();
    
    // Check for free email providers
    if (this.freeEmailProviders.includes(domain)) {
      flags.push({
        type: 'free_email_provider',
        severity: 'medium',
        message: 'Using free email provider instead of business domain',
        impact: -10
      });
      score -= 10;
    }

    // Check for spam patterns
    for (const pattern of this.spamPatterns.email) {
      if (pattern.test(email)) {
        flags.push({
          type: 'spam_email_pattern',
          severity: 'high',
          message: 'Email matches spam pattern',
          impact: -25
        });
        score -= 25;
      }
    }

    // Check domain length and complexity
    if (domain.length < 4 || domain.length > 50) {
      flags.push({
        type: 'suspicious_domain_length',
        severity: 'medium',
        message: 'Domain name has unusual length',
        impact: -5
      });
      score -= 5;
    }

    return { score: Math.max(0, score), flags };
  }

  /**
   * Analyze website URL
   */
  async analyzeWebsite(websiteUrl) {
    const flags = [];
    let score = 75; // Start with moderate score

    try {
      if (!websiteUrl || !validator.isURL(websiteUrl, { require_protocol: true })) {
        flags.push({
          type: 'invalid_website_url',
          severity: 'high',
          message: 'Invalid or missing website URL',
          impact: -30
        });
        return { score: 45, flags };
      }

      const url = new URL(websiteUrl);
      const domain = url.hostname.toLowerCase();

      // Check for spam patterns in URL
      for (const pattern of this.spamPatterns.website) {
        if (pattern.test(websiteUrl)) {
          flags.push({
            type: 'spam_website_pattern',
            severity: 'high',
            message: 'Website URL matches spam pattern',
            impact: -25
          });
          score -= 25;
        }
      }

      // Check for HTTPS
      if (url.protocol === 'https:') {
        score += 5; // Bonus for HTTPS
      } else {
        flags.push({
          type: 'no_https',
          severity: 'low',
          message: 'Website does not use HTTPS',
          impact: -5
        });
        score -= 5;
      }

      // Check domain length
      if (domain.length < 4) {
        flags.push({
          type: 'domain_too_short',
          severity: 'medium',
          message: 'Website domain is very short',
          impact: -10
        });
        score -= 10;
      }

      // Check for subdomain depth (too many subdomains can be suspicious)
      const parts = domain.split('.');
      if (parts.length > 4) {
        flags.push({
          type: 'too_many_subdomains',
          severity: 'medium',
          message: 'Website has many subdomains',
          impact: -5
        });
        score -= 5;
      }

      return { score: Math.max(0, score), flags };
    } catch (error) {
      logger.error('Website analysis error', { error: error.message, websiteUrl });
      flags.push({
        type: 'website_analysis_error',
        severity: 'medium',
        message: 'Could not analyze website',
        impact: -10
      });
      return { score: 65, flags };
    }
  }

  /**
   * Analyze phone number
   */
  analyzePhone(phoneNumber) {
    const flags = [];
    let score = 80; // Start with good score

    if (!phoneNumber) {
      flags.push({
        type: 'missing_phone',
        severity: 'medium',
        message: 'Phone number is missing',
        impact: -15
      });
      return { score: 65, flags };
    }

    // Clean phone number for analysis
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');

    // Check length
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      flags.push({
        type: 'invalid_phone_length',
        severity: 'medium',
        message: 'Phone number has invalid length',
        impact: -10
      });
      score -= 10;
    }

    // Check for spam patterns
    for (const pattern of this.spamPatterns.phone) {
      if (pattern.test(phoneNumber)) {
        flags.push({
          type: 'spam_phone_pattern',
          severity: 'high',
          message: 'Phone number matches spam pattern',
          impact: -20
        });
        score -= 20;
      }
    }

    // Check for repeated digits
    const digitCounts = {};
    for (const digit of cleanPhone) {
      digitCounts[digit] = (digitCounts[digit] || 0) + 1;
    }

    const maxRepeats = Math.max(...Object.values(digitCounts));
    if (maxRepeats > 5) {
      flags.push({
        type: 'repeated_digits',
        severity: 'medium',
        message: 'Phone number has too many repeated digits',
        impact: -15
      });
      score -= 15;
    }

    return { score: Math.max(0, score), flags };
  }

  /**
   * Analyze company name
   */
  analyzeCompanyName(companyName) {
    const flags = [];
    let score = 85; // Start with good score

    if (!companyName || companyName.trim().length < 2) {
      flags.push({
        type: 'invalid_company_name',
        severity: 'high',
        message: 'Company name is too short or missing',
        impact: -30
      });
      return { score: 55, flags };
    }

    // Check for suspicious patterns
    const nameLower = companyName.toLowerCase().trim();
    
    // Check for numbers at the end (common in fake companies)
    if (/\d{3,}$/.test(nameLower)) {
      flags.push({
        type: 'company_name_with_many_numbers',
        severity: 'medium',
        message: 'Company name ends with many numbers',
        impact: -10
      });
      score -= 10;
    }

    // Check for very generic names
    const genericNames = ['company', 'business', 'corp', 'inc', 'ltd', 'llc'];
    if (genericNames.some(generic => nameLower === generic || nameLower.startsWith(generic + ' '))) {
      flags.push({
        type: 'generic_company_name',
        severity: 'medium',
        message: 'Company name is very generic',
        impact: -5
      });
      score -= 5;
    }

    // Check for excessive capitalization
    if (companyName === companyName.toUpperCase() && companyName.length > 10) {
      flags.push({
        type: 'excessive_caps',
        severity: 'low',
        message: 'Company name is all capitals',
        impact: -3
      });
      score -= 3;
    }

    return { score: Math.max(0, score), flags };
  }

  /**
   * Analyze industry
   */
  analyzeIndustry(industry) {
    const flags = [];
    let score = 90; // Start with high score

    if (!industry || industry.trim().length < 2) {
      flags.push({
        type: 'missing_industry',
        severity: 'medium',
        message: 'Industry information is missing or too short',
        impact: -10
      });
      return { score: 80, flags };
    }

    // Industry is generally less problematic, so fewer checks
    const industryLower = industry.toLowerCase().trim();
    
    // Check for vague industries
    const vagueIndustries = ['other', 'various', 'multiple', 'general'];
    if (vagueIndustries.includes(industryLower)) {
      flags.push({
        type: 'vague_industry',
        severity: 'low',
        message: 'Industry description is vague',
        impact: -5
      });
      score -= 5;
    }

    return { score: Math.max(0, score), flags };
  }

  /**
   * Calculate final weighted score
   */
  calculateFinalScore(details) {
    const weights = {
      keywordScore: 0.25,
      emailDomainScore: 0.20,
      websiteScore: 0.20,
      phoneScore: 0.15,
      companyNameScore: 0.15,
      industryScore: 0.05
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [component, weight] of Object.entries(weights)) {
      if (details[component] !== undefined) {
        weightedSum += details[component] * weight;
        totalWeight += weight;
      }
    }

    // Apply penalty for high-severity flags
    let flagPenalty = 0;
    for (const flag of details.flags) {
      if (flag.severity === 'high') flagPenalty += 5;
      else if (flag.severity === 'medium') flagPenalty += 2;
      else flagPenalty += 1;
    }

    const baseScore = totalWeight > 0 ? (weightedSum / totalWeight) : 50;
    const finalScore = Math.max(0, Math.min(100, baseScore - flagPenalty));

    return Math.round(finalScore);
  }
}

module.exports = new RuleBasedScoringService();
