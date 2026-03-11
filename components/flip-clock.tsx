"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Maximize,
  Timer,
  Settings,
  Droplets,
  RotateCcw,
  SkipForward,
  Flag,
  BarChart3,
  Music,
} from "lucide-react"
import { toast } from "sonner"
import { BreathingBubble } from "./breathing-bubble"
import { useBreathing, BREATHING_PRESETS, type BreathingConfig } from "@/hooks/use-breathing"
import { DeepWorkFlame } from "./deep-work-flame"
import { useDeepWork, type DeepWorkConfig } from "@/hooks/use-deep-work"
import { FlipGroup } from "./flip-group"
import { LiquidButton } from "./ui/liquid-glass-button"
import { SettingsPanel, type FpsMode, type TimerSound } from "./settings-panel"
import { OnboardingOverlay } from "./onboarding-overlay"
import { RainCanvas } from "./rain-canvas"
import { SnowCanvas } from "./snow-canvas"
import { FirefliesCanvas } from "./fireflies-canvas"
import { SakuraCanvas } from "./sakura-canvas"
import { StarsCanvas } from "./stars-canvas"
import { BokehCanvas } from "./bokeh-canvas"
import { NorthernLightsCanvas } from "./northern-lights-canvas"
import { BubblesCanvas } from "./bubbles-canvas"
import { DustMotesCanvas } from "./dust-motes-canvas"
import { MatrixCanvas } from "./matrix-canvas"
import { ConfettiCanvas } from "./confetti-canvas"
import { LightningCanvas } from "./lightning-canvas"
import { WaterWavesCanvas } from "./water-waves-canvas"
import { MeshBackground } from "./mesh-background"
import { WavesBackground } from "./waves-background"
import { NoiseBackground } from "./noise-background"
import { PlasmaBackground } from "./plasma-background"
import { ParallaxBackground } from "./parallax-background"
import { ProPurchasePopup } from "./pro-purchase-popup"
import { ProgressRing } from "./progress-ring"
import { LapList } from "./lap-list"
import { StatsPanel } from "./stats-panel"
import {
  AmbientSoundPanel,
  useAmbientSound,
  type AmbientSound,
} from "./ambient-sound-panel"
import {
  ColorPanel,
  THEMES,
  type BackgroundType,
  type OverlayEffect,
  type GlowMode,
  type ClockFont,
  type CardStyle,
} from "./color-panel"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { usePro } from "@/hooks/use-pro"
import { useDynamicColors } from "@/hooks/use-dynamic-colors"
import { useTimer, type Mode } from "@/hooks/use-timer"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation"
import { getPhaseLabel } from "@/lib/pomodoro"
import {
  sendNotification,
  playAlarmSound,
  requestNotificationPermission,
} from "@/lib/notifications"
import { addSession, loadSessions, getStreak, getTodayStats, getAllTimeStats } from "@/lib/session-store"
import { checkAndUnlockBadges } from "@/lib/badges"
import { isNative, toggleBrowserFullscreen, toggleTauriFullscreen } from "@/lib/fullscreen"
import { isTauriPlatform } from "@/lib/platform"
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
  // Pro state
  const { isPro, purchasePro, restorePurchase } = usePro()
  const dynamicColors = useDynamicColors()
  const [showProPopup, setShowProPopup] = useState(false)
  const [proPreview, setProPreview] = useState(false)

  // Persisted settings
  const [use24Hour, setUse24Hour] = usePersistedState("pomo-24h", true)
  const [showSeconds, setShowSeconds] = usePersistedState("pomo-seconds", true)
  const [soundEnabled, setSoundEnabled] = usePersistedState("pomo-sound", true)
  const [themeIndex, setThemeIndex] = usePersistedState("pomo-theme", 0)
  const [customColorA, setCustomColorA] = usePersistedState("pomo-custom-a", "#1a3a5c")
  const [customColorB, setCustomColorB] = usePersistedState("pomo-custom-b", "#e8a830")
  const [bgType, setBgType] = usePersistedState<BackgroundType>("pomo-bg", "linear")
  const [overlay, setOverlay] = usePersistedState<OverlayEffect>("pomo-overlay", "none")
  const [glowEnabled, setGlowEnabled] = usePersistedState("pomo-glow", false)
  const [glowMode, setGlowMode] = usePersistedState<GlowMode>("pomo-glowmode", "rotate")
  const [clockFont, setClockFont] = usePersistedState<ClockFont>("pomo-clockfont", "default")
  const [cardStyle, setCardStyle] = usePersistedState<CardStyle>("pomo-cardstyle", "classic")
  const [customCardColor, setCustomCardColor] = usePersistedState("pomo-custom-card", "#e87850")
  const [customCardText, setCustomCardText] = usePersistedState("pomo-custom-card-text", "#b83020")
  const [timerSound, setTimerSound] = usePersistedState<TimerSound>("pomo-timersound", "default")
  const [autoStartBreak, setAutoStartBreak] = usePersistedState("pomo-autobreak", false)
  const [autoStartWork, setAutoStartWork] = usePersistedState("pomo-autowork", false)
  const [zoomed, setZoomed] = usePersistedState("pomo-zoomed", false)
  const [desktopAutoStart, setDesktopAutoStart] = usePersistedState("pomo-desktop-autostart", false)
  const [ambientSound, setAmbientSound] = usePersistedState<AmbientSound>("pomo-ambient", "none")
  const [ambientVolume, setAmbientVolume] = usePersistedState("pomo-ambient-vol", 50)
  const [fpsMode, setFpsMode] = usePersistedState<FpsMode>("pomo-fps", "30")
  const [onboardingDone, setOnboardingDone] = usePersistedState("pomo-onboarding-done", false)
  const [zenMode, setZenMode] = usePersistedState("pomo-zen", false)

  const [breathingPresetIndex, setBreathingPresetIndex] = usePersistedState("pomo-breathing-preset", 0)
  const [breathingCustomConfig, setBreathingCustomConfig] = usePersistedState("pomo-breathing-custom", { inhale: 5, exhale: 5, hold: 0 })
  const [breathingTimedMode, setBreathingTimedMode] = usePersistedState("pomo-breathing-timed", true)
  const [breathingDuration, setBreathingDuration] = usePersistedState("pomo-breathing-duration", 5)
  const [breathingHaptic, setBreathingHaptic] = usePersistedState("pomo-breathing-haptic", true)

  const [deepWorkTimedMode, setDeepWorkTimedMode] = usePersistedState("pomo-deepwork-timed", true)
  const [deepWorkDuration, setDeepWorkDuration] = usePersistedState("pomo-deepwork-duration", 60)
  const [deepWorkHaptic, setDeepWorkHaptic] = usePersistedState("pomo-deepwork-haptic", true)

  // Switch to pomo mode for onboarding so all buttons are visible
  useEffect(() => {
    if (!onboardingDone && timer.mode !== "pomo") {
      timer.setMode("pomo")
    }
  }, [onboardingDone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync desktop autostart with Tauri plugin
  useEffect(() => {
    if (!isTauriPlatform()) return

    import("@tauri-apps/plugin-autostart").then(({ enable, disable }) => {
      if (desktopAutoStart) {
        enable().catch(() => {})
      } else {
        disable().catch(() => {})
      }
    })
  }, [desktopAutoStart])

  // Panels
  const [showSettings, setShowSettings] = usePersistedState("pomo-showsettings", false)
  const [showColorPanel, setShowColorPanel] = usePersistedState("pomo-showcolors", false)
  const [showStatsPanel, setShowStatsPanel] = usePersistedState("pomo-showstats", false)
  const [showAmbientPanel, setShowAmbientPanel] = usePersistedState("pomo-showambient", false)

  // Zen mode: tap to reveal controls temporarily
  const [zenVisible, setZenVisible] = useState(false)
  const zenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const anyPanelOpen = showSettings || showColorPanel || showStatsPanel || showAmbientPanel
  const zenHidden = zenMode && !zenVisible && !anyPanelOpen

  const revealZenControls = useCallback(() => {
    if (!zenMode || anyPanelOpen) return
    setZenVisible(true)
    if (zenTimerRef.current) clearTimeout(zenTimerRef.current)
    zenTimerRef.current = setTimeout(() => setZenVisible(false), 3500)
  }, [zenMode, anyPanelOpen])

  // Keep controls visible while a panel is open
  useEffect(() => {
    if (anyPanelOpen) {
      setZenVisible(true)
      if (zenTimerRef.current) clearTimeout(zenTimerRef.current)
    }
  }, [anyPanelOpen])

  // Ambient sound playback
  useAmbientSound(ambientSound, ambientVolume)

  // Tasks (list)
  const [tasks, setTasks] = usePersistedState<string[]>("pomo-tasks", [""])
  // First task is the "current" one for widget sync
  const currentTask = tasks[0] || ""

  // Timer
  const timer = useTimer(use24Hour)

  const breathingConfig: BreathingConfig = useMemo(() => {
    const preset = breathingPresetIndex >= 0 && breathingPresetIndex < BREATHING_PRESETS.length
      ? BREATHING_PRESETS[breathingPresetIndex]
      : null
    return {
      inhale: preset ? preset.inhale : breathingCustomConfig.inhale,
      exhale: preset ? preset.exhale : breathingCustomConfig.exhale,
      hold: preset ? preset.hold : breathingCustomConfig.hold,
      timedMode: breathingTimedMode,
      durationMinutes: breathingDuration,
      hapticEnabled: breathingHaptic,
    }
  }, [breathingPresetIndex, breathingCustomConfig, breathingTimedMode, breathingDuration, breathingHaptic])

  const breathing = useBreathing(breathingConfig)

  const deepWorkConfig: DeepWorkConfig = useMemo(() => ({
    timedMode: deepWorkTimedMode,
    durationMinutes: deepWorkDuration,
    hapticEnabled: deepWorkHaptic,
  }), [deepWorkTimedMode, deepWorkDuration, deepWorkHaptic])

  const deepWork = useDeepWork(deepWorkConfig)

  // Stats refresh key — incremented each time a session is recorded
  const [statsKey, setStatsKey] = useState(0)

  // Record a session and bump the refresh key
  const recordAndRefresh = useCallback(
    (data: Parameters<typeof addSession>[0]) => {
      addSession(data)
      setStatsKey((k) => k + 1)

      // Check for newly unlocked badges
      const sessions = loadSessions()
      const today = getTodayStats()
      const allTime = getAllTimeStats()
      const streak = getStreak()
      const newBadges = checkAndUnlockBadges({
        sessions,
        streak,
        todayMinutes: today.totalMinutes,
        allTimeMinutes: allTime.totalMinutes,
        allTimeSessions: allTime.sessionCount,
      })
      for (const badge of newBadges) {
        toast.success(`${badge.emoji} ${badge.name}`, {
          description: badge.description,
        })
      }
    },
    []
  )

  // Record breathing session on completion
  const prevBreathingComplete = useRef(false)
  useEffect(() => {
    if (breathing.isComplete && !prevBreathingComplete.current) {
      recordAndRefresh({
        task: "Breathing",
        phase: "breathing",
        durationMinutes: Math.max(1, Math.round(breathing.totalDuration / 60)),
        completedAt: new Date().toISOString(),
      })
    }
    prevBreathingComplete.current = breathing.isComplete
  }, [breathing.isComplete, breathing.totalDuration, recordAndRefresh])

  // Record deep work session on completion
  const prevDeepWorkComplete = useRef(false)
  useEffect(() => {
    if (deepWork.isComplete && !prevDeepWorkComplete.current) {
      recordAndRefresh({
        task: currentTask || "Deep Work",
        phase: "deepwork",
        durationMinutes: Math.max(1, Math.round(deepWork.totalDuration / 60)),
        completedAt: new Date().toISOString(),
      })
    }
    prevDeepWorkComplete.current = deepWork.isComplete
  }, [deepWork.isComplete, deepWork.totalDuration, recordAndRefresh, currentTask])

  // Save partial work session (reset/skip/mode-change while working)
  const savePartialSession = useCallback(() => {
    if (timer.mode !== "pomo" || timer.pomo.phase !== "work") return
    const elapsedSeconds = timer.pomo.totalSeconds - timer.pomo.remaining
    const elapsedMinutes = Math.round(elapsedSeconds / 60)
    if (elapsedMinutes < 1) return
    recordAndRefresh({
      task: currentTask || "Untitled",
      phase: "work",
      durationMinutes: elapsedMinutes,
      completedAt: new Date().toISOString(),
    })
  }, [timer.mode, timer.pomo.phase, timer.pomo.totalSeconds, timer.pomo.remaining, currentTask, recordAndRefresh])

  // Wrapped actions that save partial sessions first
  const handleReset = useCallback(() => {
    savePartialSession()
    timer.reset()
  }, [savePartialSession, timer])

  const handleSkip = useCallback(() => {
    savePartialSession()
    timer.skipPhase()
  }, [savePartialSession, timer])

  const effectiveIsRunning = timer.mode === "breathing" ? breathing.isRunning : timer.mode === "deepwork" ? deepWork.isRunning : timer.isRunning

  const effectiveToggle = useCallback(() => {
    if (timer.mode === "breathing") breathing.toggle()
    else if (timer.mode === "deepwork") deepWork.toggle()
    else timer.toggleRunning()
  }, [timer.mode, breathing.toggle, deepWork.toggle, timer.toggleRunning])

  const effectiveReset = useCallback(() => {
    if (timer.mode === "breathing") breathing.reset()
    else if (timer.mode === "deepwork") deepWork.reset()
    else handleReset()
  }, [timer.mode, breathing.reset, deepWork.reset, handleReset])

  const handleModeChange = useCallback(
    (mode: Mode) => {
      savePartialSession()
      if (timer.mode === "breathing") breathing.reset()
      if (timer.mode === "deepwork") deepWork.reset()
      timer.setMode(mode)
    },
    [savePartialSession, timer, breathing.reset, deepWork.reset]
  )

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
        // Record completed session
        recordAndRefresh({
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
        playAlarmSound(timerSound)
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
    timerSound,
    autoStartBreak,
    autoStartWork,
    timer,
  ])

  // Background animation (throttled based on fpsMode)
  const bgRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)
  const fpsModeRef = useRef(fpsMode)
  const theme = themeIndex === -1
    ? { a: customColorA, b: customColorB, label: "Custom" }
    : themeIndex === -2 && dynamicColors?.available
      ? { a: dynamicColors.colorA, b: dynamicColors.colorB, label: "System" }
      : THEMES[themeIndex] || THEMES[0]
  const themeRef = useRef(theme)
  const bgTypeRef = useRef(bgType)
  themeRef.current = theme
  bgTypeRef.current = bgType
  fpsModeRef.current = fpsMode

  const animateBg = useCallback(() => {
    const now = Date.now()
    const frameMs = fpsModeRef.current === "30" ? 33 : 16
    if (now - lastFrameRef.current < frameMs) {
      rafRef.current = requestAnimationFrame(animateBg)
      return
    }
    lastFrameRef.current = now

    const el = bgRef.current
    if (!el) {
      rafRef.current = requestAnimationFrame(animateBg)
      return
    }
    const CYCLE = 8000
    const t = (now % CYCLE) / CYCLE
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
    if (effectiveIsRunning) {
      keepAwake()
    } else {
      allowSleep()
    }
    return () => { allowSleep() }
  }, [effectiveIsRunning])

  // App lifecycle: background/foreground (Capacitor)
  // Use refs to avoid re-registering the listener on every state change
  const timerRef = useRef(timer)
  const currentTaskRef = useRef(currentTask)
  timerRef.current = timer
  currentTaskRef.current = currentTask

  useEffect(() => {
    if (!isNative() || isTauriPlatform()) return

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
                recordAndRefresh({
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
    if (isTauriPlatform()) {
      toggleTauriFullscreen()
    } else if (isNative()) {
      setZoomed((z) => !z)
    } else {
      toggleBrowserFullscreen()
    }
    // Close panels when entering fullscreen
    setShowSettings(false)
    setShowColorPanel(false)
    setShowStatsPanel(false)
    setShowAmbientPanel(false)
  }, [setZoomed, setShowSettings, setShowColorPanel, setShowStatsPanel, setShowAmbientPanel])

  // Panel toggles
  const closeAllPanels = useCallback(() => {
    setShowSettings(false)
    setShowColorPanel(false)
    setShowStatsPanel(false)
    setShowAmbientPanel(false)
  }, [setShowSettings, setShowColorPanel, setShowStatsPanel, setShowAmbientPanel])

  const togglePanel = useCallback(
    (panel: "settings" | "color" | "stats" | "ambient") => {
      setShowSettings(panel === "settings" ? (s) => !s : false)
      setShowColorPanel(panel === "color" ? (s) => !s : false)
      setShowStatsPanel(panel === "stats" ? (s) => !s : false)
      setShowAmbientPanel(panel === "ambient" ? (s) => !s : false)
    },
    [setShowSettings, setShowColorPanel, setShowStatsPanel, setShowAmbientPanel]
  )

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleRunning: effectiveToggle,
    onReset: effectiveReset,
    onLap: timer.addLap,
    onFullscreen: handleFullscreen,
    onToggleSettings: () => togglePanel("settings"),
    onToggleColors: () => togglePanel("color"),
    onClosePanel: closeAllPanels,
    onSetMode: handleModeChange,
    mode: timer.mode,
  })

  // Swipe navigation between modes
  const MODES: Mode[] = ["clock", "pomo", "stopwatch", "breathing", "deepwork"]
  const [swipeAnim, setSwipeAnim] = useState<"left" | "right" | null>(null)

  const swipeToMode = useCallback(
    (direction: "left" | "right") => {
      const idx = MODES.indexOf(timer.mode)
      const next = direction === "left" ? idx + 1 : idx - 1
      if (next < 0 || next >= MODES.length) return
      setSwipeAnim(direction)
      setTimeout(() => {
        handleModeChange(MODES[next])
        setSwipeAnim(null)
      }, 150)
    },
    [timer.mode, handleModeChange]
  )

  const swipeHandlers = useSwipeNavigation({
    onSwipeLeft: () => swipeToMode("left"),
    onSwipeRight: () => swipeToMode("right"),
  })

  // Tauri tray events
  useEffect(() => {
    if (!isTauriPlatform()) return

    let unlisten: Array<() => void> = []

    import("@tauri-apps/api/event").then(({ listen }) => {
      Promise.all([
        listen("tray-play-pause", () => timer.toggleRunning()),
        listen("tray-reset", () => handleReset()),
        listen("tray-skip", () => handleSkip()),
      ]).then((fns) => {
        unlisten = fns
      })
    })

    return () => {
      unlisten.forEach((fn) => fn())
    }
  }, [timer.toggleRunning, handleReset, handleSkip])

  // Update tray tooltip with remaining time
  useEffect(() => {
    if (!isTauriPlatform()) return
    if (timer.mode !== "pomo") return

    import("@tauri-apps/api/core").then(({ invoke }) => {
      const text = timer.isRunning
        ? `Pomo - ${timer.displayMinutes}:${timer.displaySeconds}`
        : "Pomo"
      invoke("set_tray_tooltip", { text }).catch(() => {})
    })
  }, [timer.mode, timer.displayMinutes, timer.displaySeconds, timer.isRunning])

  const glowColors = [theme.a, theme.b, theme.a + "cc", theme.b + "cc"]

  const pomoPhaseCompleted = timer.pomo.remaining === 0 && !timer.pomo.running

  return (
    <main className="relative min-h-svh overflow-hidden">
      {/* Animated background */}
      {bgType === "mesh" ? (
        <MeshBackground colorA={theme.a} colorB={theme.b} fpsMode={fpsMode} />
      ) : bgType === "waves" ? (
        <WavesBackground colorA={theme.a} colorB={theme.b} fpsMode={fpsMode} />
      ) : bgType === "noise" ? (
        <NoiseBackground colorA={theme.a} colorB={theme.b} fpsMode={fpsMode} />
      ) : bgType === "plasma" ? (
        <PlasmaBackground colorA={theme.a} colorB={theme.b} fpsMode={fpsMode} />
      ) : bgType === "parallax" ? (
        <ParallaxBackground colorA={theme.a} colorB={theme.b} fpsMode={fpsMode} />
      ) : (
        <div ref={bgRef} className="absolute inset-0" style={{ zIndex: 0 }} />
      )}

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
      {overlay === "rain" && <RainCanvas sound={soundEnabled} fpsMode={fpsMode} />}
      {overlay === "snow" && <SnowCanvas sound={soundEnabled} fpsMode={fpsMode} />}
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
      {overlay === "fireflies" && <FirefliesCanvas fpsMode={fpsMode} />}
      {overlay === "sakura" && <SakuraCanvas fpsMode={fpsMode} />}
      {overlay === "stars" && <StarsCanvas fpsMode={fpsMode} />}
      {overlay === "bokeh" && <BokehCanvas colorA={theme.a} colorB={theme.b} fpsMode={fpsMode} />}
      {overlay === "aurora" && <NorthernLightsCanvas fpsMode={fpsMode} />}
      {overlay === "bubbles" && <BubblesCanvas fpsMode={fpsMode} />}
      {overlay === "dust" && <DustMotesCanvas fpsMode={fpsMode} />}
      {overlay === "matrix" && <MatrixCanvas fpsMode={fpsMode} />}
      {overlay === "confetti" && <ConfettiCanvas fpsMode={fpsMode} />}
      {overlay === "lightning" && <LightningCanvas fpsMode={fpsMode} />}
      {overlay === "waterWaves" && <WaterWavesCanvas fpsMode={fpsMode} />}

      {/* Clock display */}
      <div
        className={`relative flex flex-col items-center justify-center min-h-svh gap-5 sm:gap-8 py-8 transition-all duration-150 ${
          swipeAnim === "left"
            ? "-translate-x-12 opacity-0"
            : swipeAnim === "right"
              ? "translate-x-12 opacity-0"
              : "translate-x-0 opacity-100"
        }`}
        style={{ zIndex: 1 }}
        onClick={zenMode ? revealZenControls : undefined}
        {...swipeHandlers}
      >
        {/* Mode indicator dots */}
        {!zoomed && (
          <div className={`flex items-center gap-2 transition-opacity duration-500 ${zenHidden ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            {MODES.map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`transition-all duration-300 rounded-full ${
                  timer.mode === m
                    ? "w-6 h-2 bg-white/60"
                    : "size-2 bg-white/20 hover:bg-white/35"
                }`}
                aria-label={`Switch to ${m} mode`}
              />
            ))}
          </div>
        )}

        {/* Phase indicator for Pomo mode */}
        {timer.mode === "pomo" && !zoomed && (
          <div className={`flex flex-col items-center gap-2 transition-opacity duration-500 ${zenHidden ? "opacity-0" : "opacity-100"}`}>
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

        {/* Task list for Pomo and Deep Work modes */}
        {(timer.mode === "pomo" || timer.mode === "deepwork") && !zoomed && (
          <div data-tour="task" className={`w-full flex flex-col items-center gap-1.5 transition-opacity duration-500 ${zenHidden ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            {tasks.map((task, i) => (
              <div key={i} className="flex items-center gap-1.5" style={{ width: "clamp(172px, 30vw + 12px, 292px)" }}>
                <input
                  type="text"
                  value={task}
                  onChange={(e) => {
                    const next = [...tasks]
                    next[i] = e.target.value
                    setTasks(next)
                  }}
                  placeholder={i === 0 ? "What are you working on?" : "Another task..."}
                  className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white/80 text-xs placeholder:text-white/30 outline-none focus:border-white/25 focus:bg-white/8 transition-all duration-200 text-center"
                  style={{
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                  }}
                />
                {tasks.length > 1 && (
                  <button
                    onClick={() => setTasks(tasks.filter((_, j) => j !== i))}
                    className="shrink-0 size-6 rounded-lg bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-all text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setTasks([...tasks, ""])}
              className="size-6 rounded-lg bg-white/5 border border-white/10 text-white/30 hover:text-white/60 hover:bg-white/10 transition-all text-sm flex items-center justify-center"
            >
              +
            </button>
          </div>
        )}

        {/* Progress ring wrapper for Pomo mode */}
        <div
          data-tour="timer"
          data-font={clockFont}
          data-card-style={cardStyle}
          className="relative flex flex-col items-center gap-5 sm:gap-[min(2rem,2vh)] transition-transform duration-300 origin-center"
          style={{
            ...(zoomed && timer.mode !== "breathing" && timer.mode !== "deepwork" ? { transform: "scale(1.35)" } : {}),
            ...(cardStyle === "custom" ? {
              "--custom-card-top-from": customCardColor,
              "--custom-card-top-to": `${customCardColor}dd`,
              "--custom-card-bottom-from": `${customCardColor}dd`,
              "--custom-card-bottom-to": `${customCardColor}bb`,
              "--custom-card-text": customCardText,
            } as React.CSSProperties : {}),
          }}
        >
          {timer.mode === "breathing" ? (
            <BreathingBubble
              phase={breathing.phase}
              progress={breathing.progress}
              isLastCycle={breathing.isLastCycle}
              isComplete={breathing.isComplete}
              isRunning={breathing.isRunning}
              cycleCount={breathing.cycleCount}
              elapsedTime={breathing.elapsedTime}
              totalDuration={breathing.totalDuration}
              totalCycles={breathing.totalCycles}
              presetName={
                breathingPresetIndex >= 0 && breathingPresetIndex < BREATHING_PRESETS.length
                  ? `${BREATHING_PRESETS[breathingPresetIndex].name} ${BREATHING_PRESETS[breathingPresetIndex].inhale}/${BREATHING_PRESETS[breathingPresetIndex].exhale}`
                  : "Custom"
              }
              colorA={theme.a}
              colorB={theme.b}
              fpsMode={fpsMode}
              onDismissRecap={() => breathing.reset()}
            />
          ) : timer.mode === "deepwork" ? (
            <DeepWorkFlame
              stage={deepWork.stage}
              stageLabel={deepWork.stageLabel}
              progress={deepWork.progress}
              isComplete={deepWork.isComplete}
              isRunning={deepWork.isRunning}
              elapsedTime={deepWork.elapsedTime}
              pauseCount={deepWork.pauseCount}
              totalPauseTime={deepWork.totalPauseTime}
              totalDuration={deepWork.totalDuration}
              maxStageReached={deepWork.maxStageReached}
              taskName={currentTask}
              colorA={theme.a}
              colorB={theme.b}
              fpsMode={fpsMode}
              onDismissRecap={() => deepWork.reset()}
            />
          ) : (
            <>
              {timer.mode === "pomo" && !zoomed && (
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
            </>
          )}
        </div>

        {/* Lap list for Stopwatch mode */}
        {timer.mode === "stopwatch" && timer.laps.length > 0 && !zoomed && (
          <div className={`transition-opacity duration-500 ${zenHidden ? "opacity-0" : "opacity-100"}`}>
            <LapList laps={timer.laps} />
          </div>
        )}
      </div>

      {/* Backdrop to close panels on tap outside */}
      {(showSettings || showColorPanel || showStatsPanel || showAmbientPanel) && !zoomed && (
        <div
          className="absolute inset-0"
          style={{ zIndex: 9 }}
          onClick={closeAllPanels}
        />
      )}

      {/* Settings panel */}
      {showSettings && !zoomed && (
        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ zIndex: 10, bottom: "24%" }}
        >
          <SettingsPanel
            mode={timer.mode}
            onModeChange={handleModeChange}
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
            desktopAutoStart={desktopAutoStart}
            onToggleDesktopAutoStart={() => setDesktopAutoStart((v) => !v)}
            isDesktop={isTauriPlatform()}
            onFullscreen={handleFullscreen}
            fpsMode={fpsMode}
            onFpsModeChange={setFpsMode}
            timerSound={timerSound}
            onTimerSoundChange={setTimerSound}
            isPro={isPro}
            onProNeeded={() => setShowProPopup(true)}
            onReplayTutorial={() => {
              setOnboardingDone(false)
              setShowSettings(false)
            }}
            zenMode={zenMode}
            onToggleZenMode={() => {
              const next = !zenMode
              setZenMode(next)
              if (next) {
                closeAllPanels()
                setZenVisible(false)
              }
            }}
            breathingPresetIndex={breathingPresetIndex}
            onBreathingPresetChange={setBreathingPresetIndex}
            breathingCustomInhale={breathingCustomConfig.inhale}
            breathingCustomExhale={breathingCustomConfig.exhale}
            breathingCustomHold={breathingCustomConfig.hold}
            onBreathingCustomInhaleChange={(v: number) => setBreathingCustomConfig({ ...breathingCustomConfig, inhale: v })}
            onBreathingCustomExhaleChange={(v: number) => setBreathingCustomConfig({ ...breathingCustomConfig, exhale: v })}
            onBreathingCustomHoldChange={(v: number) => setBreathingCustomConfig({ ...breathingCustomConfig, hold: v })}
            breathingHoldEnabled={breathingCustomConfig.hold > 0}
            onBreathingHoldToggle={() => setBreathingCustomConfig({ ...breathingCustomConfig, hold: breathingCustomConfig.hold > 0 ? 0 : 1 })}
            breathingTimedMode={breathingTimedMode}
            onBreathingTimedModeToggle={() => setBreathingTimedMode((v) => !v)}
            breathingDuration={breathingDuration}
            onBreathingDurationChange={setBreathingDuration}
            breathingHaptic={breathingHaptic}
            onBreathingHapticToggle={() => setBreathingHaptic((v) => !v)}
            deepWorkTimedMode={deepWorkTimedMode}
            onDeepWorkTimedModeToggle={() => setDeepWorkTimedMode((v: boolean) => !v)}
            deepWorkDuration={deepWorkDuration}
            onDeepWorkDurationChange={setDeepWorkDuration}
            deepWorkHaptic={deepWorkHaptic}
            onDeepWorkHapticToggle={() => setDeepWorkHaptic((v: boolean) => !v)}
          />
        </div>
      )}

      {/* Color panel */}
      {showColorPanel && !zoomed && (
        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ zIndex: 10, bottom: "24%" }}
        >
          <ColorPanel
            activeThemeIndex={themeIndex}
            onThemeChange={setThemeIndex}
            customColorA={customColorA}
            customColorB={customColorB}
            onCustomColorAChange={setCustomColorA}
            onCustomColorBChange={setCustomColorB}
            backgroundType={bgType}
            onBackgroundTypeChange={setBgType}
            overlayEffect={overlay}
            onOverlayEffectChange={setOverlay}
            glowEnabled={glowEnabled}
            onGlowEnabledChange={setGlowEnabled}
            glowMode={glowMode}
            onGlowModeChange={setGlowMode}
            clockFont={clockFont}
            onClockFontChange={setClockFont}
            cardStyle={cardStyle}
            onCardStyleChange={setCardStyle}
            customCardColor={customCardColor}
            customCardText={customCardText}
            onCustomCardColorChange={setCustomCardColor}
            onCustomCardTextChange={setCustomCardText}
            onClose={() => setShowColorPanel(false)}
            isPro={isPro}
            onProNeeded={() => { setProPreview(false); setShowProPopup(true) }}
            onPreviewStart={() => { setShowColorPanel(false); setProPreview(true) }}
            systemColors={dynamicColors}
          />
        </div>
      )}

      {/* Stats panel */}
      {showStatsPanel && !zoomed && (
        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ zIndex: 10, bottom: "24%" }}
        >
          <StatsPanel
            onClose={() => setShowStatsPanel(false)}
            themeA={theme.a}
            themeB={theme.b}
            isPro={isPro}
            onProNeeded={() => setShowProPopup(true)}
            refreshKey={statsKey}
            liveElapsedMinutes={
              timer.mode === "pomo" && timer.pomo.phase === "work" && timer.isRunning
                ? Math.floor((timer.pomo.totalSeconds - timer.pomo.remaining) / 60)
                : 0
            }
          />
        </div>
      )}

      {/* Ambient sound panel */}
      {showAmbientPanel && !zoomed && (
        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ zIndex: 10, bottom: "24%" }}
        >
          <AmbientSoundPanel
            activeSound={ambientSound}
            onSoundChange={setAmbientSound}
            volume={ambientVolume}
            onVolumeChange={setAmbientVolume}
            onClose={() => setShowAmbientPanel(false)}
            isPro={isPro}
            onProNeeded={() => { setProPreview(false); setShowProPopup(true) }}
            onPreviewStart={() => { setShowAmbientPanel(false); setProPreview(true) }}
          />
        </div>
      )}

      {/* Buttons */}
      <div
        className={`absolute bottom-[8%] sm:bottom-[6%] inset-x-0 flex flex-wrap justify-center gap-3 px-4 transition-all duration-500 ${
          proPreview || zenHidden
            ? "opacity-0 pointer-events-none translate-y-4"
            : "opacity-100 translate-y-0"
        }`}
        style={{ zIndex: 11 }}
      >
        {/* Reset (pomo & stopwatch) */}
        {!zoomed && timer.mode !== "clock" && (
          <LiquidButton
            data-tour="reset"
            size="icon"
            onClick={effectiveReset}
            aria-label="Reset"
            className="rounded-full size-12 sm:size-14"
          >
            <RotateCcw className="size-4 sm:size-5 text-white/80" />
          </LiquidButton>
        )}

        {/* Play/Pause */}
        {!zoomed && timer.mode !== "clock" && (
          <LiquidButton
            data-tour="play"
            size="icon"
            onClick={effectiveToggle}
            aria-label={effectiveIsRunning ? "Pause" : "Start"}
            className={`rounded-full size-12 sm:size-14 transition-all duration-200 ${
              effectiveIsRunning
                ? "ring-2 ring-white/40 ring-offset-1 ring-offset-transparent"
                : ""
            }`}
          >
            <Timer
              className={`size-4 sm:size-5 ${
                effectiveIsRunning ? "text-white" : "text-white/80"
              }`}
            />
          </LiquidButton>
        )}

        {/* Skip phase (pomo only) */}
        {!zoomed && timer.mode === "pomo" && (
          <LiquidButton
            data-tour="skip"
            size="icon"
            onClick={handleSkip}
            aria-label="Skip phase"
            className="rounded-full size-12 sm:size-14"
          >
            <SkipForward className="size-4 sm:size-5 text-white/80" />
          </LiquidButton>
        )}

        {/* Lap (stopwatch only) */}
        {!zoomed && timer.mode === "stopwatch" && timer.isRunning && (
          <LiquidButton
            size="icon"
            onClick={timer.addLap}
            aria-label="Lap"
            className="rounded-full size-12 sm:size-14"
          >
            <Flag className="size-4 sm:size-5 text-white/80" />
          </LiquidButton>
        )}

        {!zoomed && (
          <LiquidButton
            data-tour="settings"
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
        )}

        {!zoomed && (
          <LiquidButton
            data-tour="colors"
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
        )}

        {/* Ambient sound button */}
        {!zoomed && (
          <LiquidButton
            data-tour="ambient"
            size="icon"
            onClick={() => togglePanel("ambient")}
            aria-label="Ambient sounds"
            className={`rounded-full size-12 sm:size-14 transition-all duration-200 ${
              showAmbientPanel || ambientSound !== "none"
                ? "ring-2 ring-white/40 ring-offset-1 ring-offset-transparent"
                : ""
            }`}
          >
            <Music
              className={`size-4 sm:size-5 ${
                showAmbientPanel || ambientSound !== "none" ? "text-white" : "text-white/80"
              }`}
            />
          </LiquidButton>
        )}

        {/* Stats button */}
        {!zoomed && (
          <LiquidButton
            data-tour="stats"
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
        )}

        <LiquidButton
          data-tour="fullscreen"
          size="icon"
          onClick={handleFullscreen}
          aria-label="Fullscreen"
          className="rounded-full size-12 sm:size-14"
        >
          <Maximize className="size-4 sm:size-5 text-white/80" />
        </LiquidButton>
      </div>

      {/* Pro purchase popup */}
      <ProPurchasePopup
        open={showProPopup}
        onClose={() => setShowProPopup(false)}
        onPurchase={purchasePro}
        onRestore={restorePurchase}
      />

      {/* Onboarding tutorial (first launch only) */}
      {!onboardingDone && timer.mode === "pomo" && (
        <OnboardingOverlay onComplete={() => {
          setOnboardingDone(true)
          closeAllPanels()
        }} />
      )}
    </main>
  )
}
