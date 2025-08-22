const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VerificationResult = sequelize.define('VerificationResult', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  recruiterId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'recruiter_id', // Map to snake_case column
    references: {
      model: 'recruiters',
      key: 'id'
    }
  },
  
  // Overall scoring results
  finalScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 100
    }
  },
  
  decision: {
    type: DataTypes.ENUM('approved', 'flagged', 'pending_review'),
    allowNull: false
  },
  
  confidence: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 100
    }
  },
  
  // Rule-based scoring breakdown (stored as JSON)
  ruleBasedScore: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {
      score: 0,
      details: {
        keywordScore: 0,
        emailDomainScore: 0,
        websiteScore: 0,
        phoneScore: 0,
        companyNameScore: 0,
        industryScore: 0,
        flags: []
      }
    }
  },
  
  // LLM scoring results (stored as JSON)
  llmScore: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {
      score: 0,
      model: 'gemini-pro',
      reasoning: '',
      confidence: 0,
      processingTime: 0,
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      }
    }
  },
  
  // External API verification results (stored as JSON)
  externalVerification: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      email: { isValid: null, score: 0 },
      phone: { isValid: null, score: 0 },
      company: { isValid: null, score: 0 },
      domain: { isValid: null, score: 0 }
    }
  },
  
  // Performance metrics (stored as JSON)
  processingMetrics: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      totalProcessingTime: 0,
      ruleBasedTime: 0,
      llmTime: 0,
      externalApiTime: 0,
      apiCallsCount: 0,
      errors: []
    }
  },
  
  // Additional metadata
  version: {
    type: DataTypes.STRING(10),
    defaultValue: '1.0'
  },
  
  reviewedBy: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 1000],
        msg: 'Notes cannot exceed 1000 characters'
      }
    }
  }
}, {
  tableName: 'verification_results',
  indexes: [
    {
      fields: ['recruiter_id']
    },
    {
      fields: ['decision']
    },
    {
      fields: ['final_score']
    },
    {
      fields: ['created_at']
    }
  ]
});

// Instance methods
VerificationResult.prototype.getScoreBreakdown = function() {
  const ruleWeight = parseFloat(process.env.RULE_BASED_WEIGHT) || 0.3;
  const llmWeight = parseFloat(process.env.LLM_WEIGHT) || 0.4;
  const apiWeight = parseFloat(process.env.EXTERNAL_API_WEIGHT) || 0.3;
  
  return {
    ruleBasedWeighted: this.ruleBasedScore.score * ruleWeight,
    llmWeighted: this.llmScore.score * llmWeight,
    externalWeighted: this.getExternalAPIWeightedScore() * apiWeight,
    weights: { rule: ruleWeight, llm: llmWeight, external: apiWeight }
  };
};

VerificationResult.prototype.getExternalAPIWeightedScore = function() {
  if (!this.externalVerification) return 0;
  
  const scores = [
    this.externalVerification.email?.score || 0,
    this.externalVerification.phone?.score || 0,
    this.externalVerification.company?.score || 0,
    this.externalVerification.domain?.score || 0
  ].filter(score => score > 0);
  
  return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0;
};

// Class methods
VerificationResult.getVerificationStats = async function() {
  try {
    const stats = await this.findAll({
      attributes: [
        'decision',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('final_score')), 'avgScore']
      ],
      group: ['decision']
    });
    
    return stats.map(stat => ({
      _id: stat.decision,
      count: parseInt(stat.dataValues.count),
      avgScore: parseFloat(stat.dataValues.avgScore) || 0
    }));
  } catch (error) {
    console.error('Error getting verification stats:', error);
    return [];
  }
};

// Define associations
VerificationResult.associate = function(models) {
  VerificationResult.belongsTo(models.Recruiter, {
    foreignKey: 'recruiter_id',
    as: 'recruiter'
  });
};

module.exports = VerificationResult;
