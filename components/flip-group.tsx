"use client"

import { FlipDigit } from "./flip-digit"

interface FlipGroupProps {
  value: string
}

export function FlipGroup({ value }: FlipGroupProps) {
  const digits = value.padStart(2, "0").split("")

  return (
    <div className="flex gap-2 sm:gap-3">
      <FlipDigit digit={digits[0]} />
      <FlipDigit digit={digits[1]} />
    </div>
  )
}
