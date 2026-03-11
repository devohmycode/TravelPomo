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
      burstRef.current = Math.min(1, burstRef.current + 0.035)
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
    const glowBase = 0.05 + stageNorm * 0.35
    const glowPulse = Math.sin(now / 1000 * Math.PI) * 0.05 * (stageNorm + 0.3)
    const glowAlpha = glowBase + glowPulse

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
      const vividness = 0.6 + stageNorm * 0.4 // 0.6 at stage 1, 1.0 at stage 8
      if (layer === 0) {
        flameGrad.addColorStop(0, cB)
        flameGrad.addColorStop(0.5, cA)
        flameGrad.addColorStop(1, hexToRgba(cA, 0.4 + stageNorm * 0.4))
      } else {
        flameGrad.addColorStop(0, hexToRgba(cA, 0.4 * layerAlpha * vividness))
        flameGrad.addColorStop(1, hexToRgba(cB, 0.1 * layerAlpha * vividness))
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
      const particleRate = prefersReducedMotion ? Math.max(1, Math.floor(s / 2)) : s * 2.5
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
        <div className="flex flex-col items-center gap-1">
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
