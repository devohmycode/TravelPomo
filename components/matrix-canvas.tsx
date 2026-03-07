"use client"

import { useEffect, useRef } from "react"

interface MatrixCanvasProps {
  fpsMode?: "30" | "60"
}

const CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789"

export function MatrixCanvas({ fpsMode = "30" }: MatrixCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const columnsRef = useRef<number[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0
    const fontSize = 14
    let colCount = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      colCount = Math.ceil(w / fontSize)
      const cols: number[] = []
      for (let i = 0; i < colCount; i++) {
        cols.push(Math.random() * -100) // stagger start
      }
      columnsRef.current = cols
    }

    let lastFrame = 0
    const frameMs = fpsMode === "30" ? 66 : 33 // Slower for matrix effect

    const draw = () => {
      const now = Date.now()
      if (now - lastFrame < frameMs) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      lastFrame = now

      // Fade effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)"
      ctx.fillRect(0, 0, w, h)

      ctx.font = `${fontSize}px monospace`
      const cols = columnsRef.current

      for (let i = 0; i < cols.length; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)]
        const x = i * fontSize
        const y = cols[i] * fontSize

        // Head character (bright)
        ctx.fillStyle = `rgba(0, 255, 70, 0.9)`
        ctx.fillText(char, x, y)

        // Trail character (dimmer)
        if (y > fontSize) {
          const trailChar = CHARS[Math.floor(Math.random() * CHARS.length)]
          ctx.fillStyle = `rgba(0, 200, 50, 0.15)`
          ctx.fillText(trailChar, x, y - fontSize)
        }

        cols[i]++

        // Reset column when it reaches bottom (with randomness)
        if (y > h && Math.random() > 0.975) {
          cols[i] = 0
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
