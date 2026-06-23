import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme, ACCENT_PRESETS } from '../context/ThemeContext.jsx'
import { backend } from '../api/backend.js'
import { GridIcon, CalendarIcon, UsersIcon, BookmarkIcon, SunIcon, MoonIcon, MessageIcon, RoomIcon, StarIcon } from '../components/icons.jsx'
import SEO from '../components/SEO.jsx'

const MOBILE_KEY = 'qik_mobile_tabs'
const MAX_TABS = 5

const ALL_MOBILE_TABS = [
  { key: 'catalog', label: 'Каталог', icon: GridIcon },
  { key: 'schedule', label: 'Расписание', icon: CalendarIcon },
  { key: 'rooms', label: 'Комнаты', icon: RoomIcon },
  { key: 'library', label: 'Закладки', icon: BookmarkIcon },
  { key: 'friends', label: 'Друзья', icon: UsersIcon },
  { key: 'ratings', label: 'Рейтинги', icon: StarIcon },
  { key: 'chats', label: 'Чаты', icon: MessageIcon },
]

const DEFAULT_TABS = ['catalog', 'rooms', 'library', 'friends']

function loadMobileTabs() {
  try {
    const raw = localStorage.getItem(MOBILE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length > 0) return arr.filter((k) => ALL_MOBILE_TABS.some((t) => t.key === k))
    }
  } catch { /* ignore */ }
  return [...DEFAULT_TABS]
}

function saveMobileTabs(tabs) {
  localStorage.setItem(MOBILE_KEY, JSON.stringify(tabs))
}

const ANIXART_STATUS_MAP = {
  'Просмотрено': 'completed',
  'Смотрю': 'watching',
  'В планах': 'planned',
  'Отложено': 'on_hold',
  'Брошено': 'dropped',
}

// Column name aliases for flexible header matching
const COLUMN_ALIASES = {
  titleRu: ['русское название', 'название', 'title', 'name', 'рус'],
  titleOrig: ['оригинальное название', 'original title', 'оригинал', 'original', 'английское название', 'english title'],
  status: ['статус просмотра', 'статус', 'status', 'состояние'],
}

function parseCsvLine(line) {
  const fields = []
  let cur = ''
  let quoted = false
  for (let j = 0; j < line.length; j++) {
    const ch = line[j]
    if (ch === '"') { quoted = !quoted }
    else if (ch === ',' && !quoted) { fields.push(cur.trim()); cur = '' }
    else { cur += ch }
  }
  fields.push(cur.trim())
  return fields
}

function detectColumns(headerFields) {
  const map = {}
  for (let i = 0; i < headerFields.length; i++) {
    const name = headerFields[i].toLowerCase().replace(/^"|"$/g, '')
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.some((a) => name === a || name.includes(a))) {
        if (!map[key]) map[key] = i
      }
    }
  }
  return map
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headerFields = parseCsvLine(lines[0])
  const col = detectColumns(headerFields)
  if (!col.titleRu || !col.status) return [] // minimum required columns
  const entries = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const fields = parseCsvLine(line)
    const titleRu = fields[col.titleRu]
    const statusRaw = fields[col.status]
    if (!titleRu || !ANIXART_STATUS_MAP[statusRaw]) continue
    entries.push({
      titleRu,
      titleOrig: col.titleOrig !== undefined ? fields[col.titleOrig] || undefined : undefined,
      status: statusRaw,
    })
  }
  return entries
}

export default function Settings() {
  const { user, ready, openAuth } = useAuth()
  const { accent, setAccent, theme, toggle } = useTheme()
  const [tabs, setTabs] = useState(loadMobileTabs)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef(null)

  function toggleTab(key) {
    setTabs((prev) => {
      const active = prev.includes(key)
      if (active) {
        const next = prev.filter((k) => k !== key)
        saveMobileTabs(next)
        return next
      }
      if (prev.length >= MAX_TABS) return prev
      const next = [...prev, key]
      saveMobileTabs(next)
      return next
    })
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const entries = parseCSV(reader.result)
      if (!entries.length) {
        setImportResult({ error: 'Не удалось распознать закладки в файле. Проверьте формат.' })
        return
      }
      setImporting(true)
      setImportResult(null)
      const BATCH = 60
      let imported = 0
      let failed = 0
      for (let i = 0; i < entries.length; i += BATCH) {
        const batch = entries.slice(i, i + BATCH)
        try {
          const res = await backend.importAnixartBookmarks(batch)
          imported += res.imported || 0
          failed += res.failed || 0
        } catch {
          failed += batch.length
          break
        }
      }
      setImportResult({ imported, failed, total: entries.length })
      setImporting(false)
    }
    reader.readAsText(file, 'UTF-8')
    if (fileRef.current) fileRef.current.value = ''
  }

  if (ready && !user) {
    return (
      <div className="container page">
        <div className="state">
          <h2>Нужна авторизация</h2>
          <p>Войдите в аккаунт, чтобы открыть настройки.</p>
          <button className="btn btn-primary" onClick={() => openAuth('login')}>Войти</button>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <SEO
        title="Настройки"
        description="Настройки аккаунта QIK Anime: тема, акцентный цвет, навигация, импорт закладок."
        canonical="https://quickik.ru/settings"
      />

      <h1 style={{ marginBottom: 28 }}>Настройки</h1>

      {/* Theme toggle */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 14 }}>Тема</h2>
        <button
          className="btn btn-ghost"
          onClick={toggle}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 18px',
            fontSize: 15,
            borderRadius: 12,
            border: '1px solid var(--border)',
          }}
        >
          {theme === 'dark' ? (
            <><SunIcon width={18} height={18} /> Светлая</>
          ) : (
            <><MoonIcon width={18} height={18} /> Тёмная</>
          )}
        </button>
      </section>

      {/* Accent color */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 14 }}>Акцентный цвет</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setAccent(p)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: accent.id === p.id ? '3px solid var(--text)' : '3px solid transparent',
                background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})`,
                cursor: 'pointer',
                outline: 'none',
              }}
              title={p.name}
            />
          ))}
        </div>
      </section>

      {/* Mobile nav tabs — only on touch devices */}
      <section style={{ marginBottom: 32 }} className="settings-mobile-nav">
        <h2 style={{ fontSize: 18, marginBottom: 14 }}>Нижняя панель навигации</h2>
        <p style={{ color: 'var(--text-faint)', fontSize: 13, marginBottom: 12 }}>
          Выберите до {MAX_TABS} вкладок для нижней панели на телефоне
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
          {ALL_MOBILE_TABS.map((t) => {
            const Icon = t.icon
            const active = tabs.includes(t.key)
            const locked = !active && tabs.length >= MAX_TABS
            return (
              <div
                key={t.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: active ? 'var(--surface-2)' : 'var(--surface)',
                  opacity: locked ? 0.3 : active ? 1 : 0.5,
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: locked ? 'not-allowed' : 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={active} onChange={() => toggleTab(t.key)} disabled={locked} />
                  <Icon width={18} height={18} />
                  <span>{t.label}</span>
                </label>
                {locked && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>лимит</span>}
              </div>
            )
          })}
        </div>
        <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 10 }}>
          Выбрано: {tabs.length}/{MAX_TABS} · Профиль закреплён всегда
        </p>
      </section>

      {/* Import */}
      <section>
        <h2 style={{ fontSize: 18, marginBottom: 14 }}>Импорт закладок</h2>
        <p style={{ color: 'var(--text-faint)', fontSize: 13, marginBottom: 12 }}>
          Загрузите .csv файл из Anixart, чтобы перенести закладки
        </p>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleFile} />
        <button
          className="btn btn-primary"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
        >
          {importing ? 'Импорт...' : 'Выбрать CSV из Anixart'}
        </button>
        {importResult && (
          <div style={{ marginTop: 14, fontSize: 14, color: 'var(--text-dim)' }}>
            {importResult.error ? (
              <span style={{ color: 'var(--danger)' }}>{importResult.error}</span>
            ) : (
              <>Импортировано: <b>{importResult.imported}</b> из {importResult.total}.
              {importResult.failed > 0 && <> Не найдено: <b>{importResult.failed}</b>.</>}</>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
