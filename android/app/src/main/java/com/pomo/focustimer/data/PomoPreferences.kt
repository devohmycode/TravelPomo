package com.pomo.focustimer.data

import android.content.Context
import android.content.SharedPreferences
import com.pomo.focustimer.model.PomoState

object PomoPreferences {

    private const val PREFS_NAME = "pomo_widget_state"

    @Volatile
    private var cachedPrefs: SharedPreferences? = null

    @Volatile
    private var cachedState: PomoState? = null

    private fun prefs(context: Context): SharedPreferences {
        return cachedPrefs ?: context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .also { cachedPrefs = it }
    }

    fun save(context: Context, state: PomoState) {
        cachedState = state
        prefs(context).edit().apply {
            putString("phase", state.phase)
            putInt("remaining", state.remaining)
            putInt("totalSeconds", state.totalSeconds)
            putBoolean("running", state.running)
            putInt("completedSessions", state.completedSessions)
            putString("task", state.task)
            putLong("lastUpdated", state.lastUpdated)
            putInt("workMinutes", state.workMinutes)
            putInt("shortBreakMinutes", state.shortBreakMinutes)
            putInt("longBreakMinutes", state.longBreakMinutes)
            putInt("sessionsBeforeLongBreak", state.sessionsBeforeLongBreak)
            putInt("pendingSessions", state.pendingSessions)
            putLong("endTimeMillis", state.endTimeMillis)
            apply()
        }
    }

    fun load(context: Context): PomoState {
        cachedState?.let { return it }

        val p = prefs(context)
        val state = PomoState(
            phase = p.getString("phase", "work") ?: "work",
            remaining = p.getInt("remaining", 25 * 60),
            totalSeconds = p.getInt("totalSeconds", 25 * 60),
            running = p.getBoolean("running", false),
            completedSessions = p.getInt("completedSessions", 0),
            task = p.getString("task", "") ?: "",
            lastUpdated = p.getLong("lastUpdated", System.currentTimeMillis()),
            workMinutes = p.getInt("workMinutes", 25),
            shortBreakMinutes = p.getInt("shortBreakMinutes", 5),
            longBreakMinutes = p.getInt("longBreakMinutes", 15),
            sessionsBeforeLongBreak = p.getInt("sessionsBeforeLongBreak", 4),
            pendingSessions = p.getInt("pendingSessions", 0),
            endTimeMillis = p.getLong("endTimeMillis", 0L)
        )
        cachedState = state
        return state
    }

    /**
     * Recalculate remaining time based on elapsed since lastUpdated
     * (useful after reboot or service restart).
     */
    fun loadWithDriftCorrection(context: Context): PomoState {
        val state = load(context)
        if (!state.running) return state

        // Derive remaining from endTimeMillis if available
        if (state.endTimeMillis > 0) {
            val remaining = ((state.endTimeMillis - System.currentTimeMillis()) / 1000).toInt().coerceAtLeast(0)
            return state.copy(remaining = remaining, lastUpdated = System.currentTimeMillis())
        }

        val elapsed = ((System.currentTimeMillis() - state.lastUpdated) / 1000).toInt()
        val correctedRemaining = (state.remaining - elapsed).coerceAtLeast(0)
        return state.copy(remaining = correctedRemaining, lastUpdated = System.currentTimeMillis())
    }
}
