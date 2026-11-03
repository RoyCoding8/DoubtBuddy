package dev.doubtbuddy.ui

import dev.doubtbuddy.data.ImageAttachment
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PhotoInputSessionTest {
    private val first = ImageAttachment("image/jpeg", "FIRST")
    private val second = ImageAttachment("image/jpeg", "SECOND")

    @Test fun olderPhotoCannotOverwriteNewerSelection() {
        val session = PhotoInputSession()
        val oldTicket = session.begin()
        val newTicket = session.begin()
        assertFalse(session.complete(oldTicket, first))
        assertEquals(PhotoInputState.Preparing(newTicket), session.state)
        assertTrue(session.complete(newTicket, second))
        assertEquals(PhotoInputState.Ready(second), session.state)
    }

    @Test fun removedPhotoCannotReturnAfterDecodeCompletes() {
        val session = PhotoInputSession()
        val ticket = session.begin()
        session.remove()
        assertFalse(session.complete(ticket, first))
        assertFalse(session.fail(ticket, "Old error"))
        assertEquals(PhotoInputState.Empty, session.state)
    }

    @Test fun oldImportErrorsAreIgnored() {
        val session = PhotoInputSession()
        val firstTicket = session.begin()
        val nextTicket = session.begin()
        assertFalse(session.fail(firstTicket, "Old error"))
        assertTrue(session.fail(nextTicket, "New error"))
        assertEquals(PhotoInputState.Failed("New error"), session.state)
    }
}
