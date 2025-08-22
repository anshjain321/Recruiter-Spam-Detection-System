const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { sequelize } = require('../config/database');

const Recruiter = sequelize.define('Recruiter', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fullName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Full name is required'
      },
      len: {
        args: [2, 100],
        msg: 'Full name must be between 2 and 100 characters'
      }
    }
  },
  companyName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Company name is required'
      },
      len: {
        args: [2, 200],
        msg: 'Company name must be between 2 and 200 characters'
      }
    }
  },
  websiteUrl: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Website URL is required'
      },
      isUrl: {
        msg: 'Please provide a valid website URL'
      }
    }
  },
  businessEmail: {
    type: DataTypes.STRING(254),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: {
        msg: 'Business email is required'
      },
      isEmail: {
        msg: 'Please provide a valid email address'
      }
    },
    set(value) {
      this.setDataValue('businessEmail', value.toLowerCase().trim());
    }
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Phone number is required'
      },
      isValidPhone(value) {
        const cleanPhone = value.replace(/[\s\-\(\)\+]/g, '');
        if (!/^[\+]?[1-9][\d]{0,15}$/.test(cleanPhone)) {
          throw new Error('Please provide a valid phone number');
        }
      }
    }
  },
  role: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Role is required'
      },
      len: {
        args: [1, 100],
        msg: 'Role cannot exceed 100 characters'
      }
    }
  },
  industry: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Industry is required'
      },
      len: {
        args: [1, 100],
        msg: 'Industry cannot exceed 100 characters'
      }
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Password is required'
      },
      len: {
        args: [8, 128],
        msg: 'Password must be between 8 and 128 characters'
      },
      isStrongPassword(value) {
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(value)) {
          throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
        }
      }
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'flagged', 'rejected'),
    defaultValue: 'pending'
  },
  verificationScore: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 100
    }
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isPhoneVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  registrationSource: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  tableName: 'recruiters',
  indexes: [
    {
      unique: true,
      fields: ['business_email']
    },
    {
      fields: ['company_name']
    },
    {
      fields: ['status']
    },
    {
      fields: ['verification_score']
    },
    {
      fields: ['created_at']
    }
  ],
  hooks: {
    beforeSave: async (recruiter) => {
      if (recruiter.changed('password')) {
        const salt = await bcrypt.genSalt(12);
        recruiter.password = await bcrypt.hash(recruiter.password, salt);
      }
    }
  }
});

// Instance methods
Recruiter.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

Recruiter.prototype.toSafeObject = function() {
  const recruiterObject = this.toJSON();
  delete recruiterObject.password;
  return recruiterObject;
};

// Virtual getters
Recruiter.prototype.getEmailDomain = function() {
  return this.businessEmail ? this.businessEmail.split('@')[1] : null;
};

Recruiter.prototype.getWebsiteDomain = function() {
  try {
    return new URL(this.websiteUrl).hostname;
  } catch {
    return null;
  }
};

// Define associations
Recruiter.associate = function(models) {
  Recruiter.hasMany(models.VerificationResult, {
    foreignKey: 'recruiter_id',
    as: 'verificationResults'
  });
};

// Class methods
Recruiter.findByEmail = function(email) {
  return this.findOne({ where: { businessEmail: email.toLowerCase() } });
};

module.exports = Recruiter;
