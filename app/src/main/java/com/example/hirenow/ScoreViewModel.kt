package com.example.hirenow

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ScoreViewModel : ViewModel() {

    // UI State for loading indicator
    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // UI State for score data
    private val _scoreData = MutableStateFlow<RecruiterScoreData?>(null)
    val scoreData: StateFlow<RecruiterScoreData?> = _scoreData.asStateFlow()

    // UI State for error handling
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    // Function to fetch recruiter score
    fun fetchRecruiterScore(recruiterId: Int) {
        _isLoading.value = true
        _error.value = null
        _scoreData.value = null

        RetrofitInstance.api.getRecruiterScore(recruiterId).enqueue(object : Callback<RecruiterScoreResponse> {
            override fun onResponse(call: Call<RecruiterScoreResponse>, response: Response<RecruiterScoreResponse>) {
                _isLoading.value = false
                if (response.isSuccessful && response.body()?.success == true) {
                    _scoreData.value = response.body()?.data
                } else {
                    _error.value = "Failed to fetch verification score. Please try again."
                }
            }

            override fun onFailure(call: Call<RecruiterScoreResponse>, t: Throwable) {
                _isLoading.value = false
                _error.value = "Network error: ${t.message}"
            }
        })
    }

    // Function to clear error state
    fun clearError() {
        _error.value = null
    }
}
