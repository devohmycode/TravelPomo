"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  type PomodoroConfig,
  type PomodoroState,
  type PomodoroPhase,
  DEFAULT_CONFIG,
  createInitialState,
  advancePhase,
  resetPhase,
  resetAll,
  getPhaseSeconds,
} from "@/lib/pomodoro"
import { syncWidgetState, forceSyncWidgetState } from "@/lib/widget-bridge"

export type Mode = "clock" | "pomo" | "stopwatch"

interface ClockValues {
  hours: string
  minutes: string
  seconds: string
}

export interface TimerState {
  mode: Mode
  setMode: (mode: Mode) => void

  // Clock
  clock: ClockValues

  // Pomodoro
  pomo: PomodoroState
  pomoConfig: PomodoroConfig
  setPomoConfig: (config: PomodoroConfig) => void
  pomoProgress: number // 0-1

  // Stopwatch
  swElapsed: number // seconds
  laps: number[] // cumulative seconds at each lap

  // Shared actions
  isRunning: boolean
  toggleRunning: () => void
  reset: () => void
  skipPhase: () => void
  addLap: () => void

  // Display values
  displayHours: string | null
  displayMinutes: string
  displaySeconds: string

  // Callbacks for notifications
  onPhaseComplete: React.MutableRefObject<
    ((phase: PomodoroPhase, completedSessions: number) => void) | null
  >

  // Widget sync
  taskRef: React.MutableRefObject<string>
}

function getTime(use24Hour: boolean): ClockValues {
  const now = new Date()
  let hours = now.getHours()
  if (!use24Hour) {
    hours = hours % 12 || 12
  }
  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(now.getMinutes()).padStart(2, "0"),
    seconds: String(now.getSeconds()).padStart(2, "0"),
  }
}

function formatTimer(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return {
    minutes: String(m).padStart(2, "0"),
    seconds: String(s).padStart(2, "0"),
  }
}

export function useTimer(use24Hour: boolean): TimerState {
  const [mode, setModeInternal] = useState<Mode>("clock")
  const [clock, setClock] = useState<ClockValues>({ hours: "00", minutes: "00", seconds: "00" })

  // Pomodoro
  const [pomoConfig, setPomoConfig] = useState<PomodoroConfig>(DEFAULT_CONFIG)
  const [pomo, setPomo] = useState<PomodoroState>(() =>
    createInitialState(DEFAULT_CONFIG)
  )

  // Stopwatch
  const [swElapsed, setSwElapsed] = useState(0)
  const [swRunning, setSwRunning] = useState(false)
  const [laps, setLaps] = useState<number[]>([])

  // Drift-resistant timing refs
  const pomoStartRef = useRef<number | null>(null)
  const pomoRemainingAtStart = useRef<number>(0)
  const swStartRef = useRef<number | null>(null)
  const swElapsedAtStart = useRef<number>(0)

  // Notification callback ref
  const onPhaseComplete = useRef<
    ((phase: PomodoroPhase, completedSessions: number) => void) | null
  >(null)

  // Widget sync task ref (set by component)
  const taskRef = useRef("")

  // Clock tick
  useEffect(() => {
    setClock(getTime(use24Hour))
    const interval = setInterval(() => {
      setClock(getTime(use24Hour))
    }, 1000)
    return () => clearInterval(interval)
  }, [use24Hour])

  // Pomodoro tick - drift resistant
  useEffect(() => {
    if (!pomo.running) {
      pomoStartRef.current = null
      return
    }
    if (pomoStartRef.current === null) {
      pomoStartRef.current = Date.now()
      pomoRemainingAtStart.current = pomo.remaining
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - pomoStartRef.current!) / 1000
      )
      const remaining = Math.max(
        0,
        pomoRemainingAtStart.current - elapsed
      )

      setPomo((prev) => {
        if (remaining <= 0 && prev.running) {
          const completedPhase = prev.phase
          const completedSessions =
            prev.phase === "work"
              ? prev.completedSessions + 1
              : prev.completedSessions
          // Fire notification callback
          onPhaseComplete.current?.(completedPhase, completedSessions)
          const next = { ...prev, remaining: 0, running: false }
          forceSyncWidgetState(next, pomoConfig, taskRef.current)
          return next
        }
        const next = { ...prev, remaining }
        syncWidgetState(next, pomoConfig, taskRef.current)
        return next
      })
    }, 250) // Check 4x/sec for responsiveness

    return () => clearInterval(interval)
  }, [pomo.running])

  // Stopwatch tick - drift resistant
  useEffect(() => {
    if (!swRunning) {
      swStartRef.current = null
      return
    }
    if (swStartRef.current === null) {
      swStartRef.current = Date.now()
      swElapsedAtStart.current = swElapsed
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - swStartRef.current!) / 1000
      )
      setSwElapsed(swElapsedAtStart.current + elapsed)
    }, 250)

    return () => clearInterval(interval)
  }, [swRunning])

  const setMode = useCallback(
    (newMode: Mode) => {
      setModeInternal(newMode)
      if (newMode === "pomo") {
        setPomo(createInitialState(pomoConfig))
        pomoStartRef.current = null
      }
      if (newMode === "stopwatch") {
        setSwElapsed(0)
        setSwRunning(false)
        setLaps([])
        swStartRef.current = null
      }
    },
    [pomoConfig]
  )

  const isRunning =
    (mode === "pomo" && pomo.running) || (mode === "stopwatch" && swRunning)

  const toggleRunning = useCallback(() => {
    if (mode === "pomo") {
      setPomo((prev) => {
        if (!prev.running) {
          // Starting - reset drift tracking
          pomoStartRef.current = Date.now()
          pomoRemainingAtStart.current = prev.remaining
        }
        const next = { ...prev, running: !prev.running }
        forceSyncWidgetState(next, pomoConfig, taskRef.current)
        return next
      })
    } else if (mode === "stopwatch") {
      setSwRunning((r) => {
        if (!r) {
          // Starting - reset drift tracking
          swStartRef.current = Date.now()
          swElapsedAtStart.current = swElapsed
        }
        return !r
      })
    }
  }, [mode, swElapsed, pomoConfig])

  const reset = useCallback(() => {
    if (mode === "pomo") {
      setPomo((prev) => {
        const next = resetPhase(prev, pomoConfig)
        forceSyncWidgetState(next, pomoConfig, taskRef.current)
        return next
      })
      pomoStartRef.current = null
    } else if (mode === "stopwatch") {
      setSwElapsed(0)
      setSwRunning(false)
      setLaps([])
      swStartRef.current = null
    }
  }, [mode, pomoConfig])

  const skipPhase = useCallback(() => {
    if (mode === "pomo") {
      setPomo((prev) => {
        const next = advancePhase(prev, pomoConfig)
        forceSyncWidgetState(next, pomoConfig, taskRef.current)
        return next
      })
      pomoStartRef.current = null
    }
  }, [mode, pomoConfig])

  const addLap = useCallback(() => {
    if (mode === "stopwatch" && swRunning) {
      setLaps((prev) => [...prev, swElapsed])
    }
  }, [mode, swRunning, swElapsed])

  const resetAllPomo = useCallback(() => {
    setPomo(resetAll(pomoConfig))
    pomoStartRef.current = null
  }, [pomoConfig])

  // When config changes while not running, update remaining time
  useEffect(() => {
    if (!pomo.running) {
      const totalSeconds = getPhaseSeconds(pomo.phase, pomoConfig)
      setPomo((prev) => ({
        ...prev,
        remaining: totalSeconds,
        totalSeconds,
      }))
    }
  }, [pomoConfig, pomo.phase, pomo.running])

  // Compute displayed values
  let displayHours: string | null = null
  let displayMinutes: string
  let displaySeconds: string

  if (mode === "clock") {
    displayHours = clock.hours
    displayMinutes = clock.minutes
    displaySeconds = clock.seconds
  } else if (mode === "pomo") {
    const fmt = formatTimer(pomo.remaining)
    displayMinutes = fmt.minutes
    displaySeconds = fmt.seconds
  } else {
    const fmt = formatTimer(swElapsed)
    displayMinutes = fmt.minutes
    displaySeconds = fmt.seconds
  }

  const pomoProgress =
    pomo.totalSeconds > 0
      ? 1 - pomo.remaining / pomo.totalSeconds
      : 0

  return {
    mode,
    setMode,
    clock,
    pomo,
    pomoConfig,
    setPomoConfig,
    pomoProgress,
    swElapsed,
    laps,
    isRunning,
    toggleRunning,
    reset,
    skipPhase,
    addLap,
    displayHours,
    displayMinutes,
    displaySeconds,
    onPhaseComplete,
    taskRef,
  }
}
