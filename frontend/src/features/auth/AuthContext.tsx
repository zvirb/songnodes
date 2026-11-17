import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { API_BASE_URL } from '../../lib/apiBase';

export interface User {
  email: string;
  name?: string;
}

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

const SESSION_HINT_KEY = 'sn_auth_active';

function hasSessionHint(): boolean {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage?.getItem(SESSION_HINT_KEY) === '1') {
      return true;
    }
    if (typeof document !== 'undefined' && /(?:^|;\s*)(?:songnodes_session|CF_Authorization)=/.test(document.cookie)) {
      return true;
    }
  } catch {
    // Ignore storage access errors
  }
  return false;
}

function setSessionHint(active: boolean): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (active) {
      window.sessionStorage.setItem(SESSION_HINT_KEY, '1');
    } else {
      window.sessionStorage.removeItem(SESSION_HINT_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

function isLoginPathname(): boolean {
  try {
    return typeof window !== 'undefined' && window.location?.pathname === '/login';
  } catch {
    return false;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = `${API_BASE_URL || ''}/api/v1/auth/me`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        const email = data.email || data.user?.email;
        if (email) {
          const name = data.name || data.user?.name || email.split('@')[0];
          setUser({ email, name });
          setIsAuthenticated(true);
          setSessionHint(true);
          return;
        }
      }
      setUser(null);
      setIsAuthenticated(false);
      setSessionHint(false);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      setSessionHint(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoginPathname() && !hasSessionHint()) {
      setIsLoading(false);
      return;
    }
    void checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (username: string, password?: string) => {
    const url = `${API_BASE_URL || ''}/api/v1/auth/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      let message = 'Invalid username or password';
      try {
        const errorData = await res.json();
        message = errorData.detail || errorData.message || message;
      } catch {
        // use default message
      }
      throw new Error(message);
    }

    const data = await res.json();
    if (data?.duo_auth_url) {
      window.location.href = data.duo_auth_url;
    } else if (data?.user || data?.email) {
      const email = data.email || data.user?.email || username;
      const name = data.name || data.user?.name;
      setUser({ email, name });
      setIsAuthenticated(true);
      setSessionHint(true);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const url = `${API_BASE_URL || ''}/api/v1/auth/logout`;
      await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setSessionHint(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
