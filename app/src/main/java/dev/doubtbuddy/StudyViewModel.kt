package dev.doubtbuddy

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import dev.doubtbuddy.data.ApiKeyVault
import dev.doubtbuddy.data.GeminiClient
import dev.doubtbuddy.data.ImageAttachment
import dev.doubtbuddy.data.StudyDatabase
import dev.doubtbuddy.domain.Doubt
import dev.doubtbuddy.domain.PracticeAttempt
import dev.doubtbuddy.domain.PracticeQuestion
import dev.doubtbuddy.domain.SolveMode
import dev.doubtbuddy.domain.SolveState
import dev.doubtbuddy.domain.Subject
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class StudyViewModel(application: Application) : AndroidViewModel(application) {
    private val database = StudyDatabase(application)
    private val vault = ApiKeyVault(application)
    private val client = GeminiClient()

    private val _history = MutableStateFlow(database.doubts())
    val history = _history.asStateFlow()
    private val _attempts = MutableStateFlow(database.attempts())
    val attempts = _attempts.asStateFlow()
    private val _solveState = MutableStateFlow<SolveState>(SolveState.Idle)
    val solveState = _solveState.asStateFlow()
    private val _hasApiKey = MutableStateFlow(!vault.load().isNullOrBlank())
    val hasApiKey = _hasApiKey.asStateFlow()

    fun saveKey(key: String) {
        vault.save(key)
        _hasApiKey.value = !vault.load().isNullOrBlank()
    }

    fun clearAnswer() {
        if (_solveState.value !is SolveState.Loading) _solveState.value = SolveState.Idle
    }

    fun solve(subject: Subject, mode: SolveMode, question: String, image: ImageAttachment? = null) {
        val trimmed = question.trim()
        if (_solveState.value is SolveState.Loading) return
        if (trimmed.isBlank() && image == null) {
            _solveState.value = SolveState.Failure("Enter a question or attach an image.")
            return
        }
        if (trimmed.length > 6000) {
            _solveState.value = SolveState.Failure("Keep the question under 6,000 characters.")
            return
        }
        _solveState.value = SolveState.Loading
        viewModelScope.launch {
            try {
                val key = vault.load()
                val isSample = key.isNullOrBlank()
                val answer = if (isSample) {
                    "Local preview only. This is not an AI-generated solution.\n\n" +
                        "For " + subject.label.lowercase() + ", start by identifying the given information and what the question asks. " +
                        "Write the relevant definitions, formulae, or principles before substituting values.\n\n" +
                        "Open Settings and enter your Gemini API key for a worked solution."
                } else withContext(Dispatchers.IO) {
                    client.solve(key, subject, mode, trimmed.ifBlank { "Solve the attached question." }, image)
                }
                val doubt = Doubt(
                    UUID.randomUUID().toString(), subject, trimmed.ifBlank { "Image question" },
                    answer, mode, System.currentTimeMillis(), isSample
                )
                withContext(Dispatchers.IO) { database.saveDoubt(doubt) }
                _history.value = listOf(doubt) + _history.value
                _solveState.value = SolveState.Answer(answer, isSample)
            } catch (error: Exception) {
                _solveState.value = SolveState.Failure(error.message ?: "Something went wrong. Please retry.")
            }
        }
    }

    fun bookmark(doubt: Doubt) {
        val updated = doubt.copy(bookmarked = !doubt.bookmarked)
        database.setBookmark(updated.id, updated.bookmarked)
        _history.value = _history.value.map { if (it.id == updated.id) updated else it }
    }

    fun delete(doubt: Doubt) {
        database.deleteDoubt(doubt.id)
        _history.value = _history.value.filterNot { it.id == doubt.id }
    }

    fun recordAttempt(question: PracticeQuestion, selected: Int, review: Boolean = false) {
        if (selected !in question.choices.indices) return
        val now = System.currentTimeMillis()
        val correct = question.correct == selected
        val delay = when {
            correct && review -> 3L * 86_400_000
            correct -> 86_400_000L
            review -> 10L * 60_000
            else -> 0L
        }
        val attempt = PracticeAttempt(
            UUID.randomUUID().toString(), question.id, question.subject,
            question.chapter, selected, correct, now, now + delay
        )
        database.saveAttempt(attempt)
        _attempts.value = listOf(attempt) + _attempts.value
    }

    override fun onCleared() {
        database.close()
        super.onCleared()
    }
}
