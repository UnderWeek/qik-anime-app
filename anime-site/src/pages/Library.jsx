import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { backend } from '../api/backend.js'
import { fixUrl } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import { statusLabel } from '../components/BookmarkButton.jsx'
import { TrashIcon } from '../components/icons.jsx'
import SEO from '../components/SEO.jsx'

const TABS = [
  { value: '', label: 'Все' },
  { value: 'watching', label: 'Смотрю' },
  { value: 'planned', label: 'В планах' },
  { value: 'completed', label: 'Просмотрено' },
  { value: 'on_hold', label: 'Отложено' },
  { value: 'dropped', label: 'Брошено' },
  { value: 'rewatching', label: 'Пересматриваю' },
  { value: 'favorite', label: 'Любимое' },
]

const SORTS = [
  { value: 'updated', label: 'Недавние' },
  { value: 'created', label: 'По дате добавления' },
  { value: 'title', label: 'По названию' },
  { value: 'status', label: 'По статусу' },
]

export default function Library() {
  const { user, ready, openAuth, showToast } = useAuth()
  const PAGE_SIZE = 24

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('')
  const [sort, setSort] = useState('updated')
  const [sortDir, setSortDir] = useState(-1)
  const [visible, setVisible] = useState(PAGE_SIZE)

  const load = useCallback(() => {
    if (!user) return
    setLoading(true)
    backend
      .listBookmarks()
      .then((res) => setItems(Array.isArray(res) ? res : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  // Reset visible when tab/sort changes
  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [tab, sort, sortDir])

  async function remove(animeId) {
    try {
      await backend.removeBookmark(animeId)
      setItems((prev) => prev.filter((b) => b.animeId !== animeId))
      showToast('Удалено из закладок')
    } catch (e) {
      showToast(e.message || 'Ошибка')
    }
  }

  if (ready && !user) {
    return (
      <div className="container page">
        <div className="state">
          <h2>Закладки доступны после входа</h2>
          <p style={{ marginBottom: 20 }}>Войдите в аккаунт, чтобы видеть свою коллекцию.</p>
          <button className="btn btn-primary" onClick={() => openAuth('login')}>
            Войти
          </button>
        </div>
      </div>
    )
  }

  const filtered = useMemo(() => {
    let list = tab ? items.filter((b) => b.status === tab) : items
    const STATUS_ORDER = { watching: 1, rewatching: 2, planned: 3, on_hold: 4, completed: 5, dropped: 6, favorite: 7 }
    switch (sort) {
      case 'created':
        list = [...list].sort((a, b) => sortDir * (new Date(b.createdAt || 0) - new Date(a.createdAt || 0)))
        break
      case 'title':
        list = [...list].sort((a, b) => sortDir * (a.animeTitle || '').localeCompare(b.animeTitle || '', 'ru'))
        break
      case 'status':
        list = [...list].sort((a, b) => sortDir * ((STATUS_ORDER[a.status] || 99) - (STATUS_ORDER[b.status] || 99)))
        break
      case 'updated':
      default:
        list = [...list].sort((a, b) => sortDir * (new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)))
        break
    }
    return list
  }, [items, tab, sort, sortDir])

  const counts = items.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="container page">
      <SEO
        title="Мои закладки"
        description="Моя коллекция аниме: смотрю, в планах, просмотрено, отложено, брошено, любимое."
        canonical="https://quickik.ru/library"
      />

      {user && (
        <div className="profile-head">
          <Avatar user={user} size={64} />
          <div>
            <h1>{user.username}</h1>
            <div className="meta">
              {items.length} в закладках · на QIK с{' '}
              {new Date(user.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      )}

      <div className="library-toolbar">
        <div className="day-tabs" style={{ flexWrap: 'wrap', gap: 8 }}>
          {TABS.map((t) => (
            <button
              key={t.value}
              className={`chip ${tab === t.value ? 'active' : ''}`}
              onClick={() => setTab(t.value)}
            >
              {t.label}
              {t.value && counts[t.value] ? (
                <span style={{ opacity: 0.6, marginLeft: 6 }}>{counts[t.value]}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select className="chip" value={sort} onChange={(e) => setSort(e.target.value)} style={{ cursor: 'pointer' }}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            className="chip"
            onClick={() => setSortDir((d) => -d)}
            title={sortDir === 1 ? 'По возрастанию' : 'По убыванию'}
            style={{ transition: 'transform 0.3s ease', transform: sortDir === 1 ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ↓
          </button>
        </div>
      </div>

      {loading ? (
        <div className="comment-empty">Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div className="state">
          <h2>Здесь пока пусто</h2>
          <p style={{ marginBottom: 18 }}>Добавляйте аниме в закладки кнопкой на странице тайтла.</p>
          <Link to="/catalog" className="btn btn-ghost">В каталог</Link>
        </div>
      ) : (
        <>
          <div className="grid" key={`${tab}-${sort}-${sortDir}`} style={{ animation: 'cardFlipIn 0.35s ease' }}>
            {filtered.slice(0, visible).map((b) => (
            <div key={b.animeId} style={{ position: 'relative' }}>
              <Link to={`/anime/${b.animeUrl || b.animeId}`} className="card">
                <div className="card-poster">
                  {b.animePoster ? (
                    <img src={fixUrl(b.animePoster)} alt={b.animeTitle} loading="lazy" />
                  ) : (
                    <div className="skel" style={{ width: '100%', height: '100%' }} />
                  )}
                  <div className="card-badge">{statusLabel(b.status)}</div>
                </div>
                <div className="card-title">{b.animeTitle || `Аниме #${b.animeId}`}</div>
              </Link>
              <button
                onClick={() => remove(b.animeId)}
                title="Удалить из закладок"
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: 'rgba(12,12,17,0.78)',
                  backdropFilter: 'blur(6px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ff9b9b',
                  zIndex: 3,
                }}
              >
                <TrashIcon width={15} height={15} />
              </button>
            </div>
          ))}
        </div>
        {visible < filtered.length && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              className="btn btn-ghost"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
            >
              Загрузить ещё ({filtered.length - visible} из {filtered.length})
            </button>
          </div>
        )}
      </>)}
    </div>
  )
}
