package com.pomo.focustimer.plugin

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.pomo.focustimer.data.PomoPreferences
import com.pomo.focustimer.model.PomoState
import com.pomo.focustimer.service.PomoTimerService
import com.pomo.focustimer.widget.PomoWidgetProvider

@CapacitorPlugin(name = "PomoTimer")
class PomoTimerPlugin : Plugin() {

    @PluginMethod
    fun syncState(call: PluginCall) {
        val data = call.data
        val state = PomoState(
            phase = data.optString("phase", "work"),
            remaining = data.optInt("remaining", 25 * 60),
            totalSeconds = data.optInt("totalSeconds", 25 * 60),
            running = data.optBoolean("running", false),
            completedSessions = data.optInt("completedSessions", 0),
            task = data.optString("task", ""),
            lastUpdated = System.currentTimeMillis(),
            workMinutes = data.optInt("workMinutes", 25),
            shortBreakMinutes = data.optInt("shortBreakMinutes", 5),
            longBreakMinutes = data.optInt("longBreakMinutes", 15),
            sessionsBeforeLongBreak = data.optInt("sessionsBeforeLongBreak", 4),
            pendingSessions = 0
        )
        PomoPreferences.save(context, state)
        PomoWidgetProvider.updateAllWidgets(context)
        call.resolve()
    }

    @PluginMethod
    fun getState(call: PluginCall) {
        val state = PomoPreferences.loadWithDriftCorrection(context)
        val result = JSObject().apply {
            put("phase", state.phase)
            put("remaining", state.remaining)
            put("totalSeconds", state.totalSeconds)
            put("running", state.running)
            put("completedSessions", state.completedSessions)
            put("task", state.task)
            put("lastUpdated", state.lastUpdated)
            put("workMinutes", state.workMinutes)
            put("shortBreakMinutes", state.shortBreakMinutes)
            put("longBreakMinutes", state.longBreakMinutes)
            put("sessionsBeforeLongBreak", state.sessionsBeforeLongBreak)
            put("pendingSessions", state.pendingSessions)
        }
        call.resolve(result)
    }

    @PluginMethod
    fun startService(call: PluginCall) {
        PomoTimerService.start(context)
        call.resolve()
    }

    @PluginMethod
    fun stopService(call: PluginCall) {
        PomoTimerService.stop(context)
        call.resolve()
    }
}
