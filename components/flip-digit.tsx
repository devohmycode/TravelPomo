"use client"

import { useEffect, useRef, useState } from "react"

interface FlipDigitProps {
  digit: string
}

export function FlipDigit({ digit }: FlipDigitProps) {
  const [currentDigit, setCurrentDigit] = useState(digit)
  const [previousDigit, setPreviousDigit] = useState(digit)
  const [isFlipping, setIsFlipping] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (digit !== currentDigit) {
      setPreviousDigit(currentDigit)
      setIsFlipping(true)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        setCurrentDigit(digit)
        setIsFlipping(false)
      }, 600)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [digit, currentDigit])

  return (
    <div className="flip-card-container" aria-label={digit}>
      {/* Static bottom - shows new digit */}
      <div className="flip-card-half flip-card-bottom">
        <div className="flip-card-inner">
          <span>{digit}</span>
        </div>
      </div>

      {/* Static top - shows new digit */}
      <div className="flip-card-half flip-card-top">
        <div className="flip-card-inner">
          <span>{currentDigit}</span>
        </div>
      </div>

      {/* Animated top flap - shows old digit, flips away */}
      {isFlipping && (
        <div className="flip-card-animated flip-card-animated-top">
          <div className="flip-card-inner">
            <span>{previousDigit}</span>
          </div>
        </div>
      )}

      {/* Animated bottom flap - shows new digit, flips in */}
      {isFlipping && (
        <div className="flip-card-animated flip-card-animated-bottom">
          <div className="flip-card-inner">
            <span>{digit}</span>
          </div>
        </div>
      )}
    </div>
  )
}
