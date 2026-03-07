"use client"

import { useEffect, useRef } from "react"

interface WavesBackgroundProps {
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

export function WavesBackground({
  colorA = "#1a3a5c",
  colorB = "#e8a830",
  fpsMode = "30",
}: WavesBackgroundProps) {
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

    // 3 wave layers with different params
    const layers = [
      { freq: 0.005, amp: 30, speed: 0.015, yOffset: 0.55, opacity: 0.18 },
      { freq: 0.008, amp: 20, speed: 0.02, yOffset: 0.65, opacity: 0.14 },
      { freq: 0.012, amp: 15, speed: 0.025, yOffset: 0.75, opacity: 0.10 },
    ]

    let phase = 0
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

      // Background gradient base
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
      bgGrad.addColorStop(0, cA)
      bgGrad.addColorStop(1, cB)
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)

      phase += 0.016

      for (let l = 0; l < layers.length; l++) {
        const layer = layers[l]
        const baseY = h * layer.yOffset
        const color = l % 2 === 0 ? hexToRgba(cB, layer.opacity) : hexToRgba(cA, layer.opacity)

        ctx.beginPath()
        ctx.moveTo(0, h)

        for (let x = 0; x <= w; x += 3) {
          const y =
            baseY +
            Math.sin(x * layer.freq + phase * layer.speed * 60) * layer.amp +
            Math.sin(x * layer.freq * 0.5 + phase * layer.speed * 30) * layer.amp * 0.5
          ctx.lineTo(x, y)
        }

        ctx.lineTo(w, h)
        ctx.closePath()
        ctx.fillStyle = color
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
