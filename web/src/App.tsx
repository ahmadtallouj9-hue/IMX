import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DEFAULT_NATIVE_API, ensureNativeApiUrl, setApiUrl } from './lib/api';
import { useAuth } from './lib/auth';
import { isNativeApp } from './lib/install';
import { AuthPage } from './pages/Auth';
import { Messenger } from './pages/Messenger';

export function App() {
  const { user, loading } = useAuth();
  const [nativeReady, setNativeReady] = useState(() => {
    if (!isNativeApp()) return true;
    ensureNativeApiUrl();
    setApiUrl(DEFAULT_NATIVE_API);
    return true;
  });

  useEffect(() => {
    document.documentElement.classList.add('light');
    if (!isNativeApp()) return;
    ensureNativeApiUrl();
    setApiUrl(DEFAULT_NATIVE_API);
    setNativeReady(true);
  }, []);

  // Never trap native users on a blank boot screen — go straight to routes.
  if (!nativeReady || (loading && !isNativeApp())) {
    return (
      <div className="boot">
        <div className="boot-mark" />
        <p>Opening IMX…</p>
        <button
          className="btn primary"
          type="button"
          style={{ marginTop: 16 }}
          onClick={() => {
            try {
              setApiUrl(DEFAULT_NATIVE_API);
              localStorage.removeItem('cove.accessToken');
              localStorage.removeItem('cove.refreshToken');
            } catch {
              /* ignore */
            }
            window.location.assign('/login');
          }}
        >
          Continue to sign in
        </button>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route path="/" element={user ? <Messenger /> : <Navigate to="/login" replace />} />
      <Route path="/c/:conversationId" element={user ? <Messenger /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
