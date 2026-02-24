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

let alarmAudio: HTMLAudioElement | null = null

export function playAlarmSound() {
  if (typeof window === 'undefined') return
  if (!alarmAudio) {
    alarmAudio = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZuTi39ydnmBipOcnZiQg3ZtcXqEl52hlYuAdXR8hpKeoJaKfXV1fYiSnp6Ui3x0dX6JlJ+dlIt8c3V+ipaenJOKe3N1f4qXnpySiXpydn+LmJ6ckoh5cnZ/i5ienJKIeXJ2f4uYnpySiHlydX+LmJ6ckoh5cnZ/jJmenpKIeXJ1f4yZn56TiXpydX+MmZ+ek4l6cnV/jJmfnpOJenJ1f4yZn56TiXpydX+MmZ+ek4l6cnV/jJqfnpOJenJ1f4yZn56TiXpydX+MmZ+ek4l6cnV/jJmfnpOJenJ1f4yZn56TiXpydX+MmZ+ek4l6cnV/jJmfnpOJenJ1f4yZn56TiXpydX+MmZ+ek4l6cnV/jJmfnpOJenJ1gI2aoJ+Uintzdn+MmZ+ek4l6cnWAjZqgn5SKe3N2f4yZn56UiXpydYCNmqCflIp7c3Z/jJmfnpSJenJ1gI2aoJ+Uintzdn+MmZ+elIl6cnWAjZqgn5SKe3N2f4yZn56UiXpydYCNmqCflIp7c3aAjZqgn5SKe3N2gI2aoJ+Uintzdn+MmZ+elIl6c3aAjZqgn5SKe3N2gI2aoJ+Uintzdn+NmqCflIp7c3aAjZqgn5SKe3N2gI2aoJ+Uintzdn+NmqCflIp7c3aAjZqgn5SKe3R3gI6boaCVi3x0d4COm6Gglot8dHeAjpuhoJaLfHR3gI6boaCWi3x0d4COm6Gglot8dHeAjpuhoJaLfHR3gI6boaCWi3x0d4CPnKKhlox9dXiAj5yioZaMfXV4gI+coqGWjH11eICPnKKhlox9dXiBkJ2jopaOffV4gZCdo6KWjn31eIGQnaOilo599XiBkJ2jopaOffV4gZCdo6KWjn31eIGRnqSjl459dnmBkZ6ko5eOfXZ5gZGepKOXjn12eYGRnqSjl459dnmBkZ6ko5eOfXZ5gZGepKOXjn12eYKSn6WkmJB+d3qCkp+lpJiQfnd6gpKfpaSYkH53eoKSn6WkmJB+d3qCkp+lpJiQfnd6gpKfpaSYkH53eoKTn6almZF/eHuDk5+mpZmRf3h7g5OfpqWZkX94e4OTn6almZF/eHuDk5+mpZmRf3h7g5SgpqaakYB5e4OUoKammpGAeXuDlKCmppqRgHl7g5SgpqaakYB5e4OUoKammpGAeXuElaCnp5uSgXp8hJWgp6ebkoF6fISVoKenm5KBenyElaCnp5uSgXp8hJWgp6ebkoF6fISVoKenm5KBenyFlqGop5yTgnx9hZahqKeckIJ8fYaXoqmnnJOCfH2Fl6KpqJ2Tg318hpejqqienYOCfH2GmKOqqZ6dgIJ8fYaYo6qpnp2Agn19hpiiq6qfnoGDfX6HmaOsq6CfgoR+f4iao62soaCChH5/iZqkrq2hoYOFf4CJm6WurqKig4Z/gIqcpq+vo6ODhoCAipymr6+jpIOGf4CLnaexsKSlhIeAf4ucp7CypaWFh4F/i5ynsbKlpYaIgoCMnaeys6amhoiBgIyep7O0pqeHioKBjZ+otLWnqIeKgoKOoKm1tqipiIuCg46gqra3qaqJjIODj6GrtreppomMg4OPoau3uKqrioyDhJCirLi5q6yLjYSEkaOturmtroqOhISRo627u62ui4+FhZKkrry8rq+Lj4WFkqWvvb2vsIyQhoaTpa+9vq+xjJGGh5Smr76/sLKNkoiHlaeywMCxs46TiIiWqLPBwbO0j5SIiZepssPCtLWPlYmJl6mzw8O1to+WioqYqrTExba2kJeKipmrs8XFtriRmIuLmqu0xcW3uJGYi4ubq7XGxrm6kpmMjJyrtsbHurqSmoyMnKy2x8i7u5ObjI2drLfIyLy8lJyNjp6tuMjJvb2UnY6On664ycq+vpWejpCfr7nKy7/AlZ+PkKCwusvMwMGWoJCRobG7y8zBwpehkZKisbzMzcPDl6KRkqKyvM3Ow8OXo5KTo7O9zs/ExJikk5OktL7P0MXGmaSUlKW1v9DRxseapdSUprW/0NHHx5ql'
    )
  }
  alarmAudio.currentTime = 0
  alarmAudio.volume = 0.6
  alarmAudio.play().catch(() => {})
}
