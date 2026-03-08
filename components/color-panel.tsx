"use client"

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { ProBadge } from "./pro-badge"

// ---- HSV utilities ----

function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h * 360, s * 100, v * 100]
}

function hsvToHex(h: number, s: number, v: number): string {
  const hn = h / 360, sn = s / 100, vn = v / 100
  const i = Math.floor(hn * 6)
  const f = hn * 6 - i
  const p = vn * (1 - sn), q = vn * (1 - f * sn), t = vn * (1 - (1 - f) * sn)
  let r: number, g: number, b: number
  switch (i % 6) {
    case 0: r = vn; g = t; b = p; break
    case 1: r = q; g = vn; b = p; break
    case 2: r = p; g = vn; b = t; break
    case 3: r = p; g = q; b = vn; break
    case 4: r = t; g = p; b = vn; break
    default: r = vn; g = p; b = q; break
  }
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// ---- Color Picker component ----

function ColorPickerView({
  color,
  onChange,
  onDone,
}: {
  color: string
  onChange: (hex: string) => void
  onDone: () => void
}) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(color))
  const [h, s, v] = hsv
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)

  const updateSV = (e: ReactPointerEvent | globalThis.PointerEvent) => {
    const rect = svRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    const newS = x * 100
    const newV = (1 - y) * 100
    setHsv([h, newS, newV])
    onChange(hsvToHex(h, newS, newV))
  }

  const updateHue = (e: ReactPointerEvent | globalThis.PointerEvent) => {
    const rect = hueRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newH = x * 360
    setHsv([newH, s, v])
    onChange(hsvToHex(newH, s, v))
  }

  const handleSVDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    updateSV(e)
    const onMove = (ev: globalThis.PointerEvent) => updateSV(ev)
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const handleHueDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    updateHue(e)
    const onMove = (ev: globalThis.PointerEvent) => updateHue(ev)
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const pureHue = hsvToHex(h, 100, 100)
  const currentHex = hsvToHex(h, s, v)

  return (
    <div className="space-y-4">
      <p className="text-white/60 text-xs font-medium uppercase tracking-wider">
        Choose Color
      </p>

      {/* SV area */}
      <div
        ref={svRef}
        onPointerDown={handleSVDown}
        className="relative w-full h-44 rounded-xl cursor-crosshair touch-none overflow-hidden"
        style={{ background: pureHue }}
      >
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #fff, transparent)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent, #000)" }} />
        {/* Cursor */}
        <div
          className="absolute w-5 h-5 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${s}%`,
            top: `${100 - v}%`,
            background: currentHex,
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        onPointerDown={handleHueDown}
        className="relative w-full h-6 rounded-full cursor-pointer touch-none"
        style={{
          background: "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
        }}
      >
        <div
          className="absolute top-1/2 w-5 h-5 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${(h / 360) * 100}%`,
            background: pureHue,
          }}
        />
      </div>

      {/* Preview + confirm */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-10 rounded-xl border border-white/20"
          style={{ background: currentHex }}
        />
        <button
          onClick={onDone}
          className="px-5 py-2.5 rounded-xl bg-white/20 text-white text-sm font-semibold hover:bg-white/30 transition-all"
        >
          Set
        </button>
      </div>
    </div>
  )
}

type BackgroundType = "solid" | "linear" | "radial" | "mesh" | "waves" | "noise" | "plasma" | "parallax"
type OverlayEffect = "none" | "frost" | "rain" | "snow" | "flutes" | "fireflies" | "sakura" | "stars" | "bokeh" | "aurora" | "bubbles" | "dust" | "matrix" | "confetti" | "lightning" | "waterWaves"
type GlowMode = "rotate" | "pulse" | "breathe" | "colorShift" | "flowHorizontal" | "static" | "rainbow" | "neon" | "fire" | "glitch" | "heartbeat" | "auroraGlow" | "cyber"
type ClockFont = "default" | "lcd" | "handwritten" | "pixel" | "thin"
type CardStyle = "classic" | "midnight" | "ocean" | "ruby" | "emerald" | "amethyst" | "slate" | "gold" | "rose" | "custom"

interface ThemeOption {
  a: string
  b: string
  label: string
  premium?: boolean
  system?: boolean
}

const THEMES: ThemeOption[] = [
  { a: "#1a3a5c", b: "#e8a830", label: "Ocean" },
  { a: "#e94560", b: "#ff9a8b", label: "Peach" },
  { a: "#7b2d8e", b: "#c471f5", label: "Purples" },
  { a: "#0f3460", b: "#e94560", label: "Sunset" },
  { a: "#134e4a", b: "#fbbf24", label: "Forest" },
  { a: "#1a1a2e", b: "#00d2ff", label: "Arctic" },
  // Premium themes
  { a: "#0d0221", b: "#ff2975", label: "Tokyo Neon", premium: true },
  { a: "#8B4513", b: "#FFD700", label: "Sahara", premium: true },
  { a: "#0B3D2E", b: "#00FF87", label: "Aurora", premium: true },
  { a: "#2D1B69", b: "#E8B4F8", label: "Lavender", premium: true },
  { a: "#1a0000", b: "#FF4500", label: "Ember", premium: true },
  { a: "#0a0a1a", b: "#D4AF37", label: "Midnight", premium: true },
  { a: "#2d1b3d", b: "#ff8fa3", label: "Cherry Blossom", premium: true },
  { a: "#0a1628", b: "#00e5ff", label: "Deep Ocean", premium: true },
  { a: "#1a1210", b: "#e87e04", label: "Copper", premium: true },
  { a: "#e8edf2", b: "#4a90d9", label: "Frost", premium: true },
  { a: "#0d1117", b: "#58a6ff", label: "Cobalt", premium: true },
  { a: "#1a0a2e", b: "#f72585", label: "Neon Rose", premium: true },
]

const FREE_BG_TYPES: BackgroundType[] = ["solid", "linear", "radial"]
const PREMIUM_BG_TYPES: BackgroundType[] = ["mesh", "waves", "noise", "plasma", "parallax"]
const ALL_BG_TYPES: BackgroundType[] = [...FREE_BG_TYPES, ...PREMIUM_BG_TYPES]

const FREE_OVERLAYS: OverlayEffect[] = ["none", "frost", "rain", "snow", "flutes"]
const PREMIUM_OVERLAYS: OverlayEffect[] = ["fireflies", "sakura", "stars", "bokeh", "aurora", "bubbles", "dust", "matrix", "confetti", "lightning", "waterWaves"]
const ALL_OVERLAYS: OverlayEffect[] = [...FREE_OVERLAYS, ...PREMIUM_OVERLAYS]

const FREE_GLOW_MODES: { value: GlowMode; label: string }[] = [
  { value: "rotate", label: "Rotate" },
  { value: "pulse", label: "Pulse" },
  { value: "breathe", label: "Breathe" },
  { value: "colorShift", label: "Shift" },
  { value: "flowHorizontal", label: "Flow" },
  { value: "static", label: "Static" },
]

const PREMIUM_GLOW_MODES: { value: GlowMode; label: string }[] = [
  { value: "rainbow", label: "Rainbow" },
  { value: "neon", label: "Neon" },
  { value: "fire", label: "Fire" },
  { value: "glitch", label: "Glitch" },
  { value: "heartbeat", label: "Heartbeat" },
  { value: "auroraGlow", label: "Aurora" },
  { value: "cyber", label: "Cyber" },
]

const CLOCK_FONTS: { value: ClockFont; label: string; premium: boolean }[] = [
  { value: "default", label: "Default", premium: false },
  { value: "lcd", label: "Retro LCD", premium: true },
  { value: "handwritten", label: "Handwritten", premium: true },
  { value: "pixel", label: "Pixel", premium: true },
  { value: "thin", label: "Thin", premium: true },
]

const CARD_STYLES: { value: CardStyle; label: string; colors: [string, string, string]; premium: boolean }[] = [
  { value: "classic", label: "Classic", colors: ["#e87850", "#f0a050", "#b83020"], premium: false },
  { value: "midnight", label: "Midnight", colors: ["#1a1a3e", "#3a3a7e", "#8b8bff"], premium: true },
  { value: "ocean", label: "Ocean", colors: ["#0a3d5c", "#1276a8", "#4ec8f0"], premium: true },
  { value: "ruby", label: "Ruby", colors: ["#6b1030", "#a82050", "#ff6090"], premium: true },
  { value: "emerald", label: "Emerald", colors: ["#0a3a2a", "#108050", "#40e890"], premium: true },
  { value: "amethyst", label: "Amethyst", colors: ["#3a1860", "#6830a0", "#c87cf0"], premium: true },
  { value: "slate", label: "Slate", colors: ["#2a2a30", "#4a4a55", "#b0b0c0"], premium: true },
  { value: "gold", label: "Gold", colors: ["#4a3a10", "#8a6830", "#ffd060"], premium: true },
  { value: "rose", label: "Rose", colors: ["#5a2040", "#9a4070", "#ffb0d0"], premium: true },
]

const ALL_GLOW_MODES = [...FREE_GLOW_MODES, ...PREMIUM_GLOW_MODES]

interface ColorPanelProps {
  activeThemeIndex: number
  onThemeChange: (index: number) => void
  customColorA: string
  customColorB: string
  onCustomColorAChange: (color: string) => void
  onCustomColorBChange: (color: string) => void
  backgroundType: BackgroundType
  onBackgroundTypeChange: (type: BackgroundType) => void
  overlayEffect: OverlayEffect
  onOverlayEffectChange: (effect: OverlayEffect) => void
  glowEnabled: boolean
  onGlowEnabledChange: (enabled: boolean) => void
  glowMode: GlowMode
  onGlowModeChange: (mode: GlowMode) => void
  clockFont: ClockFont
  onClockFontChange: (font: ClockFont) => void
  cardStyle: CardStyle
  onCardStyleChange: (style: CardStyle) => void
  customCardColor: string
  customCardText: string
  onCustomCardColorChange: (color: string) => void
  onCustomCardTextChange: (color: string) => void
  onClose: () => void
  isPro: boolean
  onProNeeded: () => void
  onPreviewStart?: () => void
  systemColors?: { colorA: string; colorB: string; available: boolean } | null
}

function PillButton({
  label,
  active,
  onClick,
  premium,
  isPro,
}: {
  label: string
  active: boolean
  onClick: () => void
  premium?: boolean
  isPro?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200
        ${
          active
            ? "bg-white/20 text-white shadow-inner shadow-white/10"
            : "bg-black/30 text-white/70 hover:bg-black/40 hover:text-white/90"
        }
      `}
    >
      {label}
      <ProBadge show={!!premium && !isPro} />
    </button>
  )
}

function ThemePreview({
  theme,
  active,
  onClick,
  isPro,
}: {
  theme: ThemeOption
  active: boolean
  onClick: () => void
  isPro: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-xl overflow-hidden h-20 transition-all duration-200
        ${active ? "ring-2 ring-white/60 scale-105" : "ring-1 ring-white/10 hover:ring-white/30"}
      `}
    >
      <div
        className="absolute inset-0"
        style={{
          background: theme.system
            ? `conic-gradient(from 0deg, ${theme.a}, ${theme.b}, ${theme.a})`
            : `linear-gradient(135deg, ${theme.a} 0%, ${theme.b} 100%)`,
        }}
      />
      <span className="relative text-white text-xs font-semibold drop-shadow-md flex items-end justify-center pb-2 h-full">
        {theme.label}
      </span>
      <ProBadge show={!!theme.premium && !isPro} />
    </button>
  )
}

function BgPreview({
  type,
  active,
  color1,
  color2,
  onClick,
  premium,
  isPro,
}: {
  type: BackgroundType
  active: boolean
  color1: string
  color2: string
  onClick: () => void
  premium?: boolean
  isPro?: boolean
}) {
  const bgStyle =
    type === "solid"
      ? { background: color1 }
      : type === "linear"
        ? { background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)` }
        : type === "radial"
          ? { background: `radial-gradient(circle at center, ${color2} 0%, ${color1} 100%)` }
          : type === "mesh"
            ? { background: `radial-gradient(circle at 30% 30%, ${color2} 0%, ${color1} 50%, ${color2} 100%)` }
            : type === "waves"
              ? { background: `linear-gradient(180deg, ${color1} 0%, ${color2} 60%, ${color1} 100%)` }
              : type === "noise"
                ? { background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`, filter: "contrast(1.2)" }
                : type === "plasma"
                  ? { background: `conic-gradient(${color1}, ${color2}, ${color1})` }
                  : { background: `linear-gradient(0deg, ${color1} 0%, ${color2} 40%, ${color1} 70%, ${color2} 100%)` }

  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-xl overflow-hidden h-16 transition-all duration-200
        ${active ? "ring-2 ring-white/60 scale-105" : "ring-1 ring-white/10 hover:ring-white/30"}
      `}
    >
      <div className="absolute inset-0" style={bgStyle} />
      <span className="relative text-white text-xs font-semibold drop-shadow-md flex items-end justify-center pb-2 h-full capitalize">
        {type}
      </span>
      <ProBadge show={!!premium && !isPro} />
    </button>
  )
}

function CardStylePreview({
  style,
  active,
  onClick,
  isPro,
}: {
  style: typeof CARD_STYLES[number]
  active: boolean
  onClick: () => void
  isPro: boolean
}) {
  const [top, bottom, text] = style.colors
  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-xl overflow-hidden h-16 transition-all duration-200
        ${active ? "ring-2 ring-white/60 scale-105" : "ring-1 ring-white/10 hover:ring-white/30"}
      `}
    >
      <div className="absolute inset-0 flex flex-col">
        <div className="flex-1" style={{ background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)` }} />
        <div className="h-px bg-black/20" />
        <div className="flex-1" style={{ background: `linear-gradient(180deg, ${bottom} 0%, ${bottom} 100%)` }} />
      </div>
      <span
        className="relative text-xs font-bold drop-shadow-md flex items-center justify-center h-full"
        style={{ color: text }}
      >
        {style.label}
      </span>
      <ProBadge show={style.premium && !isPro} />
    </button>
  )
}

export function ColorPanel({
  activeThemeIndex,
  onThemeChange,
  customColorA,
  customColorB,
  onCustomColorAChange,
  onCustomColorBChange,
  backgroundType,
  onBackgroundTypeChange,
  overlayEffect,
  onOverlayEffectChange,
  glowEnabled,
  onGlowEnabledChange,
  glowMode,
  onGlowModeChange,
  clockFont,
  onClockFontChange,
  cardStyle,
  onCardStyleChange,
  customCardColor,
  customCardText,
  onCustomCardColorChange,
  onCustomCardTextChange,
  onClose,
  isPro,
  onProNeeded,
  onPreviewStart,
  systemColors,
}: ColorPanelProps) {
  const showSystemTheme = systemColors?.available === true
  const systemTheme: ThemeOption | null = showSystemTheme
    ? { a: systemColors!.colorA, b: systemColors!.colorB, label: "System", system: true }
    : null

  const isCustom = activeThemeIndex === -1
  const isSystem = activeThemeIndex === -2
  const currentTheme = isCustom
    ? { a: customColorA, b: customColorB, label: "Custom" }
    : isSystem && systemTheme
      ? systemTheme
      : THEMES[activeThemeIndex] || THEMES[0]

  // Custom sub-views for theme and card style
  const [customView, setCustomView] = useState<null | "select" | "editA" | "editB" | "cardSelect" | "cardEditColor" | "cardEditText">(null)

  // Preview state for premium items
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const handlePremiumPreview = useCallback(
    (applyPreview: () => void, revert: () => void) => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)

      applyPreview()
      setPreviewing(true)
      onPreviewStart?.()

      previewTimerRef.current = setTimeout(() => {
        revert()
        setPreviewing(false)
        onProNeeded()
      }, 3500)
    },
    [onProNeeded, onPreviewStart]
  )

  const handleThemeClick = useCallback(
    (i: number) => {
      const theme = THEMES[i]
      if (theme.premium && !isPro) {
        const prev = activeThemeIndex
        handlePremiumPreview(
          () => onThemeChange(i),
          () => onThemeChange(prev)
        )
      } else {
        onThemeChange(i)
        onClose()
      }
    },
    [isPro, activeThemeIndex, onThemeChange, handlePremiumPreview]
  )

  const handleBgClick = useCallback(
    (type: BackgroundType) => {
      const isPremiumBg = PREMIUM_BG_TYPES.includes(type)
      if (isPremiumBg && !isPro) {
        const prev = backgroundType
        handlePremiumPreview(
          () => onBackgroundTypeChange(type),
          () => onBackgroundTypeChange(prev)
        )
      } else {
        onBackgroundTypeChange(type)
        onClose()
      }
    },
    [isPro, backgroundType, onBackgroundTypeChange, handlePremiumPreview]
  )

  const handleOverlayClick = useCallback(
    (effect: OverlayEffect) => {
      const isPremiumOverlay = PREMIUM_OVERLAYS.includes(effect)
      if (isPremiumOverlay && !isPro) {
        const prev = overlayEffect
        handlePremiumPreview(
          () => onOverlayEffectChange(effect),
          () => onOverlayEffectChange(prev)
        )
      } else {
        onOverlayEffectChange(effect)
        onClose()
      }
    },
    [isPro, overlayEffect, onOverlayEffectChange, handlePremiumPreview]
  )

  const handleFontClick = useCallback(
    (font: ClockFont) => {
      const isPremiumFont = CLOCK_FONTS.find((f) => f.value === font)?.premium
      if (isPremiumFont && !isPro) {
        const prev = clockFont
        handlePremiumPreview(
          () => onClockFontChange(font),
          () => onClockFontChange(prev)
        )
      } else {
        onClockFontChange(font)
        onClose()
      }
    },
    [isPro, clockFont, onClockFontChange, handlePremiumPreview]
  )

  const handleGlowModeClick = useCallback(
    (mode: GlowMode) => {
      const isPremiumGlow = PREMIUM_GLOW_MODES.some((m) => m.value === mode)
      if (isPremiumGlow && !isPro) {
        const prev = glowMode
        handlePremiumPreview(
          () => onGlowModeChange(mode),
          () => onGlowModeChange(prev)
        )
      } else {
        onGlowModeChange(mode)
        onClose()
      }
    },
    [isPro, glowMode, onGlowModeChange, handlePremiumPreview]
  )

  const handleCardStyleClick = useCallback(
    (style: CardStyle) => {
      const isPremiumStyle = CARD_STYLES.find((s) => s.value === style)?.premium
      if (isPremiumStyle && !isPro) {
        const prev = cardStyle
        handlePremiumPreview(
          () => onCardStyleChange(style),
          () => onCardStyleChange(prev)
        )
      } else {
        onCardStyleChange(style)
        onClose()
      }
    },
    [isPro, cardStyle, onCardStyleChange, handlePremiumPreview]
  )

  return (
    <div
      className="animate-in slide-in-from-bottom-4 fade-in duration-300 w-[calc(100%-2rem)] sm:w-[380px] rounded-2xl border border-white/10 p-5 max-h-[60vh] overflow-y-auto"
      style={{
        background: "rgba(40, 30, 20, 0.55)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      {/* Custom editing views */}
      {customView === "editA" ? (
        <ColorPickerView
          color={customColorA}
          onChange={onCustomColorAChange}
          onDone={() => setCustomView("select")}
        />
      ) : customView === "editB" ? (
        <ColorPickerView
          color={customColorB}
          onChange={onCustomColorBChange}
          onDone={() => setCustomView("select")}
        />
      ) : customView === "cardEditColor" ? (
        <ColorPickerView
          color={customCardColor}
          onChange={onCustomCardColorChange}
          onDone={() => setCustomView("cardSelect")}
        />
      ) : customView === "cardEditText" ? (
        <ColorPickerView
          color={customCardText}
          onChange={onCustomCardTextChange}
          onDone={() => setCustomView("cardSelect")}
        />
      ) : customView === "cardSelect" ? (
        <>
          <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-4">
            Custom Card Style
          </p>

          {/* Preview card */}
          <div className="flex justify-center mb-5">
            <div
              className="w-24 h-16 rounded-xl overflow-hidden border border-white/10 flex flex-col"
            >
              <div className="flex-1" style={{ background: `linear-gradient(180deg, ${customCardColor} 0%, ${customCardColor}dd 100%)` }} />
              <div className="h-px bg-black/20" />
              <div className="flex-1 flex items-center justify-center" style={{ background: `linear-gradient(180deg, ${customCardColor}dd 0%, ${customCardColor}bb 100%)` }}>
                <span className="text-lg font-bold" style={{ color: customCardText }}>0</span>
              </div>
            </div>
          </div>

          {/* Color / Text blocks */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => setCustomView("cardEditColor")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div
                className="w-full h-14 rounded-lg border border-white/20"
                style={{ background: customCardColor }}
              />
              <span className="text-white/80 text-sm font-medium">Background</span>
            </button>
            <button
              onClick={() => setCustomView("cardEditText")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div
                className="w-full h-14 rounded-lg border border-white/20"
                style={{ background: customCardText }}
              />
              <span className="text-white/80 text-sm font-medium">Text</span>
            </button>
          </div>

          {/* Back button */}
          <button
            onClick={() => setCustomView(null)}
            className="w-full py-2.5 rounded-xl bg-white/10 text-white/70 text-sm font-medium hover:bg-white/15 transition-all"
          >
            ← Back
          </button>
        </>
      ) : customView === "select" ? (
        <>
          <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-4">
            Custom Theme
          </p>

          {/* Preview gradient */}
          <div
            className="w-full h-20 rounded-xl mb-5 border border-white/10"
            style={{ background: `linear-gradient(135deg, ${customColorA} 0%, ${customColorB} 100%)` }}
          />

          {/* Color A / Color B blocks */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => setCustomView("editA")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div
                className="w-full h-14 rounded-lg border border-white/20"
                style={{ background: customColorA }}
              />
              <span className="text-white/80 text-sm font-medium">Color A</span>
            </button>
            <button
              onClick={() => setCustomView("editB")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div
                className="w-full h-14 rounded-lg border border-white/20"
                style={{ background: customColorB }}
              />
              <span className="text-white/80 text-sm font-medium">Color B</span>
            </button>
          </div>

          {/* Back button */}
          <button
            onClick={() => setCustomView(null)}
            className="w-full py-2.5 rounded-xl bg-white/10 text-white/70 text-sm font-medium hover:bg-white/15 transition-all"
          >
            ← Back
          </button>
        </>
      ) : (
      <>
      <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-4">
        Color
      </p>

      {/* Themes section */}
      <p className="text-white/80 text-sm font-semibold mb-2">Themes</p>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {systemTheme && (
          <ThemePreview
            key="System"
            theme={systemTheme}
            active={activeThemeIndex === -2}
            onClick={() => { setCustomView(null); onThemeChange(-2); onClose() }}
            isPro={isPro}
          />
        )}
        {THEMES.map((theme, i) => (
          <ThemePreview
            key={theme.label}
            theme={theme}
            active={activeThemeIndex === i}
            onClick={() => { setCustomView(null); handleThemeClick(i) }}
            isPro={isPro}
          />
        ))}
      </div>
      {/* Custom theme — centered */}
      <div className="flex justify-center mb-5">
        <button
          onClick={() => {
            if (!isPro) {
              const prev = activeThemeIndex
              handlePremiumPreview(
                () => onThemeChange(-1),
                () => onThemeChange(prev >= 0 ? prev : 0)
              )
            } else {
              onThemeChange(-1); setCustomView("select")
            }
          }}
          className={`
            relative rounded-xl overflow-hidden h-20 w-1/3 transition-all duration-200
            ${isCustom ? "ring-2 ring-white/60 scale-105" : "ring-1 ring-white/10 hover:ring-white/30"}
          `}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${customColorA} 0%, ${customColorB} 100%)`,
            }}
          />
          <span className="relative text-white text-xs font-semibold drop-shadow-md flex items-end justify-center pb-2 h-full">
            Custom
          </span>
          <ProBadge show={!isPro} />
        </button>
      </div>

      {/* Backgrounds section */}
      <p className="text-white/80 text-sm font-semibold mb-2">Backgrounds</p>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {ALL_BG_TYPES.map((type) => (
          <BgPreview
            key={type}
            type={type}
            active={backgroundType === type}
            color1={currentTheme.a}
            color2={currentTheme.b}
            onClick={() => handleBgClick(type)}
            premium={PREMIUM_BG_TYPES.includes(type)}
            isPro={isPro}
          />
        ))}
      </div>

      {/* Overlay Effects section */}
      <p className="text-white/80 text-sm font-semibold mb-2">Overlay Effects</p>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {ALL_OVERLAYS.map((effect) => (
          <PillButton
            key={effect}
            label={effect === "waterWaves" ? "Waves" : effect.charAt(0).toUpperCase() + effect.slice(1)}
            active={overlayEffect === effect}
            onClick={() => handleOverlayClick(effect)}
            premium={PREMIUM_OVERLAYS.includes(effect)}
            isPro={isPro}
          />
        ))}
      </div>

      {/* Glow Effect section */}
      <p className="text-white/80 text-sm font-semibold mb-2">Glow Effect</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <PillButton
          label="Off"
          active={!glowEnabled}
          onClick={() => { onGlowEnabledChange(false); onClose() }}
        />
        <PillButton
          label="On"
          active={glowEnabled}
          onClick={() => { onGlowEnabledChange(true); onClose() }}
        />
      </div>
      {glowEnabled && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          {ALL_GLOW_MODES.map((m) => (
            <PillButton
              key={m.value}
              label={m.label}
              active={glowMode === m.value}
              onClick={() => handleGlowModeClick(m.value)}
              premium={PREMIUM_GLOW_MODES.some((pm) => pm.value === m.value)}
              isPro={isPro}
            />
          ))}
        </div>
      )}

      {/* Card Style section */}
      <p className="text-white/80 text-sm font-semibold mb-2">Card Style</p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {CARD_STYLES.map((s) => (
          <CardStylePreview
            key={s.value}
            style={s}
            active={cardStyle === s.value}
            onClick={() => handleCardStyleClick(s.value)}
            isPro={isPro}
          />
        ))}
      </div>
      {/* Custom card style — centered */}
      <div className="flex justify-center mb-5">
        <button
          onClick={() => {
            if (!isPro) {
              const prev = cardStyle
              handlePremiumPreview(
                () => onCardStyleChange("custom"),
                () => onCardStyleChange(prev !== "custom" ? prev : "classic")
              )
            } else {
              onCardStyleChange("custom"); setCustomView("cardSelect")
            }
          }}
          className={`
            relative rounded-xl overflow-hidden h-16 w-1/3 transition-all duration-200
            ${cardStyle === "custom" ? "ring-2 ring-white/60 scale-105" : "ring-1 ring-white/10 hover:ring-white/30"}
          `}
        >
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1" style={{ background: customCardColor }} />
            <div className="h-px bg-black/20" />
            <div className="flex-1" style={{ background: `${customCardColor}cc` }} />
          </div>
          <span
            className="relative text-xs font-bold drop-shadow-md flex items-center justify-center h-full"
            style={{ color: customCardText }}
          >
            Custom
          </span>
          <ProBadge show={!isPro} />
        </button>
      </div>

      {/* Clock Font section */}
      <p className="text-white/80 text-sm font-semibold mb-2">Clock Font</p>
      <div className="grid grid-cols-3 gap-2">
        {CLOCK_FONTS.map((f) => (
          <PillButton
            key={f.value}
            label={f.label}
            active={clockFont === f.value}
            onClick={() => handleFontClick(f.value)}
            premium={f.premium}
            isPro={isPro}
          />
        ))}
      </div>
      </>
      )}
    </div>
  )
}

export { THEMES }
export type { BackgroundType, OverlayEffect, GlowMode, ClockFont, CardStyle }
