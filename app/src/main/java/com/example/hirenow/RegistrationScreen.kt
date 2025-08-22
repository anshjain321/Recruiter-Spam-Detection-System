package com.example.hirenow

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel // Import for viewModel() helper

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegistrationScreen(
    viewModel: RegistrationViewModel = viewModel() // ViewModel instance
) {
    val fullName by viewModel.fullName.collectAsState()
    val companyName by viewModel.companyName.collectAsState()
    val websiteUrl by viewModel.websiteUrl.collectAsState()
    val businessEmail by viewModel.businessEmail.collectAsState()
    val phoneNumber by viewModel.phoneNumber.collectAsState()
    val role by viewModel.role.collectAsState()
    val industry by viewModel.industry.collectAsState()
    val password by viewModel.password.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val registrationSuccess by viewModel.registrationSuccess.collectAsState()

    val context = LocalContext.current

    // Observe registration success/failure for Toast messages
    LaunchedEffect(registrationSuccess) {
        registrationSuccess?.let { success ->
            if (success) {
                Toast.makeText(context, "Registration Successful!", Toast.LENGTH_LONG).show()
                // Optionally clear fields or navigate away after success
                // Example: navController.navigate("success_screen")
            } else {
                Toast.makeText(context, "Registration Failed. Please try again.", Toast.LENGTH_LONG).show()
            }
            viewModel.resetRegistrationSuccess() // Reset the state to prevent re-showing Toast
        }
    }

    Surface(modifier = Modifier.fillMaxSize().padding(vertical = 20.dp), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Join as Recruiter",
                fontSize = 24.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            OutlinedTextField(
                value = fullName,
                onValueChange = viewModel::onFullNameChange, // Use ViewModel's update function
                label = { Text("Full Name") },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading
            )
            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = companyName,
                onValueChange = viewModel::onCompanyNameChange,
                label = { Text("Company Name") },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading
            )
            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = websiteUrl,
                onValueChange = viewModel::onWebsiteUrlChange,
                label = { Text("Website/LinkedIn URL") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading
            )
            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = businessEmail,
                onValueChange = viewModel::onBusinessEmailChange,
                label = { Text("Business Email") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading
            )
            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = phoneNumber,
                onValueChange = viewModel::onPhoneNumberChange,
                label = { Text("Phone Number") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading
            )
            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = role,
                onValueChange = viewModel::onRoleChange,
                label = { Text("Role/Designation") },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading
            )
            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = industry,
                onValueChange = viewModel::onIndustryChange,
                label = { Text("Industry/Sector") },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading
            )
            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = password,
                onValueChange = viewModel::onPasswordChange,
                label = { Text("Password") },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading
            )
            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = viewModel::register, // Trigger ViewModel's register function
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text("Register")
                }
            }

            TextButton(
                onClick = { /* Handle login navigation here */ },
                enabled = !isLoading
            ) {
                Text("Already have an account? Log in")
            }
        }
    }
}