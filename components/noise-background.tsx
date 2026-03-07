"use client"

import { useEffect, useRef } from "react"

interface NoiseBackgroundProps {
  colorA?: string
  colorB?: string
  fpsMode?: "30" | "60"
}

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

export function NoiseBackground({
  colorA = "#1a3a5c",
  colorB = "#e8a830",
  fpsMode = "30",
}: NoiseBackgroundProps) {
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
    let imageData: ImageData

    const resize = () => {
      // Use lower resolution for noise (performance)
      const scale = 0.25
      w = Math.ceil(window.innerWidth * scale)
      h = Math.ceil(window.innerHeight * scale)
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      imageData = ctx.createImageData(w, h)
    }

    let lastFrame = 0
    const frameMs = fpsMode === "30" ? 66 : 33 // film grain runs slower

    const draw = () => {
      const now = Date.now()
      if (now - lastFrame < frameMs) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      lastFrame = now

      const { colorA: cA, colorB: cB } = colorsRef.current
      const rgbA = hexToRgb(cA)
      const rgbB = hexToRgb(cB)

      // Animated gradient base color mix
      const CYCLE = 8000
      const t = (now % CYCLE) / CYCLE
      const mix = (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2
      const baseR = rgbA.r + (rgbB.r - rgbA.r) * mix
      const baseG = rgbA.g + (rgbB.g - rgbA.g) * mix
      const baseB = rgbA.b + (rgbB.b - rgbA.b) * mix

      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 40
        data[i] = Math.max(0, Math.min(255, baseR + noise))
        data[i + 1] = Math.max(0, Math.min(255, baseG + noise))
        data[i + 2] = Math.max(0, Math.min(255, baseB + noise))
        data[i + 3] = 255
      }

      ctx.putImageData(imageData, 0, 0)
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
      style={{ zIndex: 0, imageRendering: "auto" }}
      aria-hidden="true"
    />
  )
}
