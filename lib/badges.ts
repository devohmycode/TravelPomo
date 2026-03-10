import { type Session } from "./session-store"

export interface Badge {
  id: string
  name: string
  description: string
  emoji: string
  category: "streak" | "time" | "volume" | "special"
  unlockedAt: string | null
}

interface BadgeDef {
  id: string
  name: string
  description: string
  emoji: string
  category: Badge["category"]
  check: (ctx: BadgeContext) => boolean
}

interface BadgeContext {
  sessions: Session[]
  streak: number
  todayMinutes: number
  allTimeMinutes: number
  allTimeSessions: number
}

const BADGE_DEFS: BadgeDef[] = [
  // --- Streak milestones ---
  {
    id: "streak-7",
    name: "Week Warrior",
    description: "7-day streak",
    emoji: "\u{1F525}",
    category: "streak",
    check: (ctx) => ctx.streak >= 7,
  },
  {
    id: "streak-30",
    name: "Monthly Master",
    description: "30-day streak",
    emoji: "\u{1F3C6}",
    category: "streak",
    check: (ctx) => ctx.streak >= 30,
  },
  {
    id: "streak-100",
    name: "Centurion",
    description: "100-day streak",
    emoji: "\u{1F451}",
    category: "streak",
    check: (ctx) => ctx.streak >= 100,
  },
  {
    id: "streak-365",
    name: "Year Legend",
    description: "365-day streak",
    emoji: "\u{1F48E}",
    category: "streak",
    check: (ctx) => ctx.streak >= 365,
  },

  // --- Time-of-day ---
  {
    id: "early-bird",
    name: "Early Bird",
    description: "Session completed before 7 AM",
    emoji: "\u{1F305}",
    category: "time",
    check: (ctx) =>
      ctx.sessions.some((s) => {
        const h = new Date(s.completedAt).getHours()
        return s.phase === "work" && h < 7
      }),
  },
  {
    id: "night-owl",
    name: "Night Owl",
    description: "Session completed after 10 PM",
    emoji: "\u{1F989}",
    category: "time",
    check: (ctx) =>
      ctx.sessions.some((s) => {
        const h = new Date(s.completedAt).getHours()
        return s.phase === "work" && h >= 22
      }),
  },

  // --- Volume / duration ---
  {
    id: "first-step",
    name: "First Step",
    description: "Complete your first session",
    emoji: "\u{1F331}",
    category: "volume",
    check: (ctx) => ctx.allTimeSessions >= 1,
  },
  {
    id: "marathon",
    name: "Marathon",
    description: "4+ hours of focus in one day",
    emoji: "\u{1F3C3}",
    category: "volume",
    check: (ctx) => {
      const byDay: Record<string, number> = {}
      for (const s of ctx.sessions) {
        if (s.phase !== "work") continue
        const day = s.completedAt.slice(0, 10)
        byDay[day] = (byDay[day] || 0) + s.durationMinutes
      }
      return Object.values(byDay).some((m) => m >= 240)
    },
  },
  {
    id: "deep-focus",
    name: "Deep Focus",
    description: "2+ hours of focus in one day",
    emoji: "\u{1F9E0}",
    category: "volume",
    check: (ctx) => ctx.todayMinutes >= 120 || (() => {
      const byDay: Record<string, number> = {}
      for (const s of ctx.sessions) {
        if (s.phase !== "work") continue
        const day = s.completedAt.slice(0, 10)
        byDay[day] = (byDay[day] || 0) + s.durationMinutes
      }
      return Object.values(byDay).some((m) => m >= 120)
    })(),
  },
  {
    id: "sessions-50",
    name: "Half Century",
    description: "50 sessions completed",
    emoji: "\u{2B50}",
    category: "volume",
    check: (ctx) => ctx.allTimeSessions >= 50,
  },
  {
    id: "sessions-100",
    name: "Century Club",
    description: "100 sessions completed",
    emoji: "\u{1F4AF}",
    category: "volume",
    check: (ctx) => ctx.allTimeSessions >= 100,
  },
  {
    id: "sessions-500",
    name: "Focus Machine",
    description: "500 sessions completed",
    emoji: "\u{1F916}",
    category: "volume",
    check: (ctx) => ctx.allTimeSessions >= 500,
  },

  // --- Special ---
  {
    id: "weekend-warrior",
    name: "Weekend Warrior",
    description: "Sessions on both Saturday & Sunday",
    emoji: "\u{1F389}",
    category: "special",
    check: (ctx) => {
      const saturdays = new Set<string>()
      const sundays = new Set<string>()
      for (const s of ctx.sessions) {
        if (s.phase !== "work") continue
        const d = new Date(s.completedAt)
        const day = d.getDay()
        const week = s.completedAt.slice(0, 10)
        if (day === 6) saturdays.add(week)
        if (day === 0) sundays.add(week)
      }
      // Check if any Saturday and any Sunday within the same week
      for (const sat of saturdays) {
        const satDate = new Date(sat)
        const nextDay = new Date(satDate)
        nextDay.setDate(nextDay.getDate() + 1)
        const sunStr = nextDay.toISOString().slice(0, 10)
        if (sundays.has(sunStr)) return true
      }
      return false
    },
  },
  {
    id: "perfect-week",
    name: "Perfect Week",
    description: "Focus every day Mon\u2013Sun",
    emoji: "\u{1F31F}",
    category: "special",
    check: (ctx) => {
      const days = new Set<string>()
      for (const s of ctx.sessions) {
        if (s.phase !== "work") continue
        days.add(s.completedAt.slice(0, 10))
      }
      // Check rolling 7-day windows aligned to Mon-Sun
      const sorted = [...days].sort()
      if (sorted.length < 7) return false
      for (const dateStr of sorted) {
        const d = new Date(dateStr)
        if (d.getDay() !== 1) continue // Must start on Monday
        let ok = true
        for (let i = 0; i < 7; i++) {
          const check = new Date(d)
          check.setDate(check.getDate() + i)
          if (!days.has(check.toISOString().slice(0, 10))) {
            ok = false
            break
          }
        }
        if (ok) return true
      }
      return false
    },
  },
  {
    id: "multitasker",
    name: "Multitasker",
    description: "3+ different tasks in one day",
    emoji: "\u{1F3AF}",
    category: "special",
    check: (ctx) => {
      const byDay: Record<string, Set<string>> = {}
      for (const s of ctx.sessions) {
        if (s.phase !== "work") continue
        const day = s.completedAt.slice(0, 10)
        if (!byDay[day]) byDay[day] = new Set()
        byDay[day].add(s.task)
      }
      return Object.values(byDay).some((tasks) => tasks.size >= 3)
    },
  },
]

const STORAGE_KEY = "pomo-badges"

function loadUnlocked(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveUnlocked(unlocked: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked))
  } catch { /* quota */ }
}

export function getAllBadges(ctx: BadgeContext): Badge[] {
  const unlocked = loadUnlocked()
  return BADGE_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    description: def.description,
    emoji: def.emoji,
    category: def.category,
    unlockedAt: unlocked[def.id] || null,
  }))
}

export function checkAndUnlockBadges(ctx: BadgeContext): Badge[] {
  const unlocked = loadUnlocked()
  const newlyUnlocked: Badge[] = []

  for (const def of BADGE_DEFS) {
    if (unlocked[def.id]) continue
    if (def.check(ctx)) {
      const now = new Date().toISOString()
      unlocked[def.id] = now
      newlyUnlocked.push({
        id: def.id,
        name: def.name,
        description: def.description,
        emoji: def.emoji,
        category: def.category,
        unlockedAt: now,
      })
    }
  }

  if (newlyUnlocked.length > 0) {
    saveUnlocked(unlocked)
  }

  return newlyUnlocked
}

export function getBadgeCount(): { total: number; unlocked: number } {
  const unlocked = loadUnlocked()
  return {
    total: BADGE_DEFS.length,
    unlocked: Object.keys(unlocked).length,
  }
}
