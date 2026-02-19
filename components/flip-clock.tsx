"use client"

import { useEffect, useState } from "react"
import { FlipGroup } from "./flip-group"

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

  return (
    <main className="flip-clock-bg">
      <div className="flex flex-col items-center justify-center min-h-svh gap-4 sm:gap-6 py-8">
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
    </main>
  )
}
