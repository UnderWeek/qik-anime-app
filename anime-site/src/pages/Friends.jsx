import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import { SearchIcon, UserPlusIcon, CheckIcon, TrashIcon, CloseIcon } from '../components/icons.jsx'

export default function Friends() {
  const { user, ready, openAuth, showToast } = useAuth()
  const [friends, setFriends] = useState([])
  const [pending, setPending] = useState({ incoming: [], outgoing: [] })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('friends')

  // search
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const load = useCallback(() => {
    if (!user) return
    setLoading(true)
    Promise.all([backend.listFriends(), backend.pendingFriends()])
      .then(([f, p]) => {
        setFriends(Array.isArray(f) ? f : [])
        setPending(p || { incoming: [], outgoing: [] })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  // debounced search
  useEffect(() => {
    if (tab !== 'search') return
    const term = q.trim()
    if (!term) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(() => {
      backend
        .searchUsers(term)
        .then((r) => setResults(Array.isArray(r) ? r : []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(t)
  }, [q, tab])

  async function sendRequest(id) {
    try {
      await backend.requestFriend(id)
      showToast('Заявка отправлена')
      load()
    } catch (e) {
      showToast(e.message || 'Ошибка')
    }
  }

  async function accept(requestId) {
    try {
      await backend.acceptFriend(requestId)
      showToast('Заявка принята')
      load()
    } catch (e) {
      showToast(e.message || 'Ошибка')
    }
  }

  async function removeFriend(id) {
    try {
      await backend.removeFriend(id)
      showToast('Удалено')
      load()
    } catch (e) {
      showToast(e.message || 'Ошибка')
    }
  }

  if (ready && !user) {
    return (
      <div className="container page">
        <div className="state">
          <h2>Друзья доступны после входа</h2>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => openAuth('login')}>
            Войти
          </button>
        </div>
      </div>
    )
  }

  const friendIds = new Set(friends.map((f) => f.id))
  const outgoingIds = new Set(pending.outgoing.map((p) => p.user.id))
  const incomingCount = pending.incoming.length

  return (
    <div className="container page">
      <div className="section-head" style={{ marginBottom: 22 }}>
        <h2 className="section-title">Друзья</h2>
      </div>

      <div className="subtabs">
        <button className={`subtab ${tab === 'friends' ? 'active' : ''}`} onClick={() => setTab('friends')}>
          Мои друзья ({friends.length})
        </button>
        <button className={`subtab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          Заявки {incomingCount > 0 ? `(${incomingCount})` : ''}
        </button>
        <button className={`subtab ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>
          Найти друзей
        </button>
      </div>

      {/* FRIENDS */}
      {tab === 'friends' &&
        (loading ? (
          <div className="comment-empty">Загрузка…</div>
        ) : friends.length === 0 ? (
          <div className="state">
            <h2>Пока нет друзей</h2>
            <p style={{ marginBottom: 16 }}>Найдите людей во вкладке «Найти друзей».</p>
            <button className="btn btn-ghost" onClick={() => setTab('search')}>Найти друзей</button>
          </div>
        ) : (
          <div className="friend-list">
            {friends.map((f) => (
              <div key={f.id} className="friend-row">
                <Link to={`/u/${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: 13, flex: 1, minWidth: 0 }}>
                  <Avatar user={f} size={42} />
                  <span className="fr-name">{f.username}</span>
                </Link>
                <div className="fr-actions">
                  <Link to={`/u/${f.id}`} className="btn btn-ghost btn-sm">Профиль</Link>
                  <button className="btn btn-danger btn-sm" onClick={() => removeFriend(f.id)} title="Удалить">
                    <TrashIcon width={15} height={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

      {/* REQUESTS */}
      {tab === 'requests' && (
        <div>
          <h3 style={{ fontSize: 16, marginBottom: 14, color: 'var(--text-dim)' }}>Входящие</h3>
          {pending.incoming.length === 0 ? (
            <div className="comment-empty">Нет входящих заявок.</div>
          ) : (
            <div className="friend-list" style={{ marginBottom: 30 }}>
              {pending.incoming.map((p) => (
                <div key={p.requestId} className="friend-row">
                  <Link to={`/u/${p.user.id}`} style={{ display: 'flex', alignItems: 'center', gap: 13, flex: 1, minWidth: 0 }}>
                    <Avatar user={p.user} size={42} />
                    <span className="fr-name">{p.user.username}</span>
                  </Link>
                  <div className="fr-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => accept(p.requestId)}>
                      <CheckIcon width={15} height={15} /> Принять
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => removeFriend(p.user.id)}>
                      <CloseIcon width={15} height={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: 16, marginBottom: 14, color: 'var(--text-dim)' }}>Исходящие</h3>
          {pending.outgoing.length === 0 ? (
            <div className="comment-empty">Нет исходящих заявок.</div>
          ) : (
            <div className="friend-list">
              {pending.outgoing.map((p) => (
                <div key={p.requestId} className="friend-row">
                  <Link to={`/u/${p.user.id}`} style={{ display: 'flex', alignItems: 'center', gap: 13, flex: 1, minWidth: 0 }}>
                    <Avatar user={p.user} size={42} />
                    <span className="fr-name">{p.user.username}</span>
                  </Link>
                  <div className="fr-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => removeFriend(p.user.id)}>
                      Отменить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEARCH */}
      {tab === 'search' && (
        <div>
          <div className="header-search" style={{ maxWidth: 420, marginBottom: 22 }}>
            <SearchIcon />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Имя пользователя…"
              autoFocus
            />
          </div>

          {searching ? (
            <div className="comment-empty">Поиск…</div>
          ) : q.trim() && results.length === 0 ? (
            <div className="comment-empty">Никого не найдено.</div>
          ) : (
            <div className="friend-list">
              {results.map((r) => {
                const isFriend = friendIds.has(r.id)
                const isOutgoing = outgoingIds.has(r.id)
                return (
                  <div key={r.id} className="friend-row">
                    <Link to={`/u/${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 13, flex: 1, minWidth: 0 }}>
                      <Avatar user={r} size={42} />
                      <span className="fr-name">{r.username}</span>
                    </Link>
                    <div className="fr-actions">
                      {isFriend ? (
                        <span className="btn btn-ghost btn-sm" style={{ cursor: 'default' }}>
                          <CheckIcon width={15} height={15} /> В друзьях
                        </span>
                      ) : isOutgoing ? (
                        <span className="btn btn-ghost btn-sm" style={{ cursor: 'default' }}>Заявка отправлена</span>
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={() => sendRequest(r.id)}>
                          <UserPlusIcon width={15} height={15} /> Добавить
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
