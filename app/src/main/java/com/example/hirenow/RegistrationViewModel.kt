package com.example.hirenow

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class RegistrationViewModel : ViewModel() {

    // UI States for form fields
    private val _fullName = MutableStateFlow("")
    val fullName: StateFlow<String> = _fullName.asStateFlow()

    private val _companyName = MutableStateFlow("")
    val companyName: StateFlow<String> = _companyName.asStateFlow()

    private val _websiteUrl = MutableStateFlow("")
    val websiteUrl: StateFlow<String> = _websiteUrl.asStateFlow()

    private val _businessEmail = MutableStateFlow("")
    val businessEmail: StateFlow<String> = _businessEmail.asStateFlow()

    private val _phoneNumber = MutableStateFlow("")
    val phoneNumber: StateFlow<String> = _phoneNumber.asStateFlow()

    private val _role = MutableStateFlow("")
    val role: StateFlow<String> = _role.asStateFlow()

    private val _industry = MutableStateFlow("")
    val industry: StateFlow<String> = _industry.asStateFlow()

    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password.asStateFlow()

    // UI State for loading indicator
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Event for one-time UI feedback (e.g., Toast)
    private val _registrationSuccess = MutableStateFlow<Boolean?>(null)
    val registrationSuccess: StateFlow<Boolean?> = _registrationSuccess.asStateFlow()

    // Store recruiter ID for navigation to score screen
    private val _recruiterId = MutableStateFlow<Int?>(null)
    val recruiterId: StateFlow<Int?> = _recruiterId.asStateFlow()

    // Functions to update form fields
    fun onFullNameChange(value: String) { _fullName.value = value }
    fun onCompanyNameChange(value: String) { _companyName.value = value }
    fun onWebsiteUrlChange(value: String) { _websiteUrl.value = value }
    fun onBusinessEmailChange(value: String) { _businessEmail.value = value }
    fun onPhoneNumberChange(value: String) { _phoneNumber.value = value }
    fun onRoleChange(value: String) { _role.value = value }
    fun onIndustryChange(value: String) { _industry.value = value }
    fun onPasswordChange(value: String) { _password.value = value }

    // Function to handle registration submission
    fun register() {
        _isLoading.value = true
        _registrationSuccess.value = null // Reset success state

        val recruiterData = RecruiterData(
            fullName = fullName.value,
            companyName = companyName.value,
            websiteUrl = websiteUrl.value,
            businessEmail = businessEmail.value,
            phoneNumber = phoneNumber.value,
            role = role.value,
            industry = industry.value,
            password = password.value
        )

        RetrofitInstance.api.registerRecruiter(recruiterData).enqueue(object : Callback<ApiResponse> {
            override fun onResponse(call: Call<ApiResponse>, response: Response<ApiResponse>) {
                _isLoading.value = false
                if (response.isSuccessful && response.body()?.success == true) {
                    _registrationSuccess.value = true
                    _recruiterId.value = response.body()?.data?.id
                } else {
                    _registrationSuccess.value = false
                }
            }

            override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                _isLoading.value = false
                _registrationSuccess.value = false
            }
        })
    }

    // Call this after a Toast is shown to reset the state,
    // so the Toast doesn't reappear on configuration changes.
    fun resetRegistrationSuccess() {
        _registrationSuccess.value = null
    }

    // Reset recruiter ID
    fun resetRecruiterId() {
        _recruiterId.value = null
    }
}