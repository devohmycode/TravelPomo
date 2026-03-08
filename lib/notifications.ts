import { isNativePlatform, isTauriPlatform } from './platform'

// ---- Tauri notifications ----

async function requestTauriPermission(): Promise<boolean> {
  const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification')
  let granted = await isPermissionGranted()
  if (!granted) {
    const permission = await requestPermission()
    granted = permission === 'granted'
  }
  return granted
}

async function sendTauriNotification(title: string, body: string) {
  const { sendNotification: tauriNotify } = await import('@tauri-apps/plugin-notification')
  tauriNotify({ title, body })
}

// ---- Native (Capacitor) notifications ----

async function requestNativePermission(): Promise<boolean> {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const result = await LocalNotifications.requestPermissions()
  return result.display === 'granted'
}

async function sendNativeNotification(title: string, body: string) {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.schedule({
    notifications: [
      {
        title,
        body,
        id: Date.now() % 2147483647, // Android requires int32
        smallIcon: 'ic_stat_icon',
        largeIcon: 'ic_launcher',
      },
    ],
  })
}

// ---- Browser notifications ----

async function requestBrowserPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function sendBrowserNotification(title: string, body: string) {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    new Notification(title, { body, icon: '/icon.svg' })
  }
}

// ---- Public API (platform-aware) ----

export async function requestNotificationPermission(): Promise<boolean> {
  if (isTauriPlatform()) {
    return requestTauriPermission()
  }
  if (isNativePlatform()) {
    return requestNativePermission()
  }
  return requestBrowserPermission()
}

export function sendNotification(title: string, body: string) {
  if (isTauriPlatform()) {
    sendTauriNotification(title, body).catch(() => {})
  } else if (isNativePlatform()) {
    sendNativeNotification(title, body).catch(() => {})
  } else {
    sendBrowserNotification(title, body)
  }
}

// ---- Alarm sound (shared across platforms) ----

const TIMER_SOUND_URLS: Record<string, string> = {
  default: 'https://res.cloudinary.com/dptrimoqv/video/upload/v1772972788/new-notification_nzuvaj.mp3',
  gong: 'https://res.cloudinary.com/dptrimoqv/video/upload/v1772972788/gong_m6ehtj.mp3',
  chime: 'https://res.cloudinary.com/dptrimoqv/video/upload/v1772972788/chime_ifmdgg.mp3',
  bell: 'https://res.cloudinary.com/dptrimoqv/video/upload/v1772972788/bell_zjuw9c.mp3',
}

let alarmAudio: HTMLAudioElement | null = null
let currentSoundType = 'default'

export function playAlarmSound(soundType: string = 'default') {
  if (typeof window === 'undefined') return

  const url = TIMER_SOUND_URLS[soundType] || TIMER_SOUND_URLS['default']

  if (!alarmAudio || currentSoundType !== soundType) {
    if (alarmAudio) { alarmAudio.pause(); alarmAudio.src = '' }
    alarmAudio = new Audio(url)
    currentSoundType = soundType
  }
  alarmAudio.currentTime = 0
  alarmAudio.volume = 0.6
  alarmAudio.play().catch(() => {})
}
