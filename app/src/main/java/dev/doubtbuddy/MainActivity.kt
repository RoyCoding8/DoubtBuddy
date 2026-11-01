package dev.doubtbuddy

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.doubtbuddy.ui.DoubtBuddyTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { DoubtBuddyTheme { DoubtBuddyApp() } }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DoubtBuddyApp() {
    Scaffold(topBar = { TopAppBar(title = { Text("DoubtBuddy") }) }) { padding ->
        HomeContent(padding)
    }
}

@Composable
private fun HomeContent(padding: PaddingValues) {
    Column(
        modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Your study companion", style = MaterialTheme.typography.headlineMedium)
        Text("Ask anything. Understand everything.", style = MaterialTheme.typography.bodyLarge)
        Text("Physics · Chemistry · Mathematics", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
