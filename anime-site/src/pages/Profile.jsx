import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { backend, uploadUrl } from '../api/backend.js'
import { fixUrl, upgradePoster } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { frameColor } from '../utils/frames.js'
import Avatar from '../components/Avatar.jsx'
import Comments from '../components/Comments.jsx'
import { statusLabel } from '../components/BookmarkButton.jsx'
import SEO from '../components/SEO.jsx'
import {
  TrophyIcon,
  ClockIcon,
  EyeIcon,
  StarIcon,
  BookmarkIcon,
  MessageIcon,
  UsersIcon,
  UserPlusIcon,
  CheckIcon,
  EditIcon,
  CameraIcon,
  TrashIcon,
  SunIcon,
  MoonIcon,
} from '../components/icons.jsx'

const PASTELS = ['#A8D8C9', '#F7C9D9', '#C9D6F0', '#F5E1A4', '#D9C2F0', '#BFE3D0', '#F0C9B8', '#B8A6F0']

function fmtHours(seconds) {
  const h = seconds / 3600
  if (h < 1) return `${Math.round(seconds / 60)} мин`
  return `${h.toFixed(1)} ч`
}

export default function Profile() {
  const { id } = useParams()
  const uid = Number(id)
  const navigate = useNavigate()
  const { user, setUser, showToast, openAuth } = useAuth()
  const { theme, toggle } = useTheme()
  const isSelf = user?.id === uid

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('overview')

  // editing
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState('')
  const [color, setColor] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [bannerUrl, setBannerUrl] = useState(null)
  const [frame, setFrame] = useState('none')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const avatarFileRef = useRef(null)
  const bannerFileRef = useRef(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    backend
      .profile(uid)
      .then((d) => {
        setData(d)
        setBio(d.user.bio || '')
        setColor(d.user.avatarColor || PASTELS[0])
        setAvatarUrl(d.user.avatarUrl || null)
        setBannerUrl(d.user.bannerUrl || null)
        setFrame(d.user.avatarFrame || 'none')
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [uid])

  useEffect(() => {
    load()
  }, [load])

  async function uploadAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const { url } = await backend.uploadImage(file)
      setAvatarUrl(url)
    } catch (err) {
      showToast(err.message || 'Ошибка загрузки')
    } finally {
      setUploadingAvatar(false)
      if (avatarFileRef.current) avatarFileRef.current.value = ''
    }
  }

  async function uploadBanner(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingBanner(true)
    try {
      const { url } = await backend.uploadImage(file)
      setBannerUrl(url)
    } catch (err) {
      showToast(err.message || 'Ошибка загрузки')
    } finally {
      setUploadingBanner(false)
      if (bannerFileRef.current) bannerFileRef.current.value = ''
    }
  }

  async function saveProfile() {
    try {
      const updated = await backend.updateProfile({
        bio,
        avatarColor: color,
        avatarUrl,
        bannerUrl,
        avatarFrame: frame,
      })
      showToast('Профиль обновлён')
      setEditing(false)
      // keep the header avatar in sync
      if (isSelf && setUser) setUser((u) => ({ ...u, ...updated }))
      load()
    } catch (e) {
      showToast(e.message || 'Ошибка')
    }
  }

  async function addFriend() {
    if (!user) return openAuth('login')
    try {
      await backend.requestFriend(uid)
      showToast('Заявка отправлена')
      load()
    } catch (e) {
      showToast(e.message || 'Ошибка')
    }
  }

  async function removeFriend() {
    try {
      await backend.removeFriend(uid)
      showToast('Удалено из друзей')
      load()
    } catch (e) {
      showToast(e.message || 'Ошибка')
    }
  }

  async function sendMessage() {
    if (!user) return openAuth('login')
    try {
      await backend.startChat(uid)
      navigate('/chats')
    } catch (e) {
      showToast(e.message || 'Ошибка')
    }
  }

  if (loading) {
    return (
      <div className="container page">
        <SEO title="Загрузка профиля…" />
        <div className="skel" style={{ height: 180, borderRadius: 16, marginBottom: 26 }} />
        <div className="stats-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skel" style={{ height: 90 }} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container page">
        <SEO title="Профиль не найден" description="Запрашиваемый профиль не найден." />
        <div className="state">
          <h2>Профиль не найден</h2>
          <Link to="/" className="btn btn-ghost" style={{ marginTop: 16 }}>На главную</Link>
        </div>
      </div>
    )
  }

  const { user: profile, stats, level, achievements, achievementsUnlocked, friendStatus, frames } = data

  // live preview object used while editing
  const previewUser = editing
    ? { ...profile, avatarColor: color, avatarUrl, avatarFrame: frame }
    : profile
  const shownBanner = editing ? bannerUrl : profile.bannerUrl
  const profileImage = profile.avatarUrl || undefined

  return (
    <div className="container page">
      <SEO
        title={profile.username ? `${profile.username} — профиль` : 'Профиль'}
        description={profile.bio || `Профиль ${profile.username || 'пользователя'} на QIK Anime. Уровень ${level.level}, ${stats.watchedEpisodes} просмотренных серий.`}
        image={profileImage}
        url={`https://quickik.ru/u/${uid}`}
        type="profile"
        canonical={`https://quickik.ru/u/${uid}`}
      />

      <button className="btn btn-ghost profile-theme-mobile" onClick={toggle}>
        {theme === 'dark' ? <SunIcon width={16} height={16} /> : <MoonIcon width={16} height={16} />}
        {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      </button>

      {/* banner */}
      <div className={`profile-banner ${shownBanner ? 'has-image' : ''}`}>
        {shownBanner && (
          <div
            className="profile-banner-bg"
            style={{ backgroundImage: `url(${uploadUrl(shownBanner)})` }}
          />
        )}
        {isSelf && editing && (
          <button
            className="banner-edit-btn"
            onClick={() => bannerFileRef.current?.click()}
            disabled={uploadingBanner}
          >
            <CameraIcon width={15} height={15} />
            {uploadingBanner ? 'Загрузка…' : shownBanner ? 'Сменить шапку' : 'Добавить шапку'}
          </button>
        )}
        <input ref={bannerFileRef} type="file" accept="image/*" hidden onChange={uploadBanner} />

        <div className="profile-banner-inner">
          <div className="avatar-edit-wrap">
            <Avatar user={previewUser} size={84} />
            {isSelf && editing && (
              <button
                className="avatar-edit-btn"
                onClick={() => avatarFileRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Сменить аватар"
              >
                <CameraIcon width={15} height={15} />
              </button>
            )}
            <input ref={avatarFileRef} type="file" accept="image/*" hidden onChange={uploadAvatar} />
          </div>
          <div className="profile-id">
            <h1>{profile.username}</h1>
            {!editing && profile.bio && <div className="bio">{profile.bio}</div>}
            <div className="joined">
              На QIK с {new Date(profile.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="profile-actions">
            {isSelf ? (
              <button className="btn btn-ghost btn-sm profile-edit-btn" onClick={() => setEditing((e) => !e)}>
                <EditIcon width={15} height={15} /> {editing ? 'Отмена' : 'Редактировать'}
              </button>
            ) : (
              <>
                <button className="btn btn-primary btn-sm" onClick={sendMessage}>
                  <MessageIcon width={15} height={15} /> Написать
                </button>
                {friendStatus === 'friends' && (
                  <button className="btn btn-danger btn-sm" onClick={removeFriend}>
                    <CheckIcon width={15} height={15} /> В друзьях
                  </button>
                )}
                {friendStatus === 'none' && (
                  <button className="btn btn-primary btn-sm" onClick={addFriend}>
                    <UserPlusIcon width={15} height={15} /> Добавить в друзья
                  </button>
                )}
                {friendStatus === 'outgoing' && (
                  <button className="btn btn-ghost btn-sm" disabled>
                    Заявка отправлена
                  </button>
                )}
                {friendStatus === 'incoming' && (
                  <button className="btn btn-primary btn-sm" onClick={addFriend}>
                    <UserPlusIcon width={15} height={15} /> Принять заявку
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* edit form */}
        {editing && (
          <div style={{ marginTop: 18 }}>
            <div className="field">
              <label>О себе</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                placeholder="Пара слов о себе…"
                style={{
                  width: '100%',
                  minHeight: 70,
                  padding: '11px 14px',
                  borderRadius: 12,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: 14.5,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
            <div className="field">
              <label>Цвет аватара {avatarUrl ? '(под загруженным фото скрыт)' : ''}</label>
              <div className="color-swatches">
                {PASTELS.map((c) => (
                  <button
                    key={c}
                    className={`swatch ${color === c ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                    aria-label={c}
                  />
                ))}
              </div>
              {avatarUrl && (
                <button
                  onClick={() => setAvatarUrl(null)}
                  style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, marginTop: 10 }}
                >
                  Убрать загруженный аватар
                </button>
              )}
            </div>

            <div className="field">
              <label>Рамка аватара</label>
              <div className="frame-picker">
                {frames.map((f) => (
                  <button
                    key={f.id}
                    className={`frame-opt ${frame === f.id ? 'active' : ''} ${f.unlocked ? '' : 'locked'}`}
                    onClick={() => f.unlocked && setFrame(f.id)}
                    title={f.unlocked ? f.title : `Откроется на ${f.minLevel} уровне`}
                    disabled={!f.unlocked}
                  >
                    <span
                      className="frame-ring"
                      style={{ background: f.id === 'none' ? 'var(--surface-2)' : frameColor(f.id) }}
                    >
                      <span className="frame-dot" />
                    </span>
                    <span className="frame-name">
                      {f.title}
                      {!f.unlocked && ` · ур.${f.minLevel}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {bannerUrl && (
              <button
                onClick={() => setBannerUrl(null)}
                style={{ color: '#ff8a8a', fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'block' }}
              >
                Убрать шапку профиля
              </button>
            )}

            <button className="btn btn-primary" onClick={saveProfile}>Сохранить</button>
          </div>
        )}

        {/* level */}
        <div className="level-block">
          <div className="level-row">
            <span className="level-badge">
              <span className="lvl">Уровень {level.level}</span>
              <span style={{ color: 'var(--text-faint)', fontWeight: 600 }}>{data.xp} XP</span>
            </span>
            <span style={{ color: 'var(--text-faint)' }}>
              {level.xpInLevel} / {level.xpForNext} до {level.level + 1} ур.
            </span>
          </div>
          <div className="level-bar">
            <div className="level-bar-fill" style={{ width: `${Math.round(level.progress * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <EyeIcon className="ic" width={20} height={20} style={{ color: 'var(--accent)' }} />
          <div className="v">{stats.watchedEpisodes}</div>
          <div className="l">просмотрено серий</div>
        </div>
        <div className="stat-card">
          <ClockIcon className="ic" width={20} height={20} style={{ color: 'var(--accent)' }} />
          <div className="v">{fmtHours(stats.watchedSeconds)}</div>
          <div className="l">времени за просмотром</div>
        </div>
        <div className="stat-card">
          <StarIcon className="ic" width={20} height={20} style={{ color: 'var(--accent)' }} />
          <div className="v">{stats.ratings}</div>
          <div className="l">оценок</div>
        </div>
        <div className="stat-card">
          <TrophyIcon className="ic" width={20} height={20} style={{ color: 'var(--accent)' }} />
          <div className="v">{achievementsUnlocked}/{achievements.length}</div>
          <div className="l">достижений</div>
        </div>
        <div className="stat-card">
          <BookmarkIcon className="ic" width={20} height={20} style={{ color: 'var(--accent)' }} />
          <div className="v">{stats.bookmarks}</div>
          <div className="l">в закладках</div>
        </div>
      </div>

      {/* genre breakdown pie chart */}
      <GenreChart uid={uid} />

      {/* tabs */}
      <div className="subtabs">
        <button className={`subtab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          Достижения
        </button>
        <button className={`subtab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          История
        </button>
        <button className={`subtab ${tab === 'bookmarks' ? 'active' : ''}`} onClick={() => setTab('bookmarks')}>
          Закладки
        </button>
        <button className={`subtab ${tab === 'friends' ? 'active' : ''}`} onClick={() => setTab('friends')}>
          Друзья ({stats.friends})
        </button>
        <button className={`subtab ${tab === 'wall' ? 'active' : ''}`} onClick={() => setTab('wall')}>
          Стена
        </button>
      </div>

      {tab === 'overview' && <AchievementsGrid achievements={achievements} />}
      {tab === 'history' && <WatchHistory uid={uid} />}
      {tab === 'bookmarks' && <UserBookmarks uid={uid} />}
      {tab === 'friends' && <UserFriends uid={uid} />}
      {tab === 'wall' && (
        <div className="profile-wall">
          <Comments profileUserId={uid} />
        </div>
      )}
    </div>
  )
}

function AchievementsGrid({ achievements }) {
  return (
    <div className="ach-grid">
      {achievements.map((a) => (
        <div key={a.id} className={`ach ${a.unlocked ? 'unlocked' : 'locked'}`}>
          <div className="ach-icon">{a.icon}</div>
          <div className="ach-info">
            <b>{a.title}</b>
            <p>{a.description}</p>
            {a.progress && !a.unlocked && (
              <>
                <div className="ach-progress">
                  <span style={{ width: `${Math.round((a.progress.current / a.progress.target) * 100)}%` }} />
                </div>
                <div className="ach-progress-text">
                  {a.progress.current} / {a.progress.target}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const BOOKMARK_FILTERS = [
  { key: '', label: 'Все' },
  { key: 'watching', label: 'Смотрю' },
  { key: 'completed', label: 'Просмотрено' },
  { key: 'planned', label: 'В планах' },
  { key: 'on_hold', label: 'Отложено' },
  { key: 'dropped', label: 'Брошено' },
  { key: 'rewatching', label: 'Пересматриваю' },
  { key: 'favorite', label: 'Любимые' },
]

function UserBookmarks({ uid }) {
  const [items, setItems] = useState(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    backend.userBookmarks(uid, filter || undefined)
      .then((r) => setItems(Array.isArray(r) ? r : []))
      .catch(() => setItems([]))
  }, [uid, filter])

  if (!items) return <div className="comment-empty">Загрузка…</div>

  return (
    <>
      <div className="chips" style={{ marginBottom: 18 }}>
        {BOOKMARK_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="comment-empty">{filter ? 'Нет закладок с этим статусом.' : 'Закладок пока нет.'}</div>
      ) : (
      <div className="grid">
        {items.map((b) => (
          <Link key={b.animeId} to={`/anime/${b.animeUrl || b.animeId}`} className="card">
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
        ))}
      </div>
      )}
    </>
  )
}

function UserFriends({ uid }) {
  const navigate = useNavigate()
  const { user, showToast, openAuth } = useAuth()
  const [items, setItems] = useState(null)
  const [friends, setFriends] = useState(new Set())

  useEffect(() => {
    backend.userFriends(uid).then((r) => setItems(Array.isArray(r) ? r : [])).catch(() => setItems([]))
  }, [uid])

  // Load current user's friend IDs so we know who's already a friend
  useEffect(() => {
    if (!user) { setFriends(new Set()); return }
    backend.listFriends().then((r) => {
      setFriends(new Set((Array.isArray(r) ? r : []).map((f) => f.id)))
    }).catch(() => {})
  }, [user])

  async function addFriend(targetId) {
    if (!user) return openAuth('login')
    try {
      await backend.requestFriend(targetId)
      showToast('Заявка отправлена')
    } catch (e) { showToast(e.message || 'Ошибка') }
  }

  async function writeMessage(targetId) {
    if (!user) return openAuth('login')
    try {
      await backend.startChat(targetId)
      navigate('/chats')
    } catch (e) { showToast(e.message || 'Ошибка') }
  }

  const isSelf = user?.id === uid

  if (!items) return <div className="comment-empty">Загрузка…</div>
  if (items.length === 0) return <div className="comment-empty">Список друзей пуст.</div>

  return (
    <div className="friend-list">
      {items.map((f) => (
        <div key={f.id} className="friend-row">
          <Avatar user={f} size={42} />
          <Link to={`/u/${f.id}`} className="fr-name">{f.username}</Link>
          {user && user.id !== f.id && (
            <div className="fr-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => writeMessage(f.id)} title="Написать">
                <MessageIcon width={13} height={13} />
              </button>
              {isSelf ? (
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  try { await backend.removeFriend(f.id); showToast('Удалён из друзей'); setFriends((s) => { const n = new Set(s); n.delete(f.id); return n }) } catch (e) { showToast(e.message || 'Ошибка') }
                }} title="Удалить из друзей">
                  <TrashIcon width={13} height={13} />
                </button>
              ) : !friends.has(f.id) && (
                <button className="btn btn-ghost btn-sm" onClick={() => addFriend(f.id)} title="Добавить в друзья">
                  <UserPlusIcon width={13} height={13} />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// palette for genre slices
const PIE_COLORS = [
  '#b8a6f0', '#a6e3d0', '#f7c9d9', '#f5e1a4', '#c9d6f0',
  '#f0c9b8', '#bfe3d0', '#d9c2f0', '#ffd76a', '#8fd3ff',
  '#ff9bb3', '#9be8c2',
]

function GenreChart({ uid }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    backend.genreBreakdown(uid).then(setData).catch(() => setData({ total: 0, items: [] }))
  }, [uid])

  if (!data || data.total === 0) return null

  // top 8 genres, rest grouped into "Другое"
  const top = data.items.slice(0, 8)
  const restPct = data.items.slice(8).reduce((s, g) => s + g.percent, 0)
  const slices = [...top]
  if (restPct > 0) slices.push({ name: 'Другое', percent: Math.round(restPct * 10) / 10 })

  // build conic-gradient
  let acc = 0
  const stops = slices.map((s, idx) => {
    const start = acc
    acc += s.percent
    const color = PIE_COLORS[idx % PIE_COLORS.length]
    return `${color} ${start}% ${acc}%`
  })
  // pad to 100% if rounding leaves a gap
  if (acc < 100) stops.push(`var(--surface-2) ${acc}% 100%`)

  return (
    <div className="genre-chart-card">
      <h3 className="genre-chart-title">Любимые жанры</h3>
      <div className="genre-chart">
        <div
          className="pie"
          style={{ background: `conic-gradient(${stops.join(', ')})` }}
        >
          <div className="pie-hole">
            <b>{data.items[0]?.name || '—'}</b>
            <span>{data.items[0]?.percent || 0}%</span>
          </div>
        </div>
        <div className="genre-legend">
          {slices.map((s, idx) => (
            <div className="legend-row" key={s.name}>
              <span
                className="legend-dot"
                style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
              />
              <span className="legend-name">{s.name}</span>
              <span className="legend-pct">{s.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WatchHistory({ uid }) {
  const [items, setItems] = useState(null)
  useEffect(() => {
    backend.watchHistory(uid, 100).then((r) => setItems(Array.isArray(r) ? r : [])).catch(() => setItems([]))
  }, [uid])

  if (!items) return <div className="comment-empty">Загрузка…</div>
  if (items.length === 0) return <div className="comment-empty">История просмотров пуста.</div>

  return (
    <div className="history-list">
      {items.map((h) => (
        <Link key={h.id} to={`/anime/${h.animeUrl || h.animeId}/watch`} className="history-row">
          <div className="history-poster">
            {h.animePoster ? (
              <img src={upgradePoster(h.animePoster, 'medium')} alt={h.animeTitle} loading="lazy" />
            ) : (
              <div className="skel" style={{ width: '100%', height: '100%' }} />
            )}
          </div>
          <div className="history-info">
            <div className="history-title">{h.animeTitle || `Аниме #${h.animeId}`}</div>
            <div className="history-meta">Серия {h.episodeNumber}</div>
          </div>
          <div className="history-time">{historyTime(h.updatedAt)}</div>
        </Link>
      ))}
    </div>
  )
}

function historyTime(iso) {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`
  return d.toLocaleDateString('ru-RU')
}
