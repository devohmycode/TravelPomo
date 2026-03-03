package com.pomo.focustimer.timer

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.pomo.focustimer.MainActivity
import com.pomo.focustimer.PomoApplication
import com.pomo.focustimer.R
import com.pomo.focustimer.data.PomoPreferences
import com.pomo.focustimer.model.PomoLogic
import com.pomo.focustimer.model.PomoState
import com.pomo.focustimer.widget.PomoWidgetProvider
import com.pomo.focustimer.widget.PomoWidgetReceiver

object PomoTimerManager {

    private const val NOTIFICATION_ID = 1001
    private const val ALARM_REQUEST_CODE = 2001

    // Track last notification state to avoid redundant rebuilds
    private var lastNotifPhase: String? = null
    private var lastNotifRunning: Boolean? = null
    private var lastNotifEndTime: Long = 0

    fun startTimer(context: Context) {
        val state = PomoPreferences.load(context)
        val endTime = System.currentTimeMillis() + state.remaining * 1000L
        val newState = state.copy(
            running = true,
            endTimeMillis = endTime,
            lastUpdated = System.currentTimeMillis()
        )
        PomoPreferences.save(context, newState)
        scheduleAlarm(context, endTime)
        showNotification(context, newState)
        PomoWidgetProvider.updateAllWidgets(context)
    }

    fun pauseTimer(context: Context) {
        val state = PomoPreferences.load(context)
        val remaining = if (state.endTimeMillis > 0) {
            ((state.endTimeMillis - System.currentTimeMillis()) / 1000).toInt().coerceAtLeast(0)
        } else {
            state.remaining
        }
        val newState = state.copy(
            running = false,
            remaining = remaining,
            endTimeMillis = 0L,
            lastUpdated = System.currentTimeMillis()
        )
        PomoPreferences.save(context, newState)
        cancelAlarm(context)
        showNotification(context, newState)
        PomoWidgetProvider.updateAllWidgets(context)
    }

    fun toggleTimer(context: Context) {
        val state = PomoPreferences.load(context)
        if (state.running) pauseTimer(context) else startTimer(context)
    }

    fun skipPhase(context: Context) {
        val state = PomoPreferences.load(context)
        val newState = PomoLogic.advancePhase(state).copy(endTimeMillis = 0L)
        PomoPreferences.save(context, newState)
        cancelAlarm(context)
        showNotification(context, newState)
        PomoWidgetProvider.updateAllWidgets(context)
    }

    fun resetPhase(context: Context) {
        val state = PomoPreferences.load(context)
        val newState = PomoLogic.resetPhase(state).copy(endTimeMillis = 0L)
        PomoPreferences.save(context, newState)
        cancelAlarm(context)
        showNotification(context, newState)
        PomoWidgetProvider.updateAllWidgets(context)
    }

    fun stopTimer(context: Context) {
        cancelAlarm(context)
        removeNotification(context)
    }

    fun onAlarmFired(context: Context) {
        val state = PomoPreferences.load(context)
        val completedPhase = state.phase

        val stateWithPending = if (completedPhase == "work") {
            state.copy(pendingSessions = state.pendingSessions + 1)
        } else {
            state
        }

        val newState = PomoLogic.advancePhase(stateWithPending).copy(endTimeMillis = 0L)
        PomoPreferences.save(context, newState)

        sendPhaseCompleteNotification(context, completedPhase, newState)
        showNotification(context, newState)
        PomoWidgetProvider.updateAllWidgets(context)
    }

    fun onBootCompleted(context: Context) {
        val state = PomoPreferences.load(context)
        if (!state.running || state.endTimeMillis <= 0) {
            PomoWidgetProvider.updateAllWidgets(context)
            return
        }

        if (state.endTimeMillis <= System.currentTimeMillis()) {
            onAlarmFired(context)
        } else {
            scheduleAlarm(context, state.endTimeMillis)
            showNotification(context, state)
        }
        PomoWidgetProvider.updateAllWidgets(context)
    }

    /**
     * Called from syncState to ensure alarm + notification match current state.
     */
    fun syncFromPlugin(context: Context, state: PomoState) {
        if (state.running && state.remaining > 0) {
            val endTime = System.currentTimeMillis() + state.remaining * 1000L
            val newState = state.copy(
                endTimeMillis = endTime,
                lastUpdated = System.currentTimeMillis()
            )
            PomoPreferences.save(context, newState)
            scheduleAlarm(context, endTime)
            showNotification(context, newState)
        } else {
            val newState = state.copy(endTimeMillis = 0L, lastUpdated = System.currentTimeMillis())
            PomoPreferences.save(context, newState)
            cancelAlarm(context)
            showNotification(context, newState)
        }
        PomoWidgetProvider.updateAllWidgets(context)
    }

    // --- Private helpers ---

    private fun scheduleAlarm(context: Context, triggerAtMillis: Long) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, AlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context, ALARM_REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent
        )
    }

    private fun cancelAlarm(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, AlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context, ALARM_REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
    }

    private fun showNotification(context: Context, state: PomoState, force: Boolean = false) {
        // Skip rebuild if nothing visible changed (chronometer handles countdown)
        if (!force &&
            state.phase == lastNotifPhase &&
            state.running == lastNotifRunning &&
            (!state.running || state.endTimeMillis == lastNotifEndTime)
        ) {
            return
        }

        lastNotifPhase = state.phase
        lastNotifRunning = state.running
        lastNotifEndTime = state.endTimeMillis

        val phaseLabel = PomoLogic.getPhaseLabel(state.phase)

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPending = PendingIntent.getActivity(
            context, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val toggleIntent = Intent(context, PomoWidgetReceiver::class.java).apply {
            action = PomoWidgetReceiver.ACTION_TOGGLE
        }
        val togglePending = PendingIntent.getBroadcast(
            context, 1, toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val toggleLabel = if (state.running) "Pause" else "Play"

        val builder = NotificationCompat.Builder(context, PomoApplication.CHANNEL_TIMER)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentText(state.task.ifEmpty { "Pomo Timer" })
            .setOngoing(state.running)
            .setContentIntent(openPending)
            .addAction(0, toggleLabel, togglePending)
            .setSilent(true)

        if (state.running && state.endTimeMillis > 0) {
            builder.setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setWhen(state.endTimeMillis)
                .setContentTitle(phaseLabel)
        } else {
            val minutes = state.remaining / 60
            val seconds = state.remaining % 60
            val timeText = String.format("%02d:%02d", minutes, seconds)
            builder.setContentTitle("$phaseLabel - $timeText")
        }

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, builder.build())
    }

    private fun removeNotification(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NOTIFICATION_ID)
    }

    private fun sendPhaseCompleteNotification(context: Context, completedPhase: String, state: PomoState) {
        val title: String
        val text: String
        if (completedPhase == "work") {
            title = "Pomodoro Complete"
            text = "Session #${state.completedSessions} done! Time for a break."
        } else {
            title = "Break Over"
            text = "Ready to focus?"
        }

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPending = PendingIntent.getActivity(
            context, 100, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, PomoApplication.CHANNEL_ALERTS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openPending)
            .setAutoCancel(true)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID + 1, notification)
    }
}
