import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pomo.focustimer',
  appName: 'Pomo',
  webDir: 'out',
  server: {
    allowNavigation: ['res.cloudinary.com'],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#1a3a5c',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#e8a830',
    },
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
