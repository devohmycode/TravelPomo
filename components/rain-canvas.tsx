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

interface Splash {
  x: number
  y: number
  radius: number
  maxRadius: number
  opacity: number
  fade: number
}

interface RainCanvasProps {
  dropCount?: number
  speedMin?: number
  speedMax?: number
  wind?: number
  sound?: boolean
}

export function RainCanvas({
  dropCount = 180,
  speedMin = 12,
  speedMax = 25,
  wind = 2,
  sound = true,
}: RainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dropsRef = useRef<RainDrop[]>([])
  const splashesRef = useRef<Splash[]>([])
  const rafRef = useRef<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Rain audio loop from MP3
  useEffect(() => {
    if (!sound) return

    const audio = new Audio(
      "https://res.cloudinary.com/dptrimoqv/video/upload/v1771584789/RAINGlas_Orage_et_pluie_sur_pare_brise_voiture_ID_1296__LaSonotheque.fr_idg9yt.mp3"
    )
    audio.loop = true
    audio.volume = 0
    audioRef.current = audio

    // Fade in
    audio.play().then(() => {
      let vol = 0
      const fadeIn = setInterval(() => {
        vol = Math.min(vol + 0.02, 0.5)
        audio.volume = vol
        if (vol >= 0.5) clearInterval(fadeIn)
      }, 30)
    }).catch(() => {
      // Autoplay blocked - will start on next user interaction
    })

    return () => {
      // Fade out then pause
      const a = audio
      let vol = a.volume
      const fadeOut = setInterval(() => {
        vol = Math.max(vol - 0.04, 0)
        a.volume = vol
        if (vol <= 0) {
          clearInterval(fadeOut)
          a.pause()
          a.src = ""
        }
      }, 30)
      audioRef.current = null
    }
  }, [sound])

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
      initDrops()
    }

    const createDrop = (randomY: boolean): RainDrop => {
      const speed = speedMin + Math.random() * (speedMax - speedMin)
      const depthFactor = (speed - speedMin) / (speedMax - speedMin)
      return {
        x: Math.random() * (w + 100) - 50,
        y: randomY ? Math.random() * h : -Math.random() * h * 0.5,
        length: 15 + depthFactor * 25 + Math.random() * 10,
        speed,
        opacity: 0.15 + depthFactor * 0.25,
        width: 0.8 + depthFactor * 0.7,
      }
    }

    const initDrops = () => {
      const drops: RainDrop[] = []
      for (let i = 0; i < dropCount; i++) {
        drops.push(createDrop(true))
      }
      dropsRef.current = drops
      splashesRef.current = []
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      const drops = dropsRef.current
      const splashes = splashesRef.current

      // Draw rain drops as streaks
      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i]

        ctx.beginPath()
        ctx.moveTo(drop.x, drop.y)
        ctx.lineTo(drop.x - wind * (drop.length / drop.speed), drop.y - drop.length)
        ctx.strokeStyle = `rgba(200, 220, 255, ${drop.opacity})`
        ctx.lineWidth = drop.width
        ctx.lineCap = "round"
        ctx.stroke()

        // Move
        drop.y += drop.speed
        drop.x += wind

        // Reset when off screen
        if (drop.y > h + drop.length) {
          // Spawn splash at bottom
          if (Math.random() < 0.3) {
            splashes.push({
              x: drop.x,
              y: h - 2 + Math.random() * 4,
              radius: 0,
              maxRadius: 2 + Math.random() * 3,
              opacity: 0.3 + Math.random() * 0.2,
              fade: 0.02 + Math.random() * 0.02,
            })
          }
          drops[i] = createDrop(false)
        }
      }

      // Draw splashes
      for (let i = splashes.length - 1; i >= 0; i--) {
        const splash = splashes[i]
        ctx.beginPath()
        ctx.arc(splash.x, splash.y, splash.radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(200, 220, 255, ${splash.opacity})`
        ctx.lineWidth = 0.5
        ctx.stroke()

        splash.radius += 0.3
        splash.opacity -= splash.fade

        if (splash.opacity <= 0 || splash.radius > splash.maxRadius) {
          splashes.splice(i, 1)
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
  }, [dropCount, speedMin, speedMax, wind])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
