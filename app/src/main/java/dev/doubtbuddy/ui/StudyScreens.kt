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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.doubtbuddy.StudyViewModel
import dev.doubtbuddy.data.ImageAttachment
import dev.doubtbuddy.data.CameraCapture
import dev.doubtbuddy.domain.Doubt
import dev.doubtbuddy.domain.QuestionBank
import dev.doubtbuddy.domain.SolveMode
import dev.doubtbuddy.domain.SolveState
import dev.doubtbuddy.domain.StudyStats
import dev.doubtbuddy.domain.Subject
import java.text.DateFormat
import java.util.Date
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
private fun PageIntro(overline: String, title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(overline.uppercase(), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
        Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun ContentCard(content: @Composable () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth(),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { content() }
    }
}

@Composable
private fun SubjectPicker(selected: Subject, onSelect: (Subject) -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Subject.entries.forEach { subject ->
            FilterChip(selected = subject == selected, onClick = { onSelect(subject) }, label = { Text(subject.label) })
        }
    }
}

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

@Composable
fun PracticeScreen(vm: StudyViewModel) {
    var subject by rememberSaveable { mutableStateOf(Subject.PHYSICS) }
    var index by rememberSaveable(subject) { mutableIntStateOf(0) }
    var selection by rememberSaveable(subject, index) { mutableIntStateOf(-1) }
    var submitted by rememberSaveable(subject, index) { mutableStateOf(false) }
    val bank = QuestionBank.forSubject(subject)
    val item = bank[index % bank.size]
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)) {
        PageIntro("PRACTICE", "Build your confidence", "Quick concept checks with explanations.")
        SubjectPicker(subject) { subject = it }
        ContentCard {
            Text(item.chapter.uppercase(), color = MaterialTheme.colorScheme.primary)
            Text("Question " + (index + 1), style = MaterialTheme.typography.labelMedium)
            Text(item.question, style = MaterialTheme.typography.titleLarge)
            Column(Modifier.selectableGroup()) {
                item.choices.forEachIndexed { i, choice ->
                    Surface(
                        modifier = Modifier.fillMaxWidth().selectable(
                            selected = selection == i,
                            enabled = !submitted,
                            role = Role.RadioButton,
                            onClick = { selection = i }
                        ),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                        color = if (selection == i) MaterialTheme.colorScheme.secondaryContainer
                            else MaterialTheme.colorScheme.surfaceContainerHigh
                    ) {
                        Text(('A' + i).toString() + ".  " + choice,
                            Modifier.padding(horizontal = 18.dp, vertical = 16.dp),
                            style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
            if (!submitted) Button(onClick = { vm.recordAttempt(item, selection); submitted = true },
                enabled = selection >= 0, modifier = Modifier.fillMaxWidth()) { Text("Check answer") }
            else {
                HorizontalDivider()
                Text(if (selection == item.correct) "Correct" else "Keep learning",
                    style = MaterialTheme.typography.titleMedium,
                    color = if (selection == item.correct) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.error)
                Text("Answer: " + item.choices[item.correct], fontWeight = FontWeight.SemiBold)
                Text(item.explanation)
                Button(onClick = { index++ }, modifier = Modifier.fillMaxWidth()) { Text("Next question") }
            }
        }
    }
}

@Composable
fun ReviewScreen(vm: StudyViewModel) {
    val attempts by vm.attempts.collectAsState()
    val due = StudyStats.due(attempts, System.currentTimeMillis())
    val question = due.firstOrNull()?.let { QuestionBank.byId(it.questionId) }
    var revealed by rememberSaveable(question?.id) { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)) {
        PageIntro("REVISE", "Make it stick", "Revisit missed questions and strengthen weak concepts.")
        if (question == null) ContentCard {
            Text("You're all caught up", style = MaterialTheme.typography.titleLarge)
            Text("Missed questions return here. Correct answers are scheduled for future review.")
        } else ContentCard {
            Text(due.size.toString() + " due for review", color = MaterialTheme.colorScheme.primary)
            Text(question.chapter, style = MaterialTheme.typography.labelLarge)
            Text(question.question, style = MaterialTheme.typography.titleLarge)
            if (!revealed) Button(onClick = { revealed = true }, modifier = Modifier.fillMaxWidth()) {
                Text("Reveal answer")
            } else {
                Text("Answer: " + question.choices[question.correct])
                Text(question.explanation)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(
                        onClick = { vm.recordAttempt(question, (question.correct + 1) % 4, true); revealed = false },
                        modifier = Modifier.weight(1f)) { Text("Review again") }
                    Button(onClick = { vm.recordAttempt(question, question.correct, true); revealed = false },
                        modifier = Modifier.weight(1f)) { Text("Got it") }
                }
            }
        }
    }
}

@Composable
fun ProgressScreen(vm: StudyViewModel) {
    val attempts by vm.attempts.collectAsState()
    val doubts by vm.history.collectAsState()
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)) {
        PageIntro("YOUR JOURNEY", "Progress at a glance", "Small steps add up.")
        ContentCard {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Metric(attempts.size.toString(), "Practiced", Modifier.weight(1f))
                Metric(StudyStats.accuracy(attempts).toString() + "%", "Accuracy", Modifier.weight(1f))
                Metric(doubts.size.toString(), "Doubts", Modifier.weight(1f))
            }
        }
        ContentCard {
            Text("Accuracy by subject", style = MaterialTheme.typography.titleLarge)
            Subject.entries.forEach { subject ->
                val entries = attempts.filter { it.subject == subject }
                val percentage = StudyStats.accuracy(entries)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(subject.label, modifier = Modifier.weight(1f))
                    Text(if (entries.isEmpty()) "Not started" else percentage.toString() + "% · " +
                        entries.size.toString() + " attempts",
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                LinearProgressIndicator(progress = { percentage / 100f },
                    modifier = Modifier.fillMaxWidth().height(8.dp),
                    trackColor = MaterialTheme.colorScheme.surfaceContainerHigh)
            }
        }
        ContentCard {
            Text("Review queue", style = MaterialTheme.typography.titleMedium)
            Text(StudyStats.due(attempts, System.currentTimeMillis()).size.toString() + " questions ready")
        }
    }
}

@Composable
private fun Metric(value: String, label: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(value, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
        Text(label, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
fun HistoryScreen(vm: StudyViewModel) {
    val doubts by vm.history.collectAsState()
    var opened by remember { mutableStateOf<Doubt?>(null) }
    var pendingDelete by remember { mutableStateOf<Doubt?>(null) }
    Column(Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 12.dp)) {
        PageIntro("YOUR LIBRARY", "Saved answers", "Everything you've worked through.")
        Spacer(Modifier.height(18.dp))
        if (doubts.isEmpty()) ContentCard {
            Text("Nothing saved yet", style = MaterialTheme.typography.titleLarge)
            Text("Your answers appear here after solving a question.")
        } else LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(doubts, key = { it.id }) { doubt ->
                ElevatedCard(onClick = { opened = doubt }, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(doubt.subject.label, color = MaterialTheme.colorScheme.primary,
                                style = MaterialTheme.typography.labelMedium, modifier = Modifier.weight(1f))
                            if (doubt.isSample) Text("SAMPLE", style = MaterialTheme.typography.labelSmall)
                            if (doubt.bookmarked) Icon(Icons.Default.Bookmark, contentDescription = "Bookmarked")
                        }
                        Text(doubt.question, maxLines = 2, overflow = TextOverflow.Ellipsis,
                            style = MaterialTheme.typography.titleMedium)
                        Text(DateFormat.getDateInstance().format(Date(doubt.createdAt)),
                            style = MaterialTheme.typography.labelSmall)
                        Row {
                            TextButton(onClick = { vm.bookmark(doubt) }) {
                                Text(if (doubt.bookmarked) "Unsave" else "Bookmark")
                            }
                            TextButton(onClick = { pendingDelete = doubt }) { Text("Delete") }
                        }
                    }
                }
            }
        }
    }
    opened?.let { doubt ->
        AlertDialog(onDismissRequest = { opened = null }, title = { Text(doubt.question) },
            text = { Column(Modifier.verticalScroll(rememberScrollState())) {
                if (doubt.isSample) Text("SAMPLE", color = MaterialTheme.colorScheme.primary)
                Text(doubt.answer)
            } },
            confirmButton = { TextButton(onClick = { opened = null }) { Text("Close") } })
    }
    pendingDelete?.let { doubt ->
        AlertDialog(onDismissRequest = { pendingDelete = null }, title = { Text("Delete this answer?") },
            text = { Text("This saved answer will be permanently removed.") },
            confirmButton = { TextButton(onClick = {
                vm.delete(doubt); pendingDelete = null; if (opened?.id == doubt.id) opened = null
            }) { Text("Delete") } },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("Cancel") } })
    }
}

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
