import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, clearTokens, getAccessToken, setTokens } from './api';
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

    const boot = Promise.race([
      api.me(),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('boot-timeout')), 2000);
      }),
    ]);

    boot
      .then(async (res) => {
        if (cancelled) return;
        setUser(res.user);
        await cacheUser(res.user);
        connectSocket();
      })
      .catch(async () => {
        if (cancelled) return;
        // Stay signed in offline using the last cached profile.
        if (!isOnline()) {
          const cached = await readCachedUser();
          if (cached) {
            setUser(cached);
            return;
          }
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
        const res = await api.login(identifier, password);
        setTokens(res.tokens.accessToken, res.tokens.refreshToken);
        setUser(res.user);
        await cacheUser(res.user);
        connectSocket();
      },
      async register(payload) {
        const res = await api.register(payload);
        setTokens(res.tokens.accessToken, res.tokens.refreshToken);
        setUser(res.user);
        await cacheUser(res.user);
        connectSocket();
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
