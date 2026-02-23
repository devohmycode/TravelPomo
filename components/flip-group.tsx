"use client"

import { FlipDigit } from "./flip-digit"
import { GlowEffect } from "./ui/glow-effect"
import type { GlowEffectProps } from "./ui/glow-effect"

interface FlipGroupProps {
  value: string
  glowEnabled?: boolean
  glowMode?: GlowEffectProps["mode"]
  glowColors?: string[]
}

export function FlipGroup({ value, glowEnabled, glowMode = "rotate", glowColors }: FlipGroupProps) {
  const digits = value.padStart(2, "0").split("")

  return (
    <div className="relative">
      {glowEnabled && (
        <GlowEffect
          colors={glowColors}
          mode={glowMode}
          blur="strong"
          scale={1.15}
          className="rounded-2xl"
        />
      )}
      <div className="relative flex gap-3 sm:gap-4">
        <FlipDigit digit={digits[0]} />
        <FlipDigit digit={digits[1]} />
      </div>
    </div>
  )
}
