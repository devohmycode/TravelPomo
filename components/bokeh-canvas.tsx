"use client"

import { useEffect, useRef } from "react"

interface BokehCircle {
  x: number
  y: number
  radius: number
  speed: number
  driftX: number
  opacity: number
  hue: number
  sat: number
  light: number
}

interface BokehCanvasProps {
  colorA?: string
  colorB?: string
  fpsMode?: "30" | "60"
}

const IS_MOBILE = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent)

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }

  return [h * 360, s * 100, l * 100]
}

export function BokehCanvas({
  colorA = "#1a3a5c",
  colorB = "#e8a830",
  fpsMode = "30",
}: BokehCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const circlesRef = useRef<BokehCircle[]>([])
  const rafRef = useRef<number>(0)
  const colorsRef = useRef({ colorA, colorB })
  colorsRef.current = { colorA, colorB }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0
    const count = IS_MOBILE ? 10 : 20

    const createCircle = (): BokehCircle => {
      const [hA, sA, lA] = hexToHsl(colorsRef.current.colorA)
      const [hB, sB, lB] = hexToHsl(colorsRef.current.colorB)
      const t = Math.random()
      return {
        x: Math.random() * w,
        y: h + 20 + Math.random() * 40,
        radius: 15 + Math.random() * 35,
        speed: 0.15 + Math.random() * 0.35,
        driftX: (Math.random() - 0.5) * 0.3,
        opacity: 0.08 + Math.random() * 0.12,
        hue: hA + (hB - hA) * t,
        sat: sA + (sB - sA) * t,
        light: lA + (lB - lA) * t + 15,
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

      const circles: BokehCircle[] = []
      for (let i = 0; i < count; i++) {
        const c = createCircle()
        c.y = Math.random() * h // Scatter on init
        circles.push(c)
      }
      circlesRef.current = circles
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
      const circles = circlesRef.current

      for (let i = 0; i < circles.length; i++) {
        const c = circles[i]

        c.y -= c.speed
        c.x += c.driftX

        // Blurred circle
        const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius)
        grad.addColorStop(0, `hsla(${c.hue}, ${c.sat}%, ${c.light}%, ${c.opacity})`)
        grad.addColorStop(0.6, `hsla(${c.hue}, ${c.sat}%, ${c.light}%, ${c.opacity * 0.5})`)
        grad.addColorStop(1, `hsla(${c.hue}, ${c.sat}%, ${c.light}%, 0)`)

        ctx.beginPath()
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Reset when above viewport
        if (c.y < -c.radius * 2) {
          circles[i] = createCircle()
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
