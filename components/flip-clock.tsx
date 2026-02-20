"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  const bgRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  const theme = COLOR_THEMES[themeIndex]
  const themeRef = useRef(theme)
  themeRef.current = theme

  // Animate the background gradient with JS
  const animateBg = useCallback(() => {
    const el = bgRef.current
    if (!el) return

    const CYCLE = 8000
    const t = (Date.now() % CYCLE) / CYCLE
    // Sine wave 0->1->0 for smooth back-and-forth
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
    <main className="relative min-h-svh overflow-hidden">
      <div ref={bgRef} className="absolute inset-0" style={{ zIndex: 0 }} />
      <div className="relative flex flex-col items-center justify-center min-h-svh gap-5 sm:gap-8 py-8" style={{ zIndex: 1 }}>
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

      <div className="absolute bottom-[12%] sm:bottom-[10%] inset-x-0 flex justify-center gap-4" style={{ zIndex: 2 }}>
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
