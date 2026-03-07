"use client"

import { useEffect, useRef } from "react"

interface Firefly {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  phase: number
  pulseSpeed: number
}

interface FirefliesCanvasProps {
  fpsMode?: "30" | "60"
}

const IS_MOBILE = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent)

export function FirefliesCanvas({ fpsMode = "30" }: FirefliesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Firefly[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0
    const count = IS_MOBILE ? 20 : 40

    const createFirefly = (): Firefly => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: 1.5 + Math.random() * 2,
      opacity: 0,
      phase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.015 + Math.random() * 0.025,
    })

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const flies: Firefly[] = []
      for (let i = 0; i < count; i++) flies.push(createFirefly())
      particlesRef.current = flies
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
      const flies = particlesRef.current

      for (let i = 0; i < flies.length; i++) {
        const f = flies[i]

        // Brownian motion
        f.vx += (Math.random() - 0.5) * 0.08
        f.vy += (Math.random() - 0.5) * 0.08
        f.vx *= 0.98
        f.vy *= 0.98
        f.x += f.vx
        f.y += f.vy

        // Sin-wave opacity pulsation
        f.phase += f.pulseSpeed
        f.opacity = 0.3 + Math.sin(f.phase) * 0.5
        if (f.opacity < 0) f.opacity = 0

        // Wrap around edges
        if (f.x < -10) f.x = w + 10
        if (f.x > w + 10) f.x = -10
        if (f.y < -10) f.y = h + 10
        if (f.y > h + 10) f.y = -10

        // Glow
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius * 4)
        grad.addColorStop(0, `rgba(255, 255, 180, ${f.opacity * 0.9})`)
        grad.addColorStop(0.3, `rgba(255, 240, 120, ${f.opacity * 0.4})`)
        grad.addColorStop(1, `rgba(255, 220, 80, 0)`)
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.radius * 4, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Core
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 200, ${f.opacity})`
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
