"use client"

import { useEffect, useRef } from "react"

interface ConfettiParticle {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  width: number
  height: number
  color: string
  opacity: number
}

interface ConfettiCanvasProps {
  fpsMode?: "30" | "60"
}

const IS_MOBILE = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent)

const COLORS = ["#e74c3c", "#f1c40f", "#3498db", "#2ecc71", "#e91e9a", "#9b59b6"]

export function ConfettiCanvas({ fpsMode = "30" }: ConfettiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<ConfettiParticle[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0
    const count = IS_MOBILE ? 30 : 60

    const createParticle = (randomY: boolean): ConfettiParticle => ({
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -10 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1.2 + Math.random() * 1.8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.12,
      width: 4 + Math.random() * 6,
      height: 4 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      opacity: 0.7 + Math.random() * 0.3,
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

      const particles: ConfettiParticle[] = []
      for (let i = 0; i < count; i++) particles.push(createParticle(true))
      particlesRef.current = particles
    }

    let lastFrame = 0
    const frameMs = fpsMode === "30" ? 33 : 16
    let elapsed = 0

    const draw = () => {
      const now = Date.now()
      if (now - lastFrame < frameMs) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      lastFrame = now
      elapsed += 1

      ctx.clearRect(0, 0, w, h)
      const particles = particlesRef.current

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Sine wave horizontal drift
        p.x += p.vx + Math.sin(elapsed * 0.02 + i) * 0.3
        p.y += p.vy
        p.rotation += p.rotationSpeed

        // Respawn at top when exiting bottom
        if (p.y > h + 20) {
          p.x = Math.random() * w
          p.y = -10 - Math.random() * 40
          p.vx = (Math.random() - 0.5) * 1.5
          p.vy = 1.2 + Math.random() * 1.8
          p.rotation = Math.random() * Math.PI * 2
          p.rotationSpeed = (Math.random() - 0.5) * 0.12
          p.color = COLORS[Math.floor(Math.random() * COLORS.length)]
        }

        // Draw rotated rectangle
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height)
        ctx.restore()
      }

      ctx.globalAlpha = 1

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
