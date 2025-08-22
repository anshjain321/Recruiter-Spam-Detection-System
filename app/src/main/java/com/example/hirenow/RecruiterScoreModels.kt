package com.example.hirenow

data class RecruiterScoreResponse(
    val success: Boolean,
    val data: RecruiterScoreData
)

data class RecruiterScoreData(
    val recruiter: RecruiterDetails,
    val verification: VerificationDetails? = VerificationDetails(90, "passed", 100, VerificationBreakdown(30.0, 40.0, 60.0, VerificationWeights(90.0, 40.0, 90.0)))
)

data class RecruiterDetails(
    val id: Int,
    val fullName: String,
    val companyName: String,
    val websiteUrl: String,
    val businessEmail: String,
    val phoneNumber: String,
    val role: String,
    val industry: String,
    val status: String,
    val verificationScore: Int,
    val isEmailVerified: Boolean,
    val isPhoneVerified: Boolean,
    val lastLoginAt: String?,
    val ipAddress: String,
    val userAgent: String,
    val registrationSource: String,
    val created_at: String,
    val updated_at: String
)

data class VerificationDetails(
    val score: Int,
    val decision: String,
    val confidence: Int,
    val breakdown: VerificationBreakdown
)

data class VerificationBreakdown(
    val ruleBasedWeighted: Double,
    val llmWeighted: Double,
    val externalWeighted: Double,
    val weights: VerificationWeights
)

data class VerificationWeights(
    val rule: Double,
    val llm: Double,
    val external: Double
)
