"use client"

import { useCallback, useEffect, useState } from "react"

interface TourStep {
  target: string // data-tour attribute value
  title: string
  description: string
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "timer",
    title: "Your Focus Timer",
    description: "This is your Pomodoro timer. Work for 25 minutes, then take a break.",
  },
  {
    target: "task",
    title: "Name Your Task",
    description: "Type what you're working on to stay focused and track your sessions.",
  },
  {
    target: "play",
    title: "Start / Pause",
    description: "Tap to start or pause the timer.",
  },
  {
    target: "reset",
    title: "Reset",
    description: "Reset the current phase back to its full duration.",
  },
  {
    target: "skip",
    title: "Skip Phase",
    description: "Skip to the next phase — from work to break, or break to work.",
  },
  {
    target: "settings",
    title: "Settings",
    description: "Configure durations, modes (Clock, Pomo, Stopwatch), and preferences.",
  },
  {
    target: "colors",
    title: "Themes & Effects",
    description: "Change color themes, backgrounds, and visual effects.",
  },
  {
    target: "ambient",
    title: "Ambient Sounds",
    description: "Play rain, fire, or ocean sounds while you focus.",
  },
  {
    target: "stats",
    title: "Statistics",
    description: "Track your completed focus sessions over time.",
  },
  {
    target: "fullscreen",
    title: "Fullscreen",
    description: "Go fullscreen for a distraction-free experience.",
  },
]

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

interface OnboardingOverlayProps {
  onComplete: () => void
}

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const [visible, setVisible] = useState(false)

  const current = TOUR_STEPS[step]

  const measureTarget = useCallback(() => {
    if (!current) return false
    const el = document.querySelector(`[data-tour="${current.target}"]`)
    if (el) {
      const r = el.getBoundingClientRect()
      const pad = 8
      setRect({
        top: r.top - pad,
        left: r.left - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      })
      return true
    }
    setRect(null)
    return false
  }, [current])

  // Measure on step change and on resize — skip missing targets
  useEffect(() => {
    let attempts = 0
    const maxAttempts = 5

    const tryMeasure = () => {
      const found = measureTarget()
      if (found) {
        setVisible(true)
        return
      }
      attempts++
      if (attempts < maxAttempts) {
        // Retry after a short delay for slow DOM
        retryTimer = setTimeout(tryMeasure, 200)
      } else {
        // Target not found after retries — skip this step
        if (step < TOUR_STEPS.length - 1) {
          setStep((s) => s + 1)
        } else {
          onComplete()
        }
      }
    }

    let retryTimer: ReturnType<typeof setTimeout>
    const initialTimer = setTimeout(tryMeasure, 300)

    window.addEventListener("resize", measureTarget)
    return () => {
      clearTimeout(initialTimer)
      clearTimeout(retryTimer)
      window.removeEventListener("resize", measureTarget)
    }
  }, [measureTarget, step, onComplete])

  const next = useCallback(() => {
    setVisible(false)
    setTimeout(() => {
      if (step < TOUR_STEPS.length - 1) {
        setStep(step + 1)
      } else {
        onComplete()
      }
    }, 200)
  }, [step, onComplete])

  const skip = useCallback(() => {
    onComplete()
  }, [onComplete])

  if (!current) return null

  const isLast = step === TOUR_STEPS.length - 1

  // Position tooltip above or below spotlight
  const tooltipAbove = rect ? rect.top > window.innerHeight / 2 : false

  return (
    <div
      className="fixed inset-0 transition-opacity duration-300"
      style={{
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        touchAction: "manipulation",
      }}
      onClick={next}
    >
      {/* Dark overlay with cutout (visual only — clicks handled by parent div) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.7)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight glow ring */}
      {rect && (
        <div
          className="absolute rounded-xl pointer-events-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 2px rgba(255,255,255,0.3), 0 0 20px rgba(255,255,255,0.1)",
          }}
        />
      )}

      {/* Tooltip */}
      {rect && (
        <div
          className="absolute flex flex-col gap-2 px-5 py-4 rounded-2xl border border-white/15 max-w-[300px] transition-all duration-300"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "rgba(30, 25, 20, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            left: Math.max(16, Math.min(rect.left + rect.width / 2 - 150, window.innerWidth - 316)),
            ...(tooltipAbove
              ? { bottom: window.innerHeight - rect.top + 12 }
              : { top: rect.top + rect.height + 12 }),
          }}
        >
          <p className="text-white font-semibold text-sm">{current.title}</p>
          <p className="text-white/60 text-xs leading-relaxed">{current.description}</p>

          {/* Controls */}
          <div className="flex items-center justify-between mt-1">
            {/* Dots */}
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`size-1.5 rounded-full transition-all duration-200 ${
                    i === step ? "bg-white/80 scale-125" : i < step ? "bg-white/40" : "bg-white/15"
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              {!isLast && (
                <button
                  onClick={skip}
                  className="text-white/40 text-xs hover:text-white/60 transition-colors px-2 py-1"
                >
                  Skip
                </button>
              )}
              <button
                onClick={next}
                className="bg-white/15 hover:bg-white/25 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-all duration-200"
              >
                {isLast ? "Got it!" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
