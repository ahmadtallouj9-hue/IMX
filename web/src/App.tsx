import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DEFAULT_NATIVE_API, ensureNativeApiUrl, setApiUrl } from './lib/api';
import { useAuth } from './lib/auth';
import { isNativeApp } from './lib/install';
import { AuthPage } from './pages/Auth';
import { Messenger } from './pages/Messenger';

export function App() {
  const { user, loading } = useAuth();
  const [nativeReady, setNativeReady] = useState(!isNativeApp());

  useEffect(() => {
    if (!isNativeApp()) return;
    // Always pin the official host. Never trap users on the Setup screen when
    // a WebView health probe flakes — login will show a real error if Belmo is down.
    ensureNativeApiUrl();
    setApiUrl(DEFAULT_NATIVE_API);
    setNativeReady(true);
  }, []);

  if (!nativeReady || loading) {
    return (
      <div className="boot">
        <div className="boot-mark" />
        <p>Opening IMX…</p>
        <button
          className="btn tertiary"
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
