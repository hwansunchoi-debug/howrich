import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c0a4fb86f8d0472dbbde6e2d97cc99e3',
  appName: 'my-wife-my-money',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://c0a4fb86-f8d0-472d-bbde-6e2d97cc99e3.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SmsReader: {
      startListeningAutomatically: true
    }
  }
};

export default config;