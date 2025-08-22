# Recruiter Spam Detection System

A comprehensive AI-powered system that automatically detects and flags potentially fraudulent or spam recruiter signups on hiring platforms using a hybrid scoring approach (rule-based + LLM + external verification).

## 🚀 Features

- **Hybrid Scoring System**: Combines rule-based analysis, AI/LLM evaluation, and external API verification
- **Real-time Processing**: Automated verification workflow triggered on recruiter signup
- **External API Integration**: Hunter.io for email verification, Clearbit for company validation, Numverify for phone validation
- **Comprehensive Dashboard**: Analytics, performance metrics, and fraud analysis
- **RESTful API**: Complete API for integration with hiring platforms
- **Rate Limiting**: Built-in protection against abuse
- **Extensive Logging**: Detailed audit trails and performance monitoring

## 🏗️ Architecture

### Scoring Components

1. **Rule-Based Scoring (30% weight)**
   - Keyword detection in company names and roles
   - Email domain analysis and spam patterns
   - Phone number validation and pattern matching
   - Website URL verification and security checks

2. **LLM Scoring (40% weight)**
   - Google Gemini-based contextual analysis
   - Natural language processing for authenticity assessment
   - Intelligent pattern recognition beyond simple rules

3. **External Verification (30% weight)**
   - Email deliverability via Hunter.io
   - Company verification via Clearbit
   - Phone number validation via Numverify
   - Domain age and SSL certificate checks

### Final Decision Logic
- **Score ≥ 70**: Auto-approve (with high confidence)
- **Score < 40**: Flag as spam (with high confidence)  
- **40-69**: Manual review required
- **Low confidence scores**: Always require manual review

## 📋 Prerequisites

- Node.js 16+ 
- MongoDB 4.4+
- API Keys (optional but recommended):
  - Google Gemini API key for LLM scoring
  - Hunter.io API key for email verification
  - Clearbit API key for company verification
  - Numverify API key for phone verification

## ⚡ Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd recruiter-spam-detection

# Install dependencies
npm install

# Run setup script
npm run setup
```

### 2. Environment Configuration

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

Update `.env` with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/recruiter-spam-detection

# Google Gemini (for LLM scoring)
GEMINI_API_KEY=your_gemini_api_key_here

# External APIs (optional)
HUNTER_API_KEY=your_hunter_io_api_key
CLEARBIT_API_KEY=your_clearbit_api_key
NUMVERIFY_API_KEY=your_numverify_api_key

# Security
JWT_SECRET=your_secure_jwt_secret_here

# Scoring Configuration
SPAM_THRESHOLD=70
RULE_BASED_WEIGHT=0.3
LLM_WEIGHT=0.4
EXTERNAL_API_WEIGHT=0.3
```

### 3. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 4. Verify Installation

```bash
# Health check
curl http://localhost:3000/health

# API documentation
curl http://localhost:3000/api/docs
```

## 📚 API Usage

### Recruiter Signup

```bash
POST /api/recruiters/signup
Content-Type: application/json

{
  "fullName": "John Smith",
  "companyName": "TechCorp Inc",
  "websiteUrl": "https://techcorp.com",
  "businessEmail": "john.smith@techcorp.com",
  "phoneNumber": "+1-555-0123",
  "role": "Senior Technical Recruiter",
  "industry": "Technology",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Recruiter registered successfully. Verification is in progress.",
  "data": {
    "id": "64f5a1b2c3d4e5f6g7h8i9j0",
    "email": "john.smith@techcorp.com",
    "status": "pending",
    "registeredAt": "2023-09-04T10:30:00.000Z"
  },
  "meta": {
    "verificationInProgress": true,
    "estimatedProcessingTime": "30-60 seconds"
  }
}
```

### Check Verification Status

```bash
GET /api/recruiters/{id}/verification
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "finalScore": 85,
    "decision": "approved",
    "confidence": 92,
    "breakdown": {
      "ruleBasedScore": 78,
      "llmScore": 90,
      "externalScore": 82
    }
  }
}
```

### Dashboard Analytics

```bash
GET /api/dashboard/overview?timeframe=24h
```

## 🔧 Configuration

### Scoring Weights

Adjust the relative importance of each scoring component:

```env
RULE_BASED_WEIGHT=0.3    # Rule-based analysis
LLM_WEIGHT=0.4           # AI/LLM evaluation  
EXTERNAL_API_WEIGHT=0.3  # External API verification
```

**Note**: Weights must sum to 1.0

### Spam Threshold

Set the score threshold for automatic decisions:

```env
SPAM_THRESHOLD=70  # Scores ≥ 70 = approve, < 40 = flag, 40-69 = manual review
```

### Rate Limiting

Configure API rate limits:

```env
RATE_LIMIT_WINDOW_MS=900000     # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100     # 100 requests per window
```

## 📊 Dashboard & Analytics

Access comprehensive analytics at:

- **Overview**: `GET /api/dashboard/overview`
- **Score Analytics**: `GET /api/dashboard/analytics/scores`
- **Performance Metrics**: `GET /api/dashboard/analytics/performance`
- **Flagged Analysis**: `GET /api/dashboard/analytics/flags`
- **Data Export**: `GET /api/dashboard/export?format=csv`

### Key Metrics

- Total recruiters processed
- Verification success rates
- Score distribution analysis
- Processing time performance
- Common flag reasons
- API usage statistics

## 🛠️ Development

### Project Structure

```
src/
├── controllers/       # Request handlers
├── models/           # Database schemas
├── services/         # Business logic
│   ├── ruleBasedScoring.js
│   ├── llmScoring.js
│   ├── externalVerification.js
│   └── scoringWorkflow.js
├── routes/           # API routes
├── middleware/       # Custom middleware
├── utils/           # Helper utilities
└── config/          # Configuration files

scripts/             # Setup and utility scripts
logs/               # Application logs
tests/              # Test files
```

### Adding New Scoring Rules

1. Edit `src/services/ruleBasedScoring.js`
2. Add new validation methods
3. Update scoring weights in `calculateFinalScore()`
4. Test with sample data

### Adding External APIs

1. Add API configuration to `src/services/externalVerification.js`
2. Implement verification method
3. Update `verifyAll()` method to include new API
4. Add API key to environment variables

### Running Tests

```bash
npm test                # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

## 🚨 Error Handling

The system includes comprehensive error handling:

- **Validation Errors**: Detailed field-level validation messages
- **API Failures**: Graceful degradation when external APIs fail
- **Database Errors**: Automatic retry and connection management
- **Rate Limiting**: Proper HTTP 429 responses with retry information

## 🔐 Security

- Input sanitization and validation
- Rate limiting on all endpoints
- Secure password hashing (bcrypt)
- Environment-based configuration
- SQL injection protection (MongoDB/Mongoose)
- XSS protection via input sanitization

## 📈 Performance

### Benchmarks (Typical Performance)

- **Rule-based scoring**: ~50ms
- **LLM scoring**: ~2-5 seconds
- **External verification**: ~3-8 seconds (parallel)
- **Total processing time**: ~5-10 seconds

### Optimization Tips

1. **Enable all external APIs**: Better accuracy with parallel verification
2. **Adjust LLM temperature**: Lower values (0.1-0.3) for more consistent results
3. **Monitor token usage**: Gemini API costs scale with prompt complexity
4. **Database indexing**: Indexes are auto-created during setup

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure all external API keys
- [ ] Set up MongoDB replica set
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificates
- [ ] Configure log rotation
- [ ] Set up monitoring/alerting
- [ ] Configure backup strategy

### Docker Deployment

```dockerfile
# Dockerfile included in project
docker build -t recruiter-spam-detection .
docker run -p 3000:3000 --env-file .env recruiter-spam-detection
```

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://your-production-db/recruiter-spam-detection
OPENAI_API_KEY=your-production-openai-key
# ... other production keys
```

## 📝 API Documentation

Full API documentation is available at:
- Runtime docs: `http://localhost:3000/api/docs`
- Interactive testing: Use tools like Postman or curl

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/recruiters/signup` | Register new recruiter |
| `GET` | `/api/recruiters/{id}` | Get recruiter profile |
| `GET` | `/api/recruiters/{id}/verification` | Check verification status |
| `POST` | `/api/recruiters/{id}/rescore` | Trigger re-scoring |
| `GET` | `/api/recruiters` | List recruiters (admin) |
| `GET` | `/api/dashboard/overview` | Dashboard analytics |
| `GET` | `/api/system/health` | System health check |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Run `npm run lint` before submitting

## 🐛 Troubleshooting

### Common Issues

**MongoDB Connection Failed**
```bash
# Check if MongoDB is running
brew services start mongodb-community
# or
sudo systemctl start mongod
```

**Gemini API Errors**
- Verify API key is correct and has proper access
- Check rate limits (varies by plan)
- Ensure model availability (gemini-pro recommended)

**High Processing Times**
- Enable external APIs for parallel processing
- Consider using faster LLM models
- Check network connectivity to external services

**Rate Limit Issues**
- Adjust rate limits in environment variables
- Implement request queuing for high volume

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google for Gemini API
- Hunter.io for email verification services
- Clearbit for company data
- Numverify for phone validation
- MongoDB and Express.js communities

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check existing documentation
- Review the setup script output for configuration help

---

**Built for Hackathon** - Lightweight, presentable, and demo-ready! 🏆
