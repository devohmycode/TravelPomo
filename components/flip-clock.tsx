"use client"

import { useEffect, useState } from "react"
import { Maximize } from "lucide-react"
import { FlipGroup } from "./flip-group"
import { LiquidButton } from "./ui/liquid-glass-button"

function getTime() {
  const now = new Date()
  return {
    hours: String(now.getHours()).padStart(2, "0"),
    minutes: String(now.getMinutes()).padStart(2, "0"),
    seconds: String(now.getSeconds()).padStart(2, "0"),
  }
}

export function FlipClock() {
  const [time, setTime] = useState<ReturnType<typeof getTime> | null>(null)

  useEffect(() => {
    setTime(getTime())
    const interval = setInterval(() => {
      setTime(getTime())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  return (
    <main className="flip-clock-bg relative">
      <div className="flex flex-col items-center justify-center min-h-svh gap-5 sm:gap-8 py-8 pb-24">
        {time ? (
          <>
            <FlipGroup value={time.hours} />
            <FlipGroup value={time.minutes} />
            <FlipGroup value={time.seconds} />
          </>
        ) : (
          <>
            <FlipGroup value="00" />
            <FlipGroup value="00" />
            <FlipGroup value="00" />
          </>
        )}
      </div>

      <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))] inset-x-0 z-50 flex justify-center">
        <LiquidButton
          size="icon"
          onClick={handleFullscreen}
          aria-label="Plein ecran"
          className="rounded-full size-14"
        >
          <Maximize className="size-5 text-white/80" />
        </LiquidButton>
      </div>
    </main>
  )
}
