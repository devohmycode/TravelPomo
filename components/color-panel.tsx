"use client"

type BackgroundType = "solid" | "linear" | "radial"
type OverlayEffect = "none" | "frost" | "rain" | "flutes"

interface ThemeOption {
  a: string
  b: string
  label: string
}

const THEMES: ThemeOption[] = [
  { a: "#1a3a5c", b: "#e8a830", label: "Ocean" },
  { a: "#e94560", b: "#ff9a8b", label: "Peach" },
  { a: "#7b2d8e", b: "#c471f5", label: "Purples" },
  { a: "#0f3460", b: "#e94560", label: "Sunset" },
  { a: "#134e4a", b: "#fbbf24", label: "Forest" },
  { a: "#1a1a2e", b: "#00d2ff", label: "Arctic" },
]

interface ColorPanelProps {
  activeThemeIndex: number
  onThemeChange: (index: number) => void
  backgroundType: BackgroundType
  onBackgroundTypeChange: (type: BackgroundType) => void
  overlayEffect: OverlayEffect
  onOverlayEffectChange: (effect: OverlayEffect) => void
  onClose: () => void
}

function PillButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200
        ${
          active
            ? "bg-white/20 text-white shadow-inner shadow-white/10"
            : "bg-black/30 text-white/70 hover:bg-black/40 hover:text-white/90"
        }
      `}
    >
      {label}
    </button>
  )
}

function ThemePreview({
  theme,
  active,
  onClick,
}: {
  theme: ThemeOption
  active: boolean
  onClick: () => void
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
          background: `linear-gradient(135deg, ${theme.a} 0%, ${theme.b} 100%)`,
        }}
      />
      <span className="relative text-white text-xs font-semibold drop-shadow-md flex items-end justify-center pb-2 h-full">
        {theme.label}
      </span>
    </button>
  )
}

function BgPreview({
  type,
  active,
  color1,
  color2,
  onClick,
}: {
  type: BackgroundType
  active: boolean
  color1: string
  color2: string
  onClick: () => void
}) {
  const bgStyle =
    type === "solid"
      ? { background: color1 }
      : type === "linear"
        ? { background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)` }
        : { background: `radial-gradient(circle at center, ${color2} 0%, ${color1} 100%)` }

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
    </button>
  )
}

export function ColorPanel({
  activeThemeIndex,
  onThemeChange,
  backgroundType,
  onBackgroundTypeChange,
  overlayEffect,
  onOverlayEffectChange,
  onClose,
}: ColorPanelProps) {
  const currentTheme = THEMES[activeThemeIndex] || THEMES[0]

  return (
    <div
      className="animate-in slide-in-from-bottom-4 fade-in duration-300 w-[calc(100%-2rem)] sm:w-[380px] rounded-2xl border border-white/10 p-5 max-h-[60vh] overflow-y-auto"
      style={{
        background: "rgba(40, 30, 20, 0.55)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-4">
        Color
      </p>

      {/* Themes section */}
      <p className="text-white/80 text-sm font-semibold mb-2">Themes</p>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {THEMES.map((theme, i) => (
          <ThemePreview
            key={theme.label}
            theme={theme}
            active={activeThemeIndex === i}
            onClick={() => onThemeChange(i)}
          />
        ))}
      </div>

      {/* Backgrounds section */}
      <p className="text-white/80 text-sm font-semibold mb-2">Backgrounds</p>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {(["solid", "linear", "radial"] as BackgroundType[]).map((type) => (
          <BgPreview
            key={type}
            type={type}
            active={backgroundType === type}
            color1={currentTheme.a}
            color2={currentTheme.b}
            onClick={() => onBackgroundTypeChange(type)}
          />
        ))}
      </div>

      {/* Overlay Effects section */}
      <p className="text-white/80 text-sm font-semibold mb-2">Overlay Effects</p>
      <div className="grid grid-cols-4 gap-2">
        {(["none", "frost", "rain", "flutes"] as OverlayEffect[]).map((effect) => (
          <PillButton
            key={effect}
            label={effect.charAt(0).toUpperCase() + effect.slice(1)}
            active={overlayEffect === effect}
            onClick={() => onOverlayEffectChange(effect)}
          />
        ))}
      </div>
    </div>
  )
}

export { THEMES }
export type { BackgroundType, OverlayEffect }
