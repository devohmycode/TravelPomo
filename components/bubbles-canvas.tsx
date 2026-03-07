"use client"

import { useEffect, useRef } from "react"

interface Bubble {
  x: number
  y: number
  radius: number
  speed: number
  wobblePhase: number
  wobbleSpeed: number
  opacity: number
}

interface BubblesCanvasProps {
  fpsMode?: "30" | "60"
}

const IS_MOBILE = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent)

export function BubblesCanvas({ fpsMode = "30" }: BubblesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bubblesRef = useRef<Bubble[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0
    const count = IS_MOBILE ? 12 : 25

    const createBubble = (randomY: boolean): Bubble => ({
      x: Math.random() * w,
      y: randomY ? Math.random() * h : h + 10 + Math.random() * 40,
      radius: 4 + Math.random() * 12,
      speed: 0.3 + Math.random() * 0.6,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.015 + Math.random() * 0.02,
      opacity: 0.1 + Math.random() * 0.15,
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

      const bubbles: Bubble[] = []
      for (let i = 0; i < count; i++) bubbles.push(createBubble(true))
      bubblesRef.current = bubbles
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
      const bubbles = bubblesRef.current

      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i]

        b.wobblePhase += b.wobbleSpeed
        b.x += Math.sin(b.wobblePhase) * 0.5
        b.y -= b.speed

        // Bubble outline
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 255, 255, ${b.opacity})`
        ctx.lineWidth = 0.8
        ctx.stroke()

        // Inner highlight (reflection)
        ctx.beginPath()
        ctx.arc(
          b.x - b.radius * 0.3,
          b.y - b.radius * 0.3,
          b.radius * 0.25,
          0,
          Math.PI * 2
        )
        ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 1.5})`
        ctx.fill()

        // Subtle fill
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius)
        grad.addColorStop(0, `rgba(255, 255, 255, ${b.opacity * 0.3})`)
        grad.addColorStop(1, `rgba(255, 255, 255, 0)`)
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Pop and respawn when above viewport
        if (b.y < -b.radius * 2) {
          bubblesRef.current[i] = createBubble(false)
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
