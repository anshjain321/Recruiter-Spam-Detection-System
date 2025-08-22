const axios = require('axios');
const validator = require('validator');
const dns = require('dns').promises;
const cheerio = require('cheerio');
const logger = require('../utils/logger');

class ExternalVerificationService {
  constructor() {
    this.timeout = parseInt(process.env.API_TIMEOUT) || 10000; // 10 seconds
    
    // API configurations
    this.apis = {
      hunter: {
        baseUrl: 'https://api.hunter.io/',
        key: process.env.HUNTER_API_KEY
      },
      numverify: {
        baseUrl: 'http://apilayer.net/api',
        key: process.env.NUMVERIFY_API_KEY
      },
      clearbit: {
        baseUrl: 'https://company.clearbit.com/v1',
        key: process.env.CLEARBIT_API_KEY
      }
    };

    // Setup axios instances with timeouts
    this.httpClient = axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent': 'RecruitSpamDetector/1.0'
      }
    });
  }

  /**
   * Check if API key is valid (not placeholder or empty)
   */
  isValidApiKey(key) {
    return key && 
           key.trim() !== '' && 
           !key.includes('placeholder') && 
           !key.includes('your_') && 
           !key.includes('demo_') &&
           key !== 'your_gemini_api_key_here' &&
           key !== 'your_hunter_io_api_key' &&
           key !== 'your_clearbit_api_key' &&
           key !== 'your_numverify_api_key';
  }

  /**
   * Verify all external data points
   * @param {Object} recruiterData - Recruiter data to verify
   * @returns {Object} - Complete verification results
   */
  async verifyAll(recruiterData) {
    const timer = logger.startTimer('External verification');
    const startTime = Date.now();
    
    try {
      // Run all verifications in parallel for speed
      const [
        emailResults,
        phoneResults,
        companyResults,
        domainResults
      ] = await Promise.allSettled([
        this.verifyEmail(recruiterData.businessEmail),
        this.verifyPhone(recruiterData.phoneNumber),
        this.verifyCompany(recruiterData.companyName, recruiterData.websiteUrl),
        this.verifyDomain(recruiterData.websiteUrl)
      ]);

      const results = {
        email: this.handlePromiseResult(emailResults, 'email'),
        phone: this.handlePromiseResult(phoneResults, 'phone'),
        company: this.handlePromiseResult(companyResults, 'company'),
        domain: this.handlePromiseResult(domainResults, 'domain'),
        processingTime: Date.now() - startTime,
        apiCallsCount: 0,
        errors: []
      };

      // Count successful API calls
      Object.values(results).forEach(result => {
        if (result && result.apiCalled) results.apiCallsCount++;
        if (result && result.error) {
          results.errors.push({
            source: result.source || 'unknown',
            error: result.error,
            timestamp: new Date()
          });
        }
      });

      timer.end();

      logger.info('External verification completed', {
        apiCalls: results.apiCallsCount,
        errors: results.errors.length,
        processingTime: results.processingTime
      });

      return results;
    } catch (error) {
      timer.end();
      logger.error('External verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify email address using Hunter.io
   */
  async verifyEmail(email) {
    if (!email || !validator.isEmail(email)) {
      return {
        isValid: false,
        score: 0,
        error: 'Invalid email format',
        source: 'validation'
      };
    }

    try {
      // First, basic DNS check for domain
      const domain = email.split('@')[1];
      const dnsResult = await this.checkDNS(domain);
      
      if (!this.isValidApiKey(this.apis.hunter.key)) {
        logger.info('Hunter.io API key not configured, using basic validation');
        return {
          isValid: dnsResult.isValid,
          isDomainValid: dnsResult.isValid,
          score: dnsResult.isValid ? 60 : 20,
          provider: 'dns-only',
          details: { dnsCheck: dnsResult },
          source: 'dns'
        };
      }

      // Use Hunter.io API
      const response = await this.httpClient.get(
        `${this.apis.hunter.baseUrl}/email-verifier`,
        {
          params: {
            email: email,
            api_key: this.apis.hunter.key
          }
        }
      );

      const data = response.data.data;
      
      // Calculate score based on Hunter.io results
      let score = 50; // base score
      if (data.result === 'deliverable') score = 90;
      else if (data.result === 'undeliverable') score = 10;
      else if (data.result === 'risky') score = 30;
      else if (data.result === 'unknown') score = 50;

      // Adjust based on additional factors
      if (data.mx_records) score += 5;
      if (data.smtp_server) score += 5;
      if (data.smtp_check) score += 10;

      logger.logExternalApiCall('hunter.io', 'email-verifier', true, Date.now());

      return {
        isValid: data.result === 'deliverable',
        isDeliverable: data.result === 'deliverable',
        isDomainValid: data.mx_records || dnsResult.isValid,
        provider: 'hunter.io',
        score: Math.min(100, score),
        details: {
          result: data.result,
          score: data.score,
          email: data.email,
          regexp: data.regexp,
          gibberish: data.gibberish,
          disposable: data.disposable,
          webmail: data.webmail,
          mx_records: data.mx_records,
          smtp_server: data.smtp_server,
          smtp_check: data.smtp_check,
          accept_all: data.accept_all,
          block: data.block
        },
        apiCalled: true,
        source: 'hunter'
      };

    } catch (error) {
      logger.logExternalApiCall('hunter.io', 'email-verifier', false, Date.now(), error);
      
      // Fallback to DNS check
      const dnsResult = await this.checkDNS(email.split('@')[1]);
      return {
        isValid: dnsResult.isValid,
        isDomainValid: dnsResult.isValid,
        score: dnsResult.isValid ? 40 : 10, // Lower score due to API failure
        provider: 'dns-fallback',
        error: error.message,
        source: 'dns',
        apiCalled: false
      };
    }
  }

  /**
   * Verify phone number using Numverify
   */
  async verifyPhone(phoneNumber) {
    if (!phoneNumber) {
      return {
        isValid: false,
        score: 0,
        error: 'Phone number not provided',
        source: 'validation'
      };
    }

    try {
      // Clean phone number
      const cleanPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
      
      if (!this.isValidApiKey(this.apis.numverify.key)) {
        logger.info('Numverify API key not configured, using basic validation');
        const isBasicValid = /^[\d]{10,15}$/.test(cleanPhone);
        return {
          isValid: isBasicValid,
          score: isBasicValid ? 50 : 20,
          provider: 'basic-validation',
          source: 'validation'
        };
      }

      // Use Numverify API
      const response = await this.httpClient.get(
        `${this.apis.numverify.baseUrl}/validate`,
        {
          params: {
            access_key: this.apis.numverify.key,
            number: phoneNumber,
            country_code: '', // Let API detect
            format: 1
          }
        }
      );

      const data = response.data;
      
      if (data.error) {
        throw new Error(data.error.info || 'Numverify API error');
      }

      // Calculate score based on validation results
      let score = data.valid ? 80 : 20;
      if (data.line_type === 'mobile') score += 10;
      if (data.carrier && data.carrier.length > 0) score += 5;

      logger.logExternalApiCall('numverify', 'validate', true, Date.now());

      return {
        isValid: data.valid,
        country: data.country_name,
        countryCode: data.country_code,
        carrier: data.carrier,
        lineType: data.line_type,
        provider: 'numverify',
        score: Math.min(100, score),
        details: {
          valid: data.valid,
          number: data.number,
          local_format: data.local_format,
          international_format: data.international_format,
          country_prefix: data.country_prefix,
          country_code: data.country_code,
          country_name: data.country_name,
          location: data.location,
          carrier: data.carrier,
          line_type: data.line_type
        },
        apiCalled: true,
        source: 'numverify'
      };

    } catch (error) {
      logger.logExternalApiCall('numverify', 'validate', false, Date.now(), error);
      
      // Basic validation fallback
      const cleanPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
      const isBasicValid = /^[\d]{10,15}$/.test(cleanPhone);
      
      return {
        isValid: isBasicValid,
        score: isBasicValid ? 30 : 10, // Lower score due to API failure
        provider: 'basic-fallback',
        error: error.message,
        source: 'validation',
        apiCalled: false
      };
    }
  }

  /**
   * Verify company information using Clearbit and web scraping
   */
  async verifyCompany(companyName, websiteUrl) {
    try {
      let clearbitData = null;
      let webScrapingData = null;

      // Try Clearbit first (if available and properly configured)
      if (this.isValidApiKey(this.apis.clearbit.key) && websiteUrl) {
        try {
          clearbitData = await this.getClearbitData(websiteUrl);
        } catch (error) {
          logger.warn('Clearbit lookup failed, continuing with web scraping', { error: error.message });
        }
      } else if (websiteUrl) {
        logger.info('Clearbit API key not configured, skipping Clearbit verification');
      }

      // Web scraping as primary/fallback method
      if (websiteUrl) {
        try {
          webScrapingData = await this.scrapeWebsiteData(websiteUrl);
        } catch (error) {
          logger.warn('Website scraping failed', { error: error.message });
        }
      }

      // Combine results
      return this.combineCompanyData(companyName, clearbitData, webScrapingData);

    } catch (error) {
      logger.error('Company verification failed', { error: error.message });
      return {
        isValid: false,
        score: 30,
        error: error.message,
        source: 'verification',
        apiCalled: false
      };
    }
  }

  /**
   * Get company data from Clearbit
   */
  async getClearbitData(websiteUrl) {
    const domain = new URL(websiteUrl).hostname;
    
    const response = await this.httpClient.get(
      `${this.apis.clearbit.baseUrl}/domains/find`,
      {
        params: { domain },
        headers: {
          'Authorization': `Bearer ${this.apis.clearbit.key}`
        }
      }
    );

    logger.logExternalApiCall('clearbit', 'domains/find', true, Date.now());
    return response.data;
  }

  /**
   * Scrape basic website data
   */
  async scrapeWebsiteData(websiteUrl) {
    const response = await this.httpClient.get(websiteUrl, {
      timeout: 5000, // Shorter timeout for web scraping
      maxRedirects: 3
    });

    const $ = cheerio.load(response.data);
    
    return {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      hasContactPage: $('a[href*="contact"]').length > 0,
      hasAboutPage: $('a[href*="about"]').length > 0,
      hasPrivacyPolicy: $('a[href*="privacy"]').length > 0,
      hasTermsOfService: $('a[href*="terms"]').length > 0,
      socialLinks: {
        linkedin: $('a[href*="linkedin.com"]').length > 0,
        twitter: $('a[href*="twitter.com"]').length > 0,
        facebook: $('a[href*="facebook.com"]').length > 0
      },
      contentLength: response.data.length,
      isSSL: websiteUrl.startsWith('https://'),
      statusCode: response.status
    };
  }

  /**
   * Combine company verification data
   */
  combineCompanyData(companyName, clearbitData, webData) {
    let score = 40; // Base score
    let isValid = false;
    const details = {};

    // Process Clearbit data
    if (clearbitData) {
      isValid = true;
      score = 85;
      details.clearbit = {
        name: clearbitData.name,
        domain: clearbitData.domain,
        founded: clearbitData.foundedYear,
        employees: clearbitData.metrics?.employees,
        industry: clearbitData.category?.industry
      };
      if (clearbitData.name && clearbitData.name.toLowerCase().includes(companyName.toLowerCase())) {
        score += 10; // Name matches
      }
    }

    // Process web scraping data
    if (webData) {
      isValid = true;
      if (!clearbitData) score = 60; // Base score for web data only
      
      details.website = webData;
      
      // Score adjustments based on website quality
      if (webData.hasContactPage) score += 5;
      if (webData.hasAboutPage) score += 5;
      if (webData.hasPrivacyPolicy) score += 3;
      if (webData.isSSL) score += 5;
      if (webData.socialLinks.linkedin) score += 8;
      if (webData.socialLinks.twitter || webData.socialLinks.facebook) score += 3;
      if (webData.contentLength > 5000) score += 5; // Substantial content
    }

    return {
      isValid,
      score: Math.min(100, score),
      provider: clearbitData ? 'clearbit+scraping' : 'scraping',
      details,
      socialPresence: {
        linkedin: webData?.socialLinks?.linkedin || false,
        twitter: webData?.socialLinks?.twitter || false,
        facebook: webData?.socialLinks?.facebook || false
      },
      apiCalled: !!clearbitData,
      source: clearbitData ? 'clearbit' : 'scraping'
    };
  }

  /**
   * Verify domain information
   */
  async verifyDomain(websiteUrl) {
    try {
      if (!websiteUrl || !validator.isURL(websiteUrl)) {
        return {
          isValid: false,
          score: 0,
          error: 'Invalid URL',
          source: 'validation'
        };
      }

      const url = new URL(websiteUrl);
      const domain = url.hostname;

      // DNS and basic checks
      const dnsResult = await this.checkDNS(domain);
      
      let score = dnsResult.isValid ? 70 : 20;
      const details = { dns: dnsResult };

      // SSL check
      if (url.protocol === 'https:') {
        score += 10;
        details.ssl = true;
      } else {
        details.ssl = false;
      }

      // Domain age estimation (simplified)
      // In a real implementation, you might use a domain age API
      const domainParts = domain.split('.');
      if (domainParts.length <= 2) {
        score += 5; // Simpler domains might be more established
      }

      return {
        isValid: dnsResult.isValid,
        isSSL: url.protocol === 'https:',
        score: Math.min(100, score),
        domain,
        details,
        source: 'dns'
      };

    } catch (error) {
      logger.error('Domain verification failed', { error: error.message });
      return {
        isValid: false,
        score: 10,
        error: error.message,
        source: 'verification'
      };
    }
  }

  /**
   * Check DNS records for a domain
   */
  async checkDNS(domain) {
    try {
      const [mxRecords, aRecords] = await Promise.allSettled([
        dns.resolveMx(domain),
        dns.resolve4(domain)
      ]);

      return {
        isValid: mxRecords.status === 'fulfilled' || aRecords.status === 'fulfilled',
        hasMX: mxRecords.status === 'fulfilled',
        hasA: aRecords.status === 'fulfilled',
        mxRecords: mxRecords.status === 'fulfilled' ? mxRecords.value : [],
        aRecords: aRecords.status === 'fulfilled' ? aRecords.value : []
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Handle Promise.allSettled results
   */
  handlePromiseResult(result, source) {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      logger.error(`${source} verification failed`, { error: result.reason.message });
      return {
        error: result.reason.message,
        score: 10,
        isValid: false,
        source,
        apiCalled: false
      };
    }
  }

  /**
   * Test all external API connections
   */
  async testConnections() {
    const results = {};

    // Test Hunter.io
    if (this.apis.hunter.key) {
      try {
        await this.httpClient.get(`${this.apis.hunter.baseUrl}/account`, {
          params: { api_key: this.apis.hunter.key }
        });
        results.hunter = { status: 'success', message: 'Connected successfully' };
      } catch (error) {
        results.hunter = { status: 'error', message: error.message };
      }
    } else {
      results.hunter = { status: 'not_configured', message: 'API key not provided' };
    }

    // Test Numverify
    if (this.apis.numverify.key) {
      try {
        await this.httpClient.get(`${this.apis.numverify.baseUrl}/validate`, {
          params: { 
            access_key: this.apis.numverify.key,
            number: '+1234567890' // Test number
          }
        });
        results.numverify = { status: 'success', message: 'Connected successfully' };
      } catch (error) {
        results.numverify = { status: 'error', message: error.message };
      }
    } else {
      results.numverify = { status: 'not_configured', message: 'API key not provided' };
    }

    // Test Clearbit
    if (this.apis.clearbit.key) {
      try {
        await this.httpClient.get(`${this.apis.clearbit.baseUrl}/domains/find`, {
          params: { domain: 'clearbit.com' },
          headers: { 'Authorization': `Bearer ${this.apis.clearbit.key}` }
        });
        results.clearbit = { status: 'success', message: 'Connected successfully' };
      } catch (error) {
        results.clearbit = { status: 'error', message: error.message };
      }
    } else {
      results.clearbit = { status: 'not_configured', message: 'API key not provided' };
    }

    return results;
  }
}

module.exports = new ExternalVerificationService();
