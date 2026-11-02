package dev.doubtbuddy.domain

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class SolveLifecycle {
    private val _state = MutableStateFlow<SolveState>(SolveState.Idle)
    val state = _state.asStateFlow()
    private var nextRequestId = 0L

    fun begin(): Long? {
        if (_state.value is SolveState.Loading) return null
        val requestId = ++nextRequestId
        _state.value = SolveState.Loading(requestId)
        return requestId
    }

    fun invalidate() {
        _state.value = SolveState.Idle
    }

    fun reject(message: String) {
        _state.value = SolveState.Failure(message)
    }

    fun accepts(requestId: Long): Boolean =
        _state.value == SolveState.Loading(requestId)

    fun complete(requestId: Long, answer: String, isSample: Boolean): Boolean {
        if (!accepts(requestId)) return false
        _state.value = SolveState.Answer(answer, isSample)
        return true
    }

    fun fail(requestId: Long, message: String): Boolean {
        if (!accepts(requestId)) return false
        _state.value = SolveState.Failure(message)
        return true
    }
}
