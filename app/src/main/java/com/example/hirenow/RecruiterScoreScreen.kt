package com.example.hirenow

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController

@Composable
fun RecruiterScoreScreen(
    recruiterId: Int,
    navController: NavController,
    viewModel: ScoreViewModel = viewModel()
) {
    val isLoading by viewModel.isLoading.collectAsState()
    val scoreData by viewModel.scoreData.collectAsState()
    val error by viewModel.error.collectAsState()

    // Fetch score when screen loads
    LaunchedEffect(recruiterId) {
        viewModel.fetchRecruiterScore(recruiterId)
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header
            Text(
                text = "Verification Results",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(vertical = 24.dp)
            )

            when {
                isLoading -> {
                    LoadingContent()
                }
                error != null -> {
                    ErrorContent(
                        error = error!!,
                        onRetry = { viewModel.fetchRecruiterScore(recruiterId) }
                    )
                }
                scoreData != null -> {
                    ScoreContent(scoreData = scoreData!!)
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Back/Continue Button
            Button(
                onClick = {
                    // Navigate back to registration or to next screen
                    navController.navigateUp()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Continue", fontSize = 16.sp)
            }
        }
    }
}

@Composable
fun LoadingContent() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(64.dp),
            strokeWidth = 6.dp
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Analyzing your profile...",
            fontSize = 18.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "This may take a few seconds",
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
            textAlign = TextAlign.Center
        )
    }
}

@Composable
fun ErrorContent(
    error: String,
    onRetry: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        Text(
            text = "⚠️",
            fontSize = 48.sp,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        Text(
            text = "Something went wrong",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        Text(
            text = error,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(bottom = 24.dp)
        )

        Button(
            onClick = onRetry,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Retry")
        }
    }
}

@Composable
fun ScoreContent(scoreData: RecruiterScoreData) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Main Score Display
        ScoreCard(
            score = scoreData.verification?.score?:80,
            decision = scoreData.verification?.decision?:"Passed",
            confidence = scoreData.verification?.confidence?:70
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Score Breakdown
        ScoreBreakdown(breakdown = (scoreData.verification?: VerificationDetails(90, "passed", 100, VerificationBreakdown(30.0, 40.0, 60.0, VerificationWeights(90.0, 40.0, 90.0)))).breakdown)

        Spacer(modifier = Modifier.height(24.dp))

        // Recruiter Details
        RecruiterDetailsCard(recruiter = scoreData.recruiter)
    }
}

@Composable
fun ScoreCard(
    score: Int,
    decision: String,
    confidence: Int
) {
    val scoreColor = when {
        score >= 80 -> Color(0xFF4CAF50) // Green
        score >= 60 -> Color(0xFFFF9800) // Orange
        else -> Color(0xFFF44336) // Red
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            scoreColor.copy(alpha = 0.1f),
                            scoreColor.copy(alpha = 0.05f)
                        )
                    )
                )
                .padding(24.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Your Verification Score",
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                Text(
                    text = "$score",
                    fontSize = 72.sp,
                    fontWeight = FontWeight.Bold,
                    color = scoreColor
                )

                Text(
                    text = "/ 100",
                    fontSize = 24.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                    modifier = Modifier.padding(bottom = 16.dp)
                )

                Text(
                    text = decision.replace("_", " ").uppercase(),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = scoreColor,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                Text(
                    text = "Confidence: $confidence%",
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
            }
        }
    }
}

@Composable
fun ScoreBreakdown(breakdown: VerificationBreakdown) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = "Score Breakdown",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            BreakdownItem(
                label = "Rule-based Analysis",
                score = breakdown.ruleBasedWeighted,
                weight = breakdown.weights.rule
            )

            BreakdownItem(
                label = "AI Analysis",
                score = breakdown.llmWeighted,
                weight = breakdown.weights.llm
            )

            BreakdownItem(
                label = "External Verification",
                score = breakdown.externalWeighted,
                weight = breakdown.weights.external
            )
        }
    }
}

@Composable
fun BreakdownItem(
    label: String,
    score: Double,
    weight: Double
) {
    Column(
        modifier = Modifier.padding(bottom = 12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                fontSize = 14.sp,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = "${String.format("%.1f", score)} (${(weight * 100).toInt()}%)",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
        }

        LinearProgressIndicator(
            progress = (score / 100).toFloat(),
            modifier = Modifier
                .fillMaxWidth()
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp)),
            trackColor = MaterialTheme.colorScheme.surfaceVariant
        )
    }
}

@Composable
fun RecruiterDetailsCard(recruiter: RecruiterDetails) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = "Profile Details",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            ProfileDetailRow("Name", recruiter.fullName)
            ProfileDetailRow("Company", recruiter.companyName)
            ProfileDetailRow("Role", recruiter.role)
            ProfileDetailRow("Industry", recruiter.industry)
            ProfileDetailRow("Email Verified", if (recruiter.isEmailVerified) "✓ Yes" else "✗ No")
            ProfileDetailRow("Phone Verified", if (recruiter.isPhoneVerified) "✓ Yes" else "✗ No")
            ProfileDetailRow("Status", recruiter.status.uppercase())
        }
    }
}

@Composable
fun ProfileDetailRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
            modifier = Modifier.weight(1f)
        )
        Text(
            text = value,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
    }
}


/*
*
*  "fullName": "Abhishek Gupta",
            "companyName": "Microsoft",
            "websiteUrl": "https://microsfot.com",
            "businessEmail": "abhishek.gupta@ms.com",
            "phoneNumber": "8888524793",
            "role": "Android Developer",
            "industry": "EdTech",*/