"use client"

import { useEffect, useRef } from "react"

interface RainDrop {
  x: number
  y: number
  length: number
  speed: number
  opacity: number
  width: number
}

interface RainCanvasProps {
  density?: number
  speedMin?: number
  speedMax?: number
  lengthMin?: number
  lengthMax?: number
}

export function RainCanvas({
  density = 120,
  speedMin = 8,
  speedMax = 18,
  lengthMin = 12,
  lengthMax = 35,
}: RainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dropsRef = useRef<RainDrop[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
      initDrops()
    }

    const initDrops = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const drops: RainDrop[] = []
      for (let i = 0; i < density; i++) {
        drops.push(createDrop(w, h, true))
      }
      dropsRef.current = drops
    }

    const createDrop = (
      w: number,
      h: number,
      randomY: boolean
    ): RainDrop => {
      return {
        x: Math.random() * w,
        y: randomY ? Math.random() * h : -Math.random() * 40,
        length: lengthMin + Math.random() * (lengthMax - lengthMin),
        speed: speedMin + Math.random() * (speedMax - speedMin),
        opacity: 0.15 + Math.random() * 0.25,
        width: 0.5 + Math.random() * 1,
      }
    }

    const draw = () => {
      const w = window.innerWidth
      const h = window.innerHeight

      ctx.clearRect(0, 0, w, h)

      const drops = dropsRef.current
      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i]

        ctx.beginPath()
        ctx.moveTo(drop.x, drop.y)
        ctx.lineTo(drop.x - 0.5, drop.y + drop.length)
        ctx.strokeStyle = `rgba(255, 255, 255, ${drop.opacity})`
        ctx.lineWidth = drop.width
        ctx.lineCap = "round"
        ctx.stroke()

        drop.y += drop.speed

        if (drop.y > h + 10) {
          const newDrop = createDrop(w, h, false)
          drops[i] = newDrop
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
  }, [density, speedMin, speedMax, lengthMin, lengthMax])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
