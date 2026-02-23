import { Capacitor } from '@capacitor/core'

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function getPlatform(): 'android' | 'ios' | 'web' {
  try {
    const platform = Capacitor.getPlatform()
    if (platform === 'android') return 'android'
    if (platform === 'ios') return 'ios'
    return 'web'
  } catch {
    return 'web'
  }
}
