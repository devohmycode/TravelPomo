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

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
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

// ---- Daily minutes map (efficient single-pass) ----

export function getDailyMinutesMap(): Record<string, number> {
  const sessions = loadSessions().filter((s) => s.phase === "work")
  const map: Record<string, number> = {}
  for (const s of sessions) {
    const day = s.completedAt.slice(0, 10)
    map[day] = (map[day] || 0) + s.durationMinutes
  }
  return map
}

// ---- Today stats ----

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

// ---- Weekly stats (last 7 days) ----

export function getWeeklyStats(): { day: string; minutes: number }[] {
  const map = getDailyMinutesMap()
  const result: { day: string; minutes: number }[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = formatDate(d)
    const dayLabel = d.toLocaleDateString("en", { weekday: "short" })
    result.push({ day: dayLabel, minutes: map[dateStr] || 0 })
  }
  return result
}

// ---- Monthly stats (last 30 days) ----

export function getMonthlyStats(): { day: string; minutes: number }[] {
  const map = getDailyMinutesMap()
  const result: { day: string; minutes: number }[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = formatDate(d)
    const dayLabel = d.getDate().toString()
    result.push({ day: dayLabel, minutes: map[dateStr] || 0 })
  }
  return result
}

// ---- All-time stats (last 12 weeks, aggregated by week) ----

export function getAllTimeChartStats(): { week: string; minutes: number }[] {
  const map = getDailyMinutesMap()
  const result: { week: string; minutes: number }[] = []
  const now = new Date()

  for (let w = 11; w >= 0; w--) {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() - w * 7)

    let weekMinutes = 0
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart)
      day.setDate(day.getDate() + d)
      const dateStr = formatDate(day)
      weekMinutes += map[dateStr] || 0
    }

    const label = weekStart.toLocaleDateString("en", { month: "short", day: "numeric" })
    result.push({ week: label, minutes: weekMinutes })
  }

  return result
}

// ---- Streak (consecutive days with sessions) ----

export function getStreak(): number {
  const map = getDailyMinutesMap()
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const todayStr = formatDate(now)
  let streak = 0
  const startOffset = todayStr in map ? 0 : 1

  for (let i = startOffset; ; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = formatDate(d)
    if (map[dateStr]) {
      streak++
    } else {
      break
    }
  }

  return streak
}

// ---- All-time totals ----

export function getAllTimeStats(): { totalMinutes: number; sessionCount: number } {
  const sessions = loadSessions().filter((s) => s.phase === "work")
  return {
    totalMinutes: sessions.reduce((sum, s) => sum + s.durationMinutes, 0),
    sessionCount: sessions.length,
  }
}

// ---- Best day ----

export function getBestDay(): { date: string; minutes: number } {
  const map = getDailyMinutesMap()
  let bestDay = ""
  let bestMinutes = 0
  for (const [day, minutes] of Object.entries(map)) {
    if (minutes > bestMinutes) {
      bestDay = day
      bestMinutes = minutes
    }
  }
  return { date: bestDay, minutes: bestMinutes }
}

// ---- Weekly average ----

export function getWeeklyAverage(): number {
  const map = getDailyMinutesMap()
  const now = new Date()
  let total = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    total += map[formatDate(d)] || 0
  }
  return Math.round(total / 7)
}

// ---- Stats by task ----

export function getTaskStats(): { task: string; totalMinutes: number; sessionCount: number }[] {
  const sessions = loadSessions().filter((s) => s.phase === "work")
  const byTask: Record<string, { totalMinutes: number; sessionCount: number }> = {}
  for (const s of sessions) {
    const task = s.task || "Unnamed"
    if (!byTask[task]) byTask[task] = { totalMinutes: 0, sessionCount: 0 }
    byTask[task].totalMinutes += s.durationMinutes
    byTask[task].sessionCount++
  }
  return Object.entries(byTask)
    .map(([task, stats]) => ({ task, ...stats }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
}

// ---- Export ----

export function exportSessionsCSV(): string {
  const sessions = loadSessions()
  const header = "id,task,phase,durationMinutes,completedAt"
  const rows = sessions.map(
    (s) =>
      `${s.id},"${s.task.replace(/"/g, '""')}",${s.phase},${s.durationMinutes},${s.completedAt}`
  )
  return [header, ...rows].join("\n")
}

export function exportSessionsJSON(): string {
  return JSON.stringify(loadSessions(), null, 2)
}
