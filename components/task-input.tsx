"use client"

interface TaskInputProps {
  value: string
  onChange: (value: string) => void
}

export function TaskInput({ value, onChange }: TaskInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="What are you working on?"
      className="w-[calc(100%-4rem)] sm:w-[320px] bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white/80 text-sm placeholder:text-white/30 outline-none focus:border-white/25 focus:bg-white/8 transition-all duration-200 text-center"
      style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    />
  )
}
