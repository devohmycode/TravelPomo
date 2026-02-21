export interface Session {
  id: string
  task: string
  phase: "work" | "shortBreak" | "longBreak"
  durationMinutes: number
  completedAt: string // ISO date
}

const STORAGE_KEY = "pomo-sessions"
const MAX_AGE_DAYS = 90

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function loadSessions(): Session[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const sessions: Session[] = JSON.parse(raw)
    // Prune old sessions (90 days)
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
    return sessions.filter(
      (s) => new Date(s.completedAt).getTime() > cutoff
    )
  } catch {
    return []
  }
}

function saveSessions(sessions: Session[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    /* ignore quota */
  }
}

export function addSession(
  data: Omit<Session, "id">
): Session {
  const session: Session = { ...data, id: generateId() }
  const sessions = loadSessions()
  sessions.push(session)
  saveSessions(sessions)
  return session
}

export function getSessionsForDate(dateStr: string): Session[] {
  const sessions = loadSessions()
  return sessions.filter((s) => s.completedAt.startsWith(dateStr))
}

export function getTodayStats(): {
  totalMinutes: number
  sessionCount: number
  sessions: Session[]
} {
  const today = new Date().toISOString().slice(0, 10)
  const sessions = getSessionsForDate(today).filter(
    (s) => s.phase === "work"
  )
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0)
  return { totalMinutes, sessionCount: sessions.length, sessions }
}

export function getWeeklyStats(): { day: string; minutes: number }[] {
  const result: { day: string; minutes: number }[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const daySessions = getSessionsForDate(dateStr).filter(
      (s) => s.phase === "work"
    )
    const minutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0)
    const dayLabel = d.toLocaleDateString("en", { weekday: "short" })
    result.push({ day: dayLabel, minutes })
  }
  return result
}
