import { useCallback, useRef } from "react"

interface SwipeNavigationOptions {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  threshold?: number
  maxVerticalRatio?: number
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  threshold = 60,
  maxVerticalRatio = 0.75,
}: SwipeNavigationOptions) {
  const startX = useRef(0)
  const startY = useRef(0)
  const tracking = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    startX.current = touch.clientX
    startY.current = touch.clientY
    tracking.current = true
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!tracking.current) return
      tracking.current = false

      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX.current
      const dy = touch.clientY - startY.current

      // Ignore if vertical movement is too large relative to horizontal
      if (Math.abs(dy) > Math.abs(dx) * maxVerticalRatio) return
      // Ignore if swipe distance is too small
      if (Math.abs(dx) < threshold) return

      if (dx < 0) {
        onSwipeLeft()
      } else {
        onSwipeRight()
      }
    },
    [onSwipeLeft, onSwipeRight, threshold, maxVerticalRatio]
  )

  return { onTouchStart, onTouchEnd }
}
