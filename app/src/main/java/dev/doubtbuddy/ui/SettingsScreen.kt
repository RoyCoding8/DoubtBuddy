package dev.doubtbuddy.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import dev.doubtbuddy.StudyViewModel
import dev.doubtbuddy.domain.Doubt

@Composable
fun SettingsScreen(vm: StudyViewModel, onBack: () -> Unit) {
    val configured by vm.hasApiKey.collectAsState()
    var key by rememberSaveable { mutableStateOf("") }
    var saved by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)) {
        PageIntro("PREFERENCES", "Make it yours", "Configure your personal AI connection.")
        ContentCard {
            Text("Gemini API key", style = MaterialTheme.typography.titleLarge)
            Text(if (configured) "A key is encrypted on this device. Enter a new key to replace it."
                else "No key configured. Doubt solving uses a labeled sample response.")
            OutlinedTextField(value = key, onValueChange = { key = it; saved = false },
                modifier = Modifier.fillMaxWidth(), label = { Text("New API key") },
                singleLine = true, visualTransformation = PasswordVisualTransformation())
            Button(onClick = { vm.saveKey(key); key = ""; saved = true },
                enabled = key.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Save key securely") }
            if (configured) OutlinedButton(onClick = { vm.saveKey(""); saved = true },
                modifier = Modifier.fillMaxWidth()) { Text("Remove stored key") }
            if (saved) Text("Your AI settings were updated.", color = MaterialTheme.colorScheme.primary)
            Text("The key is encrypted with Android Keystore and sent only to Gemini over HTTPS. " +
                "Google may process submitted questions. API usage may incur charges.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        ContentCard {
            Text("About DoubtBuddy", style = MaterialTheme.typography.titleLarge)
            Text("A native JEE study companion. Practice and review work offline. AI requires internet.")
            Text("Version 0.1.0", style = MaterialTheme.typography.labelMedium)
        }
        FilledTonalButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) { Text("Back to study") }
    }
}
