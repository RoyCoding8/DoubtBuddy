package dev.doubtbuddy.ui

import java.io.File
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.PickVisualMediaRequest
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import dev.doubtbuddy.StudyViewModel
import dev.doubtbuddy.data.ImageAttachment
import dev.doubtbuddy.data.CameraCapture
import dev.doubtbuddy.domain.SolveMode
import dev.doubtbuddy.domain.SolveState
import dev.doubtbuddy.domain.Subject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun AskScreen(vm: StudyViewModel, onSettings: () -> Unit) {
    var subject by rememberSaveable { mutableStateOf(Subject.PHYSICS) }
    var mode by rememberSaveable { mutableStateOf(SolveMode.GUIDED) }
    var question by rememberSaveable { mutableStateOf("") }
    var attachment by remember { mutableStateOf<ImageAttachment?>(null) }
    var imageError by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val solve by vm.solveState.collectAsState()
    val configured by vm.hasApiKey.collectAsState()
    var pendingCameraFile by rememberSaveable { mutableStateOf<String?>(null) }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { taken ->
        val path = pendingCameraFile
        pendingCameraFile = null
        if (path != null) {
            val file = File(path)
            if (taken) {
                scope.launch {
                    val result = withContext(Dispatchers.IO) {
                        runCatching { CameraCapture.encode(file) }.also { file.delete() }
                    }
                    result.onSuccess { attachment = it; imageError = null; vm.clearAnswer() }
                        .onFailure { imageError = it.message ?: "Could not read the photo." }
                }
            } else {
                file.delete()
            }
        }
    }
    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            scope.launch {
                val result = withContext(Dispatchers.IO) {
                    runCatching { CameraCapture.encode(context, uri) }
                }
                result.onSuccess { attachment = it; imageError = null; vm.clearAnswer() }
                    .onFailure { imageError = it.message ?: "Could not read the selected photo." }
            }
        }
    }
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)) {
        PageIntro("YOUR STUDY SPACE", "What are you stuck on?", "Ask a question and choose how you want to learn.")
        if (!configured) Surface(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onSettings),
            color = MaterialTheme.colorScheme.primaryContainer,
            shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp)
        ) {
            Column(Modifier.padding(16.dp)) {
                Text("Preview mode", style = MaterialTheme.typography.titleMedium)
                Text("Add your Gemini API key in Settings for real AI answers. Tap to configure.")
            }
        }
        ContentCard {
            Text("01  Subject", style = MaterialTheme.typography.titleSmall)
            SubjectPicker(subject) { subject = it }
            Text("02  Your question", style = MaterialTheme.typography.titleSmall)
            OutlinedTextField(
                value = question,
                onValueChange = { question = it; if (solve !is SolveState.Loading) vm.clearAnswer() },
                modifier = Modifier.fillMaxWidth().heightIn(min = 150.dp),
                placeholder = { Text("Type your JEE question here...") },
                maxLines = 9
            )
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(onClick = {
                    runCatching {
                        val target = CameraCapture.createTarget(context)
                        pendingCameraFile = target.file.absolutePath
                        camera.launch(target.uri)
                    }.onFailure {
                        pendingCameraFile?.let { path -> File(path).delete() }
                        pendingCameraFile = null
                        imageError = "Camera unavailable. Please try again."
                    }
                }) {
                    Icon(Icons.Default.CameraAlt, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text(if (attachment == null) "Take photo" else "Retake photo")
                }
                OutlinedButton(onClick = {
                    gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                }) {
                    Icon(Icons.Default.PhotoLibrary, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Gallery")
                }
                if (attachment != null) TextButton(onClick = {
                    attachment = null
                    vm.clearAnswer()
                }) { Text("Remove image") }
            }
            if (attachment != null) Text("Photo attached", color = MaterialTheme.colorScheme.primary)
            if (imageError != null) Text(imageError.orEmpty(), color = MaterialTheme.colorScheme.error)
            Text("03  Answer style", style = MaterialTheme.typography.titleSmall)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SolveMode.entries.forEach { choice ->
                    FilterChip(selected = mode == choice, onClick = { mode = choice }, label = { Text(choice.label) })
                }
            }

        }
        when (val result = solve) {
            is SolveState.Answer -> ContentCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Your answer", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                    if (result.isSample) AssistChip(onClick = onSettings, label = { Text("Sample") })
                }
                androidx.compose.foundation.text.selection.SelectionContainer {
                    Text(result.text, style = MaterialTheme.typography.bodyLarge)
                }
                Text("Saved to your history", color = MaterialTheme.colorScheme.primary)
            }
            is SolveState.Failure -> ContentCard {
                Text("Could not solve", color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.titleMedium)
                Text(result.message)
                Text("Check your connection and retry.", style = MaterialTheme.typography.bodySmall)
            }
            else -> Unit
        }
        }
        Surface(modifier = Modifier.fillMaxWidth(), tonalElevation = 3.dp) {
            Button(onClick = { vm.solve(subject, mode, question, attachment) },
                enabled = (question.isNotBlank() || attachment != null) && solve !is SolveState.Loading,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp)) {
                if (solve is SolveState.Loading) CircularProgressIndicator(
                    Modifier.size(18.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary
                ) else Icon(Icons.Default.Send, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(if (solve is SolveState.Loading) "Thinking..." else "Solve question")
            }
        }
    }
}
