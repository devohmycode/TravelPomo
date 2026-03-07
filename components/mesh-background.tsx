"use client"

import { useEffect, useRef } from "react"

interface Blob {
  x: number
  y: number
  baseX: number
  baseY: number
  radius: number
  phaseX: number
  phaseY: number
  speedX: number
  speedY: number
}

interface MeshBackgroundProps {
  colorA?: string
  colorB?: string
  fpsMode?: "30" | "60"
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function MeshBackground({
  colorA = "#1a3a5c",
  colorB = "#e8a830",
  fpsMode = "30",
}: MeshBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const blobsRef = useRef<Blob[]>([])
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

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Create 4 blobs positioned around viewport
      blobsRef.current = [
        {
          x: 0, y: 0, baseX: w * 0.25, baseY: h * 0.25,
          radius: Math.max(w, h) * 0.35,
          phaseX: 0, phaseY: Math.PI * 0.5,
          speedX: 0.003, speedY: 0.004,
        },
        {
          x: 0, y: 0, baseX: w * 0.75, baseY: h * 0.3,
          radius: Math.max(w, h) * 0.3,
          phaseX: Math.PI, phaseY: 0,
          speedX: 0.004, speedY: 0.003,
        },
        {
          x: 0, y: 0, baseX: w * 0.3, baseY: h * 0.75,
          radius: Math.max(w, h) * 0.28,
          phaseX: Math.PI * 0.7, phaseY: Math.PI * 1.3,
          speedX: 0.0035, speedY: 0.0045,
        },
        {
          x: 0, y: 0, baseX: w * 0.7, baseY: h * 0.7,
          radius: Math.max(w, h) * 0.32,
          phaseX: Math.PI * 1.5, phaseY: Math.PI * 0.8,
          speedX: 0.0025, speedY: 0.0035,
        },
      ]
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

      const { colorA: cA, colorB: cB } = colorsRef.current

      // Dark background base
      ctx.fillStyle = cA
      ctx.fillRect(0, 0, w, h)

      const blobs = blobsRef.current
      const colors = [
        hexToRgba(cB, 0.35),
        hexToRgba(cA, 0.3),
        hexToRgba(cB, 0.25),
        hexToRgba(cA, 0.4),
      ]

      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i]

        // Sin path movement
        b.phaseX += b.speedX
        b.phaseY += b.speedY
        b.x = b.baseX + Math.sin(b.phaseX) * w * 0.12
        b.y = b.baseY + Math.sin(b.phaseY) * h * 0.12

        // Large blurred circle
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius)
        grad.addColorStop(0, colors[i])
        grad.addColorStop(1, "rgba(0,0,0,0)")
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
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
      className="absolute inset-0"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
