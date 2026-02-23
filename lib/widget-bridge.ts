import { registerPlugin } from "@capacitor/core"
import type { PomodoroState, PomodoroConfig } from "./pomodoro"

interface PomoTimerPlugin {
  syncState(options: {
    phase: string
    remaining: number
    totalSeconds: number
    running: boolean
    completedSessions: number
    task: string
    workMinutes: number
    shortBreakMinutes: number
    longBreakMinutes: number
    sessionsBeforeLongBreak: number
  }): Promise<void>

  getState(): Promise<{
    phase: string
    remaining: number
    totalSeconds: number
    running: boolean
    completedSessions: number
    task: string
    lastUpdated: number
    workMinutes: number
    shortBreakMinutes: number
    longBreakMinutes: number
    sessionsBeforeLongBreak: number
    pendingSessions: number
  }>

  startService(): Promise<void>
  stopService(): Promise<void>
}

const PomoTimer = registerPlugin<PomoTimerPlugin>("PomoTimer")

let lastSyncTime = 0
const SYNC_THROTTLE_MS = 1000

export function syncWidgetState(
  pomo: PomodoroState,
  config: PomodoroConfig,
  task: string
): void {
  const now = Date.now()
  if (now - lastSyncTime < SYNC_THROTTLE_MS) return
  lastSyncTime = now
  doSync(pomo, config, task)
}

function doSync(pomo: PomodoroState, config: PomodoroConfig, task: string) {
  PomoTimer.syncState({
    phase: pomo.phase,
    remaining: pomo.remaining,
    totalSeconds: pomo.totalSeconds,
    running: pomo.running,
    completedSessions: pomo.completedSessions,
    task,
    workMinutes: config.workMinutes,
    shortBreakMinutes: config.shortBreakMinutes,
    longBreakMinutes: config.longBreakMinutes,
    sessionsBeforeLongBreak: config.sessionsBeforeLongBreak,
  }).catch(() => {
    // Plugin not available (web environment) - silently ignore
  })
}

export function forceSyncWidgetState(
  pomo: PomodoroState,
  config: PomodoroConfig,
  task: string
): void {
  lastSyncTime = Date.now()
  doSync(pomo, config, task)
}

export async function getWidgetState() {
  try {
    return await PomoTimer.getState()
  } catch {
    return null
  }
}

export async function startBackgroundTimer() {
  try {
    await PomoTimer.startService()
  } catch {
    // Not available on web
  }
}

export async function stopBackgroundTimer() {
  try {
    await PomoTimer.stopService()
  } catch {
    // Not available on web
  }
}
