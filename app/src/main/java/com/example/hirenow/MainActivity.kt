package com.example.hirenow

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.example.hirenow.ui.theme.HireNowTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            HireNowTheme {
                AppNavigation()
            }
        }
    }
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "splash") {
        composable("splash") {
            SplashScreen(navController = navController)
        }
        composable("registration") {
            RegistrationScreen(navController = navController)
        }
        composable(
            route = "score/{recruiterId}",
            arguments = listOf(navArgument("recruiterId") { type = NavType.IntType })
        ) { backStackEntry ->
            val recruiterId = backStackEntry.arguments?.getInt("recruiterId") ?: 0
            RecruiterScoreScreen(
                recruiterId = recruiterId,
                navController = navController
            )
        }
    }
}