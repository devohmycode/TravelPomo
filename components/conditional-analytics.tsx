"use client"

import { useEffect, useState } from "react"
import { Analytics } from "@vercel/analytics/next"
import { isNativePlatform } from "@/lib/platform"

export function ConditionalAnalytics() {
  const [isWeb, setIsWeb] = useState(false)

  useEffect(() => {
    setIsWeb(!isNativePlatform())
  }, [])

  if (!isWeb) return null
  return <Analytics />
}
