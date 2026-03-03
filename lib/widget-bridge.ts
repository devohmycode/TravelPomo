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

// State diffing to skip unchanged syncs
let lastSyncedRemaining = -1
let lastSyncedRunning: boolean | null = null
let lastSyncedPhase = ""
let lastSyncedCompletedSessions = -1
let lastSyncedTask = ""

export function syncWidgetState(
  pomo: PomodoroState,
  config: PomodoroConfig,
  task: string
): void {
  const now = Date.now()
  if (now - lastSyncTime < SYNC_THROTTLE_MS) return

  // Skip if nothing meaningful changed
  if (
    pomo.remaining === lastSyncedRemaining &&
    pomo.running === lastSyncedRunning &&
    pomo.phase === lastSyncedPhase &&
    pomo.completedSessions === lastSyncedCompletedSessions &&
    task === lastSyncedTask
  ) {
    return
  }

  lastSyncTime = now
  lastSyncedRemaining = pomo.remaining
  lastSyncedRunning = pomo.running
  lastSyncedPhase = pomo.phase
  lastSyncedCompletedSessions = pomo.completedSessions
  lastSyncedTask = task
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
  lastSyncedRemaining = pomo.remaining
  lastSyncedRunning = pomo.running
  lastSyncedPhase = pomo.phase
  lastSyncedCompletedSessions = pomo.completedSessions
  lastSyncedTask = task
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
