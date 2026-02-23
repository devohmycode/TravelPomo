package com.pomo.focustimer.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.pomo.focustimer.data.PomoPreferences
import com.pomo.focustimer.service.PomoTimerService

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        // Correct drift after reboot
        val state = PomoPreferences.loadWithDriftCorrection(context)
        PomoPreferences.save(context, state)

        // Update widget with corrected state
        PomoWidgetProvider.updateAllWidgets(context)

        // If timer was running, restart the foreground service
        // On Android 12+ (API 31), we cannot start FG services from background
        if (state.running && state.remaining > 0 && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            PomoTimerService.start(context)
        }
    }
}
