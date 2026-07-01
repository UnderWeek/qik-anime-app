import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme, ACCENT_PRESETS } from '../context/ThemeContext.jsx'
import { backend } from '../api/backend.js'
import { GridIcon, CalendarIcon, UsersIcon, BookmarkIcon, SunIcon, MoonIcon, MessageIcon, RoomIcon, StarIcon, SettingsIcon, UserIcon, PaletteIcon, UploadIcon } from '../components/icons.jsx'
import SEO from '../components/SEO.jsx'

const MOBILE_KEY = 'qik_mobile_tabs'
const MAX_TABS = 5

const ALL_MOBILE_TABS = [
  { key: 'catalog', label: 'Каталог', icon: GridIcon },
  { key: 'schedule', label: 'Расписание', icon: CalendarIcon },
  { key: 'rooms', label: 'Комнаты', icon: RoomIcon, master: true },
  { key: 'library', label: 'Закладки', icon: BookmarkIcon },
  { key: 'friends', label: 'Друзья', icon: UsersIcon },
  { key: 'ratings', label: 'Рейтинги', icon: StarIcon },
  { key: 'quiz', label: 'Квиз', icon: StarIcon },
  { key: 'settings', label: 'Настройки', icon: SettingsIcon },
  { key: 'profile', label: 'Профиль', icon: UserIcon },
]

const DEFAULT_TABS = ['catalog', 'library', 'friends', 'profile']

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
  const [tabsSaved, setTabsSaved] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importProgress, setImportProgress] = useState(0)
  const [dragId, setDragId] = useState(null)
  const fileRef = useRef(null)

  const availableTabs = ALL_MOBILE_TABS.filter(
    (t) => !t.master || user?.isMaster || user?.isAdmin
  )
  const cleanedTabs = tabs.filter((k) => availableTabs.some((t) => t.key === k))
  const unselected = availableTabs.filter((t) => !cleanedTabs.includes(t.key))
  const displayList = [
    ...cleanedTabs.map((k) => availableTabs.find((t) => t.key === k)).filter(Boolean),
    ...unselected,
  ]

  function toggleTab(key) {
    setTabs((prev) => {
      const active = prev.includes(key)
      if (active) return prev.filter((k) => k !== key)
      const effective = prev.filter((k) => availableTabs.some((t) => t.key === k))
      if (effective.length >= MAX_TABS) return prev
      return [...prev, key]
    })
    setTabsSaved(false)
  }

  function handleDragStart(key) {
    setDragId(key)
  }

  function handleDragOver(e, key) {
    e.preventDefault()
    if (!dragId || dragId === key) return
    setTabs((prev) => {
      if (!prev.includes(dragId)) return prev
      const arr = [...prev]
      const from = arr.indexOf(dragId)
      const to = prev.includes(key) ? arr.indexOf(key) : arr.length
      arr.splice(from, 1)
      arr.splice(to, 0, dragId)
      return arr
    })
    setTabsSaved(false)
  }

  function handleDragEnd() {
    setDragId(null)
  }

  function applyTabs() {
    saveMobileTabs(cleanedTabs)
    window.location.reload()
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
      setImportProgress(0)
      const BATCH = 60
      let imported = 0
      let failed = 0
      const totalBatches = Math.ceil(entries.length / BATCH)
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
        setImportProgress(Math.min(Math.round(((i + batch.length) / entries.length) * 100), 100))
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Theme toggle */}
        <section className="settings-card settings-theme-card" data-theme={theme}>
          <div className="theme-decor">
            <span className="theme-decor-moon" />
            <span className="theme-decor-star theme-decor-star--1" />
            <span className="theme-decor-star theme-decor-star--2" />
            <span className="theme-decor-star theme-decor-star--3" />
            <span className="theme-decor-star theme-decor-star--4" />
            <span className="theme-decor-sun" />
            <span className="theme-decor-cloud theme-decor-cloud--1" />
            <span className="theme-decor-cloud theme-decor-cloud--2" />
          </div>
          <h2 className="settings-card-title"><SunIcon width={20} height={20} style={{ marginRight: 10, verticalAlign: -4 }} />Тема</h2>
          <p className="settings-card-desc">Выберите светлое или тёмное оформление сайта</p>
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
              position: 'relative',
              zIndex: 1,
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
        <section
          className="settings-card settings-accent-card"
          style={{ '--accent-a': accent.accent, '--accent-b': accent.accent2 }}
        >
          <div className="accent-decor">
            <span className="accent-bubble accent-bubble--1" />
            <span className="accent-bubble accent-bubble--2" />
            <span className="accent-bubble accent-bubble--3" />
            <span className="accent-bubble accent-bubble--4" />
          </div>
          <h2 className="settings-card-title"><PaletteIcon width={20} height={20} style={{ marginRight: 10, verticalAlign: -4 }} />Акцентный цвет</h2>
          <p className="settings-card-desc">Выберите основной цвет интерфейса</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
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

        {/* Mobile nav tabs */}
        <section className="settings-card settings-mobile-nav">
          <h2 className="settings-card-title"><GridIcon width={20} height={20} style={{ marginRight: 10, verticalAlign: -4 }} />Нижняя панель навигации</h2>
          <p className="settings-card-desc">
            Выберите до {MAX_TABS} вкладок для нижней панели на телефоне
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
            {displayList.map((t) => {
              const Icon = t.icon
              const active = cleanedTabs.includes(t.key)
              const locked = !active && cleanedTabs.length >= MAX_TABS
              const isDragging = dragId === t.key
              return (
                <div
                  key={t.key}
                  draggable={active}
                  onDragStart={() => handleDragStart(t.key)}
                  onDragOver={(e) => handleDragOver(e, t.key)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => e.preventDefault()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: active ? 'var(--surface-2)' : 'var(--surface)',
                    opacity: locked ? 0.3 : isDragging ? 0.4 : active ? 1 : 0.5,
                    cursor: active ? 'grab' : 'default',
                    transition: 'opacity 0.15s, transform 0.15s',
                    transform: isDragging ? 'scale(0.96)' : 'none',
                  }}
                >
                  {active && (
                    <span style={{ color: 'var(--text-faint)', cursor: 'grab', fontSize: 16, lineHeight: 1, userSelect: 'none', flexShrink: 0 }} title="Перетащите чтобы изменить порядок">
                      ⠿
                    </span>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: locked ? 'not-allowed' : 'pointer', fontSize: 14 }}>
                    <input type="checkbox" checked={active} onChange={() => toggleTab(t.key)} disabled={locked} />
                    <Icon width={18} height={18} />
                    <span>{t.label}</span>
                  </label>
                  {locked && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>лимит</span>}
                  {active && !locked && (
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {cleanedTabs.indexOf(t.key) + 1}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button
              className="btn btn-primary"
              onClick={applyTabs}
              disabled={tabsSaved}
              style={{ padding: '8px 20px', fontSize: 14 }}
            >
              Применить
            </button>
            {tabsSaved && <span style={{ fontSize: 13, color: 'var(--accent-2)' }}>✓ Сохранено</span>}
            {!tabsSaved && <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>Есть несохранённые изменения</span>}
          </div>
          <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 10 }}>
            Выбрано: {cleanedTabs.length}/{MAX_TABS}
          </p>
        </section>

        {/* Import */}
        <section className="settings-card settings-import-card">
          <h2 className="settings-card-title"><UploadIcon width={20} height={20} style={{ marginRight: 10, verticalAlign: -4 }} />Импорт закладок</h2>
          <p className="settings-card-desc">
            Загрузите .csv файл из Anixart, чтобы перенести закладки
          </p>
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleFile} />
          <button
            className="btn btn-primary import-btn"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <UploadIcon width={16} height={16} />
            {importing ? 'Идёт импорт...' : 'Выбрать CSV из Anixart'}
          </button>

          {importing && (
            <div className="import-progress">
              <svg className="import-wave" viewBox="0 0 340 32" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={accent.accent} />
                    <stop offset="100%" stopColor={accent.accent2} />
                  </linearGradient>
                </defs>
                <path
                  className="import-wave-track"
                  d="M0,16 Q10,4 20,16 T40,16 T60,16 T80,16 T100,16 T120,16 T140,16 T160,16 T180,16 T200,16 T220,16 T240,16 T260,16 T280,16 T300,16 T320,16 T340,16"
                  fill="none"
                  pathLength="340"
                />
                <path
                  className="import-wave-fill"
                  d="M0,16 Q10,4 20,16 T40,16 T60,16 T80,16 T100,16 T120,16 T140,16 T160,16 T180,16 T200,16 T220,16 T240,16 T260,16 T280,16 T300,16 T320,16 T340,16"
                  fill="none"
                  pathLength="340"
                  stroke="url(#waveGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: '340',
                    strokeDashoffset: 340 - (importProgress / 100) * 340,
                    transition: 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              </svg>
              <span className="import-progress-text">
                <span className="import-spinner" />
                Обработано {importProgress}%
              </span>
            </div>
          )}

          {importResult && !importing && (
            <div className={`import-result${importResult.error ? ' import-result--error' : ''}`}>
              {importResult.error ? (
                <span>{importResult.error}</span>
              ) : (
                <>
                  <span className="import-result-check">✓</span>
                  <span>Импортировано: <b>{importResult.imported}</b> из {importResult.total}.
                  {importResult.failed > 0 && <> Не найдено: <b>{importResult.failed}</b>.</>}</span>
                </>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
