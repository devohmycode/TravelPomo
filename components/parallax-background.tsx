"use client"

import { useEffect, useRef } from "react"

interface ParallaxBackgroundProps {
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

export function ParallaxBackground({
  colorA = "#1a3a5c",
  colorB = "#e8a830",
  fpsMode = "30",
}: ParallaxBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
    }

    // 3 layers with different speeds
    const layers = [
      { speed: 0.0005, offset: 0, opacity: 0.5 },
      { speed: 0.001, offset: Math.PI * 0.7, opacity: 0.35 },
      { speed: 0.002, offset: Math.PI * 1.4, opacity: 0.2 },
    ]

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

      // Base fill
      ctx.fillStyle = cA
      ctx.fillRect(0, 0, w, h)

      for (let i = 0; i < layers.length; i++) {
        const l = layers[i]
        const shift = Math.sin(now * l.speed + l.offset) * h * 0.15

        const grad = ctx.createLinearGradient(0, shift - h * 0.2, 0, h + shift)
        grad.addColorStop(0, hexToRgba(cB, l.opacity))
        grad.addColorStop(0.5, hexToRgba(cA, l.opacity * 0.5))
        grad.addColorStop(1, hexToRgba(cB, l.opacity * 0.8))

        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
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
