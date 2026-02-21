"use client"

function formatLapTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

interface LapListProps {
  laps: number[]
}

export function LapList({ laps }: LapListProps) {
  if (laps.length === 0) return null

  return (
    <div
      className="w-[calc(100%-2rem)] sm:w-[380px] rounded-2xl border border-white/10 p-4 max-h-40 overflow-y-auto"
      style={{
        background: "rgba(40, 30, 20, 0.55)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      {[...laps].reverse().map((cumulative, revIndex) => {
        const i = laps.length - 1 - revIndex
        const delta = i === 0 ? cumulative : cumulative - laps[i - 1]
        return (
          <div
            key={i}
            className="flex justify-between text-white/80 text-sm py-1.5 border-b border-white/5 last:border-0"
          >
            <span className="text-white/50 w-16">Lap {i + 1}</span>
            <span className="w-20 text-center">{formatLapTime(delta)}</span>
            <span className="text-white/40 w-20 text-right">
              {formatLapTime(cumulative)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
