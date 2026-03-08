package com.pomo.focustimer.timer

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat as MediaNotificationCompat
import com.pomo.focustimer.MainActivity
import com.pomo.focustimer.PomoApplication
import com.pomo.focustimer.R
import com.pomo.focustimer.data.PomoPreferences
import com.pomo.focustimer.model.PomoLogic
import com.pomo.focustimer.model.PomoState

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
    }

    fun resetPhase(context: Context) {
        val state = PomoPreferences.load(context)
        val newState = PomoLogic.resetPhase(state).copy(endTimeMillis = 0L)
        PomoPreferences.save(context, newState)
        cancelAlarm(context)
        showNotification(context, newState)
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

        vibrateForPhase(context, completedPhase)
        sendPhaseCompleteNotification(context, completedPhase, newState)
        showNotification(context, newState)
    }

    fun onBootCompleted(context: Context) {
        val state = PomoPreferences.load(context)
        if (!state.running || state.endTimeMillis <= 0) {
            return
        }

        if (state.endTimeMillis <= System.currentTimeMillis()) {
            onAlarmFired(context)
        } else {
            scheduleAlarm(context, state.endTimeMillis)
            showNotification(context, state)
        }
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

    private fun vibrateForPhase(context: Context, completedPhase: String) {
        val pattern = when (completedPhase) {
            "work" -> longArrayOf(0, 200, 100, 200, 100, 400)
            "longBreak" -> longArrayOf(0, 100, 80, 100, 80, 100, 80, 600)
            else -> longArrayOf(0, 150, 100, 150)
        }

        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
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

        // Action 0: Reset
        val resetIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_RESET
        }
        val resetPending = PendingIntent.getBroadcast(
            context, 2, resetIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action 1: Play/Pause
        val toggleAction = if (state.running)
            NotificationActionReceiver.ACTION_PAUSE
        else
            NotificationActionReceiver.ACTION_PLAY
        val toggleIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = toggleAction
        }
        val togglePending = PendingIntent.getBroadcast(
            context, 1, toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val toggleIcon = if (state.running)
            android.R.drawable.ic_media_pause
        else
            android.R.drawable.ic_media_play
        val toggleLabel = if (state.running) "Pause" else "Play"

        // Action 2: Skip
        val skipIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_SKIP
        }
        val skipPending = PendingIntent.getBroadcast(
            context, 3, skipIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, PomoApplication.CHANNEL_TIMER)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(state.task.ifEmpty { phaseLabel })
            .setOngoing(state.running)
            .setContentIntent(openPending)
            .addAction(android.R.drawable.ic_menu_revert, "Reset", resetPending)
            .addAction(toggleIcon, toggleLabel, togglePending)
            .addAction(android.R.drawable.ic_media_next, "Skip", skipPending)
            .setStyle(MediaNotificationCompat.MediaStyle()
                .setShowActionsInCompactView(0, 1, 2))
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        if (state.running && state.endTimeMillis > 0) {
            builder.setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setWhen(state.endTimeMillis)
                .setContentText(phaseLabel)
        } else {
            val minutes = state.remaining / 60
            val seconds = state.remaining % 60
            val timeText = String.format("%02d:%02d", minutes, seconds)
            builder.setContentText("$phaseLabel \u2014 $timeText")
        }

        if (state.task.isNotEmpty()) {
            builder.setSubText(state.task)
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
