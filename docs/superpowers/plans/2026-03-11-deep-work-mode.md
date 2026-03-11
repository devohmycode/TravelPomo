# Deep Work Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5th mode "Deep Work" with an animated flame that grows through 8 stages during long focus sessions.

**Architecture:** New hook `use-deep-work.ts` (state machine with drift-resistant timer) + new canvas component `deep-work-flame.tsx` (flame rendering with particle system). Integrated into `flip-clock.tsx` following the same pattern as the existing Breathing mode.

**Tech Stack:** React 19, Canvas 2D, TypeScript, `@capacitor/haptics` (already installed)

---

## Chunk 1: Core Infrastructure

### Task 1: Mode Type and Keyboard Shortcut

**Files:**
- Modify: `hooks/use-timer.ts:17` — Add `"deepwork"` to Mode union
- Modify: `hooks/use-timer.ts:186-201` — Add `"deepwork"` case in `setMode`
- Modify: `hooks/use-keyboard-shortcuts.ts:57-59` — Add `Digit5` case

- [ ] **Step 1: Add `"deepwork"` to the Mode type**

In `hooks/use-timer.ts`, change line 17:

```typescript
export type Mode = "clock" | "pomo" | "stopwatch" | "breathing" | "deepwork"
```

- [ ] **Step 2: Add `"deepwork"` case in `setMode`**

In `hooks/use-timer.ts`, inside the `setMode` callback (around line 186), the existing code handles `"pomo"` and `"stopwatch"`. Add a no-op case for `"deepwork"` by adding after the stopwatch block:

```typescript
// No reset needed for deepwork — use-deep-work handles its own state
```

No actual code change needed — `setModeInternal(newMode)` at line 188 already covers it. The comment is optional but helpful.

- [ ] **Step 3: Add Digit5 keyboard shortcut**

In `hooks/use-keyboard-shortcuts.ts`, add after the `Digit4` case (line 58-59):

```typescript
        case "Digit5":
          config.onSetMode("deepwork")
          break
```

- [ ] **Step 4: Verify build compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: `BUILD SUCCESSFUL` (there will be warnings about unused "deepwork" mode in flip-clock, that's fine for now)

- [ ] **Step 5: Commit**

```bash
git add hooks/use-timer.ts hooks/use-keyboard-shortcuts.ts
git commit -m "feat(deep-work): add deepwork to Mode type and Digit5 shortcut"
```

---

### Task 2: Deep Work Hook (`use-deep-work.ts`)

**Files:**
- Create: `hooks/use-deep-work.ts`

This hook manages the deep work timer state machine. It follows the exact same patterns as `use-breathing.ts`:
- Ref-based mutable state in intervals to avoid stale closures
- Stable `toggle`/`reset` callbacks via ref pattern
- Drift-resistant timing with `setInterval` + `Date.now()`
- `elapsedTime` = active time only (excludes pauses)

- [ ] **Step 1: Create the hook file**

Create `hooks/use-deep-work.ts` with the full implementation:

```typescript
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { isNativePlatform, isTauriPlatform } from "@/lib/platform"

export interface DeepWorkConfig {
  timedMode: boolean
  durationMinutes: number
  hapticEnabled: boolean
}

export const DEFAULT_DEEP_WORK_CONFIG: DeepWorkConfig = {
  timedMode: true,
  durationMinutes: 60,
  hapticEnabled: true,
}

const FREE_MODE_REFERENCE = 7200 // 120 min in seconds — flame reaches max at this point

const STAGE_LABELS = [
  "Spark",
  "Kindling",
  "Warming up",
  "Building",
  "Focused",
  "Deep focus",
  "Blazing",
  "Inferno",
] as const

export type DeepWorkStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export interface DeepWorkState {
  elapsedTime: number        // active seconds (excludes pauses)
  pauseCount: number
  totalPauseTime: number     // seconds spent paused
  stage: DeepWorkStage
  stageLabel: string
  progress: number           // 0-1, clamped
  isRunning: boolean
  isComplete: boolean
  totalDuration: number      // final elapsed time for recap
  maxStageReached: DeepWorkStage
  toggle: () => void
  reset: () => void
}

function computeStage(progress: number): DeepWorkStage {
  // 8 stages, each ~12.5% of progress
  if (progress < 0.125) return 1
  if (progress < 0.25) return 2
  if (progress < 0.375) return 3
  if (progress < 0.5) return 4
  if (progress < 0.625) return 5
  if (progress < 0.75) return 6
  if (progress < 0.875) return 7
  return 8
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

export function useDeepWork(config: DeepWorkConfig): DeepWorkState {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [pauseCount, setPauseCount] = useState(0)
  const [totalPauseTime, setTotalPauseTime] = useState(0)
  const [stage, setStage] = useState<DeepWorkStage>(1)
  const [isRunning, setIsRunning] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [totalDuration, setTotalDuration] = useState(0)
  const [maxStageReached, setMaxStageReached] = useState<DeepWorkStage>(1)

  // Refs for interval — avoids stale closures
  const sessionStartRef = useRef<number>(0)
  const totalPauseTimeRef = useRef(0)
  const pauseStartRef = useRef<number>(0)
  const pauseCountRef = useRef(0)
  const stageRef = useRef<DeepWorkStage>(1)
  const maxStageRef = useRef<DeepWorkStage>(1)
  const configRef = useRef(config)
  configRef.current = config

  // Main interval — reads from refs, writes to state
  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      const now = Date.now()
      const c = configRef.current
      const activeMs = now - sessionStartRef.current - totalPauseTimeRef.current * 1000
      const activeSeconds = Math.max(0, Math.floor(activeMs / 1000))

      setElapsedTime(activeSeconds)

      // Compute progress
      const totalSeconds = c.timedMode ? c.durationMinutes * 60 : FREE_MODE_REFERENCE
      const progress = Math.min(1, activeSeconds / totalSeconds)

      // Compute stage
      const newStage = computeStage(progress)
      if (newStage !== stageRef.current) {
        // Stage changed — haptic feedback
        if (c.hapticEnabled) triggerHaptic("Light")
        stageRef.current = newStage
        setStage(newStage)
        if (newStage > maxStageRef.current) {
          maxStageRef.current = newStage
          setMaxStageReached(newStage)
        }
      }

      // Check completion (timed mode only)
      if (c.timedMode && activeSeconds >= c.durationMinutes * 60) {
        setIsRunning(false)
        setIsComplete(true)
        setTotalDuration(activeSeconds)
        if (c.hapticEnabled) triggerEndHaptic()
      }
    }, 250) // 4x/sec like pomo timer

    return () => clearInterval(interval)
  }, [isRunning])

  // Stable toggle via ref pattern
  const toggleRef = useRef<() => void>(() => {})
  toggleRef.current = () => {
    if (isComplete) {
      setIsComplete(false)
      return
    }

    if (isRunning) {
      // Pause
      pauseStartRef.current = Date.now()
      pauseCountRef.current++
      setPauseCount(pauseCountRef.current)
      setIsRunning(false)
    } else {
      if (elapsedTime === 0 && !isComplete) {
        // Fresh start
        sessionStartRef.current = Date.now()
        totalPauseTimeRef.current = 0
        pauseCountRef.current = 0
        stageRef.current = 1
        maxStageRef.current = 1
        setPauseCount(0)
        setTotalPauseTime(0)
        setStage(1)
        setMaxStageReached(1)
      } else {
        // Resume from pause — accumulate pause duration
        const pauseDuration = (Date.now() - pauseStartRef.current) / 1000
        totalPauseTimeRef.current += pauseDuration
        setTotalPauseTime(totalPauseTimeRef.current)
      }
      setIsRunning(true)
    }
  }
  const toggle = useCallback(() => toggleRef.current(), [])

  const resetRef = useRef<() => void>(() => {})
  resetRef.current = () => {
    // If running or paused with elapsed time, record as free-mode end
    const activeTime = elapsedTime
    if (activeTime > 0 && !isComplete) {
      setTotalDuration(activeTime)
      setIsComplete(true)
      setIsRunning(false)
      if (configRef.current.hapticEnabled) triggerEndHaptic()
      return
    }

    // Full reset (from idle or after recap dismiss)
    setIsRunning(false)
    setElapsedTime(0)
    setPauseCount(0)
    setTotalPauseTime(0)
    setStage(1)
    setIsComplete(false)
    setTotalDuration(0)
    setMaxStageReached(1)
    stageRef.current = 1
    maxStageRef.current = 1
    totalPauseTimeRef.current = 0
    pauseCountRef.current = 0
  }
  const reset = useCallback(() => resetRef.current(), [])

  // Compute progress for rendering
  const totalSeconds = config.timedMode ? config.durationMinutes * 60 : FREE_MODE_REFERENCE
  const progress = Math.min(1, elapsedTime / totalSeconds)

  return {
    elapsedTime,
    pauseCount,
    totalPauseTime,
    stage,
    stageLabel: STAGE_LABELS[stage - 1],
    progress,
    isRunning,
    isComplete,
    totalDuration,
    maxStageReached,
    toggle,
    reset,
  }
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add hooks/use-deep-work.ts
git commit -m "feat(deep-work): add use-deep-work hook with state machine and drift-resistant timer"
```

---

### Task 3: Session Store — Phase Type and Stats

**Files:**
- Modify: `lib/session-store.ts:4` — Add `"deepwork"` to phase union
- Modify: `lib/session-store.ts:62` — Update `getDailyMinutesMap` filter
- Modify: `lib/session-store.ts:79` — Update `getTodayStats` filter
- Modify: `lib/session-store.ts:172` — Update `getAllTimeStats` filter
- Modify: `lib/session-store.ts:211` — Update `getTaskStats` filter
- Add: `getDeepWorkStats()` function at end of file

- [ ] **Step 1: Add `"deepwork"` to the phase union**

In `lib/session-store.ts`, change line 4:

```typescript
  phase: "work" | "shortBreak" | "longBreak" | "breathing" | "deepwork"
```

- [ ] **Step 2: Update `getDailyMinutesMap` to include deep work**

Line 62, change:
```typescript
  const sessions = loadSessions().filter((s) => s.phase === "work" || s.phase === "deepwork")
```

This ensures deep work minutes count toward heatmap, streak, daily goal, weekly average, best day, and all-time stats.

- [ ] **Step 3: Update `getTodayStats` to include deep work**

Line 79, change:
```typescript
  const sessions = getSessionsForDate(today).filter(
    (s) => s.phase === "work" || s.phase === "deepwork"
  )
```

- [ ] **Step 4: Update `getAllTimeStats` to include deep work**

Line 172, change:
```typescript
  const sessions = loadSessions().filter((s) => s.phase === "work" || s.phase === "deepwork")
```

- [ ] **Step 5: Update `getTaskStats` to include deep work**

Line 211, change:
```typescript
  const sessions = loadSessions().filter((s) => s.phase === "work" || s.phase === "deepwork")
```

- [ ] **Step 6: Add `getDeepWorkStats()` function**

Add at the end of the file, after `getBreathingStats()`:

```typescript
// ---- Deep Work stats ----

export function getDeepWorkStats(): {
  totalMinutes: number
  sessionCount: number
  averageMinutes: number
  longestMinutes: number
} {
  const sessions = loadSessions().filter((s) => s.phase === "deepwork")
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0)
  const sessionCount = sessions.length
  return {
    totalMinutes,
    sessionCount,
    averageMinutes: sessionCount > 0 ? Math.round(totalMinutes / sessionCount) : 0,
    longestMinutes: sessionCount > 0 ? Math.max(...sessions.map((s) => s.durationMinutes)) : 0,
  }
}
```

- [ ] **Step 7: Verify build compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Compiles successfully

- [ ] **Step 8: Commit**

```bash
git add lib/session-store.ts
git commit -m "feat(deep-work): add deepwork phase to session store with stats integration"
```

---

## Chunk 2: Canvas Component

### Task 4: Deep Work Flame Component (`deep-work-flame.tsx`)

**Files:**
- Create: `components/deep-work-flame.tsx`

This canvas component renders the animated flame. It follows the same structure as `breathing-bubble.tsx`:
- `propsRef` pattern for the draw loop
- `fadeRef` for fade-out at session end
- DPR-aware canvas sizing
- rAF render loop with FPS throttling
- RecapScreen sub-component
- Canvas always mounted (hidden with `display: none` during recap)

- [ ] **Step 1: Create the flame component**

Create `components/deep-work-flame.tsx`:

```typescript
"use client"

import { useEffect, useRef, useCallback } from "react"
import type { DeepWorkStage } from "@/hooks/use-deep-work"

interface DeepWorkFlameProps {
  stage: DeepWorkStage
  stageLabel: string
  progress: number
  isComplete: boolean
  isRunning: boolean
  elapsedTime: number
  pauseCount: number
  totalPauseTime: number
  totalDuration: number
  maxStageReached: DeepWorkStage
  taskName: string
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
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

const STAGE_LABELS_MAP: Record<number, string> = {
  1: "Spark", 2: "Kindling", 3: "Warming up", 4: "Building",
  5: "Focused", 6: "Deep focus", 7: "Blazing", 8: "Inferno",
}

const prefersReducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false

// Particle system
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
}

// Auto-dismiss recap after 5 seconds
function RecapScreen({
  totalDuration,
  pauseCount,
  totalPauseTime,
  maxStageLabel,
  taskName,
  onDismiss,
}: {
  totalDuration: number
  pauseCount: number
  totalPauseTime: number
  maxStageLabel: string
  taskName: string
  onDismiss?: () => void
}) {
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
        {pauseCount > 0 && (
          <p className="text-white/50 text-xs">
            {pauseCount} {pauseCount === 1 ? "pause" : "pauses"} · {formatTime(Math.round(totalPauseTime))}
          </p>
        )}
        <p className="text-white/60 text-sm">Peak: {maxStageLabel}</p>
        {taskName && <p className="text-white/40 text-xs">{taskName}</p>}
      </div>
      <p className="text-white/30 text-xs">Tap to dismiss</p>
    </div>
  )
}

export function DeepWorkFlame({
  stage,
  stageLabel,
  progress,
  isComplete,
  isRunning,
  elapsedTime,
  pauseCount,
  totalPauseTime,
  totalDuration,
  maxStageReached,
  taskName,
  colorA,
  colorB,
  fpsMode,
  onDismissRecap,
}: DeepWorkFlameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)
  const fadeRef = useRef(1)
  const particlesRef = useRef<Particle[]>([])
  const burstRef = useRef(0) // 0 = no burst, >0 = burst progress

  // Store props in refs for the draw loop
  const propsRef = useRef({ stage, progress, isComplete, isRunning, colorA, colorB })
  propsRef.current = { stage, progress, isComplete, isRunning, colorA, colorB }

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

    const { stage: s, progress: prog, isComplete: done, isRunning: running, colorA: cA, colorB: cB } = propsRef.current

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const cx = w / 2

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Burst animation at session end
    if (done && burstRef.current < 1) {
      burstRef.current = Math.min(1, burstRef.current + 0.02)
    }

    // Fade-out after burst completes
    if (done && burstRef.current >= 1 && fadeRef.current > 0) {
      fadeRef.current = Math.max(0, fadeRef.current - 0.025)
    } else if (!done) {
      fadeRef.current = 1
      burstRef.current = 0
    }

    if (done && fadeRef.current <= 0) {
      ctx.restore()
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    ctx.globalAlpha = fadeRef.current

    // Flame parameters based on stage (1-8)
    const stageNorm = (s - 1) / 7 // 0 to 1
    const flameHeight = h * (0.08 + stageNorm * 0.32) // 8% to 40% of canvas
    const flameWidth = w * (0.06 + stageNorm * 0.14) // 6% to 20% of canvas
    const baseY = h * 0.7 // flame base position
    const waveSpeed = 1.5 + stageNorm * 3 // oscillation speed
    const waveAmp = flameWidth * (0.15 + stageNorm * 0.2) // wave amplitude
    const glowAlpha = 0.05 + stageNorm * 0.35

    // Burst scale
    const burstScale = done ? 1 + burstRef.current * 0.2 : 1

    ctx.save()
    ctx.translate(cx, baseY)
    ctx.scale(burstScale, burstScale)

    // Glow halo at base
    const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, flameHeight * 1.5)
    glowGrad.addColorStop(0, hexToRgba(cA, glowAlpha))
    glowGrad.addColorStop(1, hexToRgba(cA, 0))
    ctx.beginPath()
    ctx.arc(0, 0, flameHeight * 1.5, 0, Math.PI * 2)
    ctx.fillStyle = glowGrad
    ctx.fill()

    // Draw flame body — layered sine waves
    const layers = 3
    for (let layer = 0; layer < layers; layer++) {
      const layerAlpha = 1 - layer * 0.25
      const layerOffset = layer * 0.15
      ctx.beginPath()

      // Right side of flame
      for (let i = 0; i <= 20; i++) {
        const t = i / 20
        const y = -t * flameHeight
        const widthAtHeight = flameWidth * (1 - t * 0.85) * (1 - layerOffset)
        const wave = Math.sin(now / (300 / waveSpeed) + t * 5 + layer * 2) * waveAmp * t
        const x = widthAtHeight + wave * (prefersReducedMotion ? 0.2 : 1)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }

      // Tip
      ctx.lineTo(0, -flameHeight * (1.05 + Math.sin(now / (400 / waveSpeed)) * 0.05))

      // Left side of flame (mirror)
      for (let i = 20; i >= 0; i--) {
        const t = i / 20
        const y = -t * flameHeight
        const widthAtHeight = flameWidth * (1 - t * 0.85) * (1 - layerOffset)
        const wave = Math.sin(now / (300 / waveSpeed) + t * 5 + layer * 2 + Math.PI) * waveAmp * t
        const x = -(widthAtHeight + wave * (prefersReducedMotion ? 0.2 : 1))
        ctx.lineTo(x, y)
      }

      ctx.closePath()

      // Gradient fill
      const flameGrad = ctx.createLinearGradient(0, 0, 0, -flameHeight)
      if (layer === 0) {
        flameGrad.addColorStop(0, cB)
        flameGrad.addColorStop(0.5, cA)
        flameGrad.addColorStop(1, hexToRgba(cA, 0.6))
      } else {
        flameGrad.addColorStop(0, hexToRgba(cA, 0.4 * layerAlpha))
        flameGrad.addColorStop(1, hexToRgba(cB, 0.1 * layerAlpha))
      }
      ctx.fillStyle = flameGrad
      ctx.fill()
    }

    // Burst white flash overlay
    if (done && burstRef.current > 0 && burstRef.current < 1) {
      const flashAlpha = Math.sin(burstRef.current * Math.PI) * 0.6
      const flashGrad = ctx.createRadialGradient(0, -flameHeight * 0.4, 0, 0, -flameHeight * 0.4, flameHeight)
      flashGrad.addColorStop(0, `rgba(255,255,255,${flashAlpha})`)
      flashGrad.addColorStop(1, `rgba(255,255,255,0)`)
      ctx.beginPath()
      ctx.arc(0, -flameHeight * 0.4, flameHeight, 0, Math.PI * 2)
      ctx.fillStyle = flashGrad
      ctx.fill()
    }

    ctx.restore()

    // Particles
    if (!done || burstRef.current < 1) {
      const targetFps = fpsMode === "30" ? 30 : 60
      const particleRate = prefersReducedMotion ? Math.max(1, Math.floor(s / 2)) : 2 + s * 2.5
      const particles = particlesRef.current

      // Emit new particles
      if (running && Math.random() < particleRate / targetFps) {
        particles.push({
          x: cx + (Math.random() - 0.5) * flameWidth * 0.8,
          y: baseY - flameHeight * (0.5 + Math.random() * 0.4),
          vx: (Math.random() - 0.5) * 0.5,
          vy: -(0.5 + Math.random() * 1.5),
          life: 0,
          maxLife: 30 + Math.random() * 40,
          size: 1 + Math.random() * 2.5 * (stageNorm * 0.5 + 0.5),
        })
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.life++
        if (p.life > p.maxLife) {
          particles.splice(i, 1)
          continue
        }
        const alpha = 1 - p.life / p.maxLife
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 - p.life / p.maxLife * 0.5), 0, Math.PI * 2)
        ctx.fillStyle = hexToRgba(cA, alpha * 0.8)
        ctx.fill()
      }
    }

    // Drop shadow at flame base
    const shadowGrad = ctx.createRadialGradient(cx, baseY + 5, 0, cx, baseY + 5, flameWidth * 1.5)
    shadowGrad.addColorStop(0, "rgba(0,0,0,0.1)")
    shadowGrad.addColorStop(1, "rgba(0,0,0,0)")
    ctx.beginPath()
    ctx.ellipse(cx, baseY + 5, flameWidth * 1.5, flameWidth * 0.3, 0, 0, Math.PI * 2)
    ctx.fillStyle = shadowGrad
    ctx.fill()

    ctx.restore()
    rafRef.current = requestAnimationFrame(draw)
  }, [fpsMode])

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
      {/* Stage label */}
      {isRunning && !isComplete && (
        <span
          className="text-white/70 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full transition-opacity duration-500"
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
          }}
          aria-live="polite"
        >
          {stageLabel}
        </span>
      )}

      {/* Idle label */}
      {!isRunning && elapsedTime === 0 && !isComplete && (
        <span className="text-white/50 text-xs font-medium uppercase tracking-wider">
          Deep Work
        </span>
      )}

      {/* Paused label */}
      {!isRunning && elapsedTime > 0 && !isComplete && (
        <span
          className="text-white/50 text-xs font-medium uppercase tracking-wider animate-pulse"
        >
          Paused
        </span>
      )}

      {/* Canvas (always mounted to preserve sizing/refs) */}
      <div
        ref={containerRef}
        className="relative"
        style={{
          width: "min(80vw, 400px)",
          height: "min(80vw, 400px)",
          display: isComplete ? "none" : undefined,
        }}
      >
        <canvas
          ref={canvasRef}
          className="block"
          aria-hidden="true"
        />
      </div>

      {/* Recap overlay */}
      {isComplete && (
        <RecapScreen
          totalDuration={totalDuration}
          pauseCount={pauseCount}
          totalPauseTime={totalPauseTime}
          maxStageLabel={STAGE_LABELS_MAP[maxStageReached]}
          taskName={taskName}
          onDismiss={onDismissRecap}
        />
      )}

      {/* Elapsed time + task name */}
      {(isRunning || (elapsedTime > 0 && !isComplete)) && (
        <div className="flex flex-col items-center gap-1" aria-live="polite">
          <div className="flex items-center gap-3 text-white/40 text-xs">
            <span>{formatTime(elapsedTime)}</span>
            {pauseCount > 0 && (
              <>
                <span>&middot;</span>
                <span>{pauseCount} {pauseCount === 1 ? "pause" : "pauses"}</span>
              </>
            )}
          </div>
          {taskName && (
            <span className="text-white/25 text-[10px] truncate max-w-[200px]">{taskName}</span>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add components/deep-work-flame.tsx
git commit -m "feat(deep-work): add canvas flame component with particle system and recap screen"
```

---

## Chunk 3: Integration

### Task 5: Settings Panel — Mode Selector and Deep Work Config

**Files:**
- Modify: `components/settings-panel.tsx`

Changes:
1. Mode selector layout: `grid-cols-4` → scrollable `flex` row
2. Add "Deep" pill to mode selector
3. Add settings panel header for `"deepwork"` mode
4. Add deep work config section (timed/free, duration, haptic)
5. Add new props for deep work settings

- [ ] **Step 1: Update the SettingsPanelProps interface**

In `components/settings-panel.tsx`, add these props to the `SettingsPanelProps` interface (after the breathing props, around line 62):

```typescript
  deepWorkTimedMode: boolean
  onDeepWorkTimedModeToggle: () => void
  deepWorkDuration: number
  onDeepWorkDurationChange: (v: number) => void
  deepWorkHaptic: boolean
  onDeepWorkHapticToggle: () => void
```

- [ ] **Step 2: Add the new props to the function signature**

Add the new props to the destructured parameters of `SettingsPanel` (around line 178):

```typescript
  deepWorkTimedMode,
  onDeepWorkTimedModeToggle,
  deepWorkDuration,
  onDeepWorkDurationChange,
  deepWorkHaptic,
  onDeepWorkHapticToggle,
```

- [ ] **Step 3: Update the settings panel header**

Change line 189 from:
```typescript
        {mode === "clock" ? "Clock" : mode === "pomo" ? "Pomodoro" : mode === "breathing" ? "Breathing" : "Stopwatch"}
```

To:
```typescript
        {mode === "clock" ? "Clock" : mode === "pomo" ? "Pomodoro" : mode === "breathing" ? "Breathing" : mode === "deepwork" ? "Deep Work" : "Stopwatch"}
```

- [ ] **Step 4: Update mode selector to scrollable flex + add Deep pill**

Change the mode selector grid (line 193) from:
```typescript
      <div className="grid grid-cols-4 gap-1.5 mb-3">
```

To:
```typescript
      <div className="flex overflow-x-auto gap-1.5 mb-3">
```

Then add the Deep pill after the Breathe pill (line 197):

```typescript
        <TogglePill label="Deep" active={mode === "deepwork"} onClick={() => onModeChange("deepwork")} />
```

And add `min-w-[70px] flex-shrink-0` to each TogglePill. Update the TogglePill component to accept an optional className prop, OR add the styles directly in the mode selector. The simplest approach: wrap each pill with a container. Actually, the easiest: just add `whitespace-nowrap` to the flex container and `flex-shrink-0` to the TogglePill button:

In the TogglePill component (around line 78-93), add `flex-shrink-0` to the button's className:

```typescript
function TogglePill({
  label,
  active,
  onClick,
  premium,
  isPro,
}: {
  label: string
  active: boolean
  onClick: () => void
  premium?: boolean
  isPro?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 flex-shrink-0
        ${
          active
            ? "bg-white/20 text-white shadow-inner shadow-white/10"
            : "bg-black/30 text-white/70 hover:bg-black/40 hover:text-white/90"
        }
      `}
    >
      {label}
      <ProBadge show={!!premium && !isPro} />
    </button>
  )
}
```

- [ ] **Step 5: Add Deep Work config section**

After the breathing config section (around line 300, after `{/* Breathing config */}`), add:

```typescript
      {/* Deep Work config */}
      {mode === "deepwork" && (
        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <TogglePill label="Timed" active={deepWorkTimedMode} onClick={onDeepWorkTimedModeToggle} />
            <TogglePill label="Free" active={!deepWorkTimedMode} onClick={onDeepWorkTimedModeToggle} />
          </div>

          {deepWorkTimedMode && (
            <div className="grid grid-cols-2 gap-2">
              {[45, 60, 90, 120].map((d) => (
                <button key={d} onClick={() => onDeepWorkDurationChange(d)} className={`px-2.5 py-2 rounded-xl text-sm font-medium transition-all ${deepWorkDuration === d ? "bg-white/20 text-white shadow-inner shadow-white/10" : "bg-black/30 text-white/70 hover:bg-black/40"}`}>
                  {d} min
                </button>
              ))}
            </div>
          )}

          <TogglePill label="Haptic" active={deepWorkHaptic} onClick={onDeepWorkHapticToggle} />
        </div>
      )}
```

- [ ] **Step 6: Verify build compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Build will fail because `flip-clock.tsx` doesn't pass the new props yet — that's expected, we fix it in Task 6.

- [ ] **Step 7: Commit**

```bash
git add components/settings-panel.tsx
git commit -m "feat(deep-work): add deep work settings section and scrollable mode selector"
```

---

### Task 6: Flip Clock Integration

**Files:**
- Modify: `components/flip-clock.tsx`

This is the main integration task. Changes:
1. Import deep work hook and flame component
2. Add persisted state for deep work config
3. Create `deepWorkConfig` with `useMemo`
4. Call `useDeepWork` hook
5. Update `effectiveIsRunning`/`effectiveToggle`/`effectiveReset` (3-way)
6. Update `handleModeChange` to reset deep work
7. Update `MODES` array
8. Record deep work session on completion
9. Show task input for deep work mode
10. Render `DeepWorkFlame` conditionally
11. Pass deep work props to `SettingsPanel`

- [ ] **Step 1: Add imports**

At the top of `flip-clock.tsx`, add after the breathing import (line 17):

```typescript
import { DeepWorkFlame } from "./deep-work-flame"
import { useDeepWork, type DeepWorkConfig } from "@/hooks/use-deep-work"
```

- [ ] **Step 2: Add persisted state for deep work config**

After the breathing persisted state lines (around line 137), add:

```typescript
  const [deepWorkTimedMode, setDeepWorkTimedMode] = usePersistedState("pomo-deepwork-timed", true)
  const [deepWorkDuration, setDeepWorkDuration] = usePersistedState("pomo-deepwork-duration", 60)
  const [deepWorkHaptic, setDeepWorkHaptic] = usePersistedState("pomo-deepwork-haptic", true)
```

- [ ] **Step 3: Create deepWorkConfig and call the hook**

After the `breathingConfig` useMemo and `useBreathing` call (around line 211), add:

```typescript
  const deepWorkConfig: DeepWorkConfig = useMemo(() => ({
    timedMode: deepWorkTimedMode,
    durationMinutes: deepWorkDuration,
    hapticEnabled: deepWorkHaptic,
  }), [deepWorkTimedMode, deepWorkDuration, deepWorkHaptic])

  const deepWork = useDeepWork(deepWorkConfig)
```

- [ ] **Step 4: Update effectiveIsRunning (3-way)**

Change line 282:

From:
```typescript
  const effectiveIsRunning = timer.mode === "breathing" ? breathing.isRunning : timer.isRunning
```

To:
```typescript
  const effectiveIsRunning = timer.mode === "breathing" ? breathing.isRunning : timer.mode === "deepwork" ? deepWork.isRunning : timer.isRunning
```

- [ ] **Step 5: Update effectiveToggle (3-way)**

Change the `effectiveToggle` callback (around line 284):

From:
```typescript
  const effectiveToggle = useCallback(() => {
    if (timer.mode === "breathing") breathing.toggle()
    else timer.toggleRunning()
  }, [timer.mode, breathing.toggle, timer.toggleRunning])
```

To:
```typescript
  const effectiveToggle = useCallback(() => {
    if (timer.mode === "breathing") breathing.toggle()
    else if (timer.mode === "deepwork") deepWork.toggle()
    else timer.toggleRunning()
  }, [timer.mode, breathing.toggle, deepWork.toggle, timer.toggleRunning])
```

- [ ] **Step 6: Update effectiveReset (3-way)**

Change the `effectiveReset` callback (around line 289):

From:
```typescript
  const effectiveReset = useCallback(() => {
    if (timer.mode === "breathing") breathing.reset()
    else handleReset()
  }, [timer.mode, breathing.reset, handleReset])
```

To:
```typescript
  const effectiveReset = useCallback(() => {
    if (timer.mode === "breathing") breathing.reset()
    else if (timer.mode === "deepwork") deepWork.reset()
    else handleReset()
  }, [timer.mode, breathing.reset, deepWork.reset, handleReset])
```

- [ ] **Step 7: Update handleModeChange to reset deep work**

Change the `handleModeChange` callback (around line 294):

From:
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

To:
```typescript
  const handleModeChange = useCallback(
    (mode: Mode) => {
      savePartialSession()
      if (timer.mode === "breathing") breathing.reset()
      if (timer.mode === "deepwork") deepWork.reset()
      timer.setMode(mode)
    },
    [savePartialSession, timer, breathing.reset, deepWork.reset]
  )
```

- [ ] **Step 8: Update MODES array**

Change line 552:

From:
```typescript
  const MODES: Mode[] = ["clock", "pomo", "stopwatch", "breathing"]
```

To:
```typescript
  const MODES: Mode[] = ["clock", "pomo", "stopwatch", "breathing", "deepwork"]
```

- [ ] **Step 9: Record deep work session on completion**

After the breathing session recording block (around line 255), add:

```typescript
  // Record deep work session on completion
  const prevDeepWorkComplete = useRef(false)
  useEffect(() => {
    if (deepWork.isComplete && !prevDeepWorkComplete.current) {
      recordAndRefresh({
        task: currentTask || "Deep Work",
        phase: "deepwork",
        durationMinutes: Math.max(1, Math.round(deepWork.totalDuration / 60)),
        completedAt: new Date().toISOString(),
      })
    }
    prevDeepWorkComplete.current = deepWork.isComplete
  }, [deepWork.isComplete, deepWork.totalDuration, recordAndRefresh, currentTask])
```

- [ ] **Step 10: Show task input for deep work mode**

Change line 728:

From:
```typescript
        {timer.mode === "pomo" && !zoomed && (
```

To:
```typescript
        {(timer.mode === "pomo" || timer.mode === "deepwork") && !zoomed && (
```

- [ ] **Step 11: Render DeepWorkFlame in the timer area**

Change line 783 — the conditional rendering block. Currently it's:

```typescript
          {timer.mode === "breathing" ? (
            <BreathingBubble ... />
          ) : (
            <>
              {/* FlipGroup, ProgressRing, etc. */}
            </>
          )}
```

Change to:

```typescript
          {timer.mode === "breathing" ? (
            <BreathingBubble ... />
          ) : timer.mode === "deepwork" ? (
            <DeepWorkFlame
              stage={deepWork.stage}
              stageLabel={deepWork.stageLabel}
              progress={deepWork.progress}
              isComplete={deepWork.isComplete}
              isRunning={deepWork.isRunning}
              elapsedTime={deepWork.elapsedTime}
              pauseCount={deepWork.pauseCount}
              totalPauseTime={deepWork.totalPauseTime}
              totalDuration={deepWork.totalDuration}
              maxStageReached={deepWork.maxStageReached}
              taskName={currentTask}
              colorA={theme.a}
              colorB={theme.b}
              fpsMode={fpsMode}
              onDismissRecap={() => deepWork.reset()}
            />
          ) : (
            <>
              {/* existing FlipGroup/ProgressRing code stays as-is */}
            </>
          )}
```

Note: `maxStageLabel` is computed inside the `DeepWorkFlame` component from `maxStageReached` using its internal `STAGE_LABELS_MAP`, so no label prop is needed from flip-clock.

- [ ] **Step 12: Disable zoom for deep work mode**

Find the zoomed scale style (around line 773):

```typescript
            ...(zoomed && timer.mode !== "breathing" ? { transform: "scale(1.35)" } : {}),
```

Change to:
```typescript
            ...(zoomed && timer.mode !== "breathing" && timer.mode !== "deepwork" ? { transform: "scale(1.35)" } : {}),
```

- [ ] **Step 13: Pass deep work props to SettingsPanel**

In the `<SettingsPanel>` JSX (around line 867-922), add after the breathing props:

```typescript
            deepWorkTimedMode={deepWorkTimedMode}
            onDeepWorkTimedModeToggle={() => setDeepWorkTimedMode((v) => !v)}
            deepWorkDuration={deepWorkDuration}
            onDeepWorkDurationChange={setDeepWorkDuration}
            deepWorkHaptic={deepWorkHaptic}
            onDeepWorkHapticToggle={() => setDeepWorkHaptic((v) => !v)}
```

- [ ] **Step 14: Verify build compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 15: Commit**

```bash
git add components/flip-clock.tsx
git commit -m "feat(deep-work): integrate deep work hook and flame component into flip-clock"
```

---

### Task 7: Stats Panel and Onboarding

**Files:**
- Modify: `components/stats-panel.tsx` — Add Deep Work stats section
- Modify: `components/onboarding-overlay.tsx` — Update tutorial text

- [ ] **Step 1: Add Deep Work stats import**

In `components/stats-panel.tsx`, add `getDeepWorkStats` to the import from `@/lib/session-store` (line 23):

```typescript
  getBreathingStats,
  getDeepWorkStats,
```

- [ ] **Step 2: Add Deep Work stats state**

After the `breathingStats` state (around line 178), add:

```typescript
  const [deepWorkStats, setDeepWorkStats] = useState({ totalMinutes: 0, sessionCount: 0, averageMinutes: 0, longestMinutes: 0 })
```

- [ ] **Step 3: Load Deep Work stats in the refresh effect**

Find where `setBreathingStats(getBreathingStats())` is called (around line 199), and add after it:

```typescript
    setDeepWorkStats(getDeepWorkStats())
```

- [ ] **Step 4: Add Deep Work stats section in the JSX**

After the Breathing stats section (around line 470-482), add:

```typescript
      {/* Deep Work stats */}
      {deepWorkStats.sessionCount > 0 && (
        <div className="mb-4">
          <p className="text-white/80 text-sm font-semibold mb-2">Deep Work</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/8 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{formatMinutesShort(deepWorkStats.totalMinutes)}</p>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mt-0.5">Total</p>
            </div>
            <div className="bg-white/8 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{deepWorkStats.sessionCount}</p>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mt-0.5">Sessions</p>
            </div>
            <div className="bg-white/8 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{deepWorkStats.averageMinutes}m</p>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mt-0.5">Average</p>
            </div>
            <div className="bg-white/8 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{deepWorkStats.longestMinutes}m</p>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mt-0.5">Longest</p>
            </div>
          </div>
        </div>
      )}
```

Note: `formatMinutesShort` is already defined in `stats-panel.tsx` and used by the Breathing section.

- [ ] **Step 5: Update onboarding tutorial**

In `components/onboarding-overlay.tsx`, update the settings step description (line 40):

From:
```typescript
    description: "Configure durations, modes (Clock, Pomo, Stopwatch, Breathe), and preferences.",
```

To:
```typescript
    description: "Configure durations, modes (Clock, Pomo, Timer, Breathe, Deep), and preferences.",
```

And update the statistics step description (line 55):

From:
```typescript
    description: "Track your focus sessions and breathing exercises over time.",
```

To:
```typescript
    description: "Track your focus sessions, deep work, and breathing exercises over time.",
```

- [ ] **Step 6: Verify build compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 7: Commit**

```bash
git add components/stats-panel.tsx components/onboarding-overlay.tsx
git commit -m "feat(deep-work): add deep work stats section and update onboarding tutorial"
```

---

### Task 8: Final Build and APK

- [ ] **Step 1: Full build verification**

Run: `npx next build 2>&1 | tail -10`
Expected: `BUILD SUCCESSFUL` with no errors

- [ ] **Step 2: Sync and build APK**

```bash
npx cap sync android
cd android && ./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit all remaining changes**

If there are any uncommitted fixes from build issues:

```bash
git add -A
git commit -m "fix(deep-work): resolve build issues"
```
