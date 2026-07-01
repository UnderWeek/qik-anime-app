import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const ThemeContext = createContext(null)
const KEY = 'qik_theme'
const ACCENT_KEY = 'qik_accent'

export const ACCENT_PRESETS = [
  { id: 'violet', name: 'Фиолетовый', accent: '#9b5ef0', accent2: '#c4a0f0', ink: '#221a38' },
  { id: 'blue', name: 'Синий', accent: '#6cb4f0', accent2: '#6cd0f0', ink: '#1a2a38' },
  { id: 'green', name: 'Зелёный', accent: '#6cdb8a', accent2: '#a6e3c0', ink: '#1a2a20' },
  { id: 'red', name: 'Красный', accent: '#f06c7c', accent2: '#f0a6a6', ink: '#2a1a1c' },
  { id: 'pink', name: 'Розовый', accent: '#f0a6d0', accent2: '#f0c6e0', ink: '#2a1a28' },
  { id: 'orange', name: 'Оранжевый', accent: '#f0b86c', accent2: '#f0d06c', ink: '#2a2016' },
  { id: 'teal', name: 'Бирюзовый', accent: '#6cd0c0', accent2: '#6cf0d0', ink: '#162a28' },
]

function applyAccent(preset) {
  const root = document.documentElement
  const p = preset || ACCENT_PRESETS[0]
  root.style.setProperty('--accent', p.accent)
  root.style.setProperty('--accent-2', p.accent2)
  root.style.setProperty('--accent-ink', p.ink)
  root.style.setProperty('--accent-soft', `${p.accent}22`)
  root.style.setProperty('--accent-grad', `linear-gradient(120deg, ${p.accent}, ${p.accent2})`)
  localStorage.setItem(ACCENT_KEY, p.id)
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return localStorage.getItem(KEY) || 'dark'
  })
  const [accent, setAccentState] = useState(() => {
    if (typeof window === 'undefined') return ACCENT_PRESETS[0]
    const id = localStorage.getItem(ACCENT_KEY)
    return ACCENT_PRESETS.find((p) => p.id === id) || ACCENT_PRESETS[0]
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  useEffect(() => {
    applyAccent(accent)
  }, [accent])

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const setAccent = useCallback((preset) => {
    setAccentState(preset)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
