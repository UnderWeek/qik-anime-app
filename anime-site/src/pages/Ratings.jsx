import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { backend, uploadUrl } from '../api/backend.js'
import { api, fixUrl } from '../api/client.js'
import SEO from '../components/SEO.jsx'
import Avatar from '../components/Avatar.jsx'
import { StarIcon } from '../components/icons.jsx'

const TABS = [
  { key: 'anime', label: 'Аниме' },
  { key: 'openings', label: 'Опенинги' },
  { key: 'endings', label: 'Эндинги' },
  { key: 'users', label: 'Пользователи' },
]

async function fetchAnimeInfo(ids) {
  const map = {}
  await Promise.all(
    ids.map(async (id) => {
      try {
        const a = await api.anime(id)
        if (a) map[id] = a
      } catch {}
    })
  )
  return map
}

async function fetchUserInfo(ids) {
  const map = {}
  await Promise.all(
    ids.map(async (id) => {
      try {
        const p = await backend.profile(id)
        if (p?.user) map[id] = p.user
      } catch {}
    })
  )
  return map
}

export default function Ratings() {
  const [tab, setTab] = useState('anime')
  const [items, setItems] = useState(null)

  useEffect(() => {
    setItems(null)
    let cancel = false

    async function load() {
      let rows = []
      if (tab === 'anime') rows = await backend.topAnime()
      else if (tab === 'openings') rows = await backend.topOpenings()
      else if (tab === 'endings') rows = await backend.topEndings()
      else if (tab === 'users') rows = await backend.topUsers()

      if (cancel) return

      if (tab === 'users') {
        const ids = rows.map((r) => r.userId).filter(Boolean)
        const users = await fetchUserInfo(ids)
        if (cancel) return
        setItems(rows.map((r) => ({ ...r, user: users[r.userId] || null })))
      } else {
        const ids = rows.map((r) => r.animeId).filter(Boolean)
        const anime = await fetchAnimeInfo(ids)
        if (cancel) return
        setItems(rows.map((r) => ({ ...r, anime: anime[r.animeId] || null })))
      }
    }

    load()
    return () => { cancel = true }
  }, [tab])

  return (
    <div className="container page">
      <SEO title="Рейтинги" description="Топ аниме, опенингов, эндингов и пользователей по оценкам." canonical="https://quickik.ru/ratings" />

      <div className="subtabs" style={{ marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t.key} className={`subtab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {!items ? (
        <div className="comment-empty">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="comment-empty">Пока недостаточно оценок для рейтинга.</div>
      ) : tab === 'users' ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={th}>№</th>
              <th style={{ ...th, textAlign: 'left' }}>Пользователь</th>
              <th style={{ ...th, textAlign: 'right' }}>Уровень</th>
              <th style={{ ...th, textAlign: 'right' }}>XP</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, idx) => (
              <tr key={r.userId}>
                <td style={{ color: 'var(--text-faint)', fontWeight: 700 }}>#{idx + 1}</td>
                <td>
                  <Link to={`/u/${r.userId}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none' }}>
                    <Avatar user={r.user || {}} size={32} />
                    <span style={{ fontWeight: 600 }}>{r.user?.username || `#${r.userId}`}</span>
                  </Link>
                </td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>Ур. {r.level}</td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--text-faint)' }}>{r.xp} XP</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <LeaderboardTable>
          {items.map((r, idx) => (
            <tr key={r.animeId}>
              <td style={{ color: 'var(--text-faint)', fontWeight: 700 }}>#{idx + 1}</td>
              <td>
                <Link to={`/anime/${r.anime?.anime_url || r.animeId}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none' }}>
                  {r.anime && (r.anime.poster?.small || r.anime.poster?.medium) ? (
                    <img src={fixUrl(r.anime.poster?.small || r.anime.poster?.medium)} alt="" style={{ width: 36, height: 52, objectFit: 'cover', borderRadius: 6 }} />
                  ) : (
                    <div style={{ width: 36, height: 52, borderRadius: 6, background: 'var(--surface-2)' }} />
                  )}
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.anime?.title || `Аниме #${r.animeId}`}</span>
                </Link>
              </td>
              <td style={{ textAlign: 'right' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#ffd76a', fontWeight: 700 }}>
                  <StarIcon width={14} height={14} /> {r.average}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{r.count} оценок</div>
              </td>
            </tr>
          ))}
        </LeaderboardTable>
      )}
    </div>
  )
}

function LeaderboardTable({ children }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <th style={th}>№</th>
          <th style={{ ...th, textAlign: 'left' }}>Название</th>
          <th style={{ ...th, textAlign: 'right' }}>Рейтинг</th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

const th = { padding: '10px 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-faint)' }
const td = { padding: '10px 8px', fontSize: 14 }
