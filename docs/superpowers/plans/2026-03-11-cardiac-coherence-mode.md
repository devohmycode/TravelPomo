# Cardiac Coherence Breathing Mode — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th "Breathing" mode with an animated bubble for cardiac coherence exercises.

**Architecture:** New `use-breathing` hook (state machine + interval timer) drives a `breathing-bubble` canvas component. Integrates into existing mode system in `flip-clock.tsx`. Settings section in `settings-panel.tsx` with presets + custom config. Haptics via `@capacitor/haptics`.

**Tech Stack:** React 19, Canvas 2D, TypeScript, Capacitor Haptics, usePersistedState

**Spec:** `docs/superpowers/specs/2026-03-11-cardiac-coherence-mode-design.md`

---

## Chunk 1: Foundation — Type System & Mode Integration

### Task 1: Add `"breathing"` to Mode type and update `use-timer.ts`

**Files:**
- Modify: `hooks/use-timer.ts:17` (Mode type)
- Modify: `hooks/use-timer.ts:186-201` (setMode callback)

- [ ] **Step 1: Update Mode type**

In `hooks/use-timer.ts`, line 17, change:

```typescript
export type Mode = "clock" | "pomo" | "stopwatch" | "breathing"
```

- [ ] **Step 2: Add breathing case in setMode**

In `hooks/use-timer.ts`, inside the `setMode` callback (after the stopwatch block, ~line 198), add:

```typescript
// breathing mode has no timer state to reset in use-timer
```

No actual reset logic needed — the `setMode` callback just needs to not break when receiving `"breathing"`. The current code already handles this since there's no `if (newMode === "breathing")` block, it just sets the mode. But we need the type to accept it.

- [ ] **Step 3: Verify build compiles**

Run: `cd C:/dev/Pomo && npx tsc --noEmit 2>&1 | head -20`

Expected: Type errors in `settings-panel.tsx` and `flip-clock.tsx` where `Mode` is hardcoded — this is expected and will be fixed in the next tasks.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-timer.ts
git commit -m "feat(breathing): add breathing to Mode type"
```

---

### Task 2: Fix type alignment in settings-panel.tsx

**Files:**
- Modify: `components/settings-panel.tsx:8` (remove local Mode type)
- Modify: `components/settings-panel.tsx:1` (add import)

- [ ] **Step 1: Replace local Mode type with import**

In `components/settings-panel.tsx`, remove line 8:

```typescript
type Mode = "clock" | "pomo" | "stopwatch"
```

Add import at top:

```typescript
import type { Mode } from "@/hooks/use-timer"
```

- [ ] **Step 2: Verify build compiles**

Run: `cd C:/dev/Pomo && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors in settings-panel.tsx. May still have errors in flip-clock.tsx.

- [ ] **Step 3: Commit**

```bash
git add components/settings-panel.tsx
git commit -m "refactor: import Mode type from use-timer in settings-panel"
```

---

### Task 3: Fix type alignment in flip-clock.tsx

**Files:**
- Modify: `components/flip-clock.tsx:244-250` (handleModeChange type)
- Modify: `components/flip-clock.tsx:501` (MODES array)

- [ ] **Step 1: Update handleModeChange parameter type**

In `components/flip-clock.tsx`, line 244-245, change:

```typescript
const handleModeChange = useCallback(
    (mode: "clock" | "pomo" | "stopwatch") => {
```

to:

```typescript
import type { Mode } from "@/hooks/use-timer"
// ... (already imported via useTimer, just use the type)

const handleModeChange = useCallback(
    (mode: Mode) => {
```

Note: `Mode` is already available since `useTimer` is imported from `@/hooks/use-timer`. Add `type { Mode }` to the existing import if not already there:

```typescript
import { useTimer, type Mode } from "@/hooks/use-timer"
```

- [ ] **Step 2: Update MODES array**

In `components/flip-clock.tsx`, line 501, change:

```typescript
const MODES = ["clock", "pomo", "stopwatch"] as const
```

to:

```typescript
const MODES: Mode[] = ["clock", "pomo", "stopwatch", "breathing"]
```

- [ ] **Step 3: Update mode label in settings-panel.tsx**

In `components/settings-panel.tsx`, line 158, update the mode label:

```typescript
{mode === "clock" ? "Clock" : mode === "pomo" ? "Pomodoro" : mode === "breathing" ? "Breathing" : "Stopwatch"}
```

- [ ] **Step 4: Verify build compiles**

Run: `cd C:/dev/Pomo && npx tsc --noEmit 2>&1 | head -20`

Expected: PASS — no type errors.

- [ ] **Step 5: Commit**

```bash
git add components/flip-clock.tsx components/settings-panel.tsx
git commit -m "refactor: use Mode type consistently, add breathing to MODES array"
```

---

### Task 4: Add Digit4 keyboard shortcut

**Files:**
- Modify: `hooks/use-keyboard-shortcuts.ts:48-56`

- [ ] **Step 1: Add Digit4 case**

In `hooks/use-keyboard-shortcuts.ts`, after the `case "Digit3"` block (~line 56), add:

```typescript
        case "Digit4":
          config.onSetMode("breathing")
          break
```

- [ ] **Step 2: Verify build compiles**

Run: `cd C:/dev/Pomo && npx tsc --noEmit 2>&1 | head -20`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add hooks/use-keyboard-shortcuts.ts
git commit -m "feat(breathing): add Digit4 keyboard shortcut for breathing mode"
```

---

## Chunk 2: Breathing Hook — Core Logic

### Task 5: Create `use-breathing.ts` hook

**Files:**
- Create: `hooks/use-breathing.ts`

**Key design decisions (from review):**
- Use refs for all mutable state in the interval to avoid stale closures
- Track `pausedPhaseElapsed` to handle pause/resume without progress jumps
- Check `isLastCycle` at cycle boundaries (exhale→inhale), not mid-phase
- Accept config as parameter (not internal state) for immediate updates
- Expose stable refs for toggle/reset to avoid re-render cascades

- [ ] **Step 1: Create the breathing hook**

Create `hooks/use-breathing.ts`:

```typescript
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { isNativePlatform, isTauriPlatform } from "@/lib/platform"

export type BreathingPhase = "idle" | "inhale" | "hold" | "exhale"

export interface BreathingPreset {
  name: string
  inhale: number // seconds
  exhale: number // seconds
  hold: number // seconds, 0 = no hold
}

export const BREATHING_PRESETS: BreathingPreset[] = [
  { name: "Relaxation", inhale: 5, exhale: 5, hold: 0 },
  { name: "Calming", inhale: 4, exhale: 6, hold: 0 },
  { name: "Energize", inhale: 6, exhale: 4, hold: 0 },
]

export interface BreathingConfig {
  inhale: number
  exhale: number
  hold: number // 0 = disabled
  timedMode: boolean
  durationMinutes: number
  hapticEnabled: boolean
}

export const DEFAULT_BREATHING_CONFIG: BreathingConfig = {
  inhale: 5,
  exhale: 5,
  hold: 0,
  timedMode: true,
  durationMinutes: 5,
  hapticEnabled: !isTauriPlatform(),
}

// Cubic ease-in-out
function easeInOut(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export interface BreathingState {
  phase: BreathingPhase
  progress: number // 0-1, eased
  rawProgress: number // 0-1, linear
  cycleCount: number
  elapsedTime: number // seconds
  isRunning: boolean
  isLastCycle: boolean
  isComplete: boolean // session ended (recap phase)
  totalDuration: number // final duration when complete
  totalCycles: number // final cycle count when complete
  toggle: () => void
  reset: () => void
}

async function triggerHaptic(style: "Light" | "Medium" | "Heavy"): Promise<void> {
  if (isTauriPlatform()) return
  if (!isNativePlatform()) return
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics")
    const styleMap = {
      Light: ImpactStyle.Light,
      Medium: ImpactStyle.Medium,
      Heavy: ImpactStyle.Heavy,
    }
    await Haptics.impact({ style: styleMap[style] })
  } catch {
    // haptics not available
  }
}

async function triggerEndHaptic(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await triggerHaptic("Medium")
    if (i < 2) await new Promise((r) => setTimeout(r, 100))
  }
}

export function useBreathing(config: BreathingConfig): BreathingState {
  const [phase, setPhase] = useState<BreathingPhase>("idle")
  const [rawProgress, setRawProgress] = useState(0)
  const [cycleCount, setCycleCount] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isLastCycle, setIsLastCycle] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [totalDuration, setTotalDuration] = useState(0)
  const [totalCycles, setTotalCycles] = useState(0)

  // All mutable state in refs to avoid stale closures in interval
  const phaseRef = useRef<BreathingPhase>("idle")
  const phaseStartRef = useRef<number>(0)
  const sessionStartRef = useRef<number>(0)
  const cycleCountRef = useRef(0)
  const isLastCycleRef = useRef(false)
  const configRef = useRef(config)
  configRef.current = config

  // Track elapsed time within phase at pause for correct resume
  const pausedPhaseElapsedRef = useRef(0)

  function getNextPhase(current: BreathingPhase, c: BreathingConfig): BreathingPhase {
    if (current === "inhale") return c.hold > 0 ? "hold" : "exhale"
    if (current === "hold") return "exhale"
    return "inhale"
  }

  function getPhaseDuration(p: BreathingPhase, c: BreathingConfig): number {
    if (p === "inhale") return c.inhale
    if (p === "exhale") return c.exhale
    if (p === "hold") return c.hold
    return 0
  }

  // Single interval — reads all state from refs, no stale closure issues
  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      const now = Date.now()
      const c = configRef.current
      const currentPhase = phaseRef.current

      if (currentPhase === "idle") return

      const phaseDur = getPhaseDuration(currentPhase, c)
      const elapsed = (now - phaseStartRef.current) / 1000
      const progress = Math.min(1, elapsed / phaseDur)

      setRawProgress(progress)

      // Update session elapsed time
      const sessionElapsed = Math.floor((now - sessionStartRef.current) / 1000)
      setElapsedTime(sessionElapsed)

      // Phase complete — advance
      if (progress >= 1) {
        // If exhale just ended, that completes a cycle
        if (currentPhase === "exhale") {
          const newCount = cycleCountRef.current + 1
          cycleCountRef.current = newCount
          setCycleCount(newCount)

          // Check if session is over (timed mode, after cycle completes)
          const totalSessionSeconds = c.durationMinutes * 60
          const currentSessionElapsed = (now - sessionStartRef.current) / 1000
          if (c.timedMode && currentSessionElapsed >= totalSessionSeconds) {
            setIsRunning(false)
            phaseRef.current = "idle"
            setPhase("idle")
            setIsComplete(true)
            setTotalDuration(Math.floor(currentSessionElapsed))
            setTotalCycles(newCount)
            if (c.hapticEnabled) triggerEndHaptic()
            return
          }

          // Check isLastCycle for the NEXT cycle (at cycle boundary)
          if (c.timedMode && !isLastCycleRef.current) {
            const remainingTime = totalSessionSeconds - currentSessionElapsed
            const cycleDuration = c.inhale + (c.hold > 0 ? c.hold : 0) + c.exhale
            if (remainingTime <= cycleDuration) {
              isLastCycleRef.current = true
              setIsLastCycle(true)
            }
          }
        }

        const nextPhase = getNextPhase(currentPhase, c)
        phaseRef.current = nextPhase
        phaseStartRef.current = Date.now()
        pausedPhaseElapsedRef.current = 0
        setPhase(nextPhase)
        setRawProgress(0)

        // Haptic feedback on phase change
        if (c.hapticEnabled) {
          if (nextPhase === "inhale") triggerHaptic("Light")
          else if (nextPhase === "exhale") {
            triggerHaptic("Medium").then(() =>
              setTimeout(() => triggerHaptic("Medium"), 80)
            )
          }
          else if (nextPhase === "hold") triggerHaptic("Heavy")
        }
      }
    }, 50) // 20x/sec for smooth progress

    return () => clearInterval(interval)
  }, [isRunning]) // Only depends on isRunning — all other state via refs

  // Stable toggle via ref pattern
  const toggleRef = useRef<() => void>(() => {})
  toggleRef.current = () => {
    if (isComplete) {
      setIsComplete(false)
      return
    }

    if (isRunning) {
      // Pause — save how far into phase we are
      pausedPhaseElapsedRef.current = (Date.now() - phaseStartRef.current) / 1000
      setIsRunning(false)
    } else {
      if (phaseRef.current === "idle") {
        // Fresh start
        phaseRef.current = "inhale"
        setPhase("inhale")
        setCycleCount(0)
        cycleCountRef.current = 0
        setElapsedTime(0)
        setIsLastCycle(false)
        isLastCycleRef.current = false
        setIsComplete(false)
        sessionStartRef.current = Date.now()
        phaseStartRef.current = Date.now()
        pausedPhaseElapsedRef.current = 0
        if (config.hapticEnabled) triggerHaptic("Light")
      } else {
        // Resume — offset phaseStart to account for already-elapsed time
        phaseStartRef.current = Date.now() - pausedPhaseElapsedRef.current * 1000
      }
      setIsRunning(true)
    }
  }
  const toggle = useCallback(() => toggleRef.current(), [])

  const resetRef = useRef<() => void>(() => {})
  resetRef.current = () => {
    setIsRunning(false)
    phaseRef.current = "idle"
    setPhase("idle")
    setRawProgress(0)
    setCycleCount(0)
    cycleCountRef.current = 0
    setElapsedTime(0)
    setIsLastCycle(false)
    isLastCycleRef.current = false
    setIsComplete(false)
    setTotalDuration(0)
    setTotalCycles(0)
    pausedPhaseElapsedRef.current = 0
  }
  const reset = useCallback(() => resetRef.current(), [])

  const progress = easeInOut(rawProgress)

  return {
    phase,
    progress,
    rawProgress,
    cycleCount,
    elapsedTime,
    isRunning,
    isLastCycle,
    isComplete,
    totalDuration,
    totalCycles,
    toggle,
    reset,
  }
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd C:/dev/Pomo && npx tsc --noEmit 2>&1 | head -20`

Expected: PASS (hook is standalone, no consumers yet). May warn about `@capacitor/haptics` not installed — that's expected and handled in Task 6.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-breathing.ts
git commit -m "feat(breathing): add use-breathing hook with state machine and timer"
```

---

### Task 6: Install @capacitor/haptics

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run: `cd C:/dev/Pomo && pnpm add @capacitor/haptics`

- [ ] **Step 2: Verify it installed**

Run: `cd C:/dev/Pomo && cat package.json | grep haptics`

Expected: `"@capacitor/haptics": "^X.X.X"`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install @capacitor/haptics for breathing mode"
```

---

## Chunk 3: Breathing Bubble Canvas Component

### Task 7: Create `breathing-bubble.tsx`

**Files:**
- Create: `components/breathing-bubble.tsx`

- [ ] **Step 1: Create the canvas component**

Create `components/breathing-bubble.tsx`:

```typescript
"use client"

import { useEffect, useRef, useCallback } from "react"
import type { BreathingPhase } from "@/hooks/use-breathing"

interface BreathingBubbleProps {
  phase: BreathingPhase
  progress: number // 0-1 eased
  isLastCycle: boolean
  isComplete: boolean
  isRunning: boolean
  cycleCount: number
  elapsedTime: number
  totalDuration: number
  totalCycles: number
  presetName: string
  colorA: string
  colorB: string
  fpsMode: "30" | "60"
  onDismissRecap?: () => void
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

const PHASE_LABELS: Record<BreathingPhase, string> = {
  idle: "",
  inhale: "Inhale",
  hold: "Hold",
  exhale: "Exhale",
}

// Check reduced motion preference
const prefersReducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false

export function BreathingBubble({
  phase,
  progress,
  isLastCycle,
  isComplete,
  isRunning,
  cycleCount,
  elapsedTime,
  totalDuration,
  totalCycles,
  presetName,
  colorA,
  colorB,
  fpsMode,
  onDismissRecap,
}: BreathingBubbleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)
  const fadeRef = useRef(1) // for end-of-session fade-out
  const prevPhaseRef = useRef<BreathingPhase>("idle")

  // Animate bubble
  const draw = useCallback(() => {
    const now = Date.now()
    const frameMs = fpsMode === "30" ? 33 : 16
    if (now - lastFrameRef.current < frameMs) {
      rafRef.current = requestAnimationFrame(draw)
      return
    }
    lastFrameRef.current = now

    const canvas = canvasRef.current
    if (!canvas) {
      rafRef.current = requestAnimationFrame(draw)
      return
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = canvas.width / (window.devicePixelRatio || 1)
    const h = canvas.height / (window.devicePixelRatio || 1)
    const cx = w / 2
    const cy = h / 2

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Fade-out at session end
    if (isComplete && fadeRef.current > 0) {
      fadeRef.current = Math.max(0, fadeRef.current - 0.02)
    } else if (!isComplete) {
      fadeRef.current = 1
    }

    if (isComplete && fadeRef.current <= 0) {
      // Don't draw bubble during recap
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const globalAlpha = fadeRef.current

    // Calculate bubble position and size
    const baseRadius = w * 0.18
    const minScale = 0.7
    const maxScale = 1.0

    let scale: number
    let yOffset: number

    if (phase === "idle" && !isComplete) {
      // Resting state: centered, medium size, gentle pulse
      const pulse = Math.sin(now / 2000 * Math.PI) * 0.02
      scale = 0.85 + pulse
      yOffset = 0
    } else if (phase === "inhale") {
      scale = minScale + (maxScale - minScale) * progress
      yOffset = prefersReducedMotion ? 0 : -(h * 0.2) * progress
    } else if (phase === "hold") {
      scale = maxScale + Math.sin(now / 500 * Math.PI) * 0.02
      yOffset = prefersReducedMotion ? 0 : -(h * 0.2)
    } else if (phase === "exhale") {
      scale = maxScale - (maxScale - minScale) * progress
      yOffset = prefersReducedMotion ? 0 : -(h * 0.2) * (1 - progress)
    } else {
      scale = 0.85
      yOffset = 0
    }

    const radius = baseRadius * scale
    const bubbleX = cx
    const bubbleY = cy + yOffset

    ctx.save()
    ctx.globalAlpha = globalAlpha

    // Drop shadow (radial gradient instead of ctx.filter for Android WebView compat)
    const shadowGrad = ctx.createRadialGradient(
      bubbleX, bubbleY + radius * 0.3, 0,
      bubbleX, bubbleY + radius * 0.3, radius * 0.9
    )
    shadowGrad.addColorStop(0, "rgba(0,0,0,0.12)")
    shadowGrad.addColorStop(1, "rgba(0,0,0,0)")
    ctx.beginPath()
    ctx.arc(bubbleX, bubbleY + radius * 0.3, radius * 0.9, 0, Math.PI * 2)
    ctx.fillStyle = shadowGrad
    ctx.fill()

    // Glow halo
    const glowAlpha = phase === "inhale" ? 0.1 + progress * 0.2
      : phase === "exhale" ? 0.3 - progress * 0.2
      : phase === "hold" ? 0.3
      : 0.15
    const glowGrad = ctx.createRadialGradient(
      bubbleX, bubbleY, radius,
      bubbleX, bubbleY, radius * 1.6
    )
    glowGrad.addColorStop(0, hexToRgba(colorA, glowAlpha))
    glowGrad.addColorStop(1, hexToRgba(colorA, 0))
    ctx.beginPath()
    ctx.arc(bubbleX, bubbleY, radius * 1.6, 0, Math.PI * 2)
    ctx.fillStyle = glowGrad
    ctx.fill()

    // Main bubble with radial gradient
    const grad = ctx.createRadialGradient(
      bubbleX - radius * 0.3, bubbleY - radius * 0.3, radius * 0.1,
      bubbleX, bubbleY, radius
    )
    grad.addColorStop(0, colorA)
    grad.addColorStop(1, colorB)
    ctx.beginPath()
    ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    // Subtle reflection (upper-left arc)
    ctx.beginPath()
    ctx.arc(
      bubbleX - radius * 0.25,
      bubbleY - radius * 0.25,
      radius * 0.55,
      Math.PI * 1.2,
      Math.PI * 1.8
    )
    ctx.strokeStyle = "rgba(255,255,255,0.25)"
    ctx.lineWidth = radius * 0.08
    ctx.lineCap = "round"
    ctx.stroke()

    ctx.restore()

    rafRef.current = requestAnimationFrame(draw)
  }, [phase, progress, isComplete, colorA, colorB, fpsMode])

  // Canvas setup and resize
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      const size = Math.min(rect.width, rect.height)
      canvas.width = size * dpr
      canvas.height = size * dpr
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
      const ctx = canvas.getContext("2d")
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener("resize", resize)
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [draw])

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Phase label */}
      {phase !== "idle" && !isComplete && (
        <span
          className="text-white/70 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full transition-opacity duration-500"
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
          }}
          aria-live="polite"
        >
          {PHASE_LABELS[phase]}
          {isLastCycle && " · Last cycle"}
        </span>
      )}

      {/* Preset indicator when idle */}
      {phase === "idle" && !isComplete && !isRunning && (
        <span
          className="text-white/50 text-xs font-medium uppercase tracking-wider"
        >
          {presetName}
        </span>
      )}

      {/* Canvas container */}
      {!isComplete ? (
        <div
          ref={containerRef}
          className="relative"
          style={{
            width: "min(80vw, 400px)",
            height: "min(80vw, 400px)",
          }}
        >
          <canvas
            ref={canvasRef}
            className="block"
            aria-hidden="true"
          />
        </div>
      ) : (
        // Recap screen — auto-dismiss after 5s, or tap to dismiss early
        <RecapScreen
          totalDuration={totalDuration}
          totalCycles={totalCycles}
          presetName={presetName}
          onDismiss={onDismissRecap}
        />
      )}
```

Add `RecapScreen` as a sub-component at the top of the file:

```typescript
function RecapScreen({
  totalDuration,
  totalCycles,
  presetName,
  onDismiss,
}: {
  totalDuration: number
  totalCycles: number
  presetName: string
  onDismiss?: () => void
}) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => onDismiss?.(), 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
        <div
          className="flex flex-col items-center gap-3 animate-in fade-in duration-500 cursor-pointer"
          onClick={onDismiss}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onDismiss?.()}
        >
          <div
            className="rounded-2xl px-8 py-6 flex flex-col items-center gap-2"
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(16px)",
            }}
          >
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Session Complete</p>
            <p className="text-white text-2xl font-semibold">{formatTime(totalDuration)}</p>
            <p className="text-white/60 text-sm">{totalCycles} cycles · {presetName}</p>
          </div>
          <p className="text-white/30 text-xs">Tap to dismiss</p>
        </div>
      )}

      {/* Elapsed time and cycle count */}
      {phase !== "idle" && !isComplete && (
        <div className="flex items-center gap-3 text-white/40 text-xs" aria-live="polite">
          <span>{formatTime(elapsedTime)}</span>
          <span>·</span>
          <span>{cycleCount} {cycleCount === 1 ? "cycle" : "cycles"}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd C:/dev/Pomo && npx tsc --noEmit 2>&1 | head -20`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/breathing-bubble.tsx
git commit -m "feat(breathing): add breathing-bubble canvas component"
```

---

## Chunk 4: Integration into flip-clock.tsx

### Task 8: Wire up breathing mode in flip-clock.tsx

**Files:**
- Modify: `components/flip-clock.tsx`

- [ ] **Step 1: Add imports**

At the top of `components/flip-clock.tsx`, add:

```typescript
import { BreathingBubble } from "./breathing-bubble"
import { useBreathing, BREATHING_PRESETS, type BreathingConfig } from "@/hooks/use-breathing"
```

- [ ] **Step 2: Add breathing hook and persisted state**

After the existing `usePersistedState` declarations (~line 129), add:

```typescript
const [breathingPresetIndex, setBreathingPresetIndex] = usePersistedState("pomo-breathing-preset", 0)
const [breathingCustomConfig, setBreathingCustomConfig] = usePersistedState<BreathingConfig>("pomo-breathing-config", {
  inhale: 5, exhale: 5, hold: 0, timedMode: true, durationMinutes: 5, hapticEnabled: true,
})
const [breathingTimedMode, setBreathingTimedMode] = usePersistedState("pomo-breathing-timed", true)
const [breathingDuration, setBreathingDuration] = usePersistedState("pomo-breathing-duration", 5)
const [breathingHaptic, setBreathingHaptic] = usePersistedState("pomo-breathing-haptic", true)
```

After the `const timer = useTimer(use24Hour)` line (~line 187), add:

```typescript
// Compute breathing config from persisted settings (direct, no effect sync delay)
const breathingConfig: BreathingConfig = useMemo(() => {
  const preset = breathingPresetIndex >= 0 && breathingPresetIndex < BREATHING_PRESETS.length
    ? BREATHING_PRESETS[breathingPresetIndex]
    : null
  return {
    inhale: preset ? preset.inhale : breathingCustomConfig.inhale,
    exhale: preset ? preset.exhale : breathingCustomConfig.exhale,
    hold: preset ? preset.hold : breathingCustomConfig.hold,
    timedMode: breathingTimedMode,
    durationMinutes: breathingDuration,
    hapticEnabled: breathingHaptic,
  }
}, [breathingPresetIndex, breathingCustomConfig, breathingTimedMode, breathingDuration, breathingHaptic])

const breathing = useBreathing(breathingConfig)
```

Add `useMemo` to the React imports at top and `BreathingConfig` to the `use-breathing` imports.

- [ ] **Step 3: Compute effective isRunning and controls for breathing mode**

After the breathing hook, add:

```typescript
// Effective running state (combines timer + breathing)
const effectiveIsRunning = timer.mode === "breathing" ? breathing.isRunning : timer.isRunning

// Effective toggle/reset — breathing.toggle and breathing.reset are stable refs (never change)
const effectiveToggle = useCallback(() => {
  if (timer.mode === "breathing") {
    breathing.toggle()
  } else {
    timer.toggleRunning()
  }
}, [timer.mode, breathing.toggle, timer.toggleRunning])

const effectiveReset = useCallback(() => {
  if (timer.mode === "breathing") {
    breathing.reset()
  } else {
    handleReset()
  }
}, [timer.mode, breathing.reset, handleReset])
```

- [ ] **Step 5: Update keep-awake to use effectiveIsRunning**

Change the keep-awake effect (~line 388) from:

```typescript
if (timer.isRunning) {
```

to:

```typescript
if (effectiveIsRunning) {
```

And update the dependency array to `[effectiveIsRunning]`.

- [ ] **Step 6: Update button controls to use effective actions**

In the buttons section:

1. Play/Pause button (~line 940): change `onClick={timer.toggleRunning}` to `onClick={effectiveToggle}`
2. Play/Pause aria-label (~line 941): change `timer.isRunning` to `effectiveIsRunning`
3. Play/Pause ring style (~line 942-945): change `timer.isRunning` to `effectiveIsRunning`
4. Timer icon style (~line 949-951): change `timer.isRunning` to `effectiveIsRunning`
5. Reset button (~line 927): change `onClick={handleReset}` to `onClick={effectiveReset}`
6. Show Reset and Play/Pause buttons for breathing mode too: the condition `timer.mode !== "clock"` already works since `"breathing" !== "clock"`.

- [ ] **Step 7: Hide skip button in breathing mode**

Change the skip button condition (~line 957) from:

```typescript
{!zoomed && timer.mode === "pomo" && (
```

to:

```typescript
{!zoomed && timer.mode === "pomo" && !breathing.isComplete && (
```

Actually, skip is pomo-only, so it's already correct. No change needed.

- [ ] **Step 8: Render BreathingBubble when in breathing mode**

In the main display area, inside the timer display wrapper div (the one with `data-tour="timer"`, ~line 716-766), add a conditional before the FlipGroup rendering:

```typescript
{timer.mode === "breathing" ? (
  <BreathingBubble
    phase={breathing.phase}
    progress={breathing.progress}
    isLastCycle={breathing.isLastCycle}
    isComplete={breathing.isComplete}
    isRunning={breathing.isRunning}
    cycleCount={breathing.cycleCount}
    elapsedTime={breathing.elapsedTime}
    totalDuration={breathing.totalDuration}
    totalCycles={breathing.totalCycles}
    presetName={
      breathingPresetIndex >= 0 && breathingPresetIndex < BREATHING_PRESETS.length
        ? `${BREATHING_PRESETS[breathingPresetIndex].name} ${BREATHING_PRESETS[breathingPresetIndex].inhale}/${BREATHING_PRESETS[breathingPresetIndex].exhale}`
        : "Custom"
    }
    colorA={theme.a}
    colorB={theme.b}
    fpsMode={fpsMode}
    onDismissRecap={() => breathing.reset()}
  />
) : (
  <>
    {timer.mode === "pomo" && !zoomed && (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ margin: "-20px" }}>
        <ProgressRing ... />
      </div>
    )}
    {/* existing FlipGroup code */}
  </>
)}
```

Note: The ProgressRing and FlipGroups go inside the else branch.

- [ ] **Step 9: Hide task list and phase indicator in breathing mode**

The task list block (~line 677) already checks `timer.mode === "pomo"`, so it's hidden in breathing mode. Same for the phase indicator (~line 647). No changes needed.

- [ ] **Step 10: Disable zoomed state in breathing mode**

In the zoomed wrapper div (~line 720-722), add:

```typescript
style={{
  ...(zoomed && timer.mode !== "breathing" ? { transform: "scale(1.35)" } : {}),
  ...
}}
```

- [ ] **Step 11: Reset breathing on mode change**

In `handleModeChange`, add breathing reset (breathing.reset is a stable ref, safe in deps):

```typescript
const handleModeChange = useCallback(
  (mode: Mode) => {
    savePartialSession()
    if (timer.mode === "breathing") breathing.reset()
    timer.setMode(mode)
  },
  [savePartialSession, timer, breathing.reset]
)
```

- [ ] **Step 12: Update keyboard shortcuts to use effective controls**

In the `useKeyboardShortcuts` call (~line 488):

```typescript
useKeyboardShortcuts({
  onToggleRunning: effectiveToggle,
  onReset: effectiveReset,
  ...
})
```

- [ ] **Step 13: Verify build compiles**

Run: `cd C:/dev/Pomo && npx tsc --noEmit 2>&1 | head -20`

Expected: PASS

- [ ] **Step 14: Commit**

```bash
git add components/flip-clock.tsx
git commit -m "feat(breathing): integrate breathing mode into flip-clock"
```

---

## Chunk 5: Settings Panel — Breathing Configuration

### Task 9: Add breathing settings to settings-panel.tsx

**Files:**
- Modify: `components/settings-panel.tsx`

- [ ] **Step 1: Update props interface**

Add new props to `SettingsPanelProps`:

```typescript
// Breathing mode props
breathingPresetIndex: number
onBreathingPresetChange: (index: number) => void
breathingCustomInhale: number
breathingCustomExhale: number
breathingCustomHold: number
onBreathingCustomInhaleChange: (v: number) => void
onBreathingCustomExhaleChange: (v: number) => void
onBreathingCustomHoldChange: (v: number) => void
breathingHoldEnabled: boolean
onBreathingHoldToggle: () => void
breathingTimedMode: boolean
onBreathingTimedModeToggle: () => void
breathingDuration: number
onBreathingDurationChange: (v: number) => void
breathingHaptic: boolean
onBreathingHapticToggle: () => void
```

- [ ] **Step 2: Update mode selector grid**

Change the mode selector from `grid grid-cols-3` to a flex row:

```typescript
<div className="flex gap-2 mb-3 overflow-x-auto">
  <TogglePill label="Clock" active={mode === "clock"} onClick={() => onModeChange("clock")} />
  <TogglePill label="Pomo" active={mode === "pomo"} onClick={() => onModeChange("pomo")} />
  <TogglePill label="Stopwatch" active={mode === "stopwatch"} onClick={() => onModeChange("stopwatch")} />
  <TogglePill label="Breathe" active={mode === "breathing"} onClick={() => onModeChange("breathing")} />
</div>
```

- [ ] **Step 3: Add breathing config section**

After the Pomodoro config section, add:

```typescript
{/* Breathing config */}
{mode === "breathing" && (
  <div className="space-y-3 mb-4">
    {/* Presets */}
    <p className="text-white/80 text-sm font-semibold">Preset</p>
    <div className="grid grid-cols-2 gap-2">
      <TogglePill
        label="Relaxation"
        active={breathingPresetIndex === 0}
        onClick={() => onBreathingPresetChange(0)}
      />
      <TogglePill
        label="Calming"
        active={breathingPresetIndex === 1}
        onClick={() => {
          if (!isPro) { onProNeeded(); return }
          onBreathingPresetChange(1)
        }}
        premium
        isPro={isPro}
      />
      <TogglePill
        label="Energize"
        active={breathingPresetIndex === 2}
        onClick={() => {
          if (!isPro) { onProNeeded(); return }
          onBreathingPresetChange(2)
        }}
        premium
        isPro={isPro}
      />
      <TogglePill
        label="Custom"
        active={breathingPresetIndex === -1}
        onClick={() => {
          if (!isPro) { onProNeeded(); return }
          onBreathingPresetChange(-1)
        }}
        premium
        isPro={isPro}
      />
    </div>

    {/* Custom sliders */}
    {breathingPresetIndex === -1 && (
      <div className="space-y-2.5 p-3 rounded-xl bg-white/5">
        <div className="flex items-center justify-between">
          <span className="text-white/70 text-sm">Inhale</span>
          <span className="text-white text-sm font-semibold">{breathingCustomInhale}s</span>
        </div>
        <input
          type="range"
          min={2}
          max={10}
          step={0.5}
          value={breathingCustomInhale}
          onChange={(e) => onBreathingCustomInhaleChange(parseFloat(e.target.value))}
          className="w-full accent-white/60"
        />
        <div className="flex items-center justify-between">
          <span className="text-white/70 text-sm">Exhale</span>
          <span className="text-white text-sm font-semibold">{breathingCustomExhale}s</span>
        </div>
        <input
          type="range"
          min={2}
          max={10}
          step={0.5}
          value={breathingCustomExhale}
          onChange={(e) => onBreathingCustomExhaleChange(parseFloat(e.target.value))}
          className="w-full accent-white/60"
        />
        <div className="flex items-center justify-between">
          <span className="text-white/70 text-sm">Hold</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onBreathingHoldToggle}
              className={`px-2 py-1 rounded-lg text-xs transition-all ${
                breathingHoldEnabled
                  ? "bg-white/20 text-white"
                  : "bg-black/30 text-white/50"
              }`}
            >
              {breathingHoldEnabled ? "On" : "Off"}
            </button>
            {breathingHoldEnabled && (
              <span className="text-white text-sm font-semibold">{breathingCustomHold}s</span>
            )}
          </div>
        </div>
        {breathingHoldEnabled && (
          <input
            type="range"
            min={1}
            max={5}
            step={0.5}
            value={breathingCustomHold}
            onChange={(e) => onBreathingCustomHoldChange(parseFloat(e.target.value))}
            className="w-full accent-white/60"
          />
        )}
      </div>
    )}

    {/* Duration */}
    <div className="grid grid-cols-2 gap-2">
      <TogglePill
        label="Timed"
        active={breathingTimedMode}
        onClick={onBreathingTimedModeToggle}
      />
      <TogglePill
        label="Free"
        active={!breathingTimedMode}
        onClick={() => {
          if (!isPro) { onProNeeded(); return }
          onBreathingTimedModeToggle()
        }}
        premium
        isPro={isPro}
      />
    </div>

    {breathingTimedMode && (
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 5, 10, 15, 20].map((d) => (
          <button
            key={d}
            onClick={() => onBreathingDurationChange(d)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              breathingDuration === d
                ? "bg-white/20 text-white"
                : "bg-black/30 text-white/50 hover:bg-black/40"
            }`}
          >
            {d}m
          </button>
        ))}
      </div>
    )}

    {/* Haptic toggle */}
    <TogglePill
      label="Haptic"
      active={breathingHaptic}
      onClick={onBreathingHapticToggle}
    />
  </div>
)}
```

- [ ] **Step 4: Verify build compiles**

Run: `cd C:/dev/Pomo && npx tsc --noEmit 2>&1 | head -20`

Expected: Errors because flip-clock.tsx doesn't pass the new props yet.

- [ ] **Step 5: Commit**

```bash
git add components/settings-panel.tsx
git commit -m "feat(breathing): add breathing config UI to settings panel"
```

---

### Task 10: Pass breathing settings props from flip-clock.tsx

**Files:**
- Modify: `components/flip-clock.tsx`

- [ ] **Step 1: Add breathing settings props to SettingsPanel**

In `flip-clock.tsx`, where `<SettingsPanel>` is rendered (~line 791), add the new props:

```typescript
breathingPresetIndex={breathingPresetIndex}
onBreathingPresetChange={setBreathingPresetIndex}
breathingCustomInhale={breathingCustomConfig.inhale}
breathingCustomExhale={breathingCustomConfig.exhale}
breathingCustomHold={breathingCustomConfig.hold}
onBreathingCustomInhaleChange={(v) => setBreathingCustomConfig({ ...breathingCustomConfig, inhale: v })}
onBreathingCustomExhaleChange={(v) => setBreathingCustomConfig({ ...breathingCustomConfig, exhale: v })}
onBreathingCustomHoldChange={(v) => setBreathingCustomConfig({ ...breathingCustomConfig, hold: v })}
breathingHoldEnabled={breathingCustomConfig.hold > 0}
onBreathingHoldToggle={() => setBreathingCustomConfig({
  ...breathingCustomConfig,
  hold: breathingCustomConfig.hold > 0 ? 0 : 1,
})}
breathingTimedMode={breathingTimedMode}
onBreathingTimedModeToggle={() => setBreathingTimedMode((v) => !v)}
breathingDuration={breathingDuration}
onBreathingDurationChange={setBreathingDuration}
breathingHaptic={breathingHaptic}
onBreathingHapticToggle={() => setBreathingHaptic((v) => !v)}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd C:/dev/Pomo && npx tsc --noEmit 2>&1 | head -20`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/flip-clock.tsx
git commit -m "feat(breathing): wire up breathing settings props"
```

---

## Chunk 6: Session Recording & Final Polish

### Task 11: Add breathing phase to session-store and stats

**Files:**
- Modify: `lib/session-store.ts:4` (phase type)
- Modify: `lib/session-store.ts` (add breathing stats helpers)

- [ ] **Step 1: Update Session phase type**

In `lib/session-store.ts`, line 4, change:

```typescript
phase: "work" | "shortBreak" | "longBreak"
```

to:

```typescript
phase: "work" | "shortBreak" | "longBreak" | "breathing"
```

- [ ] **Step 2: Add breathing stats function**

At the end of `lib/session-store.ts`, add:

```typescript
// ---- Breathing stats ----

export function getBreathingStats(): { totalMinutes: number; sessionCount: number } {
  const sessions = loadSessions().filter((s) => s.phase === "breathing")
  return {
    totalMinutes: sessions.reduce((sum, s) => sum + s.durationMinutes, 0),
    sessionCount: sessions.length,
  }
}
```

Note: Existing stats functions (`getTodayStats`, `getAllTimeStats`, `getDailyMinutesMap`) all filter `phase === "work"`, so breathing sessions are automatically excluded from work stats. The `getBreathingStats` function provides breathing-specific data. The stats panel can display this separately in a future enhancement.

- [ ] **Step 3: Verify build compiles**

Run: `cd C:/dev/Pomo && npx tsc --noEmit 2>&1 | head -20`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/session-store.ts
git commit -m "feat(breathing): add breathing phase to session store with stats helper"
```

---

### Task 12: Record breathing sessions

**Files:**
- Modify: `components/flip-clock.tsx`

- [ ] **Step 1: Add effect to record breathing sessions on completion**

After the breathing config sync effect, add:

```typescript
// Record breathing session on completion
const prevBreathingComplete = useRef(false)
useEffect(() => {
  if (breathing.isComplete && !prevBreathingComplete.current) {
    recordAndRefresh({
      task: "Breathing",
      phase: "breathing",
      durationMinutes: Math.max(1, Math.round(breathing.totalDuration / 60)),
      completedAt: new Date().toISOString(),
    })
  }
  prevBreathingComplete.current = breathing.isComplete
}, [breathing.isComplete, breathing.totalDuration, recordAndRefresh])
```

- [ ] **Step 2: Verify build compiles**

Run: `cd C:/dev/Pomo && npx tsc --noEmit 2>&1 | head -20`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/flip-clock.tsx
git commit -m "feat(breathing): record breathing sessions in stats"
```

---

### Task 13: Capacitor sync for Android haptics

**Files:**
- Android native files (auto-synced by Capacitor)

- [ ] **Step 1: Sync Capacitor plugins**

Run: `cd C:/dev/Pomo && pnpm cap:sync`

This registers `@capacitor/haptics` in the Android project.

- [ ] **Step 2: Verify sync completed**

Check that the haptics plugin is registered in the Android build.

- [ ] **Step 3: Commit any generated changes**

```bash
git add android/
git commit -m "chore: sync capacitor for haptics plugin"
```

---

### Task 14: Build and verify

- [ ] **Step 1: Full TypeScript check**

Run: `cd C:/dev/Pomo && npx tsc --noEmit`

Expected: PASS — no type errors.

- [ ] **Step 2: Build the app**

Run: `cd C:/dev/Pomo && pnpm build`

Expected: PASS — successful Next.js build.

- [ ] **Step 3: Manual testing checklist**

1. Navigate to breathing mode via swipe (4th dot) or Digit4
2. See the bubble in idle state with gentle pulse
3. Tap Play — bubble starts inhale animation
4. Verify haptic feedback on phase changes (Android only)
5. Verify cycle counter increments
6. Open settings — see breathing presets and config
7. Switch to Custom preset — verify sliders work
8. Set timed mode to 1 minute — verify "Last cycle" indicator and recap
9. Verify recap shows duration, cycles, preset
10. Tap recap to dismiss — returns to idle
11. Verify overlays and themes work behind the bubble
12. Switch to other modes — verify they still work correctly
