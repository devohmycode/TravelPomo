package com.pomo.focustimer.model

data class PomoState(
    val phase: String = "work",           // "work", "shortBreak", "longBreak"
    val remaining: Int = 25 * 60,         // seconds remaining
    val totalSeconds: Int = 25 * 60,      // total seconds for current phase
    val running: Boolean = false,
    val completedSessions: Int = 0,
    val task: String = "",
    val lastUpdated: Long = System.currentTimeMillis(),

    // Config
    val workMinutes: Int = 25,
    val shortBreakMinutes: Int = 5,
    val longBreakMinutes: Int = 15,
    val sessionsBeforeLongBreak: Int = 4,

    // Background tracking
    val pendingSessions: Int = 0          // sessions completed while in background
)
