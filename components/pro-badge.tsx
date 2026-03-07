"use client"

export function ProBadge({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <span
      className="absolute -top-1.5 -right-1.5 z-10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md text-white/90"
      style={{
        background: "linear-gradient(135deg, rgba(255,215,0,0.7), rgba(255,165,0,0.7))",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.2)",
        boxShadow: "0 2px 8px rgba(255,165,0,0.3)",
      }}
    >
      PRO
    </span>
  )
}
