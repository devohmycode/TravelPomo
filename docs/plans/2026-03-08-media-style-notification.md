# Media-Style Notification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the existing Android timer notification to a media-style notification with 3 action buttons (Reset, Play/Pause, Skip), task name display, and phase label.

**Architecture:** Modify the existing `showNotification()` in `PomoTimerManager.kt` to use `MediaStyle`, add Skip and Reset actions to `NotificationActionReceiver`, and register the new actions in the manifest. No JS changes needed — the native side already has full timer state.

**Tech Stack:** Kotlin, AndroidX NotificationCompat.MediaStyle, existing PomoTimerManager infrastructure

---

### Task 1: Add Skip and Reset actions to NotificationActionReceiver

**Files:**
- Modify: `android/app/src/main/java/com/pomo/focustimer/timer/NotificationActionReceiver.kt`

**Step 1: Add action constants and handlers**

Replace the entire file content with:

```kotlin
package com.pomo.focustimer.timer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NotificationActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_PAUSE = "com.pomo.focustimer.NOTIF_PAUSE"
        const val ACTION_PLAY = "com.pomo.focustimer.NOTIF_PLAY"
        const val ACTION_SKIP = "com.pomo.focustimer.NOTIF_SKIP"
        const val ACTION_RESET = "com.pomo.focustimer.NOTIF_RESET"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_PAUSE, ACTION_PLAY -> PomoTimerManager.toggleTimer(context)
            ACTION_SKIP -> PomoTimerManager.skipPhase(context)
            ACTION_RESET -> PomoTimerManager.resetPhase(context)
        }
    }
}
```

---

### Task 2: Register new actions in AndroidManifest.xml

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`

**Step 1: Add SKIP and RESET actions to the receiver's intent-filter**

Find the NotificationActionReceiver block (lines 39-46) and replace with:

```xml
        <!-- Notification Action Receiver (play/pause/skip/reset from notification) -->
        <receiver
            android:name=".timer.NotificationActionReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="com.pomo.focustimer.NOTIF_PAUSE" />
                <action android:name="com.pomo.focustimer.NOTIF_PLAY" />
                <action android:name="com.pomo.focustimer.NOTIF_SKIP" />
                <action android:name="com.pomo.focustimer.NOTIF_RESET" />
            </intent-filter>
        </receiver>
```

---

### Task 3: Upgrade showNotification() to MediaStyle with 3 actions

**Files:**
- Modify: `android/app/src/main/java/com/pomo/focustimer/timer/PomoTimerManager.kt`

**Step 1: Add the MediaStyle import**

Add after the existing imports:
```kotlin
import androidx.media.app.NotificationCompat as MediaNotificationCompat
```

**Step 2: Replace the `showNotification()` method (lines 159-215)**

Replace the entire `showNotification` method with:

```kotlin
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
            builder.setContentText("$phaseLabel — $timeText")
        }

        // Show task name as subtext when task is set
        if (state.task.isNotEmpty()) {
            builder.setSubText(state.task)
        }

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, builder.build())
    }
```

**Key changes from the old notification:**
- `contentTitle` = task name (or phase label if no task)
- `contentText` = phase label (when running, chronometer shows countdown) or "Phase — MM:SS" (when paused)
- `subText` = task name (shown as small text above content when task is set)
- 3 actions: Reset (index 0), Play/Pause (index 1), Skip (index 2)
- `MediaStyle` with all 3 actions shown in compact view
- Action icons: `ic_menu_revert` (reset), `ic_media_play`/`ic_media_pause` (toggle), `ic_media_next` (skip)
- `VISIBILITY_PUBLIC` so controls appear on lock screen

**Step 3: Add the gradle dependency for media compat**

Check if `androidx.media` is already in `android/app/build.gradle`. If not, add to the dependencies block:

```gradle
implementation "androidx.media:media:1.7.0"
```

---

### Task 4: Build and verify

**Step 1: Build Next.js**

Run: `pnpm build`
Expected: Build succeeds.

**Step 2: Sync Capacitor**

Run: `npx cap sync android`
Expected: Sync completes.

**Step 3: Verify Android build**

Build the Android project to ensure no compilation errors.

**Step 4: Commit**

```bash
git add android/app/src/main/java/com/pomo/focustimer/timer/NotificationActionReceiver.kt \
      android/app/src/main/java/com/pomo/focustimer/timer/PomoTimerManager.kt \
      android/app/src/main/AndroidManifest.xml \
      android/app/build.gradle
git commit -m "feat: Upgrade to media-style notification with Reset/Play/Skip controls"
```
