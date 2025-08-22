#!/usr/bin/env node

/**
 * Demo script for Recruiter Spam Detection System
 * 
 * This script demonstrates the system capabilities by:
 * 1. Creating sample recruiter data
 * 2. Running the scoring workflow
 * 3. Showing real-time results
 * 4. Generating demo dashboard data
 */

const axios = require('axios');
const colors = require('colors');
require('dotenv').config();

const API_BASE = `http://localhost:${process.env.PORT || 3000}/api`;

// Demo data sets
const LEGITIMATE_RECRUITERS = [
  {
    fullName: "Sarah Johnson",
    companyName: "TechCorp Solutions",
    websiteUrl: "https://techcorp-solutions.com",
    businessEmail: "sarah.johnson@techcorp-solutions.com",
    phoneNumber: "+1-555-0123",
    role: "Senior Technical Recruiter",
    industry: "Technology",
    password: "SecurePass123!"
  },
  {
    fullName: "Michael Chen",
    companyName: "DataFlow Analytics",
    websiteUrl: "https://dataflow-analytics.com",
    businessEmail: "m.chen@dataflow-analytics.com",
    phoneNumber: "+1-555-0234",
    role: "Talent Acquisition Manager",
    industry: "Data Science",
    password: "MySecurePass456!"
  },
  {
    fullName: "Emily Rodriguez",
    companyName: "CloudFirst Consulting",
    websiteUrl: "https://cloudfirst-consulting.com",
    businessEmail: "emily.rodriguez@cloudfirst-consulting.com",
    phoneNumber: "+1-555-0345",
    role: "HR Business Partner",
    industry: "Cloud Computing",
    password: "CloudPass789!"
  }
];

const SUSPICIOUS_RECRUITERS = [
  {
    fullName: "John Scammer",
    companyName: "Fake Corp 123",
    websiteUrl: "https://example.com",
    businessEmail: "test123@gmail.com",
    phoneNumber: "1111111111",
    role: "CEO",
    industry: "Various",
    password: "password123"
  },
  {
    fullName: "Spam Bot",
    companyName: "TestCompany",
    websiteUrl: "http://localhost:3000",
    businessEmail: "noreply@tempmail.org",
    phoneNumber: "0000000000",
    role: "Owner",
    industry: "Other",
    password: "spampass"
  },
  {
    fullName: "X Y",
    companyName: "ABC Inc",
    websiteUrl: "https://192.168.1.1",
    businessEmail: "admin@example.org",
    phoneNumber: "9999999999",
    role: "Founder",
    industry: "Adult",
    password: "weak"
  }
];

class DemoRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async run() {
    console.log('\n🎭 RECRUITER SPAM DETECTION DEMO'.rainbow.bold);
    console.log('=====================================\n'.rainbow);

    try {
      // Check if server is running
      await this.checkServerHealth();

      // Run demo scenarios
      await this.runLegitimateRecruitersDemo();
      await this.runSuspiciousRecruitersDemo();
      
      // Wait for all processing to complete
      await this.waitForProcessing();
      
      // Show dashboard data
      await this.showDashboardData();
      
      // Display summary
      this.displaySummary();

      console.log('\n🎉 Demo completed successfully!'.green.bold);
      
    } catch (error) {
      console.log(`\n❌ Demo failed: ${error.message}`.red);
      process.exit(1);
    }
  }

  async checkServerHealth() {
    console.log('🏥 Checking server health...'.blue);
    
    try {
      const response = await axios.get(`${API_BASE}/../health`, { timeout: 5000 });
      
      if (response.data.status === 'OK') {
        console.log('✅ Server is healthy and ready\n'.green);
      } else {
        throw new Error('Server health check failed');
      }
    } catch (error) {
      throw new Error('Cannot connect to server. Please ensure the server is running on port ' + (process.env.PORT || 3000));
    }
  }

  async runLegitimateRecruitersDemo() {
    console.log('👥 LEGITIMATE RECRUITERS DEMO'.cyan.bold);
    console.log('==============================\n'.cyan);

    for (let i = 0; i < LEGITIMATE_RECRUITERS.length; i++) {
      const recruiter = LEGITIMATE_RECRUITERS[i];
      console.log(`📋 Processing recruiter ${i + 1}/3: ${recruiter.fullName}`.yellow);
      
      try {
        const result = await this.submitRecruiter(recruiter);
        this.results.push({ ...result, expectedLegitimate: true });
        
        console.log(`   Company: ${recruiter.companyName}`);
        console.log(`   Email: ${recruiter.businessEmail}`);
        console.log(`   Status: ${'Registration submitted'.green} - Verification in progress\n`);
        
      } catch (error) {
        console.log(`   Error: ${error.message}`.red);
      }
    }
  }

  async runSuspiciousRecruitersDemo() {
    console.log('🚨 SUSPICIOUS RECRUITERS DEMO'.red.bold);
    console.log('==============================\n'.red);

    for (let i = 0; i < SUSPICIOUS_RECRUITERS.length; i++) {
      const recruiter = SUSPICIOUS_RECRUITERS[i];
      console.log(`🔍 Processing suspicious recruiter ${i + 1}/3: ${recruiter.fullName}`.yellow);
      
      try {
        const result = await this.submitRecruiter(recruiter);
        this.results.push({ ...result, expectedLegitimate: false });
        
        console.log(`   Company: ${recruiter.companyName}`);
        console.log(`   Email: ${recruiter.businessEmail}`);
        console.log(`   Red flags: Company name, free email, suspicious patterns`);
        console.log(`   Status: ${'Registration submitted'.green} - Verification in progress\n`);
        
      } catch (error) {
        console.log(`   Error: ${error.message}`.red);
      }
    }
  }

  async submitRecruiter(recruiterData) {
    try {
      const response = await axios.post(`${API_BASE}/recruiters/signup`, recruiterData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        id: response.data.data.id,
        email: response.data.data.email,
        submittedAt: new Date(),
        data: recruiterData
      };
    } catch (error) {
      if (error.response && error.response.data) {
        throw new Error(error.response.data.message || 'Registration failed');
      }
      throw error;
    }
  }

  async waitForProcessing() {
    console.log('⏳ WAITING FOR VERIFICATION PROCESSING'.magenta.bold);
    console.log('=======================================\n'.magenta);
    
    const maxWaitTime = 90000; // 90 seconds
    const checkInterval = 3000; // 3 seconds
    let elapsed = 0;
    
    while (elapsed < maxWaitTime) {
      console.log(`⌛ Checking verification status... (${Math.round(elapsed/1000)}s elapsed)`);
      
      let allCompleted = true;
      
      for (let result of this.results) {
        if (!result.verificationComplete) {
          try {
            const response = await axios.get(`${API_BASE}/recruiters/${result.id}/verification`);
            
            if (response.data.data.status === 'completed') {
              result.verificationComplete = true;
              result.finalScore = response.data.data.finalScore;
              result.decision = response.data.data.decision;
              result.confidence = response.data.data.confidence;
              result.breakdown = response.data.data.breakdown;
              
              console.log(`✅ ${result.data.fullName}: Score ${result.finalScore}/100, Decision: ${result.decision}`.green);
            } else {
              allCompleted = false;
            }
          } catch (error) {
            console.log(`⚠️  Error checking ${result.data.fullName}: ${error.message}`.yellow);
            allCompleted = false;
          }
        }
      }
      
      if (allCompleted) {
        console.log('\n🎯 All verifications completed!'.green.bold);
        break;
      }
      
      await this.sleep(checkInterval);
      elapsed += checkInterval;
    }
    
    if (elapsed >= maxWaitTime) {
      console.log('\n⚠️  Some verifications may still be processing...'.yellow);
    }
  }

  async showDashboardData() {
    console.log('\n📊 DASHBOARD ANALYTICS'.blue.bold);
    console.log('======================\n'.blue);

    try {
      // Get overview
      const overview = await axios.get(`${API_BASE}/dashboard/overview?timeframe=1h`);
      const data = overview.data.data;

      console.log('📈 System Overview:'.cyan);
      console.log(`   Total Recruiters: ${data.totals.recruiters}`);
      console.log(`   Recent Signups (1h): ${data.totals.recentRecruiters}`);
      console.log(`   Total Verifications: ${data.totals.verifications}`);

      console.log('\n📊 Status Breakdown:'.cyan);
      data.statusBreakdown.forEach(status => {
        const emoji = status._id === 'approved' ? '✅' : 
                     status._id === 'flagged' ? '🚩' : 
                     status._id === 'pending' ? '⏳' : '❓';
        console.log(`   ${emoji} ${status._id}: ${status.count}`);
      });

      console.log('\n⚡ Scoring Configuration:'.cyan);
      console.log(`   Spam Threshold: ${data.scoring.threshold}/100`);
      console.log(`   Average Score: ${Math.round(data.scoring.averageScore)}/100`);

    } catch (error) {
      console.log(`⚠️  Could not fetch dashboard data: ${error.message}`.yellow);
    }
  }

  displaySummary() {
    console.log('\n📋 DEMO SUMMARY'.rainbow.bold);
    console.log('===============\n'.rainbow);

    let correctPredictions = 0;
    let totalPredictions = 0;

    console.log('🎯 Verification Results:\n'.cyan.bold);
    
    this.results.forEach((result, index) => {
      const expected = result.expectedLegitimate ? 'LEGITIMATE' : 'SUSPICIOUS';
      const actualDecision = result.decision || 'pending';
      
      let status = '⏳ Processing';
      let correct = false;
      
      if (result.verificationComplete) {
        totalPredictions++;
        
        if (result.expectedLegitimate && result.decision === 'approved') {
          status = '✅ Correctly identified as legitimate';
          correct = true;
        } else if (!result.expectedLegitimate && (result.decision === 'flagged' || result.finalScore < 50)) {
          status = '✅ Correctly identified as suspicious';
          correct = true;
        } else {
          status = '❌ Prediction needs review';
        }
        
        if (correct) correctPredictions++;
      }
      
      console.log(`${index + 1}. ${result.data.fullName}`.white.bold);
      console.log(`   Expected: ${expected}`);
      console.log(`   Score: ${result.finalScore || 'Processing'}/100`);
      console.log(`   Decision: ${actualDecision}`);
      console.log(`   Status: ${status}`);
      console.log(`   Company: ${result.data.companyName}\n`);
    });

    if (totalPredictions > 0) {
      const accuracy = Math.round((correctPredictions / totalPredictions) * 100);
      console.log(`🎯 System Accuracy: ${correctPredictions}/${totalPredictions} (${accuracy}%)`.green.bold);
    }

    const processingTime = Math.round((Date.now() - this.startTime) / 1000);
    console.log(`⏱️  Total Demo Time: ${processingTime} seconds`.blue);
    
    console.log('\n🔗 Next Steps:'.yellow.bold);
    console.log('   • View full dashboard: http://localhost:3000/api/dashboard/overview');
    console.log('   • Check system health: http://localhost:3000/health');
    console.log('   • API documentation: http://localhost:3000/api/docs');
    console.log('   • Test your own recruiter: POST http://localhost:3000/api/recruiters/signup');
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run demo if called directly
if (require.main === module) {
  const demo = new DemoRunner();
  demo.run().catch(error => {
    console.log(`\n❌ Demo script failed: ${error.message}`.red);
    process.exit(1);
  });
}

module.exports = DemoRunner;
