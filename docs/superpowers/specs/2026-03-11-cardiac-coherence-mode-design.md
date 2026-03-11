# Cardiac Coherence Mode — Design Spec

## Summary

Add a 4th mode "Breathing" alongside Clock / Pomodoro / Stopwatch. The user performs guided breathing exercises with an animated bubble that rises and inflates (inhale) then descends and deflates (exhale). Haptic feedback on phase changes. Presets + full duration customization.

## Mode Integration

### Type system

Add `"breathing"` to the `Mode` union type in `hooks/use-timer.ts`:

```typescript
export type Mode = "clock" | "pomo" | "stopwatch" | "breathing"
```

Update the `MODES` array in `flip-clock.tsx`:

```typescript
const MODES: Mode[] = ["clock", "pomo", "stopwatch", "breathing"]
```

### Navigation

- Swipe navigation: breathing is the 4th dot (rightmost)
- Mode dots at the top of the screen: 4 dots instead of 3
- Keyboard shortcut: `Digit4` for breathing mode (existing: `Digit1-3`)
- Mode selector in settings: switch from 3-column grid to a scrollable row of chips to accommodate the 4th mode without cramping mobile layout

### Interaction with `use-timer`

`useTimer` is always called unconditionally (React rules of hooks). When mode is `"breathing"`, its `isRunning` and controls are ignored — `flip-clock.tsx` reads from `use-breathing` instead. The `use-breathing` hook exposes the same control interface (`isRunning`, `toggle`, `reset`) so the existing control buttons work without changes.

Changes needed in `use-timer.ts`:
- Add `"breathing"` case in `setMode` callback (no-op: just switches mode, no state to reset)
- `isRunning` derivation stays as-is (returns false for breathing mode, which is correct — breathing's own `isRunning` is used separately)

### Type alignment

The `Mode` type must be used consistently. Update these hardcoded unions:
- `flip-clock.tsx` `handleModeChange` parameter: use imported `Mode` type instead of inline `"clock" | "pomo" | "stopwatch"`
- `settings-panel.tsx` local `type Mode`: remove, import from `use-timer.ts`
- The `MODES as const` array in `flip-clock.tsx` naturally infers the correct literal types when `"breathing"` is added

## Main Screen

- Animated bubble centered in the main content area (replaces the FlipGroup timer and ProgressRing)
- Phase label: "Inhale" / "Exhale" / "Hold" — above the bubble, crossfade between transitions
- Elapsed time counter + completed cycle count — bottom of screen, subtle
- Controls: Play/Pause, Stop/Reset (same control buttons as other modes)
- Active preset indicator ("Relaxation 5/5")
- Task list is hidden in breathing mode (not relevant to breathing exercises)
- Keep-awake is active during breathing sessions (user needs to watch the bubble)

## Bubble — Canvas Rendering

### Visual Composition

- Main circle with radial gradient (theme's colorA → colorB)
- Drop shadow below the bubble (levitation effect)
- Glow halo around the bubble that pulses with breathing (opacity tied to progress)
- Subtle reflection: semi-transparent white arc in upper-left quarter

### Canvas Positioning

Unlike overlay canvases that use `position: absolute; inset: 0` (full-screen), the breathing bubble canvas is a **contained, centered element** within the main content area. It replaces the FlipGroup/ProgressRing in the flex column layout:

- Canvas size: fixed aspect ratio 1:1, width = `min(80vw, 400px)`
- Centered horizontally and vertically in the content area
- Background and overlays (rain, snow, etc.) still render full-screen behind the bubble as usual

### Movement

- **Vertical translation**: bubble traverses ~40% of the canvas height (rises to upper third, descends to lower third)
- **Scale**: radius varies from 0.7x to 1.0x between exhale and inhale
- **Easing**: cubic ease-in-out for both axes
- **Hold phase**: bubble stays in upper position, slight scale oscillation ±2% to show the app is alive

### Theme

- Colors from `colorA` / `colorB` of the active theme — compatible with all 18 themes + custom + Dynamic Colors
- Background and active overlays continue rendering normally behind the bubble
- Respects existing FPS mode (30/60)

### Accessibility

- `aria-live="polite"` region for phase change announcements (screen readers)
- `aria-live="polite"` for cycle counter updates
- `prefers-reduced-motion`: disable vertical translation, keep only the scale animation

## Presets

| Name | Inhale | Exhale | Hold | Use case |
|------|--------|--------|------|----------|
| Relaxation | 5s | 5s | — | Standard cardiac coherence (6 cycles/min) |
| Calming | 4s | 6s | — | Long exhale, parasympathetic activation |
| Energize | 6s | 4s | — | Long inhale, sympathetic activation |

## Custom Configuration

- **Inhale**: slider 2-10s (step 0.5s)
- **Exhale**: slider 2-10s (step 0.5s)
- **Hold**: toggle on/off + slider 1-5s (step 0.5s) — starts at 1s when enabled (0s = same as disabled)
- Real-time preview: small inline preview bubble within the settings panel itself (not the main bubble behind the panel, which would be occluded)

## Session Duration

- **Timed mode**: 1, 2, 3, 5, 10, 15, 20 min (default: 5 min)
- **Free mode**: no limit, counter displayed
- End of session: the current cycle completes entirely (no mid-phase cutoff)
- When the session timer expires mid-cycle, a "Last cycle" indicator appears to inform the user
- Edge case: even if only 1 second remains when a new cycle starts, the full cycle completes before ending

## Haptic Feedback

### Dependency

Install `@capacitor/haptics` as a new dependency. On desktop (Tauri), haptics are a no-op (graceful fallback — check platform before calling).

### Phase feedback

- **Inhale start**: single short impulse (~50ms) — `Haptics.impact({ style: 'Light' })`
- **Exhale start**: double impulse (~30ms + 30ms, 50ms gap) — `Haptics.impact({ style: 'Medium' })`
- **Hold start**: long soft impulse (~100ms) — `Haptics.impact({ style: 'Heavy' })`
- **End of session**: 3 rapid impulses

### Settings

- Toggle haptic on/off in breathing settings
- Default: on (mobile), off (desktop)

## End of Session (Timed Mode)

1. Current cycle completes normally (with "Last cycle" indicator)
2. Bubble fades out smoothly over 1.5s after the last exhale
3. Final haptic (3 rapid impulses)
4. Recap shown inline (replaces the bubble area, same component) for 5s then returns to idle:
   - Total duration
   - Completed cycle count
   - Preset used
   - Tap to dismiss early
5. "Return to idle" = mode stays on "breathing", bubble returns to initial resting state (not running). Mode does NOT switch back to clock.
6. No notification / no end sound — calm spirit

## Pro / Premium Gating

- **Free**: Relaxation preset (5/5) only, timed mode only
- **Pro**: all presets, custom configuration, free mode

## Architecture

### New hook: `hooks/use-breathing.ts`

- State machine: `idle` → `inhale` → `hold` (if enabled) → `exhale` → (loop back to `inhale` | `idle` if session ended)
- **Phase duration tracking**: `setInterval` + `Date.now()` for accurate timing (same pattern as `use-timer.ts`), prevents drift when tab is backgrounded
- **Visual progress**: exposes a `progress` value (0→1) for the current phase, interpolated with ease-in-out — consumed by the canvas for smooth animation
- Exposes: `phase`, `progress`, `cycleCount`, `elapsedTime`, `isRunning`, `toggle()`, `reset()`, `isLastCycle`
- Easing calculation done in hook, not in canvas component

### New component: `components/breathing-bubble.tsx`

- Canvas 2D — follows the existing overlay pattern (DPR-aware sizing, rAF render loop, FPS throttling) but with contained sizing instead of full-screen
- Receives `progress`, `phase`, `isLastCycle` from hook — no timer logic inside
- Draws bubble with: Y position, radius, glow, theme colors
- Handles the fade-out animation at session end
- Includes the phase label text and recap screen rendering

### Integration in `flip-clock.tsx`

- When `mode === "breathing"`: render `breathing-bubble` in place of the FlipGroup/ProgressRing block
- Controls (play/pause/reset) are mapped to `use-breathing` instead of `use-timer`
- Settings panel shows the breathing configuration section
- `keepAwake()` is called when breathing session is running
- Zoomed state is disabled in breathing mode

### Settings in `settings-panel.tsx`

- New section visible only when mode is "breathing"
- Preset chips (Relaxation, Calming, Energize) + Custom option
- Custom mode: sliders for inhale/exhale/hold durations
- Toggle timed/free + duration selector
- Toggle haptic on/off
- Small inline preview bubble in custom mode

### Session Recording

Add `"breathing"` to the phase types in `lib/session-store.ts`. Breathing sessions are tracked in stats:
- Stats panel shows breathing time separately (not mixed with work/break stats)
- No badge integration for now (can be added later)

### Storage

- `usePersistedState` — selected preset, custom values, duration, haptic on/off, timed/free mode

### Background behavior

The mode is purely front-end: the user watches the screen, no need for background timer service or notifications. When the app is backgrounded, the breathing timer **pauses** (the user can't see the bubble). The existing lifecycle handler in `flip-clock.tsx` already returns early for non-pomo modes, so this works automatically. On resume, the session continues from where it paused.

### Onboarding

During onboarding (not completed), mode is forced to "pomo". Breathing mode is not accessible until onboarding is done. No special handling needed — the existing forced-pomo pattern covers this.
