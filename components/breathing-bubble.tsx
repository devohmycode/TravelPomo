"use client"

import { useEffect, useRef, useCallback } from "react"
import type { BreathingPhase } from "@/hooks/use-breathing"

interface BreathingBubbleProps {
  phase: BreathingPhase
  progress: number
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

const prefersReducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false

// Auto-dismiss recap after 5 seconds
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
  )
}

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
  const fadeRef = useRef(1)

  // Store props in refs for the draw loop
  const propsRef = useRef({ phase, progress, isComplete, colorA, colorB })
  propsRef.current = { phase, progress, isComplete, colorA, colorB }

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

    const { phase: p, progress: prog, isComplete: done, colorA: cA, colorB: cB } = propsRef.current

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const cx = w / 2
    const cy = h / 2

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Fade-out at session end
    if (done && fadeRef.current > 0) {
      fadeRef.current = Math.max(0, fadeRef.current - 0.02)
    } else if (!done) {
      fadeRef.current = 1
    }

    if (done && fadeRef.current <= 0) {
      ctx.restore()
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    ctx.globalAlpha = fadeRef.current

    // Calculate bubble position and size
    const baseRadius = w * 0.18
    const minScale = 0.7
    const maxScale = 1.0

    let scale: number
    let yOffset: number

    if (p === "idle" && !done) {
      const pulse = Math.sin(now / 2000 * Math.PI) * 0.02
      scale = 0.85 + pulse
      yOffset = 0
    } else if (p === "inhale") {
      scale = minScale + (maxScale - minScale) * prog
      yOffset = prefersReducedMotion ? 0 : -(h * 0.2) * prog
    } else if (p === "hold") {
      scale = maxScale + Math.sin(now / 500 * Math.PI) * 0.02
      yOffset = prefersReducedMotion ? 0 : -(h * 0.2)
    } else if (p === "exhale") {
      scale = maxScale - (maxScale - minScale) * prog
      yOffset = prefersReducedMotion ? 0 : -(h * 0.2) * (1 - prog)
    } else {
      scale = 0.85
      yOffset = 0
    }

    const radius = baseRadius * scale
    const bubbleX = cx
    const bubbleY = cy + yOffset

    // Drop shadow (radial gradient for Android WebView compatibility)
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
    const glowAlpha = p === "inhale" ? 0.1 + prog * 0.2
      : p === "exhale" ? 0.3 - prog * 0.2
      : p === "hold" ? 0.3
      : 0.15
    const glowGrad = ctx.createRadialGradient(
      bubbleX, bubbleY, radius,
      bubbleX, bubbleY, radius * 1.6
    )
    glowGrad.addColorStop(0, hexToRgba(cA, glowAlpha))
    glowGrad.addColorStop(1, hexToRgba(cA, 0))
    ctx.beginPath()
    ctx.arc(bubbleX, bubbleY, radius * 1.6, 0, Math.PI * 2)
    ctx.fillStyle = glowGrad
    ctx.fill()

    // Main bubble with radial gradient
    const grad = ctx.createRadialGradient(
      bubbleX - radius * 0.3, bubbleY - radius * 0.3, radius * 0.1,
      bubbleX, bubbleY, radius
    )
    grad.addColorStop(0, cA)
    grad.addColorStop(1, cB)
    ctx.beginPath()
    ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    // Subtle reflection
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
          {isLastCycle && " \u00b7 Last cycle"}
        </span>
      )}

      {/* Preset indicator when idle */}
      {phase === "idle" && !isComplete && !isRunning && (
        <span className="text-white/50 text-xs font-medium uppercase tracking-wider">
          {presetName}
        </span>
      )}

      {/* Canvas or Recap */}
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
        <RecapScreen
          totalDuration={totalDuration}
          totalCycles={totalCycles}
          presetName={presetName}
          onDismiss={onDismissRecap}
        />
      )}

      {/* Elapsed time and cycle count */}
      {phase !== "idle" && !isComplete && (
        <div className="flex items-center gap-3 text-white/40 text-xs" aria-live="polite">
          <span>{formatTime(elapsedTime)}</span>
          <span>&middot;</span>
          <span>{cycleCount} {cycleCount === 1 ? "cycle" : "cycles"}</span>
        </div>
      )}
    </div>
  )
}
