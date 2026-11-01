package dev.doubtbuddy

import androidx.test.platform.app.InstrumentationRegistry
import dev.doubtbuddy.data.StudyDatabase
import dev.doubtbuddy.domain.Doubt
import dev.doubtbuddy.domain.SolveMode
import dev.doubtbuddy.domain.Subject
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class StudyStorageTest {
    @Test
    fun savedDoubtSurvivesClosingAndReopeningDatabase() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val id = UUID.randomUUID().toString()
        val doubt = Doubt(
            id = id,
            subject = Subject.PHYSICS,
            question = "How does Newton's second law work?",
            answer = "Force equals mass times acceleration.",
            mode = SolveMode.GUIDED,
            createdAt = 123456789L,
            isSample = true
        )
        StudyDatabase(context).use { it.saveDoubt(doubt) }
        StudyDatabase(context).use { reopened ->
            try {
                val stored = reopened.doubts().firstOrNull { it.id == id }
                assertNotNull(stored)
                assertEquals(doubt, stored)
            } finally {
                reopened.deleteDoubt(id)
            }
        }
    }
}
