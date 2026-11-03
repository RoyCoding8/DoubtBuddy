package dev.doubtbuddy.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dev.doubtbuddy.data.ImageAttachment

internal sealed interface PhotoInputState {
    data object Empty : PhotoInputState
    data class Preparing(val ticket: Long) : PhotoInputState
    data class Ready(val attachment: ImageAttachment) : PhotoInputState
    data class Failed(val message: String) : PhotoInputState
}

internal class PhotoInputSession {
    var state by mutableStateOf<PhotoInputState>(PhotoInputState.Empty)
        private set

    private var nextTicket = 0L

    fun begin(): Long {
        val ticket = ++nextTicket
        state = PhotoInputState.Preparing(ticket)
        return ticket
    }

    fun complete(ticket: Long, attachment: ImageAttachment): Boolean {
        if (state != PhotoInputState.Preparing(ticket)) return false
        state = PhotoInputState.Ready(attachment)
        return true
    }

    fun fail(ticket: Long, message: String): Boolean {
        if (state != PhotoInputState.Preparing(ticket)) return false
        state = PhotoInputState.Failed(message)
        return true
    }

    fun remove() {
        ++nextTicket
        state = PhotoInputState.Empty
    }
}
