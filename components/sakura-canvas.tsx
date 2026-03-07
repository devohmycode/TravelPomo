"use client"

import { useEffect, useRef } from "react"

interface Petal {
  x: number
  y: number
  size: number
  speed: number
  rotation: number
  rotationSpeed: number
  opacity: number
  driftPhase: number
  driftSpeed: number
  driftAmp: number
}

interface SakuraCanvasProps {
  fpsMode?: "30" | "60"
}

const IS_MOBILE = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent)

export function SakuraCanvas({ fpsMode = "30" }: SakuraCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const petalsRef = useRef<Petal[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0
    const count = IS_MOBILE ? 15 : 30

    const createPetal = (randomY: boolean): Petal => ({
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -20 - Math.random() * 60,
      size: 4 + Math.random() * 6,
      speed: 0.4 + Math.random() * 0.8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: 0.01 + Math.random() * 0.03,
      opacity: 0.4 + Math.random() * 0.4,
      driftPhase: Math.random() * Math.PI * 2,
      driftSpeed: 0.01 + Math.random() * 0.02,
      driftAmp: 0.5 + Math.random() * 1,
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

      const petals: Petal[] = []
      for (let i = 0; i < count; i++) petals.push(createPetal(true))
      petalsRef.current = petals
    }

    let lastFrame = 0
    const frameMs = fpsMode === "30" ? 33 : 16

    const drawPetal = (p: Petal) => {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)

      // Ellipse petal shape
      ctx.beginPath()
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 183, 197, ${p.opacity})`
      ctx.fill()

      // Inner highlight
      ctx.beginPath()
      ctx.ellipse(-p.size * 0.15, -p.size * 0.1, p.size * 0.5, p.size * 0.25, 0, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 220, 230, ${p.opacity * 0.6})`
      ctx.fill()

      ctx.restore()
    }

    const draw = () => {
      const now = Date.now()
      if (now - lastFrame < frameMs) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      lastFrame = now

      ctx.clearRect(0, 0, w, h)
      const petals = petalsRef.current

      for (let i = 0; i < petals.length; i++) {
        const p = petals[i]

        p.driftPhase += p.driftSpeed
        p.x += Math.sin(p.driftPhase) * p.driftAmp
        p.y += p.speed
        p.rotation += p.rotationSpeed

        drawPetal(p)

        if (p.y > h + p.size * 2) {
          petals[i] = createPetal(false)
        }
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
