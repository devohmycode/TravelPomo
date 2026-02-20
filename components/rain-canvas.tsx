"use client"

import { useEffect, useRef } from "react"

interface StaticDrop {
  x: number
  y: number
  radius: number
  opacity: number
}

interface DripDrop {
  x: number
  y: number
  radius: number
  speed: number
  opacity: number
  trail: { x: number; y: number }[]
  trailLength: number
  wobble: number
  wobbleSpeed: number
  wobblePhase: number
  paused: boolean
  pauseTimer: number
}

interface RainCanvasProps {
  staticDensity?: number
  dripCount?: number
  dripSpeedMin?: number
  dripSpeedMax?: number
}

export function RainCanvas({
  staticDensity = 200,
  dripCount = 30,
  dripSpeedMin = 0.3,
  dripSpeedMax = 1.2,
}: RainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const staticDropsRef = useRef<StaticDrop[]>([])
  const dripDropsRef = useRef<DripDrop[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      initDrops()
    }

    const createStaticDrop = (): StaticDrop => ({
      x: Math.random() * w,
      y: Math.random() * h,
      radius: 0.5 + Math.random() * 2.5,
      opacity: 0.1 + Math.random() * 0.35,
    })

    const createDripDrop = (randomY: boolean): DripDrop => {
      const speed = dripSpeedMin + Math.random() * (dripSpeedMax - dripSpeedMin)
      return {
        x: Math.random() * w,
        y: randomY ? Math.random() * h * 0.6 : -10 - Math.random() * 60,
        radius: 1.5 + Math.random() * 2.5,
        speed,
        opacity: 0.2 + Math.random() * 0.3,
        trail: [],
        trailLength: 30 + Math.floor(Math.random() * 50),
        wobble: 0.3 + Math.random() * 0.8,
        wobbleSpeed: 0.01 + Math.random() * 0.03,
        wobblePhase: Math.random() * Math.PI * 2,
        paused: false,
        pauseTimer: 0,
      }
    }

    const initDrops = () => {
      const statics: StaticDrop[] = []
      for (let i = 0; i < staticDensity; i++) {
        statics.push(createStaticDrop())
      }
      staticDropsRef.current = statics

      const drips: DripDrop[] = []
      for (let i = 0; i < dripCount; i++) {
        drips.push(createDripDrop(true))
      }
      dripDropsRef.current = drips
    }

    const drawStaticDrop = (drop: StaticDrop) => {
      // Outer glow
      ctx.beginPath()
      ctx.arc(drop.x, drop.y, drop.radius + 0.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${drop.opacity * 0.3})`
      ctx.fill()

      // Main drop
      ctx.beginPath()
      ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${drop.opacity})`
      ctx.fill()

      // Highlight
      ctx.beginPath()
      ctx.arc(
        drop.x - drop.radius * 0.25,
        drop.y - drop.radius * 0.25,
        drop.radius * 0.35,
        0,
        Math.PI * 2
      )
      ctx.fillStyle = `rgba(255, 255, 255, ${drop.opacity * 1.5})`
      ctx.fill()
    }

    const drawDripDrop = (drop: DripDrop) => {
      // Trail
      const trail = drop.trail
      for (let i = 0; i < trail.length; i++) {
        const t = i / trail.length
        const trailRadius = drop.radius * 0.3 * (1 - t * 0.7)
        const trailOpacity = drop.opacity * 0.3 * (1 - t)
        if (trailRadius < 0.2) continue

        ctx.beginPath()
        ctx.arc(trail[i].x, trail[i].y, trailRadius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${trailOpacity})`
        ctx.fill()
      }

      // Main drip head - slightly elongated
      ctx.beginPath()
      ctx.ellipse(drop.x, drop.y, drop.radius * 0.85, drop.radius * 1.15, 0, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${drop.opacity})`
      ctx.fill()

      // Outer glow
      ctx.beginPath()
      ctx.ellipse(drop.x, drop.y, drop.radius + 1, drop.radius + 1.3, 0, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${drop.opacity * 0.2})`
      ctx.fill()

      // Highlight
      ctx.beginPath()
      ctx.arc(
        drop.x - drop.radius * 0.2,
        drop.y - drop.radius * 0.3,
        drop.radius * 0.35,
        0,
        Math.PI * 2
      )
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(drop.opacity * 1.8, 0.8)})`
      ctx.fill()
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      // Static condensation drops
      for (const drop of staticDropsRef.current) {
        drawStaticDrop(drop)
      }

      // Dripping drops
      const drips = dripDropsRef.current
      for (let i = 0; i < drips.length; i++) {
        const drop = drips[i]

        // Handle pause (some drops stop briefly before continuing)
        if (drop.paused) {
          drop.pauseTimer--
          if (drop.pauseTimer <= 0) {
            drop.paused = false
          }
          drawDripDrop(drop)
          continue
        }

        // Random pause chance
        if (Math.random() < 0.002) {
          drop.paused = true
          drop.pauseTimer = 30 + Math.floor(Math.random() * 120)
          drawDripDrop(drop)
          continue
        }

        // Record trail
        drop.trail.unshift({ x: drop.x, y: drop.y })
        if (drop.trail.length > drop.trailLength) {
          drop.trail.pop()
        }

        // Move with wobble
        drop.wobblePhase += drop.wobbleSpeed
        drop.y += drop.speed
        drop.x += Math.sin(drop.wobblePhase) * drop.wobble * 0.15

        // Accelerate slightly as drip grows
        drop.speed += 0.001

        drawDripDrop(drop)

        // Reset when off screen
        if (drop.y > h + 20) {
          drips[i] = createDripDrop(false)
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
  }, [staticDensity, dripCount, dripSpeedMin, dripSpeedMax])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
