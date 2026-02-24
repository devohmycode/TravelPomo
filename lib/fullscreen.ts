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

export async function toggleTauriFullscreen() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const win = getCurrentWindow()
  const isFullscreen = await win.isFullscreen()
  await win.setFullscreen(!isFullscreen)
}
