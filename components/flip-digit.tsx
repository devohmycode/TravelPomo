"use client"

import { useEffect, useRef, useState } from "react"

interface FlipDigitProps {
  digit: string
}

export function FlipDigit({ digit }: FlipDigitProps) {
  const [displayDigit, setDisplayDigit] = useState(digit)
  const [prevDigit, setPrevDigit] = useState(digit)
  const [flipKey, setFlipKey] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const prevDigitProp = useRef(digit)

  useEffect(() => {
    if (digit !== prevDigitProp.current) {
      // Store the old digit for the animated flaps
      setPrevDigit(prevDigitProp.current)
      // Immediately update to the new digit for the static halves
      setDisplayDigit(digit)
      // Increment key to remount animated flaps and restart CSS animations
      setFlipKey((k) => k + 1)
      setIsFlipping(true)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        setIsFlipping(false)
      }, 600)

      prevDigitProp.current = digit
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [digit])

  return (
    <div className="flip-card-container" aria-label={displayDigit} role="img">
      {/* Static top half - always shows the NEW digit */}
      <div className="flip-card-half flip-card-top">
        <div className="flip-card-inner">
          <span>{displayDigit}</span>
        </div>
      </div>

      {/* Static bottom half - always shows the OLD digit (revealed as flap falls) */}
      <div className="flip-card-half flip-card-bottom">
        <div className="flip-card-inner">
          <span>{isFlipping ? prevDigit : displayDigit}</span>
        </div>
      </div>

      {/* Animated top flap - shows OLD digit, flips down and away */}
      {isFlipping && (
        <div key={`top-${flipKey}`} className="flip-card-animated flip-card-animated-top">
          <div className="flip-card-inner">
            <span>{prevDigit}</span>
          </div>
        </div>
      )}

      {/* Animated bottom flap - shows NEW digit, flips down into place */}
      {isFlipping && (
        <div key={`bottom-${flipKey}`} className="flip-card-animated flip-card-animated-bottom">
          <div className="flip-card-inner">
            <span>{displayDigit}</span>
          </div>
        </div>
      )}
    </div>
  )
}
