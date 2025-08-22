package com.example.hirenow

data class ApiResponse(
    val success: Boolean,
    val message: String,
    val data: Data,
    val meta: Meta
)

data class Data(
    val id: Int,
    val email: String,
    val status: String
)

data class Meta(
    val verificationInProgress: Boolean,
    val estimatedProcessingTime: String
) 