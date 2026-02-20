"use client"

import { useEffect, useRef } from "react"

interface Snowflake {
  x: number
  y: number
  radius: number
  speed: number
  opacity: number
  wobbleAmp: number
  wobbleSpeed: number
  wobblePhase: number
  drift: number
}

interface SnowCanvasProps {
  density?: number
  sizeMin?: number
  sizeMax?: number
  speedMin?: number
  speedMax?: number
}

export function SnowCanvas({
  density = 150,
  sizeMin = 1,
  sizeMax = 4.5,
  speedMin = 0.2,
  speedMax = 1.4,
}: SnowCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flakesRef = useRef<Snowflake[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0

    const createFlake = (randomY: boolean): Snowflake => {
      const radius = sizeMin + Math.random() * (sizeMax - sizeMin)
      const speed = speedMin + Math.random() * (speedMax - speedMin)
      // Larger flakes fall slightly faster & are more opaque (closer to viewer)
      const sizeFactor = (radius - sizeMin) / (sizeMax - sizeMin)
      return {
        x: Math.random() * w,
        y: randomY ? Math.random() * h : -radius * 2 - Math.random() * 40,
        radius,
        speed: speed * (0.7 + sizeFactor * 0.6),
        opacity: 0.25 + sizeFactor * 0.45,
        wobbleAmp: 0.3 + Math.random() * 0.8,
        wobbleSpeed: 0.008 + Math.random() * 0.02,
        wobblePhase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.15,
      }
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
      initFlakes()
    }

    const initFlakes = () => {
      const flakes: Snowflake[] = []
      for (let i = 0; i < density; i++) {
        flakes.push(createFlake(true))
      }
      flakesRef.current = flakes
    }

    const drawFlake = (f: Snowflake) => {
      // Soft outer glow
      const gradient = ctx.createRadialGradient(
        f.x,
        f.y,
        0,
        f.x,
        f.y,
        f.radius * 2.5
      )
      gradient.addColorStop(0, `rgba(255, 255, 255, ${f.opacity * 0.5})`)
      gradient.addColorStop(0.4, `rgba(255, 255, 255, ${f.opacity * 0.2})`)
      gradient.addColorStop(1, `rgba(255, 255, 255, 0)`)
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.radius * 2.5, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Main snowflake body
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${f.opacity})`
      ctx.fill()

      // Inner highlight for depth
      ctx.beginPath()
      ctx.arc(
        f.x - f.radius * 0.2,
        f.y - f.radius * 0.2,
        f.radius * 0.4,
        0,
        Math.PI * 2
      )
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(f.opacity * 1.5, 0.9)})`
      ctx.fill()
    }

    const animate = () => {
      ctx.clearRect(0, 0, w, h)

      const flakes = flakesRef.current
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i]

        // Lateral wobble (sine wave)
        f.wobblePhase += f.wobbleSpeed
        f.x += Math.sin(f.wobblePhase) * f.wobbleAmp + f.drift
        f.y += f.speed

        // Wrap horizontally
        if (f.x > w + f.radius * 3) {
          f.x = -f.radius * 3
        } else if (f.x < -f.radius * 3) {
          f.x = w + f.radius * 3
        }

        drawFlake(f)

        // Reset when below viewport
        if (f.y > h + f.radius * 3) {
          flakes[i] = createFlake(false)
        }
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    resize()
    rafRef.current = requestAnimationFrame(animate)
    window.addEventListener("resize", resize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [density, sizeMin, sizeMax, speedMin, speedMax])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
