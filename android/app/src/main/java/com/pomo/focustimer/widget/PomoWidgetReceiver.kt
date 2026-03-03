package com.pomo.focustimer.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.pomo.focustimer.timer.PomoTimerManager

class PomoWidgetReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_TOGGLE = "com.pomo.focustimer.WIDGET_TOGGLE"
        const val ACTION_SKIP = "com.pomo.focustimer.WIDGET_SKIP"
        const val ACTION_RESET = "com.pomo.focustimer.WIDGET_RESET"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_TOGGLE -> PomoTimerManager.toggleTimer(context)
            ACTION_SKIP -> PomoTimerManager.skipPhase(context)
            ACTION_RESET -> PomoTimerManager.resetPhase(context)
        }
    }
}
