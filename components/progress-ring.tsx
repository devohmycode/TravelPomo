"use client"

interface ProgressRingProps {
  progress: number // 0 to 1
  colorA: string
  colorB: string
  size?: number
  className?: string
}

export function ProgressRing({
  progress,
  colorA,
  colorB,
  size = 100,
  className,
}: ProgressRingProps) {
  const radius = 46
  const stroke = 3
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)))

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ transform: "rotate(-90deg)" }}
    >
      {/* Track */}
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />
      {/* Progress */}
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="url(#pomo-progress-gradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.5s linear" }}
      />
      <defs>
        <linearGradient id="pomo-progress-gradient">
          <stop offset="0%" stopColor={colorA} />
          <stop offset="100%" stopColor={colorB} />
        </linearGradient>
      </defs>
    </svg>
  )
}
