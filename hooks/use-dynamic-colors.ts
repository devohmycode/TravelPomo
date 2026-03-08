"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getPlatform } from "@/lib/platform"

interface DynamicColors {
  colorA: string
  colorB: string
  available: boolean
}

export function useDynamicColors() {
  const [colors, setColors] = useState<DynamicColors | null>(null)
  const fetchedRef = useRef(false)

  const fetchColors = useCallback(async () => {
    if (getPlatform() !== "android") {
      setColors({ colorA: "#1a3a5c", colorB: "#e8a830", available: false })
      return
    }

    try {
      const { Capacitor } = await import("@capacitor/core")
      if (Capacitor.isNativePlatform()) {
        const result = await Capacitor.Plugins["DynamicColors"]?.getSystemColors()
        if (result) {
          setColors({
            colorA: result.colorA,
            colorB: result.colorB,
            available: result.available,
          })
          return
        }
      }
    } catch {
      // Plugin not available
    }

    setColors({ colorA: "#1a3a5c", colorB: "#e8a830", available: false })
  }, [])

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      fetchColors()
    }
  }, [fetchColors])

  return colors
}
