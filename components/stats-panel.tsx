"use client"

import { useEffect, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { getTodayStats, getWeeklyStats, type Session } from "@/lib/session-store"

interface StatsPanelProps {
  onClose: () => void
}

export function StatsPanel({ onClose }: StatsPanelProps) {
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [todaySessions, setTodaySessions] = useState<Session[]>([])
  const [weeklyData, setWeeklyData] = useState<
    { day: string; minutes: number }[]
  >([])

  useEffect(() => {
    const today = getTodayStats()
    setTodayMinutes(today.totalMinutes)
    setTodayCount(today.sessionCount)
    setTodaySessions(today.sessions)
    setWeeklyData(getWeeklyStats())
  }, [])

  return (
    <div
      className="animate-in slide-in-from-bottom-4 fade-in duration-300 w-[calc(100%-2rem)] sm:w-[380px] rounded-2xl border border-white/10 p-5 max-h-[60vh] overflow-y-auto"
      style={{
        background: "rgba(40, 30, 20, 0.55)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-4">
        Statistics
      </p>

      {/* Today summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white/8 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{todayMinutes}</p>
          <p className="text-white/50 text-xs mt-1">Minutes today</p>
        </div>
        <div className="bg-white/8 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{todayCount}</p>
          <p className="text-white/50 text-xs mt-1">Sessions today</p>
        </div>
      </div>

      {/* Weekly chart */}
      <p className="text-white/80 text-sm font-semibold mb-2">This Week</p>
      <div className="h-32 mb-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyData}>
            <XAxis
              dataKey="day"
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "rgba(0,0,0,0.7)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "white",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`${value} min`, "Focus"]}
            />
            <Bar
              dataKey="minutes"
              fill="rgba(255,255,255,0.3)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Today's sessions */}
      {todaySessions.length > 0 && (
        <>
          <p className="text-white/80 text-sm font-semibold mb-2">
            Today&apos;s Sessions
          </p>
          <div className="space-y-1.5">
            {todaySessions.map((s) => (
              <div
                key={s.id}
                className="flex justify-between text-sm text-white/70 bg-white/5 rounded-lg px-3 py-2"
              >
                <span className="truncate max-w-[200px]">{s.task}</span>
                <span className="text-white/40 ml-2 shrink-0">
                  {s.durationMinutes}m
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {todaySessions.length === 0 && (
        <p className="text-white/30 text-sm text-center py-4">
          No sessions yet today. Start a Pomodoro!
        </p>
      )}
    </div>
  )
}
