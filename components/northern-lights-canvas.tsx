"use client"

import { useEffect, useRef } from "react"

interface Band {
  y: number
  height: number
  phase: number
  speed: number
  hue: number
  opacity: number
}

interface NorthernLightsCanvasProps {
  fpsMode?: "30" | "60"
}

const IS_MOBILE = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent)

export function NorthernLightsCanvas({ fpsMode = "30" }: NorthernLightsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bandsRef = useRef<Band[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0
    const bandCount = IS_MOBILE ? 3 : 5

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const bands: Band[] = []
      for (let i = 0; i < bandCount; i++) {
        bands.push({
          y: h * 0.15 + (h * 0.4 * i) / bandCount,
          height: 40 + Math.random() * 60,
          phase: Math.random() * Math.PI * 2,
          speed: 0.003 + Math.random() * 0.005,
          hue: 120 + Math.random() * 60, // green to cyan
          opacity: 0.06 + Math.random() * 0.08,
        })
      }
      bandsRef.current = bands
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
      const bands = bandsRef.current

      for (let i = 0; i < bands.length; i++) {
        const b = bands[i]
        b.phase += b.speed

        ctx.beginPath()
        ctx.moveTo(0, b.y + b.height)

        // Undulating wave top edge
        for (let x = 0; x <= w; x += 4) {
          const wave =
            Math.sin(x * 0.003 + b.phase) * 25 +
            Math.sin(x * 0.007 + b.phase * 1.3) * 15 +
            Math.sin(x * 0.001 + b.phase * 0.7) * 10
          ctx.lineTo(x, b.y + wave)
        }

        ctx.lineTo(w, b.y + b.height)
        ctx.closePath()

        const grad = ctx.createLinearGradient(0, b.y - 30, 0, b.y + b.height)
        grad.addColorStop(0, `hsla(${b.hue}, 80%, 60%, 0)`)
        grad.addColorStop(0.3, `hsla(${b.hue}, 80%, 60%, ${b.opacity})`)
        grad.addColorStop(0.7, `hsla(${b.hue + 40}, 70%, 50%, ${b.opacity * 0.6})`)
        grad.addColorStop(1, `hsla(${b.hue + 80}, 60%, 40%, 0)`)
        ctx.fillStyle = grad
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
