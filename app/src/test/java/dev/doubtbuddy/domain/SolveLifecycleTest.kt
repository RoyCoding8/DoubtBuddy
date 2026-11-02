package dev.doubtbuddy.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SolveLifecycleTest {
    @Test fun editingDuringRequestRejectsOldAnswerAndOldFailure() {
        val lifecycle = SolveLifecycle()
        val first = lifecycle.begin()!!
        lifecycle.invalidate()
        val second = lifecycle.begin()!!

        assertFalse(lifecycle.complete(first, "Stale answer", false))
        assertFalse(lifecycle.fail(first, "Stale error"))
        assertEquals(SolveState.Loading(second), lifecycle.state.value)
        assertTrue(lifecycle.complete(second, "Current answer", false))
        assertEquals(SolveState.Answer("Current answer", false), lifecycle.state.value)
    }

    @Test fun editingAfterResultClearsAnswerAndAllowsNewRequest() {
        val lifecycle = SolveLifecycle()
        val first = lifecycle.begin()!!
        assertTrue(lifecycle.complete(first, "Previous", true))
        lifecycle.invalidate()
        assertEquals(SolveState.Idle, lifecycle.state.value)
        val second = lifecycle.begin()!!
        assertTrue(lifecycle.fail(second, "Network unavailable"))
        assertEquals(SolveState.Failure("Network unavailable"), lifecycle.state.value)
        lifecycle.invalidate()
        assertEquals(SolveState.Idle, lifecycle.state.value)
    }

    @Test fun duplicateSubmissionsAreIgnoredWhileLoading() {
        val lifecycle = SolveLifecycle()
        val first = lifecycle.begin()!!
        assertEquals(null, lifecycle.begin())
        assertTrue(lifecycle.accepts(first))
    }
}
