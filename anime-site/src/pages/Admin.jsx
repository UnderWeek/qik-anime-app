import { useState, useEffect } from 'react'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import SEO from '../components/SEO.jsx'

export default function Admin() {
  const { user, ready } = useAuth()
  const [tab, setTab] = useState('stats')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState(null)
  const [userPage, setUserPage] = useState(1)
  const [userQuery, setUserQuery] = useState('')
  const [claimCode, setClaimCode] = useState('')
  const [claimError, setClaimError] = useState('')
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (!user?.isAdmin) return
    if (tab === 'stats') {
      backend.adminStats().then(setStats).catch(() => setStats(null))
    }
  }, [tab, user])

  useEffect(() => {
    if (!user?.isAdmin || tab !== 'users') return
    backend.adminUsers({ q: userQuery, page: userPage, limit: 100 })
      .then(setUsers)
      .catch(() => setUsers(null))
  }, [tab, user, userPage, userQuery])

  async function deleteUser(id) {
    if (!confirm('Удалить пользователя #' + id + '?')) return
    try {
      await backend.adminDeleteUser(id)
      setUsers((prev) => prev && { ...prev, items: prev.items.filter((u) => u.id !== id), total: prev.total - 1 })
    } catch (e) {
      alert(e.message || 'Ошибка')
    }
  }

  async function handleClaim(e) {
    e.preventDefault()
    if (!claimCode.trim()) return
    setClaiming(true)
    setClaimError('')
    try {
      const res = await backend.adminClaim(claimCode.trim())
      if (res.ok) {
        window.location.reload()
      } else {
        setClaimError(res.error || 'Неверный код')
      }
    } catch {
      setClaimError('Ошибка соединения')
    }
    setClaiming(false)
  }

  if (!user) {
    return (
      <div className="container page">
        <SEO title="Админка" />
        <div className="state">
          <h2>Войдите в аккаунт</h2>
          <p style={{ color: 'var(--text-faint)' }}>Чтобы получить доступ к админке.</p>
        </div>
      </div>
    )
  }

  if (!user.isAdmin) {
    return (
      <div className="container page">
        <SEO title="Админка" />
        <h1 style={{ marginBottom: 24 }}>Админка</h1>
        <form onSubmit={handleClaim} style={{ maxWidth: 360 }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 14, fontSize: 14, lineHeight: 1.5 }}>
            Введите код доступа чтобы стать администратором.
          </p>
          <input
            className="select"
            style={{ width: '100%', marginBottom: 10 }}
            placeholder="Код..."
            value={claimCode}
            onChange={(e) => setClaimCode(e.target.value)}
          />
          {claimError && <p style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 10 }}>{claimError}</p>}
          <button className="btn btn-primary" type="submit" disabled={claiming}>
            {claiming ? '...' : 'Войти как админ'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="container page">
      <SEO title="Админка" description="Панель администратора QIK Anime." />

      <h1 style={{ marginBottom: 24 }}>Админка</h1>

      <div className="subtabs" style={{ marginBottom: 24 }}>
        <button className={`subtab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
          Статистика
        </button>
        <button className={`subtab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          Пользователи
        </button>
      </div>

      {tab === 'stats' && <StatsView stats={stats} />}
      {tab === 'users' && (
        <UsersView
          users={users}
          query={userQuery}
          onQuery={setUserQuery}
          page={userPage}
          onPage={setUserPage}
          onDelete={deleteUser}
        />
      )}
    </div>
  )
}

function StatsView({ stats }) {
  if (!stats) return <div className="comment-empty">Загрузка...</div>

  const cards = [
    { label: 'Пользователей', value: stats.totalUsers },
    { label: 'Админов', value: stats.admins },
    { label: 'Закладок', value: stats.bookmarks },
    { label: 'Оценок', value: stats.ratings },
    { label: 'Комментариев', value: stats.comments },
    { label: 'Просмотрено серий', value: stats.watchedEpisodes },
    { label: 'Часов просмотра', value: stats.watchedHours },
    { label: 'Чатов', value: stats.chats },
    { label: 'Комнат', value: stats.rooms },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
      {cards.map((c) => (
        <div key={c.label} className="stat-card" style={{ textAlign: 'center' }}>
          <div className="v" style={{ fontSize: 28 }}>{c.value}</div>
          <div className="l">{c.label}</div>
        </div>
      ))}
    </div>
  )
}

function UsersView({ users, query, onQuery, page, onPage, onDelete }) {
  if (!users) return <div className="comment-empty">Загрузка...</div>

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          className="select"
          style={{ maxWidth: 280 }}
          placeholder="Поиск по нику..."
          value={query}
          onChange={(e) => { onQuery(e.target.value); onPage(1) }}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Ник</th>
              <th style={th}>Email</th>
              <th style={th}>Админ</th>
              <th style={th}>Серий</th>
              <th style={th}>Часов</th>
              <th style={th}>Дата</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {users.items.map((u) => (
              <tr key={u.id}>
                <td style={td}>{u.id}</td>
                <td style={td}><b>{u.username}</b></td>
                <td style={{ ...td, color: 'var(--text-dim)' }}>{u.email}</td>
                <td style={td}>{u.isAdmin ? '✅' : ''}</td>
                <td style={td}>{u.watchedEpisodes}</td>
                <td style={td}>{u.watchedHours}</td>
                <td style={{ ...td, color: 'var(--text-dim)', fontSize: 13 }}>{new Date(u.createdAt).toLocaleDateString('ru-RU')}</td>
                <td style={td}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onDelete(u.id)}
                    style={{ color: '#ff6b6b', fontSize: 12 }}
                    title="Удалить пользователя"
                  >Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.pages > 1 && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>←</button>
          <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{page} / {users.pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= users.pages} onClick={() => onPage(page + 1)}>→</button>
        </div>
      )}
    </>
  )
}

const th = { textAlign: 'left', padding: '9px 12px', borderBottom: '2px solid var(--border)', color: 'var(--text-dim)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }
const td = { padding: '10px 12px', borderBottom: '1px solid var(--border)' }
