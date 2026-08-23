import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.imx.chat',
  appName: 'IMX',
  webDir: 'dist',
  server: {
    // Load live IMX so Android matches the website (avoids localhost→HTTPS mixed-content / CORS traps)
    url: 'https://imx-cbf0.onbelmo.uk',
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
