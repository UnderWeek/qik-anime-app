import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { backend, getToken, setToken } from '../api/backend.js'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)))
}

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
    // Unsubscribe from push before clearing user
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) {
            backend.pushUnsubscribe(sub.endpoint).catch(() => {})
            sub.unsubscribe().catch(() => {})
          }
        })
      })
    }
    setToken(null)
    setUser(null)
    showToast('Вы вышли из аккаунта')
  }, [showToast])

  // Sync push subscription when user is logged in
  useEffect(() => {
    if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    const timer = setTimeout(() => {
      navigator.serviceWorker.ready.then(async (reg) => {
        let sub = await reg.pushManager.getSubscription()
        if (sub) return // already subscribed
        try {
          const { publicKey } = await backend.pushKey()
          if (!publicKey) return
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          })
          await backend.pushSubscribe(sub.toJSON())
        } catch { /* silent */ }
      })
    }, 2000) // wait for SW to be fully ready
    return () => clearTimeout(timer)
  }, [user])

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
