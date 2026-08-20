import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.chatter.chat',
  appName: 'IMX',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
