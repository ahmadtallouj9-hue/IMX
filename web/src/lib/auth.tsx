import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, clearTokens, ensureNativeApiUrl, getAccessToken, setTokens } from './api';
import { cacheUser, clearCachedUser, isOnline, readCachedUser } from './offline';
import { connectSocket, disconnectSocket } from './socket';
import type { PublicUser } from './types';

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: { username: string; email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: PublicUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function hasStoredSession(): boolean {
  try {
    return Boolean(getAccessToken() || localStorage.getItem('cove.refreshToken'));
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  // Start unlocked when logged out so the login screen paints immediately (esp. bundled APK).
  const [loading, setLoading] = useState(() => hasStoredSession());

  useEffect(() => {
    let cancelled = false;
    if (!hasStoredSession()) {
      setLoading(false);
      return;
    }

    // Soft timeout only unlocks the UI — it must not clear a valid session on slow networks.
    const boot = Promise.race([
      api.me().then((res) => ({ ok: true as const, res })),
      new Promise<{ ok: false; reason: 'timeout' }>((resolve) => {
        window.setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 2500);
      }),
    ]);

    boot
      .then(async (result) => {
        if (cancelled) return;
        if (result.ok) {
          setUser(result.res.user);
          void cacheUser(result.res.user);
          connectSocket();
          return;
        }
        // Timed out while "online": keep cached profile and retry me() in background.
        const cached = await readCachedUser();
        if (cached) {
          setUser(cached);
          connectSocket();
        }
        void api
          .me()
          .then((res) => {
            if (cancelled) return;
            setUser(res.user);
            void cacheUser(res.user);
            connectSocket();
          })
          .catch(async (err) => {
            if (cancelled) return;
            if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
              clearTokens();
              void clearCachedUser();
              setUser(null);
              return;
            }
            if (!cached) {
              const again = await readCachedUser();
              if (again) setUser(again);
            }
          });
      })
      .catch(async (err) => {
        if (cancelled) return;
        // Stay signed in offline / on transient failures using the last cached profile.
        const cached = await readCachedUser();
        if (cached && !(err instanceof ApiError && (err.status === 401 || err.status === 403))) {
          setUser(cached);
          if (isOnline()) connectSocket();
          return;
        }
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearTokens();
          void clearCachedUser();
          setUser(null);
          return;
        }
        if (!isOnline() && cached) {
          setUser(cached);
          return;
        }
        clearTokens();
        void clearCachedUser();
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      setUser,
      async login(identifier, password) {
        ensureNativeApiUrl();
        const res = await api.login(identifier, password);
        setTokens(res.tokens.accessToken, res.tokens.refreshToken);
        setUser(res.user);
        void cacheUser(res.user);
        connectSocket();
        void import('./e2e').then(({ ensureIdentityKeys }) => ensureIdentityKeys(res.user.id)).catch(() => undefined);
      },
      async register(payload) {
        ensureNativeApiUrl();
        const res = await api.register(payload);
        setTokens(res.tokens.accessToken, res.tokens.refreshToken);
        setUser(res.user);
        void cacheUser(res.user);
        connectSocket();
        void import('./e2e').then(({ ensureIdentityKeys }) => ensureIdentityKeys(res.user.id)).catch(() => undefined);
      },
      async logout() {
        try {
          await api.logout();
        } catch {
          // still clear local session
        }
        disconnectSocket();
        clearTokens();
        void clearCachedUser();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
