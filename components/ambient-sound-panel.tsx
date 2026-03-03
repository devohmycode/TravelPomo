"use client"

import { useEffect, useRef } from "react"
import {
  CloudRain,
  Flame,
  Waves,
  Droplet,
  Snowflake,
  CloudLightning,
  Volume2,
  VolumeX,
} from "lucide-react"

export type AmbientSound = "none" | "rain" | "fire" | "beach" | "river" | "blizzard" | "thunder"

const AMBIENT_SOUNDS: { id: AmbientSound; label: string; icon: typeof CloudRain; url: string }[] = [
  {
    id: "rain",
    label: "Pluie",
    icon: CloudRain,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1771584789/RAINGlas_Orage_et_pluie_sur_pare_brise_voiture_ID_1296__LaSonotheque.fr_idg9yt.mp3",
  },
  {
    id: "fire",
    label: "Feu",
    icon: Flame,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772294643/campfire-in-the-woods_oc4siq.mp3",
  },
  {
    id: "beach",
    label: "Plage",
    icon: Waves,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772294643/beach-calm-waves_zhgbtb.mp3",
  },
  {
    id: "river",
    label: "Rivière",
    icon: Droplet,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772294642/soothing-river-flow_ikyos0.mp3",
  },
  {
    id: "blizzard",
    label: "Blizzard",
    icon: Snowflake,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772294968/blizzard-ambience-sounds_b6yfbr.mp3",
  },
  {
    id: "thunder",
    label: "Orage",
    icon: CloudLightning,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772294965/dry-thunder_dn6otj.mp3",
  },
]

interface AmbientSoundPanelProps {
  activeSound: AmbientSound
  onSoundChange: (sound: AmbientSound) => void
  volume: number
  onVolumeChange: (volume: number) => void
  onClose: () => void
}

export function AmbientSoundPanel({
  activeSound,
  onSoundChange,
  volume,
  onVolumeChange,
  onClose,
}: AmbientSoundPanelProps) {
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
        Ambiance
      </p>

      {/* Sound grid */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {AMBIENT_SOUNDS.map((sound) => {
          const Icon = sound.icon
          const isActive = activeSound === sound.id
          return (
            <button
              key={sound.id}
              onClick={() => onSoundChange(isActive ? "none" : sound.id)}
              className={`
                flex flex-col items-center gap-2 rounded-xl px-3 py-3.5 text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? "bg-white/20 text-white shadow-inner shadow-white/10 scale-105"
                    : "bg-black/30 text-white/70 hover:bg-black/40 hover:text-white/90"
                }
              `}
            >
              <Icon className="size-5" />
              <span className="text-xs">{sound.label}</span>
            </button>
          )
        })}
      </div>

      {/* Volume control */}
      <div className="flex items-center gap-3">
        <VolumeX className="size-4 text-white/50 shrink-0" />
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none bg-white/20 accent-white/80 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
        />
        <Volume2 className="size-4 text-white/50 shrink-0" />
      </div>
    </div>
  )
}

// Hook to manage ambient audio playback
export function useAmbientSound(activeSound: AmbientSound, volume: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentSoundRef = useRef<AmbientSound>("none")

  const stopCurrentRef = useRef(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
      audioRef.current = null
    }
  })

  // Handle sound changes
  useEffect(() => {
    if (activeSound === "none") {
      stopCurrentRef.current()
      currentSoundRef.current = "none"
      return
    }

    const soundConfig = AMBIENT_SOUNDS.find((s) => s.id === activeSound)
    if (!soundConfig) return

    // If same sound, just keep playing
    if (currentSoundRef.current === activeSound && audioRef.current) {
      return
    }

    // Stop previous and start new
    stopCurrentRef.current()

    const audio = new Audio(soundConfig.url)
    audio.loop = true
    audio.volume = volume / 100
    audio.play().catch(() => {})
    audioRef.current = audio
    currentSoundRef.current = activeSound
  }, [activeSound]) // volume handled by separate effect

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCurrentRef.current()
    }
  }, [])
}
