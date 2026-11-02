package dev.doubtbuddy.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.doubtbuddy.StudyViewModel
import dev.doubtbuddy.domain.Doubt
import dev.doubtbuddy.domain.StudyStats
import dev.doubtbuddy.domain.Subject
import java.text.DateFormat
import java.util.Date

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
