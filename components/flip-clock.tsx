"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Maximize, Palette, Timer, Settings } from "lucide-react"
import { FlipGroup } from "./flip-group"
import { LiquidButton } from "./ui/liquid-glass-button"
import { SettingsPanel } from "./settings-panel"

const COLOR_THEMES = [
  { a: "#1a3a5c", b: "#e8a830", label: "Bleu & Ambre" },
  { a: "#5c1a2a", b: "#e8a830", label: "Bordeaux & Or" },
  { a: "#0f3460", b: "#e94560", label: "Nuit & Corail" },
  { a: "#1a1a2e", b: "#00d2ff", label: "Sombre & Cyan" },
  { a: "#2d1b69", b: "#f97316", label: "Indigo & Orange" },
  { a: "#134e4a", b: "#fbbf24", label: "Emeraude & Dore" },
] as const

type Mode = "clock" | "pomo" | "stopwatch"

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function lerpColor(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
  t: number
) {
  const r = Math.round(c1.r + (c2.r - c1.r) * t)
  const g = Math.round(c1.g + (c2.g - c1.g) * t)
  const b = Math.round(c1.b + (c2.b - c1.b) * t)
  return `rgb(${r},${g},${b})`
}

function getTime(use24Hour: boolean) {
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

export function FlipClock() {
  const [mode, setMode] = useState<Mode>("clock")
  const [use24Hour, setUse24Hour] = useState(true)
  const [showSeconds, setShowSeconds] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [themeIndex, setThemeIndex] = useState(0)

  // Clock state
  const [time, setTime] = useState<{ hours: string; minutes: string; seconds: string } | null>(null)

  // Pomodoro state
  const [pomoRemaining, setPomoRemaining] = useState(25 * 60) // 25 min
  const [pomoRunning, setPomoRunning] = useState(false)

  // Stopwatch state
  const [swElapsed, setSwElapsed] = useState(0)
  const [swRunning, setSwRunning] = useState(false)

  // Background animation
  const bgRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const theme = COLOR_THEMES[themeIndex]
  const themeRef = useRef(theme)
  themeRef.current = theme

  const animateBg = useCallback(() => {
    const el = bgRef.current
    if (!el) return
    const CYCLE = 8000
    const t = (Date.now() % CYCLE) / CYCLE
    const mix = (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2
    const colorA = hexToRgb(themeRef.current.a)
    const colorB = hexToRgb(themeRef.current.b)
    const startColor = lerpColor(colorA, colorB, mix)
    const endColor = lerpColor(colorB, colorA, mix)
    el.style.background = `linear-gradient(135deg, ${startColor} 0%, ${endColor} 100%)`
    rafRef.current = requestAnimationFrame(animateBg)
  }, [])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animateBg)
    return () => cancelAnimationFrame(rafRef.current)
  }, [animateBg])

  // Clock tick
  useEffect(() => {
    setTime(getTime(use24Hour))
    const interval = setInterval(() => {
      setTime(getTime(use24Hour))
    }, 1000)
    return () => clearInterval(interval)
  }, [use24Hour])

  // Pomodoro tick
  useEffect(() => {
    if (!pomoRunning) return
    const interval = setInterval(() => {
      setPomoRemaining((prev) => {
        if (prev <= 0) {
          setPomoRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [pomoRunning])

  // Stopwatch tick
  useEffect(() => {
    if (!swRunning) return
    const interval = setInterval(() => {
      setSwElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [swRunning])

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  const cycleTheme = () => {
    setThemeIndex((prev) => (prev + 1) % COLOR_THEMES.length)
  }

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode)
    if (newMode === "pomo") {
      setPomoRemaining(25 * 60)
      setPomoRunning(false)
    }
    if (newMode === "stopwatch") {
      setSwElapsed(0)
      setSwRunning(false)
    }
  }

  // Compute displayed values
  let displayHours: string | null = null
  let displayMinutes: string
  let displaySeconds: string

  if (mode === "clock") {
    displayHours = time?.hours ?? "00"
    displayMinutes = time?.minutes ?? "00"
    displaySeconds = time?.seconds ?? "00"
  } else if (mode === "pomo") {
    const pomo = formatTimer(pomoRemaining)
    displayMinutes = pomo.minutes
    displaySeconds = pomo.seconds
  } else {
    const sw = formatTimer(swElapsed)
    displayMinutes = sw.minutes
    displaySeconds = sw.seconds
  }

  const handleTimerTap = () => {
    if (mode === "pomo") {
      setPomoRunning((r) => !r)
    } else if (mode === "stopwatch") {
      setSwRunning((r) => !r)
    }
  }

  const isTimerActive =
    (mode === "pomo" && pomoRunning) || (mode === "stopwatch" && swRunning)

  return (
    <main className="relative min-h-svh overflow-hidden">
      <div ref={bgRef} className="absolute inset-0" style={{ zIndex: 0 }} />

      {/* Clock display */}
      <div
        className="relative flex flex-col items-center justify-center min-h-svh gap-5 sm:gap-8 py-8"
        style={{ zIndex: 1 }}
      >
        {mode === "clock" && displayHours !== null && (
          <FlipGroup value={displayHours} />
        )}
        <FlipGroup value={displayMinutes} />
        {showSeconds && <FlipGroup value={displaySeconds} />}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ zIndex: 10, bottom: "18%" }}
        >
          <SettingsPanel
            mode={mode}
            onModeChange={handleModeChange}
            showSeconds={showSeconds}
            onToggleSeconds={() => setShowSeconds((s) => !s)}
            use24Hour={use24Hour}
            onToggle24Hour={() => setUse24Hour((u) => !u)}
            onClose={() => setShowSettings(false)}
          />
        </div>
      )}

      {/* Buttons */}
      <div
        className="absolute bottom-[8%] sm:bottom-[6%] inset-x-0 flex justify-center gap-3"
        style={{ zIndex: 11 }}
      >
        {/* Timer play/pause (only in pomo/stopwatch) */}
        {mode !== "clock" && (
          <LiquidButton
            size="icon"
            onClick={handleTimerTap}
            aria-label={isTimerActive ? "Pause" : "Demarrer"}
            className={`rounded-full size-12 sm:size-14 transition-all duration-200 ${
              isTimerActive ? "ring-2 ring-white/40 ring-offset-1 ring-offset-transparent" : ""
            }`}
          >
            <Timer className={`size-4 sm:size-5 ${isTimerActive ? "text-white" : "text-white/80"}`} />
          </LiquidButton>
        )}

        <LiquidButton
          size="icon"
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Parametres"
          className={`rounded-full size-12 sm:size-14 transition-all duration-200 ${
            showSettings ? "ring-2 ring-white/40 ring-offset-1 ring-offset-transparent" : ""
          }`}
        >
          <Settings className={`size-4 sm:size-5 ${showSettings ? "text-white" : "text-white/80"}`} />
        </LiquidButton>

        <LiquidButton
          size="icon"
          onClick={cycleTheme}
          aria-label="Changer les couleurs"
          className="rounded-full size-12 sm:size-14"
        >
          <Palette className="size-4 sm:size-5 text-white/80" />
        </LiquidButton>

        <LiquidButton
          size="icon"
          onClick={handleFullscreen}
          aria-label="Plein ecran"
          className="rounded-full size-12 sm:size-14"
        >
          <Maximize className="size-4 sm:size-5 text-white/80" />
        </LiquidButton>
      </div>
    </main>
  )
}
