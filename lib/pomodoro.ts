export type PomodoroPhase = "work" | "shortBreak" | "longBreak"

export interface PomodoroConfig {
  workMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  sessionsBeforeLongBreak: number
}

export interface PomodoroState {
  phase: PomodoroPhase
  remaining: number // seconds
  totalSeconds: number // total for current phase (for progress calc)
  running: boolean
  completedSessions: number
}

export const DEFAULT_CONFIG: PomodoroConfig = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
}

export function createInitialState(config: PomodoroConfig): PomodoroState {
  const totalSeconds = config.workMinutes * 60
  return {
    phase: "work",
    remaining: totalSeconds,
    totalSeconds,
    running: false,
    completedSessions: 0,
  }
}

export function tick(
  state: PomodoroState
): { state: PomodoroState; phaseCompleted: boolean } {
  if (!state.running || state.remaining <= 0) {
    return { state, phaseCompleted: false }
  }
  const next = { ...state, remaining: state.remaining - 1 }
  if (next.remaining <= 0) {
    next.running = false
    return { state: next, phaseCompleted: true }
  }
  return { state: next, phaseCompleted: false }
}

export function advancePhase(
  state: PomodoroState,
  config: PomodoroConfig
): PomodoroState {
  if (state.phase === "work") {
    const newCompleted = state.completedSessions + 1
    const isLongBreak =
      newCompleted % config.sessionsBeforeLongBreak === 0
    const phase: PomodoroPhase = isLongBreak ? "longBreak" : "shortBreak"
    const totalSeconds =
      (isLongBreak ? config.longBreakMinutes : config.shortBreakMinutes) * 60
    return {
      phase,
      remaining: totalSeconds,
      totalSeconds,
      running: false,
      completedSessions: newCompleted,
    }
  } else {
    const totalSeconds = config.workMinutes * 60
    return {
      ...state,
      phase: "work",
      remaining: totalSeconds,
      totalSeconds,
      running: false,
    }
  }
}

export function resetPhase(
  state: PomodoroState,
  config: PomodoroConfig
): PomodoroState {
  const totalSeconds = getPhaseSeconds(state.phase, config)
  return { ...state, remaining: totalSeconds, totalSeconds, running: false }
}

export function resetAll(config: PomodoroConfig): PomodoroState {
  return createInitialState(config)
}

export function getPhaseSeconds(
  phase: PomodoroPhase,
  config: PomodoroConfig
): number {
  switch (phase) {
    case "work":
      return config.workMinutes * 60
    case "shortBreak":
      return config.shortBreakMinutes * 60
    case "longBreak":
      return config.longBreakMinutes * 60
  }
}

export function getPhaseLabel(phase: PomodoroPhase): string {
  switch (phase) {
    case "work":
      return "WORK"
    case "shortBreak":
      return "SHORT BREAK"
    case "longBreak":
      return "LONG BREAK"
  }
}
