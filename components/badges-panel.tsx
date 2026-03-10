"use client"

import { useEffect, useState } from "react"
import {
  getAllBadges,
  getBadgeCount,
  type Badge,
} from "@/lib/badges"
import {
  loadSessions,
  getStreak,
  getTodayStats,
  getAllTimeStats,
} from "@/lib/session-store"

interface BadgesPanelProps {
  refreshKey: number
}

export function BadgesPanel({ refreshKey }: BadgesPanelProps) {
  const [badges, setBadges] = useState<Badge[]>([])
  const [counts, setCounts] = useState({ total: 0, unlocked: 0 })

  useEffect(() => {
    const sessions = loadSessions()
    const today = getTodayStats()
    const allTime = getAllTimeStats()
    const streak = getStreak()

    const ctx = {
      sessions,
      streak,
      todayMinutes: today.totalMinutes,
      allTimeMinutes: allTime.totalMinutes,
      allTimeSessions: allTime.sessionCount,
    }

    setBadges(getAllBadges(ctx))
    setCounts(getBadgeCount())
  }, [refreshKey])

  const unlocked = badges.filter((b) => b.unlockedAt)
  const locked = badges.filter((b) => !b.unlockedAt)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/80 text-sm font-semibold">Badges</p>
        <span className="text-white/40 text-xs">
          {counts.unlocked}/{counts.total}
        </span>
      </div>

      {/* Unlocked badges */}
      {unlocked.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {unlocked.map((badge) => (
            <div
              key={badge.id}
              className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-white/10 border border-white/15"
            >
              <span className="text-2xl">{badge.emoji}</span>
              <span className="text-white/90 text-[10px] font-semibold text-center leading-tight">
                {badge.name}
              </span>
              <span className="text-white/35 text-[9px] text-center leading-tight">
                {badge.description}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Locked badges */}
      {locked.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {locked.map((badge) => (
            <div
              key={badge.id}
              className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <span className="text-2xl grayscale opacity-30">
                {badge.emoji}
              </span>
              <span className="text-white/25 text-[10px] font-semibold text-center leading-tight">
                {badge.name}
              </span>
              <span className="text-white/15 text-[9px] text-center leading-tight">
                {badge.description}
              </span>
            </div>
          ))}
        </div>
      )}

      {unlocked.length === 0 && (
        <p className="text-white/25 text-xs text-center py-3">
          Complete sessions to unlock badges!
        </p>
      )}
    </div>
  )
}
