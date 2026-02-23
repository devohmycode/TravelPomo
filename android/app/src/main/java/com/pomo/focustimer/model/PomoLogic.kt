package com.pomo.focustimer.model

/**
 * Kotlin port of lib/pomodoro.ts logic.
 * Used by the native ForegroundService and Widget.
 */
object PomoLogic {

    fun getPhaseSeconds(phase: String, state: PomoState): Int = when (phase) {
        "work" -> state.workMinutes * 60
        "shortBreak" -> state.shortBreakMinutes * 60
        "longBreak" -> state.longBreakMinutes * 60
        else -> state.workMinutes * 60
    }

    fun getPhaseLabel(phase: String): String = when (phase) {
        "work" -> "WORK"
        "shortBreak" -> "SHORT BREAK"
        "longBreak" -> "LONG BREAK"
        else -> "WORK"
    }

    fun advancePhase(state: PomoState): PomoState {
        return if (state.phase == "work") {
            val newCompleted = state.completedSessions + 1
            val isLongBreak = newCompleted % state.sessionsBeforeLongBreak == 0
            val nextPhase = if (isLongBreak) "longBreak" else "shortBreak"
            val totalSec = getPhaseSeconds(nextPhase, state)
            state.copy(
                phase = nextPhase,
                remaining = totalSec,
                totalSeconds = totalSec,
                running = false,
                completedSessions = newCompleted,
                lastUpdated = System.currentTimeMillis()
            )
        } else {
            val totalSec = getPhaseSeconds("work", state)
            state.copy(
                phase = "work",
                remaining = totalSec,
                totalSeconds = totalSec,
                running = false,
                lastUpdated = System.currentTimeMillis()
            )
        }
    }

    fun resetPhase(state: PomoState): PomoState {
        val totalSec = getPhaseSeconds(state.phase, state)
        return state.copy(
            remaining = totalSec,
            totalSeconds = totalSec,
            running = false,
            lastUpdated = System.currentTimeMillis()
        )
    }

    fun resetAll(state: PomoState): PomoState {
        val totalSec = state.workMinutes * 60
        return state.copy(
            phase = "work",
            remaining = totalSec,
            totalSeconds = totalSec,
            running = false,
            completedSessions = 0,
            pendingSessions = 0,
            lastUpdated = System.currentTimeMillis()
        )
    }
}
