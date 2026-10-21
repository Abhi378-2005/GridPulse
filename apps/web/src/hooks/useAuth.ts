'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, loadToken, saveToken } from '@/lib/api';
import { setSocketToken } from '@/lib/socket';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  nodeId: string | null;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  // False until the saved session (if any) has been checked, so pages don't flash a logged-out state
  const [ready, setReady] = useState(false);

  const applySession = useCallback((t: string | null, u: AuthUser | null) => {
    setToken(t);
    setUser(u);
    saveToken(t);
    setSocketToken(t);
  }, []);

  // Restore a saved session on load
  useEffect(() => {
    const saved = loadToken();
    if (!saved) {
      setReady(true);
      return;
    }
    apiFetch<any>('/api/auth/me', saved)
      .then(me => applySession(saved, {
        id: me._id,
        email: me.email,
        name: me.name,
        role: me.role,
        nodeId: me.nodeId?._id ?? me.nodeId ?? null,
      }))
      .catch(() => applySession(null, null))
      .finally(() => setReady(true));
  }, [applySession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<AuthResponse>('/api/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    applySession(res.token, res.user);
  }, [applySession]);

  const register = useCallback(async (name: string, email: string, password: string, nodeId: string | null) => {
    const res = await apiFetch<AuthResponse>('/api/auth/register', null, {
      method: 'POST',
      body: JSON.stringify({ name, email, password, nodeId: nodeId || undefined }),
    });
    applySession(res.token, res.user);
  }, [applySession]);

  const logout = useCallback(() => applySession(null, null), [applySession]);

  return { token, user, ready, isAdmin: user?.role === 'admin', login, register, logout };
}
