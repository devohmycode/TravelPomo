"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { isNativePlatform, isTauriPlatform } from "@/lib/platform"

export type BreathingPhase = "idle" | "inhale" | "hold" | "exhale"

export interface BreathingPreset {
  name: string
  inhale: number
  exhale: number
  hold: number
}

export const BREATHING_PRESETS: BreathingPreset[] = [
  { name: "Relaxation", inhale: 5, exhale: 5, hold: 0 },
  { name: "Calming", inhale: 4, exhale: 6, hold: 0 },
  { name: "Energize", inhale: 6, exhale: 4, hold: 0 },
]

export interface BreathingConfig {
  inhale: number
  exhale: number
  hold: number
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
  hapticEnabled: true,
}

function easeInOut(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export interface BreathingState {
  phase: BreathingPhase
  progress: number
  rawProgress: number
  cycleCount: number
  elapsedTime: number
  isRunning: boolean
  isLastCycle: boolean
  isComplete: boolean
  totalDuration: number
  totalCycles: number
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

function getPhaseDuration(p: BreathingPhase, c: BreathingConfig): number {
  if (p === "inhale") return c.inhale
  if (p === "exhale") return c.exhale
  if (p === "hold") return c.hold
  return 0
}

function getNextPhase(current: BreathingPhase, c: BreathingConfig): BreathingPhase {
  if (current === "inhale") return c.hold > 0 ? "hold" : "exhale"
  if (current === "hold") return "exhale"
  return "inhale"
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
    }, 50)

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
        if (configRef.current.hapticEnabled) triggerHaptic("Light")
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
