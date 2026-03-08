"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  CloudRain,
  Flame,
  Waves,
  Droplet,
  Snowflake,
  CloudLightning,
  Volume2,
  VolumeX,
  Coffee,
  TreePine,
  Orbit,
  Piano,
  TrainFront,
  Building2,
  Wind,
  Shell,
} from "lucide-react"
import { ProBadge } from "./pro-badge"

export type AmbientSound = "none" | "rain" | "fire" | "beach" | "river" | "blizzard" | "thunder" | "cafe" | "forest" | "space" | "piano" | "train" | "city" | "wind" | "underwater"

const AMBIENT_SOUNDS: { id: AmbientSound; label: string; icon: typeof CloudRain; url: string; premium?: boolean }[] = [
  {
    id: "rain",
    label: "Rain",
    icon: CloudRain,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1771584789/RAINGlas_Orage_et_pluie_sur_pare_brise_voiture_ID_1296__LaSonotheque.fr_idg9yt.mp3",
  },
  {
    id: "fire",
    label: "Fire",
    icon: Flame,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772294643/campfire-in-the-woods_oc4siq.mp3",
  },
  {
    id: "beach",
    label: "Beach",
    icon: Waves,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772294643/beach-calm-waves_zhgbtb.mp3",
  },
  {
    id: "river",
    label: "River",
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
    label: "Thunder",
    icon: CloudLightning,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772294965/dry-thunder_dn6otj.mp3",
  },
  // Premium sounds
  {
    id: "cafe",
    label: "Coffee",
    icon: Coffee,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772972788/coffee_j48oqa.mp3",
    premium: true,
  },
  {
    id: "forest",
    label: "Forest",
    icon: TreePine,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772972789/forest_l8mogd.mp3",
    premium: true,
  },
  {
    id: "space",
    label: "Space",
    icon: Orbit,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772972789/space-waves_t7sebe.mp3",
    premium: true,
  },
  {
    id: "piano",
    label: "Piano",
    icon: Piano,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772972789/piano_uepdgf.mp3",
    premium: true,
  },
  {
    id: "train",
    label: "Train",
    icon: TrainFront,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772972790/train_t4vda8.mp3",
    premium: true,
  },
  {
    id: "city",
    label: "City",
    icon: Building2,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772972789/city_laodem.mp3",
    premium: true,
  },
  {
    id: "wind",
    label: "Wind",
    icon: Wind,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772972788/winter-wind_afv5qq.mp3",
    premium: true,
  },
  {
    id: "underwater",
    label: "Underwater",
    icon: Shell,
    url: "https://res.cloudinary.com/dptrimoqv/video/upload/v1772972789/underwater_eojudv.mp3",
    premium: true,
  },
]

interface AmbientSoundPanelProps {
  activeSound: AmbientSound
  onSoundChange: (sound: AmbientSound) => void
  volume: number
  onVolumeChange: (volume: number) => void
  onClose: () => void
  isPro: boolean
  onProNeeded: () => void
  onPreviewStart?: () => void
}

export function AmbientSoundPanel({
  activeSound,
  onSoundChange,
  volume,
  onVolumeChange,
  onClose,
  isPro,
  onProNeeded,
  onPreviewStart,
}: AmbientSoundPanelProps) {
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const isPreviewingRef = useRef(false)

  // Cleanup on unmount — skip if premium preview is active (panel closed but timer must fire)
  useEffect(() => {
    return () => {
      if (isPreviewingRef.current) return
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.src = ""
      }
    }
  }, [])

  const handleSoundClick = useCallback(
    (sound: typeof AMBIENT_SOUNDS[number]) => {
      const isActive = activeSound === sound.id

      if (sound.premium && !isPro) {
        // Preview: play for 3.5s, then show popup
        if (previewAudioRef.current) {
          previewAudioRef.current.pause()
          previewAudioRef.current.src = ""
        }
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current)

        const audio = new Audio(sound.url)
        audio.volume = volume / 100
        audio.loop = false
        audio.play().catch(() => {})
        previewAudioRef.current = audio

        isPreviewingRef.current = true
        onPreviewStart?.()

        previewTimerRef.current = setTimeout(() => {
          audio.pause()
          audio.src = ""
          previewAudioRef.current = null
          onProNeeded()
        }, 3500)
        return
      }

      onSoundChange(isActive ? "none" : sound.id)
      onClose()
    },
    [activeSound, isPro, volume, onSoundChange, onProNeeded, onPreviewStart]
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
              onClick={() => handleSoundClick(sound)}
              className={`
                relative flex flex-col items-center gap-2 rounded-xl px-3 py-3.5 text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? "bg-white/20 text-white shadow-inner shadow-white/10 scale-105"
                    : "bg-black/30 text-white/70 hover:bg-black/40 hover:text-white/90"
                }
              `}
            >
              <Icon className="size-5" />
              <span className="text-xs">{sound.label}</span>
              <ProBadge show={!!sound.premium && !isPro} />
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
