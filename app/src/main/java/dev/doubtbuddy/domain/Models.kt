package dev.doubtbuddy.domain

enum class Subject(val label: String, val symbol: String) {
    PHYSICS("Physics", "P"),
    CHEMISTRY("Chemistry", "C"),
    MATHEMATICS("Mathematics", "M")
}

enum class SolveMode(val label: String, val instruction: String) {
    GUIDED("Step by step", "Show the reasoning as clear numbered steps."),
    HINT("Just a hint", "Give one useful hint without revealing the final answer."),
    CONCEPT("Explain concept", "Explain the underlying principle with a short example."),
    QUICK("Quick answer", "Answer concisely and include essential working.")
}

data class Doubt(
    val id: String,
    val subject: Subject,
    val question: String,
    val answer: String,
    val mode: SolveMode,
    val createdAt: Long,
    val isSample: Boolean,
    val bookmarked: Boolean = false
)

data class PracticeQuestion(
    val id: String,
    val subject: Subject,
    val chapter: String,
    val question: String,
    val choices: List<String>,
    val correct: Int,
    val explanation: String
) {
    init { require(choices.size == 4 && correct in choices.indices) }
}

data class PracticeAttempt(
    val id: String,
    val questionId: String,
    val subject: Subject,
    val chapter: String,
    val selected: Int,
    val correct: Boolean,
    val completedAt: Long,
    val nextReviewAt: Long
)

sealed interface SolveState {
    data object Idle : SolveState
    data class Loading(val requestId: Long) : SolveState
    data class Answer(val text: String, val isSample: Boolean) : SolveState
    data class Failure(val message: String) : SolveState
}
