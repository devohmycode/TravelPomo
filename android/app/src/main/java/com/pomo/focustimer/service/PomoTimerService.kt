package com.pomo.focustimer.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.pomo.focustimer.MainActivity
import com.pomo.focustimer.PomoApplication
import com.pomo.focustimer.R
import com.pomo.focustimer.data.PomoPreferences
import com.pomo.focustimer.model.PomoLogic
import com.pomo.focustimer.model.PomoState
import com.pomo.focustimer.widget.PomoWidgetProvider
import com.pomo.focustimer.widget.PomoWidgetReceiver

class PomoTimerService : Service() {

    companion object {
        const val ACTION_START = "com.pomo.focustimer.ACTION_START"
        const val ACTION_STOP = "com.pomo.focustimer.ACTION_STOP"
        const val ACTION_TOGGLE = "com.pomo.focustimer.ACTION_TOGGLE"
        const val ACTION_SKIP = "com.pomo.focustimer.ACTION_SKIP"
        const val ACTION_RESET = "com.pomo.focustimer.ACTION_RESET"

        private const val NOTIFICATION_ID = 1001
        private const val TICK_INTERVAL_MS = 1000L

        fun start(context: Context) {
            val intent = Intent(context, PomoTimerService::class.java).apply {
                action = ACTION_START
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, PomoTimerService::class.java))
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private var state: PomoState = PomoState()

    private val tickRunnable = object : Runnable {
        override fun run() {
            if (!state.running) return

            state = state.copy(
                remaining = (state.remaining - 1).coerceAtLeast(0),
                lastUpdated = System.currentTimeMillis()
            )

            if (state.remaining <= 0) {
                // Phase completed
                onPhaseComplete()
            } else {
                PomoPreferences.save(this@PomoTimerService, state)
                updateNotification()
                PomoWidgetProvider.updateAllWidgets(this@PomoTimerService)
                handler.postDelayed(this, TICK_INTERVAL_MS)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        state = PomoPreferences.loadWithDriftCorrection(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                state = PomoPreferences.loadWithDriftCorrection(this)
                startForeground(NOTIFICATION_ID, buildNotification())
                if (state.running) {
                    startTicking()
                }
            }
            ACTION_STOP -> {
                stopTicking()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            ACTION_TOGGLE -> {
                state = PomoPreferences.load(this)
                state = state.copy(
                    running = !state.running,
                    lastUpdated = System.currentTimeMillis()
                )
                PomoPreferences.save(this, state)
                if (state.running) {
                    startForeground(NOTIFICATION_ID, buildNotification())
                    startTicking()
                } else {
                    stopTicking()
                    updateNotification()
                }
                PomoWidgetProvider.updateAllWidgets(this)
            }
            ACTION_SKIP -> {
                state = PomoPreferences.load(this)
                state = PomoLogic.advancePhase(state)
                PomoPreferences.save(this, state)
                stopTicking()
                updateNotification()
                PomoWidgetProvider.updateAllWidgets(this)
            }
            ACTION_RESET -> {
                state = PomoPreferences.load(this)
                state = PomoLogic.resetPhase(state)
                PomoPreferences.save(this, state)
                stopTicking()
                updateNotification()
                PomoWidgetProvider.updateAllWidgets(this)
            }
        }
        return START_STICKY
    }

    private fun startTicking() {
        handler.removeCallbacks(tickRunnable)
        handler.postDelayed(tickRunnable, TICK_INTERVAL_MS)
    }

    private fun stopTicking() {
        handler.removeCallbacks(tickRunnable)
    }

    private fun onPhaseComplete() {
        val completedPhase = state.phase

        // Track pending sessions if work phase completed
        if (completedPhase == "work") {
            state = state.copy(pendingSessions = state.pendingSessions + 1)
        }

        // Advance to next phase
        state = PomoLogic.advancePhase(state)
        PomoPreferences.save(this, state)

        // Send alert notification
        sendPhaseCompleteNotification(completedPhase)

        // Update widget
        PomoWidgetProvider.updateAllWidgets(this)
        updateNotification()

        // Stop ticking since new phase starts paused
        stopTicking()
    }

    private fun sendPhaseCompleteNotification(completedPhase: String) {
        val title: String
        val text: String
        if (completedPhase == "work") {
            title = "Pomodoro Complete"
            text = "Session #${state.completedSessions} done! Time for a break."
        } else {
            title = "Break Over"
            text = "Ready to focus?"
        }

        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPending = PendingIntent.getActivity(
            this, 100, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, PomoApplication.CHANNEL_ALERTS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openPending)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        manager.notify(NOTIFICATION_ID + 1, notification)
    }

    private fun buildNotification(): Notification {
        val minutes = state.remaining / 60
        val seconds = state.remaining % 60
        val timeText = String.format("%02d:%02d", minutes, seconds)
        val phaseLabel = PomoLogic.getPhaseLabel(state.phase)

        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPending = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Toggle action
        val toggleIntent = Intent(this, PomoWidgetReceiver::class.java).apply {
            action = PomoWidgetReceiver.ACTION_TOGGLE
        }
        val togglePending = PendingIntent.getBroadcast(
            this, 1, toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val toggleLabel = if (state.running) "Pause" else "Play"

        return NotificationCompat.Builder(this, PomoApplication.CHANNEL_TIMER)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("$phaseLabel - $timeText")
            .setContentText(state.task.ifEmpty { "Pomo Timer" })
            .setOngoing(state.running)
            .setContentIntent(openPending)
            .addAction(0, toggleLabel, togglePending)
            .setSilent(true)
            .build()
    }

    private fun updateNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification())
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopTicking()
        super.onDestroy()
    }
}
