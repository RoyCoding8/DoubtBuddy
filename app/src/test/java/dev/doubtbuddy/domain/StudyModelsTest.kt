package dev.doubtbuddy.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class StudyModelsTest {
    @Test fun allThreeJeeSubjectsAvailable() {
        assertEquals(listOf("Physics", "Chemistry", "Mathematics"), Subject.entries.map { it.label })
    }

    @Test fun noPracticeQuestionWithInvalidAnswerKey() {
        assertThrows(IllegalArgumentException::class.java) {
            PracticeQuestion("bad", Subject.PHYSICS, "Motion", "Question", listOf("a", "b"), 2, "Explanation")
        }
    }

    @Test fun solveStatesAreDistinct() {
        assertEquals(SolveState.Idle, SolveState.Idle)
        assertEquals("Error", (SolveState.Failure("Error")).message)
    }
}
