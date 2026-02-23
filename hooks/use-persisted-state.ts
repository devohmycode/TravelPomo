"use client"

import { useState, useEffect, useCallback } from "react"

export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(defaultValue)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) {
        setState(JSON.parse(stored))
      }
    } catch {
      /* ignore parse errors */
    }
  }, [key])

  const setPersisted = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next =
          typeof value === "function"
            ? (value as (prev: T) => T)(prev)
            : value
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* ignore quota errors */
        }
        return next
      })
    },
    [key]
  )

  return [state, setPersisted]
}
