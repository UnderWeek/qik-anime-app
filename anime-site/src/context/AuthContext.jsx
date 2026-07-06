import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { backend, getToken, setToken, getStoredUid } from '../api/backend.js'

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
    const prevUid = getStoredUid()
    backend
      .me()
      .then((u) => {
        // Guard: if the token returned a different user than before,
        // the token may have been replaced — force re-login.
        if (prevUid != null && u.id !== prevUid) {
          console.warn('[auth] token mismatch: stored uid', prevUid, 'got', u.id)
          setToken(null)
          setReady(true)
          return
        }
        setUser(u)
      })
      .catch(() => setToken(null))
      .finally(() => setReady(true))
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast(null), 2600)
  }, [])

  // One-shot push setup: must be called from a user gesture (click) so the
  // browser shows the permission prompt. Safe to call multiple times — skips
  // if already subscribed or permission denied.
  const setupPush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (sub) return // already subscribed
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return
      const { publicKey } = await backend.pushKey()
      if (!publicKey) return
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      await backend.pushSubscribe(sub.toJSON())
    } catch { /* silent */ }
  }, [])

  const login = useCallback(async (login, password) => {
    const res = await backend.login({ login, password })
    setToken(res.token, res.user.id)
    setUser(res.user)
    setupPush() // user gesture → permission prompt
    return res.user
  }, [setupPush])

  const register = useCallback(async (payload) => {
    const res = await backend.register(payload)
    setToken(res.token, res.user.id)
    setUser(res.user)
    setupPush() // user gesture → permission prompt
    return res.user
  }, [setupPush])

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

  // On session restore: silently re-subscribe if permission was already granted.
  // Will not trigger a permission prompt (permission is already 'granted').
  useEffect(() => {
    if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission !== 'granted') return
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      if (sub) return
      try {
        const { publicKey } = await backend.pushKey()
        if (!publicKey) return
        const newSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
        await backend.pushSubscribe(newSub.toJSON())
      } catch { /* silent */ }
    })
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
