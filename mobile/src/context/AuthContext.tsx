import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Snackbar } from 'react-native-paper';
import backend from '../api/backend';
import { getToken, setToken } from '../api/client';

export interface QikUser {
  id: number;
  email?: string;
  username: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  avatarFrame?: string | null;
  bio?: string;
  role?: string;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

interface AuthContextValue {
  user: QikUser | null;
  token: string | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  toasts: Toast[];
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error') => void;
  removeToast: (id: number) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let toastId = 0;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<QikUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, type, message }]);
  }, []);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    const t = await getToken();
    if (!t) {
      setLoading(false);
      return;
    }
    setTokenState(t);
    try {
      const me = await backend.me();
      setUser(me);
    } catch (e: any) {
      if (e?.status === 401) {
        await setToken(null);
        setTokenState(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await backend.login({ email, password });
    await setToken(res.token, res.user?.id);
    setTokenState(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const res = await backend.register({ email, username, password });
      await setToken(res.token, res.user?.id);
      setTokenState(res.token);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    loading,
    isAuthModalOpen,
    toasts,
    openAuthModal: () => setAuthModalOpen(true),
    closeAuthModal: () => setAuthModalOpen(false),
    login,
    register,
    logout,
    refreshUser,
    addToast,
    removeToast,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <Snackbar
        visible={toasts.length > 0}
        onDismiss={() => toasts[0] && removeToast(toasts[0].id)}
        duration={4000}
        style={
          toasts[0]?.type === 'error'
            ? { backgroundColor: '#B3261E' }
            : { backgroundColor: '#311B92' }
        }
      >
        {toasts[0]?.message || ''}
      </Snackbar>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
