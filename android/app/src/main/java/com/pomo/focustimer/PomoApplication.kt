package com.pomo.focustimer

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class PomoApplication : Application() {

    companion object {
        const val CHANNEL_TIMER = "pomo_timer"
        const val CHANNEL_ALERTS = "pomo_alerts"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            val timerChannel = NotificationChannel(
                CHANNEL_TIMER,
                getString(R.string.notification_channel_timer),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows the running timer countdown"
                setShowBadge(false)
            }

            val alertsChannel = NotificationChannel(
                CHANNEL_ALERTS,
                getString(R.string.notification_channel_alerts),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Phase completion alerts"
                enableVibration(true)
            }

            manager.createNotificationChannel(timerChannel)
            manager.createNotificationChannel(alertsChannel)
        }
    }
}
