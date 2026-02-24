import { Capacitor } from '@capacitor/core'

export type Platform = 'tauri' | 'android' | 'ios' | 'web'

export function isTauriPlatform(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

export function isNativePlatform(): boolean {
  if (isTauriPlatform()) return true
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function getPlatform(): Platform {
  if (isTauriPlatform()) return 'tauri'
  try {
    const platform = Capacitor.getPlatform()
    if (platform === 'android') return 'android'
    if (platform === 'ios') return 'ios'
    return 'web'
  } catch {
    return 'web'
  }
}
