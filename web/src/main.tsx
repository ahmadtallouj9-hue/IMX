import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './lib/auth';
import { isNativeApp, listenForInstall } from './lib/install';
import './styles.css';

const BUILD_ID = 'ui-v6-apk-black-fix-2';

// Always start light so auth/boot never renders as a blank black screen on phones
// that previously saved dark mode (html:not(.light) uses near-black --bg).
document.documentElement.classList.add('light');
if (localStorage.getItem('imx.light') === '0' && isNativeApp()) {
  localStorage.setItem('imx.light', '1');
}

listenForInstall();
void import('@capacitor/app').then(({ App }) => {
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) window.history.back();
    else void App.exitApp();
  });
}).catch(() => undefined);
void import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
  void StatusBar.setBackgroundColor({ color: '#d7dde6' });
  void StatusBar.setStyle({ style: Style.Light });
}).catch(() => undefined);

async function bootServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Capacitor WebViews + service workers often white-screen. Never register on native.
  if (isNativeApp()) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    }
    return;
  }

  const prev = localStorage.getItem('imx.build');
  if (prev !== BUILD_ID) {
    // Only force one reload per tab session to avoid an infinite Opening IMX loop
    const reloadKey = `imx.reload.${BUILD_ID}`;
    const alreadyReloaded = sessionStorage.getItem(reloadKey) === '1';
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    localStorage.setItem('imx.build', BUILD_ID);
    if (!alreadyReloaded) {
      sessionStorage.setItem(reloadKey, '1');
      window.location.reload();
      return;
    }
  }
  await navigator.serviceWorker.register(`/sw.js?v=${BUILD_ID}`);
}

window.addEventListener('load', () => {
  void bootServiceWorker();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
