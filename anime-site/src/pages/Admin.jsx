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

  async function toggleMaster(id) {
    try {
      const res = await backend.adminToggleMaster(id)
      setUsers((prev) => prev && {
        ...prev,
        items: prev.items.map((u) => u.id === id ? { ...u, isMaster: res.isMaster } : u),
      })
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
    } catch (err) {
      setClaimError(err.message || 'Ошибка соединения')
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

      <div className="subtabs" style={{ marginBottom: 24, flexWrap: 'wrap' }}>
        <button className={`subtab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
          Статистика
        </button>
        <button className={`subtab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          Пользователи
        </button>
        <button className={`subtab ${tab === 'server' ? 'active' : ''}`} onClick={() => setTab('server')}>
          Сервер
        </button>
        <button className={`subtab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
          Аудит
        </button>
        <button className={`subtab ${tab === 'chart' ? 'active' : ''}`} onClick={() => setTab('chart')}>
          График
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
          onToggleMaster={toggleMaster}
        />
      )}
      {tab === 'server' && <ServerView />}
      {tab === 'audit' && <AuditView />}
      {tab === 'chart' && <ChartView />}
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

function UsersView({ users, query, onQuery, page, onPage, onDelete, onToggleMaster }) {
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
              <th style={th}>Мастер</th>
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
                <td style={td}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onToggleMaster(u.id)}
                    style={{ fontSize: 12, color: u.isMaster ? '#4ade80' : 'var(--text-dim)' }}
                    title={u.isMaster ? 'Убрать мастера' : 'Сделать мастером'}
                  >{u.isMaster ? '✅' : '—'}</button>
                </td>
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

function ServerView() {
  const [data, setData] = useState(null)
  useEffect(() => {
    backend.adminServer().then(setData).catch(() => setData(null))
    const iv = setInterval(() => backend.adminServer().then(setData).catch(() => {}), 10000)
    return () => clearInterval(iv)
  }, [])

  if (!data) return <div className="comment-empty">Загрузка...</div>

  const uptime = data.uptime
  const days = Math.floor(uptime / 86400)
  const hours = Math.floor((uptime % 86400) / 3600)
  const mins = Math.floor((uptime % 3600) / 60)

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* CPU + RAM gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        <GaugeCard
          label="CPU"
          value={data.cpu.percent}
          color={data.cpu.percent > 85 ? '#ff6b6b' : data.cpu.percent > 60 ? '#f0b86c' : '#6cdb8a'}
          detail={`${data.cpu.cores} ядер · ${data.cpu.loadAvg[0].toFixed(1)} / ${data.cpu.loadAvg[1].toFixed(1)} / ${data.cpu.loadAvg[2].toFixed(1)}`}
          sub={data.cpu.model}
        />
        <GaugeCard
          label="RAM"
          value={data.memory.percent}
          color={data.memory.percent > 85 ? '#ff6b6b' : data.memory.percent > 60 ? '#f0b86c' : '#6cdb8a'}
          detail={`${data.memory.used} / ${data.memory.total} MB`}
          sub={`Свободно ${data.memory.free} MB`}
          history={data.memory.history}
        />
        {data.disk && data.disk.total > 0 && (
          <GaugeCard
            label={data.disk.note || 'Диск'}
            value={data.disk.percent || 0}
            color={data.disk.percent > 85 ? '#ff6b6b' : data.disk.percent > 60 ? '#f0b86c' : '#6cdb8a'}
            detail={`${data.disk.used} / ${data.disk.total} MB`}
            sub={data.disk.note ? '' : `Свободно ${data.disk.free} MB`}
          />
        )}
      </div>

      {/* uptime info */}
      <div className="stat-card" style={{ padding: 16, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>
          Аптайм: <b style={{ color: 'var(--text)' }}>{days}д {hours}ч {mins}м</b>
        </span>
        <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>
          Платформа: <b style={{ color: 'var(--text)' }}>{data.platform}</b>
        </span>
        <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>
          Node: <b style={{ color: 'var(--text)' }}>{data.nodeVersion}</b>
        </span>
      </div>
    </div>
  )
}

function GaugeCard({ label, value, color, detail, sub, history }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ

  return (
    <div className="stat-card" style={{ padding: 18, textAlign: 'center' }}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={130} height={130} viewBox="0 0 130 130">
          <circle cx={65} cy={65} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={10} />
          <circle
            cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform="rotate(-90 65 65)"
            style={{ transition: 'stroke-dashoffset 0.7s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 26, fontWeight: 800, color }}>{value}%</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>{label}</span>
        </div>
      </div>
      {history && history.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28, justifyContent: 'center', marginTop: 10 }}>
          {history.map((v, i) => (
            <div key={i} style={{
              width: 6,
              height: `${Math.max(8, Math.round((v / 100) * 28))}px`,
              background: v > 85 ? '#ff6b6b' : v > 60 ? '#f0b86c' : '#6cdb8a',
              borderRadius: 2,
              opacity: 0.7,
            }} />
          ))}
        </div>
      )}
      <div style={{ marginTop: history ? 6 : 12, fontSize: 13, color: 'var(--text-dim)' }}>{detail}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function AuditView() {
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    backend.adminAudit(page).then(setData).catch(() => setData(null))
  }, [page])

  if (!data) return <div className="comment-empty">Загрузка...</div>
  if (data.items.length === 0) return <div className="comment-empty">Лог пуст.</div>

  const labels = {
    delete_user: 'Удаление',
    promote_master: 'Назначение мастера',
    demote_master: 'Снятие мастера',
    claim: 'Получение админки',
  }

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={th}>Время</th>
              <th style={th}>Админ</th>
              <th style={th}>Действие</th>
              <th style={th}>Цель</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((a) => (
              <tr key={a.id}>
                <td style={{ ...td, color: 'var(--text-dim)', fontSize: 13, whiteSpace: 'nowrap' }}>
                  {new Date(a.createdAt).toLocaleString('ru-RU')}
                </td>
                <td style={td}>{a.adminName}</td>
                <td style={td}>{labels[a.action] || a.action}</td>
                <td style={td}>{a.target || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.pages > 1 && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
          <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{page} / {data.pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>→</button>
        </div>
      )}
    </>
  )
}

function ChartView() {
  const [data, setData] = useState(null)

  useEffect(() => {
    backend.adminRegistrations(30).then(setData).catch(() => setData(null))
  }, [])

  if (!data) return <div className="comment-empty">Загрузка...</div>
  if (data.length === 0) return <div className="comment-empty">Нет данных.</div>

  const maxCount = Math.max(...data.map(d => d.count), 1)
  const barWidth = Math.max(8, Math.floor(280 / data.length))

  return (
    <div className="stat-card" style={{ padding: 20 }}>
      <h3 style={{ margin: '0 0 18px', fontSize: 16 }}>Регистрации за 30 дней</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160, overflowX: 'auto' }}>
        {data.map((d) => {
          const h = Math.max(3, Math.round((d.count / maxCount) * 100))
          return (
            <div key={d.day} style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{d.count || ''}</span>
              <div
                style={{
                  width: barWidth,
                  height: `${h}%`,
                  background: 'var(--accent-grad)',
                  borderRadius: '3px 3px 0 0',
                  minHeight: 3,
                  transition: 'height 0.3s ease',
                }}
                title={`${d.day}: ${d.count}`}
              />
              <span style={{ fontSize: 9, color: 'var(--text-dim)', transform: 'rotate(-45deg)', transformOrigin: 'top left', marginTop: 4, whiteSpace: 'nowrap' }}>
                {d.day.slice(5)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const th = { textAlign: 'left', padding: '9px 12px', borderBottom: '2px solid var(--border)', color: 'var(--text-dim)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }
const td = { padding: '10px 12px', borderBottom: '1px solid var(--border)' }
