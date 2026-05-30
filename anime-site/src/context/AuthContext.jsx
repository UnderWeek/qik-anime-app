import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { backend, getToken, setToken } from '../api/backend.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [authModal, setAuthModal] = useState(null) // 'login' | 'register' | null
  const [toast, setToast] = useState(null)

  // Restore session on mount
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setReady(true)
      return
    }
    backend
      .me()
      .then((u) => setUser(u))
      .catch(() => setToken(null))
      .finally(() => setReady(true))
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const login = useCallback(async (login, password) => {
    const res = await backend.login({ login, password })
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const register = useCallback(async (payload) => {
    const res = await backend.register(payload)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    showToast('Вы вышли из аккаунта')
  }, [showToast])

  const requireAuth = useCallback(() => {
    if (!user) {
      setAuthModal('login')
      return false
    }
    return true
  }, [user])

  const value = {
    user,
    setUser,
    ready,
    login,
    register,
    logout,
    authModal,
    openAuth: setAuthModal,
    closeAuth: () => setAuthModal(null),
    requireAuth,
    showToast,
    toast,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
