package com.pomo.focustimer.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.widget.RemoteViews
import com.pomo.focustimer.R
import com.pomo.focustimer.MainActivity
import com.pomo.focustimer.data.PomoPreferences
import com.pomo.focustimer.model.PomoLogic
import com.pomo.focustimer.model.PomoState

class PomoWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        // First widget placed
    }

    override fun onDisabled(context: Context) {
        // Last widget removed
    }

    companion object {
        private val handler = Handler(Looper.getMainLooper())
        @Volatile private var pendingUpdate: Runnable? = null
        private const val DEBOUNCE_MS = 500L

        fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val state = PomoPreferences.load(context)
            val views = buildRemoteViews(context, state)
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        fun updateAllWidgets(context: Context) {
            pendingUpdate?.let { handler.removeCallbacks(it) }
            val appContext = context.applicationContext
            val runnable = Runnable {
                val manager = AppWidgetManager.getInstance(appContext)
                val ids = manager.getAppWidgetIds(
                    ComponentName(appContext, PomoWidgetProvider::class.java)
                )
                if (ids.isEmpty()) return@Runnable
                val state = PomoPreferences.load(appContext)
                val views = buildRemoteViews(appContext, state)
                for (id in ids) {
                    manager.updateAppWidget(id, views)
                }
            }
            pendingUpdate = runnable
            handler.postDelayed(runnable, DEBOUNCE_MS)
        }

        private fun buildRemoteViews(context: Context, state: PomoState): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_pomo)

            // Timer text
            val minutes = state.remaining / 60
            val seconds = state.remaining % 60
            views.setTextViewText(
                R.id.widget_timer,
                String.format("%02d:%02d", minutes, seconds)
            )

            // Phase label
            views.setTextViewText(R.id.widget_phase, PomoLogic.getPhaseLabel(state.phase))

            // Sessions
            val sessionsDone = state.completedSessions % state.sessionsBeforeLongBreak
            views.setTextViewText(
                R.id.widget_sessions,
                "$sessionsDone/${state.sessionsBeforeLongBreak}"
            )

            // Task
            val taskText = state.task.ifEmpty { "" }
            views.setTextViewText(R.id.widget_task, taskText)

            // Play/Pause icon
            views.setImageViewResource(
                R.id.widget_btn_toggle,
                if (state.running) R.drawable.ic_widget_pause else R.drawable.ic_widget_play
            )

            // Button PendingIntents
            views.setOnClickPendingIntent(
                R.id.widget_btn_toggle,
                buildActionIntent(context, PomoWidgetReceiver.ACTION_TOGGLE)
            )
            views.setOnClickPendingIntent(
                R.id.widget_btn_skip,
                buildActionIntent(context, PomoWidgetReceiver.ACTION_SKIP)
            )
            views.setOnClickPendingIntent(
                R.id.widget_btn_reset,
                buildActionIntent(context, PomoWidgetReceiver.ACTION_RESET)
            )

            // Tap on timer/root opens the app
            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openPending = PendingIntent.getActivity(
                context, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_timer, openPending)
            views.setOnClickPendingIntent(R.id.widget_phase, openPending)

            return views
        }

        private fun buildActionIntent(context: Context, action: String): PendingIntent {
            val intent = Intent(context, PomoWidgetReceiver::class.java).apply {
                this.action = action
            }
            return PendingIntent.getBroadcast(
                context,
                action.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }
}
