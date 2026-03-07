"use client"

import { useEffect, useState } from "react"
import { Crown, X } from "lucide-react"

interface ProPurchasePopupProps {
  open: boolean
  onClose: () => void
  onPurchase: () => Promise<boolean>
  onRestore: () => Promise<boolean>
}

export function ProPurchasePopup({ open, onClose, onPurchase, onRestore }: ProPurchasePopupProps) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [open])

  if (!open) return null

  const handlePurchase = async () => {
    setLoading(true)
    try {
      const success = await onPurchase()
      if (success) onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    setLoading(true)
    try {
      const restored = await onRestore()
      if (restored) onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.5)",
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Popup */}
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/15 p-6 transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(30, 25, 20, 0.85)",
          backdropFilter: "blur(32px) saturate(1.5)",
          WebkitBackdropFilter: "blur(32px) saturate(1.5)",
          transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
          opacity: visible ? 1 : 0,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X className="size-4 text-white/60" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="size-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(255,215,0,0.3), rgba(255,165,0,0.3))",
              border: "1px solid rgba(255,215,0,0.3)",
            }}
          >
            <Crown className="size-8 text-amber-400" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-white text-lg font-bold text-center mb-1">
          Unlock TravelPomo Pro
        </h2>
        <p className="text-white/50 text-sm text-center mb-5">
          Premium themes, backgrounds, overlays, glows &amp; ambient sounds
        </p>

        {/* Price */}
        <div className="flex items-baseline justify-center gap-1 mb-5">
          <span className="text-white text-3xl font-bold">1.99€</span>
          <span className="text-white/40 text-sm">one-time</span>
        </div>

        {/* Purchase button */}
        <button
          onClick={handlePurchase}
          disabled={loading}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #FFD700, #FF8C00)",
            boxShadow: "0 4px 16px rgba(255,165,0,0.3)",
          }}
        >
          {loading ? "Processing..." : "Unlock Pro"}
        </button>

        {/* Restore */}
        <button
          onClick={handleRestore}
          disabled={loading}
          className="w-full mt-2 py-2 text-white/40 text-xs hover:text-white/60 transition-colors disabled:opacity-50"
        >
          Restore Purchase
        </button>
      </div>
    </div>
  )
}
