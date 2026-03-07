"use client"

import { useCallback, useEffect, useRef } from "react"
import { usePersistedState } from "./use-persisted-state"

export function usePro() {
  const [isPro, setIsPro] = usePersistedState("pomo-pro", false)
  const checkedRef = useRef(false)

  const callPlugin = useCallback(async (method: string) => {
    try {
      const { Capacitor } = await import("@capacitor/core")
      if (Capacitor.isNativePlatform()) {
        const result = await Capacitor.Plugins["ProPurchase"]?.[method]()
        return result
      }
    } catch {
      // Plugin not available
    }
    return null
  }, [])

  const checkPro = useCallback(async () => {
    const result = await callPlugin("checkPro")
    if (result && typeof result.isPro === "boolean") {
      setIsPro(result.isPro)
    }
  }, [callPlugin, setIsPro])

  const purchasePro = useCallback(async (): Promise<boolean> => {
    const result = await callPlugin("purchasePro")
    if (result?.success) {
      setIsPro(true)
      return true
    }
    return false
  }, [callPlugin, setIsPro])

  const restorePurchase = useCallback(async () => {
    const result = await callPlugin("restorePurchase")
    if (result && typeof result.isPro === "boolean") {
      setIsPro(result.isPro)
      return result.isPro
    }
    return false
  }, [callPlugin, setIsPro])

  // Check pro status on mount (once)
  useEffect(() => {
    if (!checkedRef.current) {
      checkedRef.current = true
      checkPro()
    }
  }, [checkPro])

  return { isPro, setIsPro, purchasePro, restorePurchase, checkPro }
}
