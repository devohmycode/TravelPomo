# Android Performance Optimization - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate continuous UI lag/jank on mid-range Android devices by optimizing both WebView animations and native Android operations.

**Architecture:** Hybrid Capacitor app where the web layer (React/Next.js) runs inside an Android WebView. Performance bottlenecks exist in both layers: canvas animations running at 60 FPS uncapped, excessive IPC bridge calls without state diffing, and native SharedPreferences disk reads on the main thread with unbatched widget updates.

**Tech Stack:** TypeScript/React (WebView), Kotlin (Android native), Capacitor 8 (bridge)

---

### Task 1: Throttle background gradient animation to 30 FPS

**Files:**
- Modify: `components/flip-clock.tsx:209-234`

The `animateBg` callback runs `requestAnimationFrame` in a tight loop at 60 FPS. On Android WebView, this consumes significant GPU. The gradient changes slowly (8s cycle), so 30 FPS is visually identical.

**Step 1: Add frame throttling to animateBg**

Replace the `animateBg` callback and its effect (lines 209-234) with a throttled version:

```typescript
const lastFrameRef = useRef<number>(0)
const TARGET_FRAME_MS = 1000 / 30 // 30 FPS

const animateBg = useCallback(() => {
  const now = Date.now()
  if (now - lastFrameRef.current < TARGET_FRAME_MS) {
    rafRef.current = requestAnimationFrame(animateBg)
    return
  }
  lastFrameRef.current = now

  const el = bgRef.current
  if (!el) return
  const CYCLE = 8000
  const t = (now % CYCLE) / CYCLE
  const mix = (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2
  const colorA = hexToRgb(themeRef.current.a)
  const colorB = hexToRgb(themeRef.current.b)
  const c1 = lerpColor(colorA, colorB, mix)
  const c2 = lerpColor(colorB, colorA, mix)

  const currentBgType = bgTypeRef.current
  if (currentBgType === "solid") {
    el.style.background = c1
  } else if (currentBgType === "radial") {
    el.style.background = `radial-gradient(circle at 50% 50%, ${c2} 0%, ${c1} 100%)`
  } else {
    el.style.background = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`
  }
  rafRef.current = requestAnimationFrame(animateBg)
}, [])

useEffect(() => {
  rafRef.current = requestAnimationFrame(animateBg)
  return () => cancelAnimationFrame(rafRef.current)
}, [animateBg])
```

**Step 2: Verify the app builds**

Run: `pnpm build`
Expected: Build succeeds, no TypeScript errors.

**Step 3: Commit**

```bash
git add components/flip-clock.tsx
git commit -m "perf: throttle background gradient animation to 30 FPS"
```

---

### Task 2: Throttle snow and rain canvas to 30 FPS + reduce density on mobile

**Files:**
- Modify: `components/snow-canvas.tsx:162-189`
- Modify: `components/rain-canvas.tsx:127-183`

Both canvases run `requestAnimationFrame` at 60 FPS with 150+ particles. Each frame creates radial gradients (snow) or stroke paths (rain). Throttle to 30 FPS and reduce particle count on Android.

**Step 1: Throttle snow canvas animate loop**

In `components/snow-canvas.tsx`, add frame throttling inside the second `useEffect` (lines 78-200). Add a `lastFrameRef` and time check at the start of `animate`:

```typescript
// Add at top of second useEffect, after ctx check:
let lastFrame = 0
const TARGET_FRAME_MS = 1000 / 30

const animate = () => {
  const now = Date.now()
  if (now - lastFrame < TARGET_FRAME_MS) {
    rafRef.current = requestAnimationFrame(animate)
    return
  }
  lastFrame = now

  ctx.clearRect(0, 0, w, h)
  // ... rest of animate function unchanged
```

Also change the default `density` prop from `150` to detect mobile:

In the component signature (line 27), change the density default:

```typescript
export function SnowCanvas({
  density: densityProp,
  sizeMin = 1,
  sizeMax = 4.5,
  speedMin = 0.2,
  speedMax = 1.4,
  sound = true,
}: SnowCanvasProps & { density?: number }) {
  const density = densityProp ?? (typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent) ? 80 : 150)
```

**Step 2: Throttle rain canvas animate loop**

In `components/rain-canvas.tsx`, same approach inside the `draw` function (lines 127-183):

```typescript
// Add at top of second useEffect, after ctx check:
let lastFrame = 0
const TARGET_FRAME_MS = 1000 / 30

const draw = () => {
  const now = Date.now()
  if (now - lastFrame < TARGET_FRAME_MS) {
    rafRef.current = requestAnimationFrame(draw)
    return
  }
  lastFrame = now

  ctx.clearRect(0, 0, w, h)
  // ... rest of draw function unchanged
```

Also reduce default `dropCount` on mobile:

```typescript
export function RainCanvas({
  dropCount: dropCountProp,
  speedMin = 12,
  speedMax = 25,
  wind = 2,
  sound = true,
}: RainCanvasProps & { dropCount?: number }) {
  const dropCount = dropCountProp ?? (typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent) ? 100 : 180)
```

**Step 3: Verify the app builds**

Run: `pnpm build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add components/snow-canvas.tsx components/rain-canvas.tsx
git commit -m "perf: throttle rain/snow canvas to 30 FPS, reduce particles on mobile"
```

---

### Task 3: Add state diffing to widget-bridge before native sync

**Files:**
- Modify: `lib/widget-bridge.ts:39-68`

Currently `doSync` sends all 11 fields every 1s. Most ticks only `remaining` changes by 1 second. Add diffing to skip unchanged syncs.

**Step 1: Add state diff tracking**

Add a `lastSyncedState` variable and diff check in `syncWidgetState`:

```typescript
// After line 40 (const SYNC_THROTTLE_MS = 1000), add:
let lastSyncedRemaining = -1
let lastSyncedRunning: boolean | null = null
let lastSyncedPhase = ""
let lastSyncedCompletedSessions = -1

export function syncWidgetState(
  pomo: PomodoroState,
  config: PomodoroConfig,
  task: string
): void {
  const now = Date.now()
  if (now - lastSyncTime < SYNC_THROTTLE_MS) return

  // Skip if nothing meaningful changed
  if (
    pomo.remaining === lastSyncedRemaining &&
    pomo.running === lastSyncedRunning &&
    pomo.phase === lastSyncedPhase &&
    pomo.completedSessions === lastSyncedCompletedSessions
  ) {
    return
  }

  lastSyncTime = now
  lastSyncedRemaining = pomo.remaining
  lastSyncedRunning = pomo.running
  lastSyncedPhase = pomo.phase
  lastSyncedCompletedSessions = pomo.completedSessions
  doSync(pomo, config, task)
}
```

Note: `forceSyncWidgetState` should NOT check the diff (it's used for critical transitions like backgrounding). Update it to also set the tracking vars:

```typescript
export function forceSyncWidgetState(
  pomo: PomodoroState,
  config: PomodoroConfig,
  task: string
): void {
  lastSyncTime = Date.now()
  lastSyncedRemaining = pomo.remaining
  lastSyncedRunning = pomo.running
  lastSyncedPhase = pomo.phase
  lastSyncedCompletedSessions = pomo.completedSessions
  doSync(pomo, config, task)
}
```

**Step 2: Verify the app builds**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add lib/widget-bridge.ts
git commit -m "perf: add state diffing to widget bridge, skip unchanged syncs"
```

---

### Task 4: Cache SharedPreferences instance and add in-memory state cache

**Files:**
- Modify: `android/app/src/main/java/com/pomo/focustimer/data/PomoPreferences.kt`

Currently `prefs(context)` creates a new `SharedPreferences` handle every call and all reads are synchronous disk I/O on the main thread.

**Step 1: Add SharedPreferences instance caching and in-memory state**

Replace the entire `PomoPreferences` object:

```kotlin
object PomoPreferences {

    private const val PREFS_NAME = "pomo_widget_state"

    @Volatile
    private var cachedPrefs: SharedPreferences? = null

    @Volatile
    private var cachedState: PomoState? = null

    private fun prefs(context: Context): SharedPreferences {
        return cachedPrefs ?: context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .also { cachedPrefs = it }
    }

    fun save(context: Context, state: PomoState) {
        cachedState = state
        prefs(context).edit().apply {
            putString("phase", state.phase)
            putInt("remaining", state.remaining)
            putInt("totalSeconds", state.totalSeconds)
            putBoolean("running", state.running)
            putInt("completedSessions", state.completedSessions)
            putString("task", state.task)
            putLong("lastUpdated", state.lastUpdated)
            putInt("workMinutes", state.workMinutes)
            putInt("shortBreakMinutes", state.shortBreakMinutes)
            putInt("longBreakMinutes", state.longBreakMinutes)
            putInt("sessionsBeforeLongBreak", state.sessionsBeforeLongBreak)
            putInt("pendingSessions", state.pendingSessions)
            putLong("endTimeMillis", state.endTimeMillis)
            apply()
        }
    }

    fun load(context: Context): PomoState {
        cachedState?.let { return it }

        val p = prefs(context)
        val state = PomoState(
            phase = p.getString("phase", "work") ?: "work",
            remaining = p.getInt("remaining", 25 * 60),
            totalSeconds = p.getInt("totalSeconds", 25 * 60),
            running = p.getBoolean("running", false),
            completedSessions = p.getInt("completedSessions", 0),
            task = p.getString("task", "") ?: "",
            lastUpdated = p.getLong("lastUpdated", System.currentTimeMillis()),
            workMinutes = p.getInt("workMinutes", 25),
            shortBreakMinutes = p.getInt("shortBreakMinutes", 5),
            longBreakMinutes = p.getInt("longBreakMinutes", 15),
            sessionsBeforeLongBreak = p.getInt("sessionsBeforeLongBreak", 4),
            pendingSessions = p.getInt("pendingSessions", 0),
            endTimeMillis = p.getLong("endTimeMillis", 0L)
        )
        cachedState = state
        return state
    }

    fun loadWithDriftCorrection(context: Context): PomoState {
        val state = load(context)
        if (!state.running) return state

        if (state.endTimeMillis > 0) {
            val remaining = ((state.endTimeMillis - System.currentTimeMillis()) / 1000).toInt().coerceAtLeast(0)
            return state.copy(remaining = remaining, lastUpdated = System.currentTimeMillis())
        }

        val elapsed = ((System.currentTimeMillis() - state.lastUpdated) / 1000).toInt()
        val correctedRemaining = (state.remaining - elapsed).coerceAtLeast(0)
        return state.copy(remaining = correctedRemaining, lastUpdated = System.currentTimeMillis())
    }
}
```

**Step 2: Verify the Android build**

Run: `cd android && ./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL

**Step 3: Commit**

```bash
git add android/app/src/main/java/com/pomo/focustimer/data/PomoPreferences.kt
git commit -m "perf: cache SharedPreferences instance and add in-memory state cache"
```

---

### Task 5: Debounce widget updates

**Files:**
- Modify: `android/app/src/main/java/com/pomo/focustimer/widget/PomoWidgetProvider.kt`

Currently every timer action calls `updateAllWidgets()` synchronously, rebuilding `RemoteViews` and serializing IPC to the launcher.

**Step 1: Add debounced update to PomoWidgetProvider**

Add a `Handler`-based debounce to the companion object:

```kotlin
import android.os.Handler
import android.os.Looper
```

Replace the `updateAllWidgets` method in the companion object:

```kotlin
companion object {
    private val handler = Handler(Looper.getMainLooper())
    private var pendingUpdate: Runnable? = null
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
        val runnable = Runnable {
            val appContext = context.applicationContext
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

    // ... buildRemoteViews and buildActionIntent remain unchanged
```

**Step 2: Verify the Android build**

Run: `cd android && ./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL

**Step 3: Commit**

```bash
git add android/app/src/main/java/com/pomo/focustimer/widget/PomoWidgetProvider.kt
git commit -m "perf: debounce widget updates with 500ms Handler delay"
```

---

### Task 6: Optimize notification rebuilding in PomoTimerManager

**Files:**
- Modify: `android/app/src/main/java/com/pomo/focustimer/timer/PomoTimerManager.kt`

The `showNotification` method is called on every action (start, pause, skip, reset, alarm, sync). When the timer is running with a chronometer, Android handles the countdown natively - we only need to rebuild when state actually changes (phase, running status).

**Step 1: Add notification caching to avoid redundant rebuilds**

Add tracking variables and a guard to `showNotification`:

```kotlin
object PomoTimerManager {

    private const val NOTIFICATION_ID = 1001
    private const val ALARM_REQUEST_CODE = 2001

    // Track last notification state to avoid redundant rebuilds
    private var lastNotifPhase: String? = null
    private var lastNotifRunning: Boolean? = null
    private var lastNotifEndTime: Long = 0
```

Then modify `showNotification` to skip redundant rebuilds:

```kotlin
private fun showNotification(context: Context, state: PomoState, force: Boolean = false) {
    // Skip rebuild if nothing visible changed (chronometer handles countdown)
    if (!force &&
        state.phase == lastNotifPhase &&
        state.running == lastNotifRunning &&
        state.running && state.endTimeMillis == lastNotifEndTime
    ) {
        return
    }

    lastNotifPhase = state.phase
    lastNotifRunning = state.running
    lastNotifEndTime = state.endTimeMillis

    // ... rest of showNotification unchanged
```

Update `syncFromPlugin` to pass `force = false`:

```kotlin
fun syncFromPlugin(context: Context, state: PomoState) {
    if (state.running && state.remaining > 0) {
        val endTime = System.currentTimeMillis() + state.remaining * 1000L
        val newState = state.copy(
            endTimeMillis = endTime,
            lastUpdated = System.currentTimeMillis()
        )
        PomoPreferences.save(context, newState)
        scheduleAlarm(context, endTime)
        showNotification(context, newState) // Will skip if same phase+running+endTime
    } else {
        val newState = state.copy(endTimeMillis = 0L, lastUpdated = System.currentTimeMillis())
        PomoPreferences.save(context, newState)
        cancelAlarm(context)
        showNotification(context, newState)
    }
    PomoWidgetProvider.updateAllWidgets(context)
}
```

All other callers (`startTimer`, `pauseTimer`, `skipPhase`, `resetPhase`, `onAlarmFired`) already change phase or running status, so they'll always rebuild - which is correct.

**Step 2: Verify the Android build**

Run: `cd android && ./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL

**Step 3: Commit**

```bash
git add android/app/src/main/java/com/pomo/focustimer/timer/PomoTimerManager.kt
git commit -m "perf: skip redundant notification rebuilds during timer sync"
```

---

### Task 7: Fix AmbientAudioService lifecycle

**Files:**
- Modify: `android/app/src/main/java/com/pomo/focustimer/service/AmbientAudioService.kt`

`START_STICKY` causes Android to restart the service with a null intent if killed, which is wrong for a media playback service controlled by the WebView.

**Step 1: Change to START_NOT_STICKY**

```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(NOTIFICATION_ID, buildNotification())
    return START_NOT_STICKY
}

override fun onDestroy() {
    super.onDestroy()
    stopForeground(STOP_FOREGROUND_REMOVE)
}
```

**Step 2: Verify the Android build**

Run: `cd android && ./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL

**Step 3: Commit**

```bash
git add android/app/src/main/java/com/pomo/focustimer/service/AmbientAudioService.kt
git commit -m "perf: use START_NOT_STICKY for AmbientAudioService, add cleanup"
```

---

### Task 8: Stabilize useAmbientSound hook dependencies

**Files:**
- Modify: `components/ambient-sound-panel.tsx:127-183`

The `stopCurrent` callback is stable (empty deps on `useCallback`), but it's included in the `useEffect` deps at line 168, causing the effect to be a potential re-render trigger if React decides the reference changed. More importantly, the cleanup effect at line 178-182 also depends on `stopCurrent`.

**Step 1: Use a ref for stopCurrent to guarantee stability**

```typescript
export function useAmbientSound(activeSound: AmbientSound, volume: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentSoundRef = useRef<AmbientSound>("none")

  const stopCurrentRef = useRef(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
      audioRef.current = null
    }
  })

  // Handle sound changes
  useEffect(() => {
    if (activeSound === "none") {
      stopCurrentRef.current()
      currentSoundRef.current = "none"
      return
    }

    const soundConfig = AMBIENT_SOUNDS.find((s) => s.id === activeSound)
    if (!soundConfig) return

    // If same sound, just keep playing
    if (currentSoundRef.current === activeSound && audioRef.current) {
      return
    }

    // Stop previous and start new
    stopCurrentRef.current()

    const audio = new Audio(soundConfig.url)
    audio.loop = true
    audio.volume = volume / 100
    audio.play().catch(() => {})
    audioRef.current = audio
    currentSoundRef.current = activeSound
  }, [activeSound]) // volume removed - handled by separate effect

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCurrentRef.current()
    }
  }, [])
}
```

**Step 2: Verify the app builds**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/ambient-sound-panel.tsx
git commit -m "perf: stabilize useAmbientSound hook deps with ref pattern"
```
