package com.pomo.focustimer.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.pomo.focustimer.MainActivity
import com.pomo.focustimer.PomoApplication
import com.pomo.focustimer.R

/**
 * Foreground service started ONLY when ambient sounds are playing.
 * Keeps the process alive so WebView audio continues in the background.
 * Justifies FOREGROUND_SERVICE_MEDIA_PLAYBACK permission.
 */
class AmbientAudioService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 1003

        fun start(context: Context) {
            val intent = Intent(context, AmbientAudioService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, AmbientAudioService::class.java))
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    private fun buildNotification(): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPending = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, PomoApplication.CHANNEL_TIMER)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Ambient Sounds")
            .setContentText("Playing background audio")
            .setOngoing(true)
            .setContentIntent(openPending)
            .setSilent(true)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
