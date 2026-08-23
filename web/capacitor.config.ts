import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.imx.chat',
  appName: 'IMX',
  webDir: 'dist',
  // Bundle the UI inside the APK. Remote server.url caused white/black screens when
  // Belmo was slow, undeployed, or the WebView failed to load. API still points at Belmo.
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
