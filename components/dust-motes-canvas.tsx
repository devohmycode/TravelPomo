"use client"

import { useEffect, useRef } from "react"

interface Mote {
  x: number
  y: number
  radius: number
  speed: number
  opacity: number
  phase: number
  pulseSpeed: number
}

interface DustMotesCanvasProps {
  fpsMode?: "30" | "60"
}

const IS_MOBILE = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent)

export function DustMotesCanvas({ fpsMode = "30" }: DustMotesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const motesRef = useRef<Mote[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0
    const count = IS_MOBILE ? 20 : 40

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const motes: Mote[] = []
      for (let i = 0; i < count; i++) {
        motes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: 0.8 + Math.random() * 1.5,
          speed: 0.1 + Math.random() * 0.2,
          opacity: 0,
          phase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.008 + Math.random() * 0.015,
        })
      }
      motesRef.current = motes
    }

    // Diagonal light beam direction (top-right to bottom-left)
    const beamAngle = Math.PI * 0.75

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

      // Subtle light beam
      const beamGrad = ctx.createLinearGradient(w * 0.8, 0, w * 0.2, h)
      beamGrad.addColorStop(0, "rgba(255, 230, 170, 0.03)")
      beamGrad.addColorStop(0.5, "rgba(255, 230, 170, 0.06)")
      beamGrad.addColorStop(1, "rgba(255, 230, 170, 0)")
      ctx.fillStyle = beamGrad
      ctx.fillRect(0, 0, w, h)

      const motes = motesRef.current

      for (let i = 0; i < motes.length; i++) {
        const m = motes[i]

        // Slow drift along beam direction
        m.x += Math.cos(beamAngle) * m.speed
        m.y += Math.sin(beamAngle) * m.speed

        // Sin-wave pulsation
        m.phase += m.pulseSpeed
        m.opacity = 0.2 + Math.sin(m.phase) * 0.35
        if (m.opacity < 0) m.opacity = 0

        // Wrap around
        if (m.x < -5) m.x = w + 5
        if (m.x > w + 5) m.x = -5
        if (m.y < -5) m.y = h + 5
        if (m.y > h + 5) m.y = -5

        // Golden glow dot
        const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius * 3)
        grad.addColorStop(0, `rgba(255, 220, 150, ${m.opacity * 0.8})`)
        grad.addColorStop(1, `rgba(255, 200, 100, 0)`)
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.radius * 3, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        ctx.beginPath()
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 230, 170, ${m.opacity})`
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
