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

export const STAGE_LABELS = [
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
    }, 250)

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
