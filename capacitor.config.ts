import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c0a4fb86f8d0472dbbde6e2d97cc99e3',
  appName: 'my-wife-my-money',
  webDir: 'dist',
  bundledWebRuntime: true,
  plugins: {
    SmsReader: {
      startListeningAutomatically: true
    }
  }
};

export default config;