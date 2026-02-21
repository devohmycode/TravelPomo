import { isNativePlatform } from './platform'

let wakeLockSentinel: WakeLockSentinel | null = null

export async function keepAwake(): Promise<void> {
  if (isNativePlatform()) {
    const mod = await import('@capacitor-community/keep-awake')
    await mod.KeepAwake.keepAwake()
  } else {
    try {
      if ('wakeLock' in navigator) {
        wakeLockSentinel = await navigator.wakeLock.request('screen')
      }
    } catch {
      // Wake Lock API not supported or failed
    }
  }
}

export async function allowSleep(): Promise<void> {
  if (isNativePlatform()) {
    const mod = await import('@capacitor-community/keep-awake')
    await mod.KeepAwake.allowSleep()
  } else {
    try {
      await wakeLockSentinel?.release()
      wakeLockSentinel = null
    } catch {
      // ignore
    }
  }
}
