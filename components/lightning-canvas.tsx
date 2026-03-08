"use client"

import { useEffect, useRef } from "react"

interface LightningBolt {
  segments: { x: number; y: number }[]
  branches: { x: number; y: number }[][]
  startTime: number
  opacity: number
}

interface LightningCanvasProps {
  fpsMode?: "30" | "60"
}

const IS_MOBILE = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent)

const FLASH_DURATION = 150
const FADE_DURATION = 300
const MIN_INTERVAL = 3000
const MAX_INTERVAL = 8000

export function LightningCanvas({ fpsMode = "30" }: LightningCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boltRef = useRef<LightningBolt | null>(null)
  const rafRef = useRef<number>(0)
  const nextStrikeRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0

    const randomInterval = () =>
      MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL)

    const generateBolt = (): LightningBolt => {
      const segments: { x: number; y: number }[] = []
      const branches: { x: number; y: number }[][] = []

      // Start near the top
      const startX = w * 0.2 + Math.random() * w * 0.6
      const startY = Math.random() * h * 0.05
      segments.push({ x: startX, y: startY })

      let x = startX
      let y = startY
      const stepCount = IS_MOBILE ? 12 : 18
      const stepY = (h * 0.95) / stepCount

      for (let i = 0; i < stepCount; i++) {
        x += (Math.random() - 0.5) * w * 0.15
        // Keep within bounds
        x = Math.max(w * 0.05, Math.min(w * 0.95, x))
        y += stepY * (0.7 + Math.random() * 0.6)
        segments.push({ x, y })

        // Occasionally branch
        if (Math.random() < 0.3 && i > 1 && i < stepCount - 2) {
          const branch: { x: number; y: number }[] = [{ x, y }]
          let bx = x
          let by = y
          const branchSteps = 3 + Math.floor(Math.random() * 4)
          for (let j = 0; j < branchSteps; j++) {
            bx += (Math.random() - 0.5) * w * 0.12
            bx = Math.max(w * 0.02, Math.min(w * 0.98, bx))
            by += stepY * (0.4 + Math.random() * 0.5)
            branch.push({ x: bx, y: by })
          }
          branches.push(branch)
        }
      }

      return {
        segments,
        branches,
        startTime: Date.now(),
        opacity: 1,
      }
    }

    const drawBoltPath = (
      points: { x: number; y: number }[],
      opacity: number,
      lineWidth: number
    ) => {
      if (points.length < 2) return

      // Glow layer
      ctx.save()
      ctx.shadowBlur = 25
      ctx.shadowColor = `rgba(180, 210, 255, ${opacity * 0.8})`
      ctx.strokeStyle = `rgba(200, 220, 255, ${opacity * 0.5})`
      ctx.lineWidth = lineWidth * 3
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.stroke()
      ctx.restore()

      // Core bright line
      ctx.save()
      ctx.shadowBlur = 10
      ctx.shadowColor = `rgba(220, 235, 255, ${opacity})`
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`
      ctx.lineWidth = lineWidth
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.stroke()
      ctx.restore()
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
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

      // Trigger a new bolt if it's time
      if (now >= nextStrikeRef.current && !boltRef.current) {
        boltRef.current = generateBolt()
        nextStrikeRef.current = now + randomInterval()
      }

      const bolt = boltRef.current
      if (bolt) {
        const elapsed = now - bolt.startTime
        const totalDuration = FLASH_DURATION + FADE_DURATION

        if (elapsed > totalDuration) {
          // Bolt is done
          boltRef.current = null
        } else {
          // Calculate opacity
          let opacity: number
          if (elapsed < FLASH_DURATION) {
            opacity = 1
          } else {
            opacity = 1 - (elapsed - FLASH_DURATION) / FADE_DURATION
          }

          // Ambient full-screen flash
          if (opacity > 0.3) {
            ctx.fillStyle = `rgba(200, 220, 255, ${opacity * 0.04})`
            ctx.fillRect(0, 0, w, h)
          }

          // Draw main bolt
          drawBoltPath(bolt.segments, opacity, 2)

          // Draw branches (thinner)
          for (let i = 0; i < bolt.branches.length; i++) {
            drawBoltPath(bolt.branches[i], opacity * 0.7, 1)
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    resize()
    nextStrikeRef.current = Date.now() + randomInterval()
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
