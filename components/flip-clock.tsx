"use client"

import { useEffect, useState } from "react"
import { Maximize, Palette } from "lucide-react"
import { FlipGroup } from "./flip-group"
import { LiquidButton } from "./ui/liquid-glass-button"

const COLOR_THEMES = [
  { a: "#1a3a5c", b: "#e8a830", label: "Bleu & Ambre" },
  { a: "#5c1a2a", b: "#e8a830", label: "Bordeaux & Or" },
  { a: "#0f3460", b: "#e94560", label: "Nuit & Corail" },
  { a: "#1a1a2e", b: "#00d2ff", label: "Sombre & Cyan" },
  { a: "#2d1b69", b: "#f97316", label: "Indigo & Orange" },
  { a: "#134e4a", b: "#fbbf24", label: "Emeraude & Dore" },
] as const

function getTime() {
  const now = new Date()
  return {
    hours: String(now.getHours()).padStart(2, "0"),
    minutes: String(now.getMinutes()).padStart(2, "0"),
    seconds: String(now.getSeconds()).padStart(2, "0"),
  }
}

export function FlipClock() {
  const [time, setTime] = useState<ReturnType<typeof getTime> | null>(null)
  const [themeIndex, setThemeIndex] = useState(0)

  const theme = COLOR_THEMES[themeIndex]

  useEffect(() => {
    setTime(getTime())
    const interval = setInterval(() => {
      setTime(getTime())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

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

  return (
    <main
      className="flip-clock-bg relative"
      style={
        {
          "--theme-a": theme.a,
          "--theme-b": theme.b,
        } as React.CSSProperties
      }
    >
      <div className="flex flex-col items-center justify-center min-h-svh gap-5 sm:gap-8 py-8">
        {time ? (
          <>
            <FlipGroup value={time.hours} />
            <FlipGroup value={time.minutes} />
            <FlipGroup value={time.seconds} />
          </>
        ) : (
          <>
            <FlipGroup value="00" />
            <FlipGroup value="00" />
            <FlipGroup value="00" />
          </>
        )}
      </div>

      <div className="absolute bottom-[12%] sm:bottom-[10%] inset-x-0 z-50 flex justify-center gap-4">
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
