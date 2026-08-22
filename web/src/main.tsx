import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './lib/auth';
import { listenForInstall } from './lib/install';
import './styles.css';

const BUILD_ID = 'ui-v5-panels';

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
  const prev = localStorage.getItem('imx.build');
  if (prev !== BUILD_ID) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    localStorage.setItem('imx.build', BUILD_ID);
    window.location.reload();
    return;
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
