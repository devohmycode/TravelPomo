"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import {
  getTodayStats,
  getWeeklyStats,
  getMonthlyStats,
  getAllTimeChartStats,
  getStreak,
  getAllTimeStats,
  getBestDay,
  getWeeklyAverage,
  getTaskStats,
  getDailyMinutesMap,
  getBreathingStats,
  getDeepWorkStats,
  exportSessionsCSV,
  exportSessionsJSON,
  type Session,
} from "@/lib/session-store"
import { ProBadge } from "./pro-badge"
import { BadgesPanel } from "./badges-panel"

// ---- Utilities ----

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0)
  const prev = useRef(0)

  useEffect(() => {
    if (target === prev.current) return
    const from = prev.current
    prev.current = target
    if (target === 0) { setValue(0); return }

    let raf: number
    const start = performance.now()
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - t) ** 3
      setValue(Math.round(from + (target - from) * eased))
      if (t < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

function formatMinutesShort(m: number): string {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r > 0 ? `${h}h ${r}m` : `${h}h`
}

// ---- Heatmap Calendar ----

function HeatmapCalendar({ themeColor }: { themeColor: string }) {
  const [minutesMap, setMinutesMap] = useState<Record<string, number>>({})

  useEffect(() => {
    setMinutesMap(getDailyMinutesMap())
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayDow = today.getDay() // 0=Sun

  // 13 columns (weeks), ending with current week
  const totalDays = 13 * 7
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - (totalDays - 1 - todayDow))

  // Find max for scaling
  const values = Object.values(minutesMap)
  const maxMinutes = Math.max(...values, 1)

  const dayLabels = ["", "M", "", "W", "", "F", ""]

  const columns: { date: string; minutes: number; future: boolean }[][] = []
  const cursor = new Date(startDate)

  for (let col = 0; col < 13; col++) {
    const week: { date: string; minutes: number; future: boolean }[] = []
    for (let row = 0; row < 7; row++) {
      const dateStr = cursor.toISOString().slice(0, 10)
      const isFuture = cursor > today
      week.push({
        date: dateStr,
        minutes: isFuture ? -1 : (minutesMap[dateStr] || 0),
        future: isFuture,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    columns.push(week)
  }

  return (
    <div className="flex items-start gap-1">
      {/* Day labels */}
      <div className="flex flex-col gap-[3px] pt-0">
        {dayLabels.map((label, i) => (
          <div key={i} className="h-[11px] text-[9px] leading-[11px] text-white/30 w-3 text-right">
            {label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex gap-[3px]">
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {col.map((cell, ri) => {
              const intensity = cell.minutes > 0 ? Math.max(0.2, cell.minutes / maxMinutes) : 0
              return (
                <div
                  key={ri}
                  className="size-[11px] rounded-[2px] transition-colors"
                  style={{
                    background: cell.future
                      ? "transparent"
                      : cell.minutes === 0
                        ? "rgba(255,255,255,0.06)"
                        : hexToRgba(themeColor, intensity * 0.85 + 0.15),
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Chart View Tabs ----

type ChartView = "week" | "month" | "all"

// ---- Main Component ----

interface StatsPanelProps {
  onClose: () => void
  themeA: string
  themeB: string
  isPro: boolean
  onProNeeded: () => void
  refreshKey?: number
  liveElapsedMinutes?: number
}

export function StatsPanel({ onClose, themeA, themeB, isPro, onProNeeded, refreshKey = 0, liveElapsedMinutes = 0 }: StatsPanelProps) {
  // Data
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [todaySessions, setTodaySessions] = useState<Session[]>([])
  const [streak, setStreak] = useState(0)
  const [allTime, setAllTime] = useState({ totalMinutes: 0, sessionCount: 0 })
  const [bestDay, setBestDay] = useState({ date: "", minutes: 0 })
  const [weeklyAvg, setWeeklyAvg] = useState(0)
  const [taskStats, setTaskStats] = useState<{ task: string; totalMinutes: number; sessionCount: number }[]>([])
  const [breathingStats, setBreathingStats] = useState({ totalMinutes: 0, sessionCount: 0 })
  const [deepWorkStats, setDeepWorkStats] = useState({ totalMinutes: 0, sessionCount: 0, averageMinutes: 0, longestMinutes: 0 })

  // Chart
  const [chartView, setChartView] = useState<ChartView>("week")
  const [chartData, setChartData] = useState<{ day?: string; week?: string; minutes: number }[]>([])

  // Daily goal
  const [dailyGoal, setDailyGoal] = useState(120)
  const [editingGoal, setEditingGoal] = useState(false)

  // Load data (re-runs when refreshKey changes = new session recorded)
  useEffect(() => {
    const today = getTodayStats()
    setTodayMinutes(today.totalMinutes)
    setTodayCount(today.sessionCount)
    setTodaySessions(today.sessions)
    setStreak(getStreak())
    setAllTime(getAllTimeStats())
    setBestDay(getBestDay())
    setWeeklyAvg(getWeeklyAverage())
    setTaskStats(getTaskStats())
    setBreathingStats(getBreathingStats())
    setDeepWorkStats(getDeepWorkStats())

    try {
      const stored = localStorage.getItem("pomo-daily-goal")
      if (stored) setDailyGoal(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [refreshKey])

  // Update chart when view or data changes
  useEffect(() => {
    if (chartView === "week") setChartData(getWeeklyStats())
    else if (chartView === "month") setChartData(getMonthlyStats())
    else setChartData(getAllTimeChartStats())
  }, [chartView, refreshKey])

  const updateGoal = useCallback((v: number) => {
    const clamped = Math.max(15, Math.min(480, v))
    setDailyGoal(clamped)
    try { localStorage.setItem("pomo-daily-goal", JSON.stringify(clamped)) } catch { /* ignore */ }
  }, [])

  const handleExport = useCallback((format: "csv" | "json") => {
    const content = format === "csv" ? exportSessionsCSV() : exportSessionsJSON()
    const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "application/json" })
    const filename = `pomo-sessions.${format}`

    if (typeof navigator !== "undefined" && navigator.share) {
      const file = new File([blob], filename, { type: blob.type })
      navigator.share({ files: [file] }).catch(() => {
        // Fallback to download
        downloadBlob(blob, filename)
      })
    } else {
      downloadBlob(blob, filename)
    }
  }, [])

  // Include live elapsed minutes from current running session
  const effectiveTodayMinutes = todayMinutes + liveElapsedMinutes

  // Animated values
  const animMinutes = useCountUp(effectiveTodayMinutes)
  const animSessions = useCountUp(todayCount)
  const animStreak = useCountUp(streak)
  const animAvg = useCountUp(weeklyAvg)

  const goalProgress = Math.min(effectiveTodayMinutes / dailyGoal, 1)
  const chartKey = chartView === "week" || chartView === "month" ? "day" : "week"

  return (
    <div
      className="animate-in slide-in-from-bottom-4 fade-in duration-300 w-[calc(100%-2rem)] sm:w-[400px] rounded-2xl border border-white/10 p-5 max-h-[60vh] overflow-y-auto"
      style={{
        background: "rgba(40, 30, 20, 0.55)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-4">
        Statistics
      </p>

      {/* Streak banner */}
      {streak > 0 && (
        <div
          className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 mb-4"
          style={{ background: hexToRgba(themeB, 0.15), border: `1px solid ${hexToRgba(themeB, 0.25)}` }}
        >
          <span className="text-lg">&#128293;</span>
          <span className="text-white font-semibold text-sm">
            {animStreak}-day streak
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="bg-white/8 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{animMinutes}</p>
          <p className="text-white/50 text-xs mt-0.5">Minutes today</p>
        </div>
        <div className="bg-white/8 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{animSessions}</p>
          <p className="text-white/50 text-xs mt-0.5">Sessions today</p>
        </div>
        <div className="bg-white/8 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{animAvg}</p>
          <p className="text-white/50 text-xs mt-0.5">Avg min/day</p>
        </div>
        <div className="bg-white/8 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{bestDay.minutes}</p>
          <p className="text-white/50 text-xs mt-0.5">Best day (min)</p>
        </div>
      </div>

      {/* All-time summary */}
      <div className="flex justify-between text-xs text-white/40 mb-4 px-1">
        <span>All time: {formatMinutesShort(allTime.totalMinutes + liveElapsedMinutes)}</span>
        <span>{allTime.sessionCount + (liveElapsedMinutes > 0 ? 1 : 0)} sessions</span>
      </div>

      {/* Daily goal progress */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-white/80 text-sm font-semibold">Daily Goal</p>
          <button
            onClick={() => setEditingGoal(!editingGoal)}
            className="text-white/40 text-xs hover:text-white/60 transition-colors"
          >
            {editingGoal ? "Done" : `${dailyGoal}m`}
          </button>
        </div>

        {/* Goal edit controls */}
        {editingGoal && (
          <div className="flex items-center justify-center gap-3 mb-2">
            <button
              onClick={() => updateGoal(dailyGoal - 15)}
              className="size-7 rounded-lg bg-black/30 text-white/70 hover:bg-black/40 text-sm font-medium flex items-center justify-center"
            >
              -
            </button>
            <span className="text-white text-sm font-semibold w-14 text-center">
              {dailyGoal} min
            </span>
            <button
              onClick={() => updateGoal(dailyGoal + 15)}
              className="size-7 rounded-lg bg-black/30 text-white/70 hover:bg-black/40 text-sm font-medium flex items-center justify-center"
            >
              +
            </button>
          </div>
        )}

        {/* Progress bar */}
        <div className="relative h-3 rounded-full bg-white/8 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${goalProgress * 100}%`,
              background: `linear-gradient(90deg, ${themeA}, ${themeB})`,
            }}
          />
        </div>
        <p className="text-white/30 text-xs mt-1 text-center">
          {effectiveTodayMinutes}/{dailyGoal} min
        </p>
      </div>

      {/* Chart section */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/80 text-sm font-semibold">Activity</p>
        <div className="flex gap-1">
          {(["week", "month", "all"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setChartView(view)}
                className={`relative text-xs px-2.5 py-1 rounded-lg transition-all ${
                  chartView === view
                    ? "bg-white/15 text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {view === "week" ? "7d" : view === "month" ? "30d" : "12w"}
              </button>
          ))}
        </div>
      </div>

      <div className="h-32 mb-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis
              dataKey={chartKey}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={chartView === "month" ? 4 : 0}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "rgba(0,0,0,0.75)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "white",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`${value} min`, "Focus"]}
            />
            <Bar
              dataKey="minutes"
              fill={hexToRgba(themeB, 0.5)}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap calendar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-white/80 text-sm font-semibold relative">
            Contributions
          </p>
        </div>
        <HeatmapCalendar themeColor={themeB} />
      </div>

      {/* Today's sessions */}
      {todaySessions.length > 0 && (
        <div className="mb-5">
          <p className="text-white/80 text-sm font-semibold mb-2">
            Today&apos;s Sessions
          </p>
          <div className="space-y-1.5">
            {todaySessions.map((s) => {
              const time = new Date(s.completedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-sm text-white/70 bg-white/5 rounded-lg px-3 py-2"
                >
                  <span className="truncate max-w-[160px]">{s.task || "Unnamed"}</span>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-white/30 text-xs">{time}</span>
                    <span className="text-white/50">{s.durationMinutes}m</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {todaySessions.length === 0 && (
        <p className="text-white/30 text-sm text-center py-4 mb-5">
          No sessions yet today. Start a Pomodoro!
        </p>
      )}

      {/* By Task */}
      <div className="mb-5">
        <p className="text-white/80 text-sm font-semibold mb-2 relative">
          By Task
        </p>
        {taskStats.length > 0 ? (
          <div className="space-y-1.5">
            {taskStats.slice(0, 8).map((t) => (
              <div
                key={t.task}
                className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2"
              >
                <span className="text-white/70 truncate max-w-[160px]">{t.task}</span>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span className="text-white/50">{formatMinutesShort(t.totalMinutes)}</span>
                  <span className="text-white/30 text-xs">({t.sessionCount})</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/30 text-sm text-center py-2">No data yet</p>
        )}
      </div>

      {/* Breathing stats */}
      {breathingStats.sessionCount > 0 && (
        <div className="mb-5">
          <p className="text-white/80 text-sm font-semibold mb-2">Breathing</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/8 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{formatMinutesShort(breathingStats.totalMinutes)}</p>
              <p className="text-white/50 text-xs mt-0.5">Total</p>
            </div>
            <div className="bg-white/8 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{breathingStats.sessionCount}</p>
              <p className="text-white/50 text-xs mt-0.5">Sessions</p>
            </div>
          </div>
        </div>
      )}

      {/* Deep Work stats */}
      {deepWorkStats.sessionCount > 0 && (
        <div className="mb-5">
          <p className="text-white/80 text-sm font-semibold mb-2">Deep Work</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/8 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{formatMinutesShort(deepWorkStats.totalMinutes)}</p>
              <p className="text-white/50 text-xs mt-0.5">Total</p>
            </div>
            <div className="bg-white/8 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{deepWorkStats.sessionCount}</p>
              <p className="text-white/50 text-xs mt-0.5">Sessions</p>
            </div>
            <div className="bg-white/8 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{deepWorkStats.averageMinutes}m</p>
              <p className="text-white/50 text-xs mt-0.5">Average</p>
            </div>
            <div className="bg-white/8 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{deepWorkStats.longestMinutes}m</p>
              <p className="text-white/50 text-xs mt-0.5">Longest</p>
            </div>
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="mb-5">
        <BadgesPanel refreshKey={refreshKey} />
      </div>

      {/* Export */}
      <div>
        <p className="text-white/80 text-sm font-semibold mb-2 relative">
          Export
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="py-2.5 rounded-xl bg-white/8 text-white/70 text-sm font-medium hover:bg-white/12 transition-all"
          >
            CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            className="py-2.5 rounded-xl bg-white/8 text-white/70 text-sm font-medium hover:bg-white/12 transition-all"
          >
            JSON
          </button>
        </div>
      </div>
    </div>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
