package com.pomo.focustimer.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.pomo.focustimer.service.PomoTimerService

class PomoWidgetReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_TOGGLE = "com.pomo.focustimer.WIDGET_TOGGLE"
        const val ACTION_SKIP = "com.pomo.focustimer.WIDGET_SKIP"
        const val ACTION_RESET = "com.pomo.focustimer.WIDGET_RESET"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val serviceAction = when (intent.action) {
            ACTION_TOGGLE -> PomoTimerService.ACTION_TOGGLE
            ACTION_SKIP -> PomoTimerService.ACTION_SKIP
            ACTION_RESET -> PomoTimerService.ACTION_RESET
            else -> return
        }

        val serviceIntent = Intent(context, PomoTimerService::class.java).apply {
            action = serviceAction
        }
        context.startForegroundService(serviceIntent)
    }
}
