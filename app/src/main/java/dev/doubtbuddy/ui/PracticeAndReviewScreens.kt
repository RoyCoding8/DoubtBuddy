package dev.doubtbuddy.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.doubtbuddy.StudyViewModel
import dev.doubtbuddy.domain.QuestionBank
import dev.doubtbuddy.domain.StudyStats
import dev.doubtbuddy.domain.Subject

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
