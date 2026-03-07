package com.pomo.focustimer.timer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NotificationActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_PAUSE = "com.pomo.focustimer.NOTIF_PAUSE"
        const val ACTION_PLAY = "com.pomo.focustimer.NOTIF_PLAY"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_PAUSE, ACTION_PLAY -> PomoTimerManager.toggleTimer(context)
        }
    }
}
