package dev.doubtbuddy.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class QuestionBankTest {
    @Test fun everySubjectHasSixValidQuestions() {
        for (subject in Subject.entries) {
            val questions = QuestionBank.forSubject(subject)
            assertEquals(6, questions.size)
            assertTrue(questions.all { it.choices.size == 4 && it.correct in 0..3 && it.explanation.isNotBlank() })
        }
    }

    @Test fun idsAreUnique() {
        assertEquals(QuestionBank.questions.size, QuestionBank.questions.map { it.id }.distinct().size)
    }

    @Test fun latestAttemptDefinesReviewEligibility() {
        val old = PracticeAttempt("1", "p01", Subject.PHYSICS, "Kinematics", 0, false, 100, 100)
        val newer = old.copy(id = "2", selected = 2, correct = true, completedAt = 200, nextReviewAt = 300)
        assertTrue(StudyStats.due(listOf(old, newer), 250).isEmpty())
        assertEquals(listOf(newer), StudyStats.due(listOf(old, newer), 300))
    }

    @Test fun accuracyHandlesEmptyHistory() {
        assertEquals(0, StudyStats.accuracy(emptyList()))
    }
}
