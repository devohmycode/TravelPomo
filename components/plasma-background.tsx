"use client"

import { useEffect, useRef } from "react"

interface PlasmaBackgroundProps {
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

export function PlasmaBackground({
  colorA = "#1a3a5c",
  colorB = "#e8a830",
  fpsMode = "30",
}: PlasmaBackgroundProps) {
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
      // Low res for performance
      const scale = 0.15
      w = Math.ceil(window.innerWidth * scale)
      h = Math.ceil(window.innerHeight * scale)
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      imageData = ctx.createImageData(w, h)
    }

    let time = 0
    let lastFrame = 0
    const frameMs = fpsMode === "30" ? 33 : 16

    const draw = () => {
      const now = Date.now()
      if (now - lastFrame < frameMs) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      lastFrame = now

      time += 0.015

      const { colorA: cA, colorB: cB } = colorsRef.current
      const rgbA = hexToRgb(cA)
      const rgbB = hexToRgb(cB)

      const data = imageData.data

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4

          // Plasma function: sum of sin waves
          const v1 = Math.sin(x * 0.06 + time)
          const v2 = Math.sin(y * 0.07 + time * 0.7)
          const v3 = Math.sin((x * 0.04 + y * 0.04) + time * 0.5)
          const cx = x - w / 2
          const cy = y - h / 2
          const v4 = Math.sin(Math.sqrt(cx * cx + cy * cy) * 0.08 + time * 0.8)

          const v = (v1 + v2 + v3 + v4) / 4 // -1 to 1
          const t = (v + 1) / 2 // 0 to 1

          data[idx] = rgbA.r + (rgbB.r - rgbA.r) * t
          data[idx + 1] = rgbA.g + (rgbB.g - rgbA.g) * t
          data[idx + 2] = rgbA.b + (rgbB.b - rgbA.b) * t
          data[idx + 3] = 255
        }
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
