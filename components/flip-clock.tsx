"use client"

import { useCallback, useEffect, useRef } from "react"
import {
  Maximize,
  Timer,
  Settings,
  Droplets,
  RotateCcw,
  SkipForward,
  Flag,
  BarChart3,
} from "lucide-react"
import { toast } from "sonner"
import { FlipGroup } from "./flip-group"
import { LiquidButton } from "./ui/liquid-glass-button"
import { SettingsPanel } from "./settings-panel"
import { RainCanvas } from "./rain-canvas"
import { SnowCanvas } from "./snow-canvas"
import { ProgressRing } from "./progress-ring"
import { LapList } from "./lap-list"
import { StatsPanel } from "./stats-panel"
import { TaskInput } from "./task-input"
import {
  ColorPanel,
  THEMES,
  type BackgroundType,
  type OverlayEffect,
  type GlowMode,
} from "./color-panel"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { useTimer } from "@/hooks/use-timer"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { getPhaseLabel } from "@/lib/pomodoro"
import {
  sendNotification,
  playAlarmSound,
  requestNotificationPermission,
} from "@/lib/notifications"
import { addSession } from "@/lib/session-store"
import { isNative, toggleBrowserFullscreen } from "@/lib/fullscreen"
import { keepAwake, allowSleep } from "@/lib/keep-awake"
import {
  startBackgroundTimer,
  stopBackgroundTimer,
  getWidgetState,
  forceSyncWidgetState,
} from "@/lib/widget-bridge"

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function lerpColor(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
  t: number
) {
  const r = Math.round(c1.r + (c2.r - c1.r) * t)
  const g = Math.round(c1.g + (c2.g - c1.g) * t)
  const b = Math.round(c1.b + (c2.b - c1.b) * t)
  return `rgb(${r},${g},${b})`
}

export function FlipClock() {
  // Persisted settings
  const [use24Hour, setUse24Hour] = usePersistedState("pomo-24h", true)
  const [showSeconds, setShowSeconds] = usePersistedState("pomo-seconds", true)
  const [soundEnabled, setSoundEnabled] = usePersistedState("pomo-sound", true)
  const [themeIndex, setThemeIndex] = usePersistedState("pomo-theme", 0)
  const [bgType, setBgType] = usePersistedState<BackgroundType>("pomo-bg", "linear")
  const [overlay, setOverlay] = usePersistedState<OverlayEffect>("pomo-overlay", "none")
  const [glowEnabled, setGlowEnabled] = usePersistedState("pomo-glow", false)
  const [glowMode, setGlowMode] = usePersistedState<GlowMode>("pomo-glowmode", "rotate")
  const [autoStartBreak, setAutoStartBreak] = usePersistedState("pomo-autobreak", false)
  const [autoStartWork, setAutoStartWork] = usePersistedState("pomo-autowork", false)
  const [zoomed, setZoomed] = usePersistedState("pomo-zoomed", false)

  // Panels
  const [showSettings, setShowSettings] = usePersistedState("pomo-showsettings", false)
  const [showColorPanel, setShowColorPanel] = usePersistedState("pomo-showcolors", false)
  const [showStatsPanel, setShowStatsPanel] = usePersistedState("pomo-showstats", false)

  // Task
  const [currentTask, setCurrentTask] = usePersistedState("pomo-task", "")

  // Timer
  const timer = useTimer(use24Hour)

  // Keep widget bridge taskRef in sync
  useEffect(() => {
    timer.taskRef.current = currentTask
  }, [currentTask, timer.taskRef])

  // Persisted pomo config
  const [savedConfig, setSavedConfig] = usePersistedState("pomo-config", timer.pomoConfig)
  useEffect(() => {
    timer.setPomoConfig(savedConfig)
  }, []) // Apply saved config on mount only

  const handleConfigChange = useCallback(
    (config: typeof savedConfig) => {
      setSavedConfig(config)
      timer.setPomoConfig(config)
    },
    [setSavedConfig, timer]
  )

  // Request notification permission on first pomo start
  const notifRequested = useRef(false)
  useEffect(() => {
    if (timer.mode === "pomo" && timer.isRunning && !notifRequested.current) {
      notifRequested.current = true
      requestNotificationPermission()
    }
  }, [timer.mode, timer.isRunning])

  // Phase completion handler
  useEffect(() => {
    timer.onPhaseComplete.current = (phase, completedSessions) => {
      const phaseLabel = getPhaseLabel(phase)

      if (phase === "work") {
        // Record session
        addSession({
          task: currentTask || "Untitled",
          phase: "work",
          durationMinutes: timer.pomoConfig.workMinutes,
          completedAt: new Date().toISOString(),
        })

        toast.success("Work session complete!", {
          description: "Time for a break.",
        })
        sendNotification(
          "Pomodoro Complete",
          `Work session #${completedSessions} done! Time for a break.`
        )
      } else {
        toast.success(`${phaseLabel} over!`, {
          description: "Ready to focus?",
        })
        sendNotification("Break Over", "Ready to focus?")
      }

      if (soundEnabled) {
        playAlarmSound()
      }

      // Auto-advance phase
      setTimeout(() => {
        timer.skipPhase()
        // Auto-start if enabled
        if (
          (phase === "work" && autoStartBreak) ||
          (phase !== "work" && autoStartWork)
        ) {
          setTimeout(() => timer.toggleRunning(), 1500)
        }
      }, 500)
    }
  }, [
    currentTask,
    soundEnabled,
    autoStartBreak,
    autoStartWork,
    timer,
  ])

  // Background animation
  const bgRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const theme = THEMES[themeIndex] || THEMES[0]
  const themeRef = useRef(theme)
  const bgTypeRef = useRef(bgType)
  themeRef.current = theme
  bgTypeRef.current = bgType

  const animateBg = useCallback(() => {
    const el = bgRef.current
    if (!el) return
    const CYCLE = 8000
    const t = (Date.now() % CYCLE) / CYCLE
    const mix = (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2
    const colorA = hexToRgb(themeRef.current.a)
    const colorB = hexToRgb(themeRef.current.b)
    const c1 = lerpColor(colorA, colorB, mix)
    const c2 = lerpColor(colorB, colorA, mix)

    const currentBgType = bgTypeRef.current
    if (currentBgType === "solid") {
      el.style.background = c1
    } else if (currentBgType === "radial") {
      el.style.background = `radial-gradient(circle at 50% 50%, ${c2} 0%, ${c1} 100%)`
    } else {
      el.style.background = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`
    }
    rafRef.current = requestAnimationFrame(animateBg)
  }, [])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animateBg)
    return () => cancelAnimationFrame(rafRef.current)
  }, [animateBg])

  // Keep screen awake while timer is running
  useEffect(() => {
    if (timer.isRunning) {
      keepAwake()
    } else {
      allowSleep()
    }
    return () => { allowSleep() }
  }, [timer.isRunning])

  // App lifecycle: background/foreground (Capacitor)
  // Use refs to avoid re-registering the listener on every state change
  const timerRef = useRef(timer)
  const currentTaskRef = useRef(currentTask)
  timerRef.current = timer
  currentTaskRef.current = currentTask

  useEffect(() => {
    if (!isNative()) return

    let cancelled = false
    let removeListener: (() => void) | undefined

    import("@capacitor/app").then(({ App }) => {
      if (cancelled) return

      App.addListener("appStateChange", async ({ isActive }) => {
        const t = timerRef.current
        const task = currentTaskRef.current

        if (t.mode !== "pomo") return

        if (!isActive && t.pomo.running) {
          // Going to background while timer is running -> start native service
          forceSyncWidgetState(t.pomo, t.pomoConfig, task)
          await startBackgroundTimer()
        } else if (isActive) {
          // Returning to foreground -> restore state from native, stop service
          const nativeState = await getWidgetState()
          if (nativeState) {
            if (nativeState.pendingSessions > 0) {
              for (let i = 0; i < nativeState.pendingSessions; i++) {
                addSession({
                  task: task || "Untitled",
                  phase: "work",
                  durationMinutes: t.pomoConfig.workMinutes,
                  completedAt: new Date().toISOString(),
                })
              }
            }
          }
          await stopBackgroundTimer()
        }
      }).then((handle) => {
        removeListener = () => handle.remove()
      })
    }).catch(() => {
      // @capacitor/app not available
    })

    return () => {
      cancelled = true
      removeListener?.()
    }
  }, []) // Register once on mount

  // Fullscreen / Zoom
  const handleFullscreen = useCallback(() => {
    if (isNative()) {
      // On Android: toggle zoomed cards instead of browser fullscreen
      setZoomed((z) => !z)
    } else {
      toggleBrowserFullscreen()
    }
  }, [setZoomed])

  // Panel toggles
  const closeAllPanels = useCallback(() => {
    setShowSettings(false)
    setShowColorPanel(false)
    setShowStatsPanel(false)
  }, [setShowSettings, setShowColorPanel, setShowStatsPanel])

  const togglePanel = useCallback(
    (panel: "settings" | "color" | "stats") => {
      if (panel === "settings") {
        setShowSettings((s) => !s)
        setShowColorPanel(false)
        setShowStatsPanel(false)
      } else if (panel === "color") {
        setShowColorPanel((s) => !s)
        setShowSettings(false)
        setShowStatsPanel(false)
      } else {
        setShowStatsPanel((s) => !s)
        setShowSettings(false)
        setShowColorPanel(false)
      }
    },
    [setShowSettings, setShowColorPanel, setShowStatsPanel]
  )

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleRunning: timer.toggleRunning,
    onReset: timer.reset,
    onLap: timer.addLap,
    onFullscreen: handleFullscreen,
    onToggleSettings: () => togglePanel("settings"),
    onToggleColors: () => togglePanel("color"),
    onClosePanel: closeAllPanels,
    onSetMode: timer.setMode,
    mode: timer.mode,
  })

  const glowColors = [theme.a, theme.b, theme.a + "cc", theme.b + "cc"]

  const pomoPhaseCompleted = timer.pomo.remaining === 0 && !timer.pomo.running

  return (
    <main className="relative min-h-svh overflow-hidden">
      {/* Animated background */}
      <div ref={bgRef} className="absolute inset-0" style={{ zIndex: 0 }} />

      {/* Overlay effects */}
      {overlay === "frost" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 0,
            backdropFilter: "blur(2px) brightness(1.05)",
            WebkitBackdropFilter: "blur(2px) brightness(1.05)",
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
          }}
        />
      )}
      {overlay === "rain" && <RainCanvas sound={soundEnabled} />}
      {overlay === "snow" && <SnowCanvas sound={soundEnabled} />}
      {overlay === "flutes" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 0,
            background:
              "repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 10px)",
          }}
        />
      )}

      {/* Clock display */}
      <div
        className="relative flex flex-col items-center justify-center min-h-svh gap-5 sm:gap-8 py-8"
        style={{ zIndex: 1 }}
      >
        {/* Phase indicator for Pomo mode */}
        {timer.mode === "pomo" && (
          <div className="flex flex-col items-center gap-2">
            <span
              className="text-white/70 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
              }}
            >
              {getPhaseLabel(timer.pomo.phase)}
            </span>
            {/* Session dots */}
            <div className="flex gap-1.5">
              {Array.from({ length: timer.pomoConfig.sessionsBeforeLongBreak }).map(
                (_, i) => (
                  <div
                    key={i}
                    className={`size-2 rounded-full transition-all duration-300 ${
                      i < timer.pomo.completedSessions % timer.pomoConfig.sessionsBeforeLongBreak
                        ? "bg-white/80 scale-110"
                        : "bg-white/20"
                    }`}
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* Task input for Pomo mode */}
        {timer.mode === "pomo" && (
          <TaskInput value={currentTask} onChange={setCurrentTask} />
        )}

        {/* Progress ring wrapper for Pomo mode */}
        <div
          className="relative flex flex-col items-center gap-5 sm:gap-8 transition-transform duration-300 origin-center"
          style={zoomed ? { transform: "scale(1.35)" } : undefined}
        >
          {timer.mode === "pomo" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ margin: "-20px" }}>
              <ProgressRing
                progress={timer.pomoProgress}
                colorA={theme.a}
                colorB={theme.b}
                size={400}
                className="opacity-40"
              />
            </div>
          )}

          {timer.mode === "clock" && timer.displayHours !== null && (
            <FlipGroup
              value={timer.displayHours}
              glowEnabled={glowEnabled}
              glowMode={glowMode}
              glowColors={glowColors}
            />
          )}
          <FlipGroup
            value={timer.displayMinutes}
            glowEnabled={glowEnabled}
            glowMode={glowMode}
            glowColors={glowColors}
          />
          {showSeconds && (
            <FlipGroup
              value={timer.displaySeconds}
              glowEnabled={glowEnabled}
              glowMode={glowMode}
              glowColors={glowColors}
            />
          )}
        </div>

        {/* Lap list for Stopwatch mode */}
        {timer.mode === "stopwatch" && timer.laps.length > 0 && (
          <LapList laps={timer.laps} />
        )}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ zIndex: 10, bottom: "18%" }}
        >
          <SettingsPanel
            mode={timer.mode}
            onModeChange={timer.setMode}
            showSeconds={showSeconds}
            onToggleSeconds={() => setShowSeconds((s) => !s)}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled((s) => !s)}
            use24Hour={use24Hour}
            onToggle24Hour={() => setUse24Hour((u) => !u)}
            onClose={() => setShowSettings(false)}
            pomoConfig={savedConfig}
            onPomoConfigChange={handleConfigChange}
            autoStartBreak={autoStartBreak}
            onToggleAutoStartBreak={() => setAutoStartBreak((v) => !v)}
            autoStartWork={autoStartWork}
            onToggleAutoStartWork={() => setAutoStartWork((v) => !v)}
          />
        </div>
      )}

      {/* Color panel */}
      {showColorPanel && (
        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ zIndex: 10, bottom: "18%" }}
        >
          <ColorPanel
            activeThemeIndex={themeIndex}
            onThemeChange={setThemeIndex}
            backgroundType={bgType}
            onBackgroundTypeChange={setBgType}
            overlayEffect={overlay}
            onOverlayEffectChange={setOverlay}
            glowEnabled={glowEnabled}
            onGlowEnabledChange={setGlowEnabled}
            glowMode={glowMode}
            onGlowModeChange={setGlowMode}
            onClose={() => setShowColorPanel(false)}
          />
        </div>
      )}

      {/* Stats panel */}
      {showStatsPanel && (
        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ zIndex: 10, bottom: "18%" }}
        >
          <StatsPanel onClose={() => setShowStatsPanel(false)} />
        </div>
      )}

      {/* Buttons */}
      <div
        className="absolute bottom-[8%] sm:bottom-[6%] inset-x-0 flex justify-center gap-3"
        style={{ zIndex: 11 }}
      >
        {/* Reset (pomo & stopwatch) */}
        {timer.mode !== "clock" && (
          <LiquidButton
            size="icon"
            onClick={timer.reset}
            aria-label="Reset"
            className="rounded-full size-12 sm:size-14"
          >
            <RotateCcw className="size-4 sm:size-5 text-white/80" />
          </LiquidButton>
        )}

        {/* Play/Pause */}
        {timer.mode !== "clock" && (
          <LiquidButton
            size="icon"
            onClick={timer.toggleRunning}
            aria-label={timer.isRunning ? "Pause" : "Start"}
            className={`rounded-full size-12 sm:size-14 transition-all duration-200 ${
              timer.isRunning
                ? "ring-2 ring-white/40 ring-offset-1 ring-offset-transparent"
                : ""
            }`}
          >
            <Timer
              className={`size-4 sm:size-5 ${
                timer.isRunning ? "text-white" : "text-white/80"
              }`}
            />
          </LiquidButton>
        )}

        {/* Skip phase (pomo only) */}
        {timer.mode === "pomo" && (
          <LiquidButton
            size="icon"
            onClick={timer.skipPhase}
            aria-label="Skip phase"
            className="rounded-full size-12 sm:size-14"
          >
            <SkipForward className="size-4 sm:size-5 text-white/80" />
          </LiquidButton>
        )}

        {/* Lap (stopwatch only) */}
        {timer.mode === "stopwatch" && timer.isRunning && (
          <LiquidButton
            size="icon"
            onClick={timer.addLap}
            aria-label="Lap"
            className="rounded-full size-12 sm:size-14"
          >
            <Flag className="size-4 sm:size-5 text-white/80" />
          </LiquidButton>
        )}

        <LiquidButton
          size="icon"
          onClick={() => togglePanel("settings")}
          aria-label="Settings"
          className={`rounded-full size-12 sm:size-14 transition-all duration-200 ${
            showSettings
              ? "ring-2 ring-white/40 ring-offset-1 ring-offset-transparent"
              : ""
          }`}
        >
          <Settings
            className={`size-4 sm:size-5 ${
              showSettings ? "text-white" : "text-white/80"
            }`}
          />
        </LiquidButton>

        <LiquidButton
          size="icon"
          onClick={() => togglePanel("color")}
          aria-label="Colors"
          className={`rounded-full size-12 sm:size-14 transition-all duration-200 ${
            showColorPanel
              ? "ring-2 ring-white/40 ring-offset-1 ring-offset-transparent"
              : ""
          }`}
        >
          <Droplets
            className={`size-4 sm:size-5 ${
              showColorPanel ? "text-white" : "text-white/80"
            }`}
          />
        </LiquidButton>

        {/* Stats button */}
        <LiquidButton
          size="icon"
          onClick={() => togglePanel("stats")}
          aria-label="Statistics"
          className={`rounded-full size-12 sm:size-14 transition-all duration-200 ${
            showStatsPanel
              ? "ring-2 ring-white/40 ring-offset-1 ring-offset-transparent"
              : ""
          }`}
        >
          <BarChart3
            className={`size-4 sm:size-5 ${
              showStatsPanel ? "text-white" : "text-white/80"
            }`}
          />
        </LiquidButton>

        <LiquidButton
          size="icon"
          onClick={handleFullscreen}
          aria-label="Fullscreen"
          className="rounded-full size-12 sm:size-14"
        >
          <Maximize className="size-4 sm:size-5 text-white/80" />
        </LiquidButton>
      </div>
    </main>
  )
}
