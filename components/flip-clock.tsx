"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Maximize, Timer, Settings, Droplets } from "lucide-react"
import { FlipGroup } from "./flip-group"
import { LiquidButton } from "./ui/liquid-glass-button"
import { SettingsPanel } from "./settings-panel"
import { RainCanvas } from "./rain-canvas"
import { SnowCanvas } from "./snow-canvas"
import {
  ColorPanel,
  THEMES,
  type BackgroundType,
  type OverlayEffect,
} from "./color-panel"

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
  const [showColorPanel, setShowColorPanel] = useState(false)
  const [themeIndex, setThemeIndex] = useState(0)
  const [bgType, setBgType] = useState<BackgroundType>("linear")
  const [overlay, setOverlay] = useState<OverlayEffect>("none")

  // Clock state
  const [time, setTime] = useState<{
    hours: string
    minutes: string
    seconds: string
  } | null>(null)

  // Pomodoro state
  const [pomoRemaining, setPomoRemaining] = useState(25 * 60)
  const [pomoRunning, setPomoRunning] = useState(false)

  // Stopwatch state
  const [swElapsed, setSwElapsed] = useState(0)
  const [swRunning, setSwRunning] = useState(false)

  // Background animation
  const bgRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const theme = THEMES[themeIndex]
  const themeRef = useRef(theme)
  const bgTypeRef = useRef(bgType)
  themeRef.current = theme
  bgTypeRef.current = bgType

  const animateBg = useCallback(() => {
    const el = bgRef.current
    if (!el) return
    const CYCLE = 8000
    const t = (Date.now() % CYCLE) / CYCLE
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
    if (mode === "pomo") setPomoRunning((r) => !r)
    else if (mode === "stopwatch") setSwRunning((r) => !r)
  }

  const isTimerActive =
    (mode === "pomo" && pomoRunning) || (mode === "stopwatch" && swRunning)

  const togglePanel = (panel: "settings" | "color") => {
    if (panel === "settings") {
      setShowSettings((s) => !s)
      if (!showSettings) setShowColorPanel(false)
    } else {
      setShowColorPanel((s) => !s)
      if (!showColorPanel) setShowSettings(false)
    }
  }

  return (
    <main className="relative min-h-svh overflow-hidden">
      {/* Animated background */}
      <div ref={bgRef} className="absolute inset-0" style={{ zIndex: 0 }} />

      {/* Overlay effects */}
      {overlay === "frost" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 0,
            backdropFilter: "blur(2px) brightness(1.05)",
            WebkitBackdropFilter: "blur(2px) brightness(1.05)",
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
          }}
        />
      )}
      {overlay === "rain" && <RainCanvas />}
      {overlay === "snow" && <SnowCanvas />}
      {overlay === "flutes" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 0,
            background:
              "repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 10px)",
          }}
        />
      )}

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

      {/* Color panel */}
      {showColorPanel && (
        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ zIndex: 10, bottom: "18%" }}
        >
          <ColorPanel
            activeThemeIndex={themeIndex}
            onThemeChange={setThemeIndex}
            backgroundType={bgType}
            onBackgroundTypeChange={setBgType}
            overlayEffect={overlay}
            onOverlayEffectChange={setOverlay}
            onClose={() => setShowColorPanel(false)}
          />
        </div>
      )}

      {/* Buttons */}
      <div
        className="absolute bottom-[8%] sm:bottom-[6%] inset-x-0 flex justify-center gap-3"
        style={{ zIndex: 11 }}
      >
        {mode !== "clock" && (
          <LiquidButton
            size="icon"
            onClick={handleTimerTap}
            aria-label={isTimerActive ? "Pause" : "Demarrer"}
            className={`rounded-full size-12 sm:size-14 transition-all duration-200 ${
              isTimerActive
                ? "ring-2 ring-white/40 ring-offset-1 ring-offset-transparent"
                : ""
            }`}
          >
            <Timer
              className={`size-4 sm:size-5 ${isTimerActive ? "text-white" : "text-white/80"}`}
            />
          </LiquidButton>
        )}

        <LiquidButton
          size="icon"
          onClick={() => togglePanel("settings")}
          aria-label="Parametres"
          className={`rounded-full size-12 sm:size-14 transition-all duration-200 ${
            showSettings
              ? "ring-2 ring-white/40 ring-offset-1 ring-offset-transparent"
              : ""
          }`}
        >
          <Settings
            className={`size-4 sm:size-5 ${showSettings ? "text-white" : "text-white/80"}`}
          />
        </LiquidButton>

        <LiquidButton
          size="icon"
          onClick={() => togglePanel("color")}
          aria-label="Couleurs"
          className={`rounded-full size-12 sm:size-14 transition-all duration-200 ${
            showColorPanel
              ? "ring-2 ring-white/40 ring-offset-1 ring-offset-transparent"
              : ""
          }`}
        >
          <Droplets
            className={`size-4 sm:size-5 ${showColorPanel ? "text-white" : "text-white/80"}`}
          />
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
