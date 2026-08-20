import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getApiUrl } from './lib/api';
import { useAuth } from './lib/auth';
import { isNativeApp } from './lib/install';
import { AuthPage } from './pages/Auth';
import { Messenger } from './pages/Messenger';
import { ServerSetup } from './pages/ServerSetup';

export function App() {
  const { user, loading } = useAuth();
  const [needsServer, setNeedsServer] = useState(isNativeApp() && !getApiUrl());

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    fetch(`${getApiUrl()}/health/live`)
      .then((res) => {
        if (!cancelled) setNeedsServer(!res.ok);
      })
      .catch(() => {
        if (!cancelled) setNeedsServer(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (needsServer) {
    return <ServerSetup onReady={() => window.location.reload()} />;
  }

  if (loading) {
    return (
      <div className="boot">
        <div className="boot-mark" />
        <p>Opening Chatter…</p>
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
