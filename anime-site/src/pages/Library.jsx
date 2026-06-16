import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { backend } from '../api/backend.js'
import { fixUrl } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import { statusLabel } from '../components/BookmarkButton.jsx'
import { TrashIcon } from '../components/icons.jsx'

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

export default function Library() {
  const { user, ready, openAuth, showToast } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('')

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

  const filtered = tab ? items.filter((b) => b.status === tab) : items
  const counts = items.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="container page">
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

      {loading ? (
        <div className="comment-empty">Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div className="state">
          <h2>Здесь пока пусто</h2>
          <p style={{ marginBottom: 18 }}>Добавляйте аниме в закладки кнопкой на странице тайтла.</p>
          <Link to="/catalog" className="btn btn-ghost">В каталог</Link>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((b) => (
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
      )}
    </div>
  )
}
