# Deep Work Mode — Design Spec

## Summary

Add a 5th mode "Deep Work" alongside Clock / Pomodoro / Stopwatch / Breathing. The user performs long, uninterrupted focus sessions with an animated flame that grows through 8 stages as the session progresses. Pauses are allowed but tracked transparently in the session recap. No score, no gamification — the duration and stats speak for themselves.

## Mode Integration

### Type system

Add `"deepwork"` to the `Mode` union type in `hooks/use-timer.ts`:

```typescript
export type Mode = "clock" | "pomo" | "stopwatch" | "breathing" | "deepwork"
```

Update the `MODES` array in `flip-clock.tsx`:

```typescript
const MODES: Mode[] = ["clock", "pomo", "stopwatch", "breathing", "deepwork"]
```

### Navigation

- Swipe navigation: deep work is the 5th dot (rightmost)
- Mode dots at the top of the screen: 5 dots instead of 4
- Keyboard shortcut: `Digit5` for deep work mode
- Mode selector in settings: switch from `grid-cols-4` to a scrollable horizontal `flex` row with `overflow-x-auto` and `gap-1.5`, each pill has a minimum width. Accommodates 5+ modes without cramping mobile layout.
- Label in the selector: **"Deep"** (short, consistent with "Pomo", "Timer", "Breathe")

### Interaction with `use-timer`

Same pattern as Breathing: `useTimer` is always called unconditionally. When mode is `"deepwork"`, its `isRunning` and controls are ignored — `flip-clock.tsx` reads from `use-deep-work` instead. The `use-deep-work` hook exposes the same control interface (`isRunning`, `toggle`, `reset`) so the existing control buttons work without changes.

Changes needed in `use-timer.ts`:
- Add `"deepwork"` case in `setMode` callback (no-op: just switches mode)

### Type alignment

The `Mode` type must be used consistently everywhere it was updated for Breathing.

## Main Screen

- Animated flame centered in the main content area (replaces the FlipGroup timer and ProgressRing)
- Stage label above the flame: "Spark" / "Kindling" / "Warming up" / etc. — crossfade between transitions
- Elapsed time counter + task name — bottom of screen, subtle
- Controls: Play/Pause, Reset (same control buttons as other modes). No Skip button.
- Task input visible (unlike Breathing where it's hidden)
- Keep-awake active during sessions
- Zen mode compatible

## Flame — Canvas Rendering

### Visual Composition

- Main flame built with multiple sinusoidal wave layers, colored with theme's `colorA` → `colorB`
- Spark particles rising from the flame tip (small circles with fade-out)
- Glow halo at the base of the flame that pulses
- Drop shadow below the flame base

### Canvas Positioning

Same pattern as Breathing bubble: the flame canvas is a **contained, centered element** within the main content area. It replaces the FlipGroup/ProgressRing in the flex column layout:

- Canvas size: fixed aspect ratio 1:1, width = `min(80vw, 400px)`
- Centered horizontally and vertically in the content area
- Background and overlays (rain, snow, etc.) still render full-screen behind the flame as usual

### 8 Stages of Flame Progression

| Stage | % (timed) | Free (ref 120min) | Label | Visual |
|-------|-----------|-------------------|-------|--------|
| 1 | 0-12% | 0-15 min | Spark | Small flickering spark, almost no glow |
| 2 | 12-25% | 15-30 min | Kindling | Small fragile flame, slight movement, few particles |
| 3 | 25-37% | 30-45 min | Warming up | Stable flame, visible glow, regular particles |
| 4 | 37-50% | 45-60 min | Building | Medium flame, fluid movement, more vivid colors |
| 5 | 50-62% | 60-75 min | Focused | Large flame, many particles, intense glow |
| 6 | 62-75% | 75-90 min | Deep focus | Wide and tall flame, rapid oscillations |
| 7 | 75-87% | 90-105 min | Blazing | Maximum flame, abundant sparks, luminous halo |
| 8 | 87-100% | 105-120 min | Inferno | Peak flame, powerful pulsation, cascading particles |

In free mode, the flame reaches "Inferno" at 120 min and stays stable thereafter.

### Movement

- **Wave oscillation**: multiple sine waves control the flame's edge, frequency and amplitude increase with stage
- **Particle emission rate**: scales from ~2/sec (Spark) to ~20/sec (Inferno)
- **Glow intensity**: scales from 0.05 alpha (Spark) to 0.4 alpha (Inferno)
- **Color saturation**: theme colors become more vivid at higher stages

### Theme

- Colors from `colorA` / `colorB` of the active theme — compatible with all themes + custom + Dynamic Colors
- Background and active overlays continue rendering normally behind the flame
- Respects existing FPS mode (30/60)

### Accessibility

- `aria-live="polite"` region for stage change announcements (screen readers)
- `prefers-reduced-motion`: reduce particle count and wave speed, keep the static flame shape

## Controls and Behavior

### Pause

- Timer stops, flame freezes (no animation but flame remains displayed)
- Internal pause counter increments
- Pause duration tracked separately
- No friction dialog — just pause/resume transparently

### End of Session (Timed Mode)

1. Flame does a final burst animation (bright flash, 1.5s)
2. Haptic feedback (3 rapid impulses, same as Breathing)
3. End sound plays (if sound enabled)
4. Recap shown inline (replaces the flame area):
   - Total duration
   - Number of pauses + total pause duration
   - Max stage reached
   - Task name
   - "Tap to dismiss" (auto-dismiss after 5s)
5. Return to idle: mode stays on "deepwork", flame returns to unlit state

### End of Session (Free Mode)

- User presses Reset to end the session
- Same recap as timed mode

### Canvas Mounting

Canvas is always mounted in the DOM (hidden with CSS `display: none` during recap, not unmounted). This prevents the resize/ref loss bug discovered in Breathing mode.

## Session Duration

- **Timed mode**: 45, 60, 90, 120 min (grid 2x2 in settings)
- **Free mode**: no limit, elapsed time displayed
- Default: timed, 60 min

## Haptic Feedback

Reuses `@capacitor/haptics` already installed.

### Feedback events

- **Stage change**: single light impulse — `Haptics.impact({ style: 'Light' })`
- **End of session**: 3 rapid impulses (same pattern as Breathing)
- Desktop: graceful no-op

### Settings

- Toggle haptic on/off in deep work settings
- Default: on (mobile), off (desktop)

## Settings Panel

New section visible only when mode is `"deepwork"`:

- Toggle Timed / Free (same UI pattern as Breathing)
- Duration buttons: 45, 60, 90, 120 min (grid 2x2)
- Haptic toggle

No other configuration. Deep Work is deliberately simple.

## Stats

### Session Recording

Add `"deepwork"` to the phase types in `lib/session-store.ts`:

```typescript
phase: "work" | "shortBreak" | "longBreak" | "breathing" | "deepwork"
```

Deep work sessions record:
- Duration (total elapsed, excluding pause time)
- Task name
- Pause count
- Total pause duration

### Stats Panel

Section "Deep Work" (same pattern as "Breathing" section):
- Total time
- Session count
- Average session duration
- Longest session

Deep work stats are separate from Pomo work stats.

## Pro / Premium Gating

- Deep Work mode is **free** — no Pro gating on any feature
- All durations, free mode, and haptic toggle are available to all users

## Architecture

### New hook: `hooks/use-deep-work.ts`

- State machine: `idle` → `running` → `paused` → `running` → `complete`
- Drift-resistant timing with `setInterval` + `Date.now()` (same pattern as `use-breathing.ts`)
- Ref-based state to avoid stale closures in intervals
- Stable `toggle`/`reset` callbacks via ref pattern
- Tracks: `elapsedTime`, `pauseCount`, `totalPauseTime`, `stage` (1-8), `isRunning`, `isComplete`, `maxStageReached`
- Stage computed from progress (elapsed / total duration in timed, elapsed / 7200s in free)
- Exposes: `elapsedTime`, `pauseCount`, `totalPauseTime`, `stage`, `progress`, `isRunning`, `toggle()`, `reset()`, `isComplete`, `maxStageReached`

### New component: `components/deep-work-flame.tsx`

- Canvas 2D — follows the breathing-bubble pattern (DPR-aware sizing, rAF render loop, FPS throttling, contained sizing)
- Receives `stage`, `progress`, `isComplete`, `colorA`, `colorB` from hook — no timer logic inside
- Draws flame with: sine wave layers, particle system, glow, theme colors
- Stage label rendered as HTML above the canvas (not drawn on canvas)
- RecapScreen sub-component (same pattern as breathing-bubble.tsx)
- Canvas always mounted (display: none during recap)

### Integration in `flip-clock.tsx`

- When `mode === "deepwork"`: render `DeepWorkFlame` in place of FlipGroup/ProgressRing
- Controls (play/pause/reset) mapped to `use-deep-work`
- Settings panel shows deep work configuration section
- `keepAwake()` called when deep work session is running
- Zoomed state disabled in deep work mode
- Session recorded on completion via `prevDeepWorkComplete` ref pattern (same as Breathing)

### Modified files

- `hooks/use-timer.ts` — Add `"deepwork"` to Mode type
- `components/flip-clock.tsx` — Deep work integration
- `components/settings-panel.tsx` — Scrollable mode selector (5 modes) + deep work settings section
- `hooks/use-keyboard-shortcuts.ts` — `Digit5` for deep work
- `lib/session-store.ts` — Phase `"deepwork"` + `getDeepWorkStats()`
- `components/stats-panel.tsx` — "Deep Work" section with KPIs
- `components/onboarding-overlay.tsx` — Update tutorial to mention Deep Work mode

### Storage

- `usePersistedState` — timed/free toggle, selected duration, haptic on/off

### No new dependencies

Haptics reuses `@capacitor/haptics`. No other new packages needed.

### Background behavior

Same as Breathing: purely front-end. When the app is backgrounded, the deep work timer **continues** (unlike Breathing where the user needs to watch the bubble). The elapsed time is drift-corrected on resume via `Date.now()` comparison. This is the key difference from Breathing's pause-on-background behavior.

### Onboarding

During onboarding (not completed), mode is forced to "pomo". Deep Work is not accessible until onboarding is done. The existing forced-pomo pattern covers this.
