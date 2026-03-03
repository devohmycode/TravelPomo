package com.pomo.focustimer.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.pomo.focustimer.timer.PomoTimerManager

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        PomoTimerManager.onBootCompleted(context)
    }
}
