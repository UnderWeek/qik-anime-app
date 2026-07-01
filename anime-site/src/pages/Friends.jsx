import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import { SearchIcon, UserPlusIcon, CheckIcon, TrashIcon, CloseIcon, UserIcon } from '../components/icons.jsx'
import SEO from '../components/SEO.jsx'

export default function Friends() {
  const { user, ready, openAuth, showToast } = useAuth()
  const navigate = useNavigate()
  const [friends, setFriends] = useState([])
  const [pending, setPending] = useState({ incoming: [], outgoing: [] })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('friends')

  async function startChat(friendId) {
    try {
      await backend.startChat(friendId)
      navigate('/chats')
    } catch (err) {
      showToast(err.message || 'Не удалось открыть чат')
    }
  }

  // search
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const load = useCallback(() => {
    if (!user) return
    setLoading(true)
    Promise.all([backend.listFriends(), backend.pendingFriends()])
      .then(([f, p]) => {
        setFriends(Array.isArray(f) ? f.filter(Boolean) : [])
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
    if (!window.confirm('Удалить из друзей?')) return
    try {
      await backend.removeFriend(id)
      showToast('Удалено')
      load()
    } catch (e) {
      showToast(e.message || 'Ошибка')
    }
  }

  async function cancelRequest(id) {
    if (!window.confirm('Отозвать заявку?')) return
    try {
      await backend.removeFriend(id)
      showToast('Заявка отозвана')
      load()
    } catch (e) {
      showToast(e.message || 'Ошибка')
    }
  }

  async function rejectRequest(id) {
    if (!window.confirm('Отклонить заявку?')) return
    try {
      await backend.removeFriend(id)
      showToast('Заявка отклонена')
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

  const friendIds = new Set(friends.map((f) => f?.id).filter(Boolean))
  const outgoingIds = new Set((pending.outgoing || []).map((p) => p?.user?.id).filter(Boolean))
  const incomingCount = (pending.incoming || []).length

  return (
    <div className="container page">
      <SEO
        title="Друзья"
        description="Список друзей на QIK Anime."
        canonical="https://quickik.ru/friends"
      />

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
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => startChat(f.id)} title="Написать">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </button>
                  <Link to={`/u/${f.id}`} className="btn btn-ghost btn-sm btn-icon" title="Профиль">
                    <UserIcon width={20} height={20} />
                  </Link>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeFriend(f.id)} title="Удалить">
                    <TrashIcon width={18} height={18} />
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
                    <button className="btn btn-danger btn-sm" onClick={() => rejectRequest(p.user.id)}>
                      <CloseIcon width={15} height={15} /> Отклонить
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
                    <button className="btn btn-danger btn-sm" onClick={() => cancelRequest(p.user.id)}>
                      <CloseIcon width={15} height={15} /> Отозвать
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
                        <button className="btn btn-ghost btn-sm" onClick={() => cancelRequest(r.id)}>
                          <CheckIcon width={15} height={15} /> Заявка отправлена
                        </button>
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
