import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DEFAULT_NATIVE_API, ensureNativeApiUrl, setApiUrl } from './lib/api';
import { useAuth } from './lib/auth';
import { isNativeApp } from './lib/install';
import { AuthPage } from './pages/Auth';
import { Messenger } from './pages/Messenger';
import { ServerSetup } from './pages/ServerSetup';

export function App() {
  const { user, loading } = useAuth();
  const [checkingServer, setCheckingServer] = useState(isNativeApp());
  const [needsServer, setNeedsServer] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;

    async function probe(url: string): Promise<boolean> {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 6000);
      try {
        const res = await fetch(`${url}/health/live`, { signal: ctrl.signal });
        return res.ok;
      } catch {
        return false;
      } finally {
        window.clearTimeout(timer);
      }
    }

    async function bootNative() {
      const apiBase = ensureNativeApiUrl();
      if (await probe(apiBase)) {
        if (!cancelled) setNeedsServer(false);
        return;
      }

      if (apiBase !== DEFAULT_NATIVE_API) {
        setApiUrl(DEFAULT_NATIVE_API);
        if (await probe(DEFAULT_NATIVE_API)) {
          if (!cancelled) setNeedsServer(false);
          return;
        }
      }

      if (!cancelled) setNeedsServer(true);
    }

    void bootNative().finally(() => {
      if (!cancelled) setCheckingServer(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isNativeApp() && checkingServer) {
    return (
      <div className="boot">
        <div className="boot-mark" />
        <p>Opening IMX…</p>
      </div>
    );
  }

  if (needsServer) {
    return <ServerSetup onReady={() => window.location.reload()} />;
  }

  if (loading) {
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
              if (isNativeApp()) setApiUrl(DEFAULT_NATIVE_API);
              else localStorage.removeItem('cove.apiUrl');
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
