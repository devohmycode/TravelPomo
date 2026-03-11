"use client"

import type { PomodoroConfig } from "@/lib/pomodoro"
import type { Mode } from "@/hooks/use-timer"
import { ProBadge } from "./pro-badge"

export type FpsMode = "30" | "60"

export type TimerSound = "default" | "gong" | "chime" | "bell"

const TIMER_SOUNDS: { value: TimerSound; label: string; premium: boolean }[] = [
  { value: "default", label: "Default", premium: false },
  { value: "gong", label: "Gong", premium: true },
  { value: "chime", label: "Chime", premium: true },
  { value: "bell", label: "Bell", premium: true },
]

interface SettingsPanelProps {
  mode: Mode
  onModeChange: (mode: Mode) => void
  showSeconds: boolean
  onToggleSeconds: () => void
  soundEnabled: boolean
  onToggleSound: () => void
  use24Hour: boolean
  onToggle24Hour: () => void
  onClose: () => void
  pomoConfig: PomodoroConfig
  onPomoConfigChange: (config: PomodoroConfig) => void
  autoStartBreak: boolean
  onToggleAutoStartBreak: () => void
  autoStartWork: boolean
  onToggleAutoStartWork: () => void
  desktopAutoStart?: boolean
  onToggleDesktopAutoStart?: () => void
  isDesktop?: boolean
  onFullscreen: () => void
  fpsMode: FpsMode
  onFpsModeChange: (mode: FpsMode) => void
  timerSound: TimerSound
  onTimerSoundChange: (sound: TimerSound) => void
  isPro: boolean
  onProNeeded: () => void
  onReplayTutorial: () => void
  zenMode: boolean
  onToggleZenMode: () => void
}

function TogglePill({
  label,
  active,
  onClick,
  premium,
  isPro,
}: {
  label: string
  active: boolean
  onClick: () => void
  premium?: boolean
  isPro?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200
        ${
          active
            ? "bg-white/20 text-white shadow-inner shadow-white/10"
            : "bg-black/30 text-white/70 hover:bg-black/40 hover:text-white/90"
        }
      `}
    >
      {label}
      <ProBadge show={!!premium && !isPro} />
    </button>
  )
}

function DurationControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/70 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="size-7 rounded-lg bg-black/30 text-white/70 hover:bg-black/40 hover:text-white/90 transition-all text-sm font-medium flex items-center justify-center"
        >
          -
        </button>
        <span className="text-white text-sm font-semibold w-8 text-center">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="size-7 rounded-lg bg-black/30 text-white/70 hover:bg-black/40 hover:text-white/90 transition-all text-sm font-medium flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
  )
}

export function SettingsPanel({
  mode,
  onModeChange,
  showSeconds,
  onToggleSeconds,
  soundEnabled,
  onToggleSound,
  use24Hour,
  onToggle24Hour,
  onClose,
  pomoConfig,
  onPomoConfigChange,
  autoStartBreak,
  onToggleAutoStartBreak,
  autoStartWork,
  onToggleAutoStartWork,
  desktopAutoStart,
  onToggleDesktopAutoStart,
  isDesktop,
  onFullscreen,
  fpsMode,
  onFpsModeChange,
  timerSound,
  onTimerSoundChange,
  isPro,
  onProNeeded,
  onReplayTutorial,
  zenMode,
  onToggleZenMode,
}: SettingsPanelProps) {
  return (
    <div
      className="animate-in slide-in-from-bottom-4 fade-in duration-300 w-[calc(100%-2rem)] sm:w-[360px] rounded-2xl border border-white/10 p-5 max-h-[60vh] overflow-y-auto"
      style={{
        background: "rgba(40, 30, 20, 0.55)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-4">
        {mode === "clock" ? "Clock" : mode === "pomo" ? "Pomodoro" : mode === "breathing" ? "Breathing" : "Stopwatch"}
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

      {/* Pomodoro config */}
      {mode === "pomo" && (
        <div className="space-y-2.5 mb-4 p-3 rounded-xl bg-white/5">
          <DurationControl
            label="Work"
            value={pomoConfig.workMinutes}
            min={1}
            max={60}
            onChange={(v) =>
              onPomoConfigChange({ ...pomoConfig, workMinutes: v })
            }
          />
          <DurationControl
            label="Short Break"
            value={pomoConfig.shortBreakMinutes}
            min={1}
            max={15}
            onChange={(v) =>
              onPomoConfigChange({ ...pomoConfig, shortBreakMinutes: v })
            }
          />
          <DurationControl
            label="Long Break"
            value={pomoConfig.longBreakMinutes}
            min={5}
            max={30}
            onChange={(v) =>
              onPomoConfigChange({ ...pomoConfig, longBreakMinutes: v })
            }
          />
          <DurationControl
            label="Sessions"
            value={pomoConfig.sessionsBeforeLongBreak}
            min={2}
            max={6}
            onChange={(v) =>
              onPomoConfigChange({
                ...pomoConfig,
                sessionsBeforeLongBreak: v,
              })
            }
          />
        </div>
      )}

      {/* Options */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <TogglePill
          label="Seconds"
          active={showSeconds}
          onClick={onToggleSeconds}
        />
        <TogglePill
          label="Sound"
          active={soundEnabled}
          onClick={onToggleSound}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <TogglePill
          label="24 Hour"
          active={use24Hour}
          onClick={onToggle24Hour}
        />
        <TogglePill
          label="Fullscreen"
          active={false}
          onClick={onFullscreen}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <TogglePill
          label="30 FPS"
          active={fpsMode === "30"}
          onClick={() => onFpsModeChange("30")}
        />
        <TogglePill
          label="60 FPS"
          active={fpsMode === "60"}
          onClick={() => onFpsModeChange("60")}
        />
        <TogglePill
          label="Zen"
          active={zenMode}
          onClick={onToggleZenMode}
        />
      </div>

      {/* Auto-start options for Pomo */}
      {mode === "pomo" && (
        <div className="grid grid-cols-2 gap-2">
          <TogglePill
            label="Auto Break"
            active={autoStartBreak}
            onClick={onToggleAutoStartBreak}
          />
          <TogglePill
            label="Auto Work"
            active={autoStartWork}
            onClick={onToggleAutoStartWork}
          />
        </div>
      )}

      {/* Desktop autostart */}
      {isDesktop && onToggleDesktopAutoStart && (
        <div className="grid grid-cols-1 gap-2 mt-3">
          <TogglePill
            label="Launch at Startup"
            active={!!desktopAutoStart}
            onClick={onToggleDesktopAutoStart}
          />
        </div>
      )}

      {/* Timer Sound (Pomo mode) */}
      {mode === "pomo" && (
        <>
          <p className="text-white/80 text-sm font-semibold mb-2 mt-4">Timer Sound</p>
          <div className="grid grid-cols-2 gap-2">
            {TIMER_SOUNDS.map((s) => (
              <TogglePill
                key={s.value}
                label={s.label}
                active={timerSound === s.value}
                onClick={() => {
                  if (s.premium && !isPro) {
                    onProNeeded()
                  } else {
                    onTimerSoundChange(s.value)
                  }
                }}
                premium={s.premium}
                isPro={isPro}
              />
            ))}
          </div>
        </>
      )}

      {/* Tutorial replay */}
      <div className="grid grid-cols-1 gap-2 mt-3">
        <TogglePill
          label="Tutorial"
          active={false}
          onClick={onReplayTutorial}
        />
      </div>
    </div>
  )
}
