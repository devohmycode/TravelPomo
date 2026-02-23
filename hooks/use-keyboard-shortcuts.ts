"use client"

import { useEffect } from "react"
import type { Mode } from "./use-timer"

interface KeyboardShortcutsConfig {
  onToggleRunning: () => void
  onReset: () => void
  onLap: () => void
  onFullscreen: () => void
  onToggleSettings: () => void
  onToggleColors: () => void
  onClosePanel: () => void
  onSetMode: (mode: Mode) => void
  mode: Mode
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      switch (e.code) {
        case "Space":
          e.preventDefault()
          if (config.mode !== "clock") config.onToggleRunning()
          break
        case "KeyR":
          config.onReset()
          break
        case "KeyL":
          if (config.mode === "stopwatch") config.onLap()
          break
        case "KeyF":
          config.onFullscreen()
          break
        case "KeyS":
          config.onToggleSettings()
          break
        case "KeyC":
          config.onToggleColors()
          break
        case "Escape":
          config.onClosePanel()
          break
        case "Digit1":
          config.onSetMode("clock")
          break
        case "Digit2":
          config.onSetMode("pomo")
          break
        case "Digit3":
          config.onSetMode("stopwatch")
          break
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [config])
}
