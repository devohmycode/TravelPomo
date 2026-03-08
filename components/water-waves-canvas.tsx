"use client"

import { useEffect, useRef } from "react"

interface Wave {
  baseY: number       // vertical position as a fraction of canvas height (0-1)
  amplitude: number   // wave height in px
  frequency: number   // how many full cycles across the screen
  speed: number       // how fast the wave moves horizontally
  opacity: number     // fill opacity (0.03-0.08)
  phase: number       // current horizontal phase offset
}

interface WaterWavesCanvasProps {
  fpsMode?: "30" | "60"
}

export function WaterWavesCanvas({ fpsMode = "30" }: WaterWavesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wavesRef = useRef<Wave[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0

    const createWaves = (): Wave[] => [
      {
        baseY: 0.55,
        amplitude: 28,
        frequency: 1.2,
        speed: 0.008,
        opacity: 0.04,
        phase: 0,
      },
      {
        baseY: 0.62,
        amplitude: 18,
        frequency: 1.8,
        speed: 0.012,
        opacity: 0.05,
        phase: Math.PI * 0.5,
      },
      {
        baseY: 0.70,
        amplitude: 12,
        frequency: 2.5,
        speed: 0.006,
        opacity: 0.06,
        phase: Math.PI,
      },
      {
        baseY: 0.78,
        amplitude: 22,
        frequency: 1.0,
        speed: 0.010,
        opacity: 0.03,
        phase: Math.PI * 1.5,
      },
    ]

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      wavesRef.current = createWaves()
    }

    let lastFrame = 0
    const frameMs = fpsMode === "30" ? 33 : 16

    const draw = () => {
      const now = Date.now()
      if (now - lastFrame < frameMs) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      lastFrame = now

      ctx.clearRect(0, 0, w, h)
      const waves = wavesRef.current

      for (let i = 0; i < waves.length; i++) {
        const wave = waves[i]

        wave.phase += wave.speed

        const y0 = wave.baseY * h

        ctx.beginPath()
        ctx.moveTo(0, y0 + Math.sin(wave.phase) * wave.amplitude)

        // Draw sine wave points across the width
        const step = 4
        for (let x = step; x <= w; x += step) {
          const normalizedX = (x / w) * Math.PI * 2 * wave.frequency
          const y = y0 + Math.sin(normalizedX + wave.phase) * wave.amplitude
          ctx.lineTo(x, y)
        }

        // Close the path by filling down to the bottom of the canvas
        ctx.lineTo(w, h)
        ctx.lineTo(0, h)
        ctx.closePath()

        ctx.fillStyle = `rgba(255, 255, 255, ${wave.opacity})`
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    resize()
    rafRef.current = requestAnimationFrame(draw)
    window.addEventListener("resize", resize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [fpsMode])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
