package com.example.hirenow

import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.Call

interface ApiInterface {
    @POST("/api/recruiters/signup")
    fun registerRecruiter(@Body recruiterData: RecruiterData): Call<ApiResponse>

    @GET("/api/recruiters/{id}")
    fun getRecruiterScore(@Path("id") recruiterId: Int): Call<RecruiterScoreResponse>
} 