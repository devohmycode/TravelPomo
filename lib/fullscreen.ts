import { isNativePlatform } from './platform'

export function isNative(): boolean {
  return isNativePlatform()
}

export function toggleBrowserFullscreen(): void {
  if (typeof document === 'undefined') return
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen()
  }
}
