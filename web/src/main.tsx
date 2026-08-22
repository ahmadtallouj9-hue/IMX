import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './lib/auth';
import { listenForInstall } from './lib/install';
import './styles.css';

listenForInstall();
void import('@capacitor/app').then(({ App }) => {
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) window.history.back();
    else void App.exitApp();
  });
}).catch(() => undefined);
void import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
  void StatusBar.setBackgroundColor({ color: '#090b0e' });
  void StatusBar.setStyle({ style: Style.Dark });
}).catch(() => undefined);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
