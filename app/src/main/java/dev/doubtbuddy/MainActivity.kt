package dev.doubtbuddy

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.doubtbuddy.ui.AskScreen
import dev.doubtbuddy.ui.HistoryScreen
import dev.doubtbuddy.ui.PracticeScreen
import dev.doubtbuddy.ui.ProgressScreen
import dev.doubtbuddy.ui.ReviewScreen
import dev.doubtbuddy.ui.SettingsScreen
import dev.doubtbuddy.ui.DoubtBuddyTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { DoubtBuddyTheme { DoubtBuddyApp() } }
    }
}

private enum class Destination(val label: String) {
    ASK("Ask"), PRACTICE("Practice"), REVIEW("Review"), PROGRESS("Progress"), SAVED("Saved"), SETTINGS("Settings")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DoubtBuddyApp(vm: StudyViewModel = viewModel()) {
    var page by rememberSaveable { mutableStateOf(Destination.ASK) }
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (page == Destination.SETTINGS) "Settings" else "DoubtBuddy",
                        style = MaterialTheme.typography.titleLarge
                    )
                },
                actions = {
                    if (page != Destination.SETTINGS) {
                        IconButton(onClick = { page = Destination.SETTINGS }) {
                            Icon(Icons.Default.Settings, contentDescription = "Settings")
                        }
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                listOf(
                    Destination.ASK to Icons.Default.Home,
                    Destination.PRACTICE to Icons.Default.CheckCircle,
                    Destination.REVIEW to Icons.Default.Schedule,
                    Destination.PROGRESS to Icons.Default.BarChart,
                    Destination.SAVED to Icons.Default.History
                ).forEach { (destination, icon) ->
                    NavigationBarItem(
                        selected = page == destination,
                        onClick = { page = destination },
                        icon = { Icon(icon, contentDescription = null) },
                        label = { Text(destination.label) }
                    )
                }
            }
        }
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (page) {
                Destination.ASK -> AskScreen(vm, onSettings = { page = Destination.SETTINGS })
                Destination.PRACTICE -> PracticeScreen(vm)
                Destination.REVIEW -> ReviewScreen(vm)
                Destination.PROGRESS -> ProgressScreen(vm)
                Destination.SAVED -> HistoryScreen(vm)
                Destination.SETTINGS -> SettingsScreen(vm, onBack = { page = Destination.ASK })
            }
        }
    }
}
