"use client"

import { useState } from "react"

type Mode = "clock" | "pomo" | "stopwatch"

interface SettingsPanelProps {
  mode: Mode
  onModeChange: (mode: Mode) => void
  showSeconds: boolean
  onToggleSeconds: () => void
  use24Hour: boolean
  onToggle24Hour: () => void
  onClose: () => void
}

function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200
        ${
          active
            ? "bg-white/20 text-white shadow-inner shadow-white/10"
            : "bg-black/30 text-white/70 hover:bg-black/40 hover:text-white/90"
        }
      `}
    >
      {label}
    </button>
  )
}

export function SettingsPanel({
  mode,
  onModeChange,
  showSeconds,
  onToggleSeconds,
  use24Hour,
  onToggle24Hour,
  onClose,
}: SettingsPanelProps) {
  return (
    <div
      className="animate-in slide-in-from-bottom-4 fade-in duration-300 w-[calc(100%-2rem)] sm:w-[360px] rounded-2xl border border-white/10 p-5"
      style={{
        background: "rgba(40, 30, 20, 0.55)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-4">
        {mode === "clock" ? "Clock" : mode === "pomo" ? "Pomodoro" : "Stopwatch"}
      </p>

      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <TogglePill
          label="Clock"
          active={mode === "clock"}
          onClick={() => onModeChange("clock")}
        />
        <TogglePill
          label="Pomo"
          active={mode === "pomo"}
          onClick={() => onModeChange("pomo")}
        />
        <TogglePill
          label="Stopwatch"
          active={mode === "stopwatch"}
          onClick={() => onModeChange("stopwatch")}
        />
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <TogglePill
          label="Seconds"
          active={showSeconds}
          onClick={onToggleSeconds}
        />
        <TogglePill
          label="Sound"
          active={false}
          onClick={() => {}}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <TogglePill
          label="24 Hour"
          active={use24Hour}
          onClick={onToggle24Hour}
        />
        <TogglePill
          label="Fullscreen"
          active={!!document.fullscreenElement}
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen()
            } else {
              document.documentElement.requestFullscreen()
            }
          }}
        />
      </div>
    </div>
  )
}
