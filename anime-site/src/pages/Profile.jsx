import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { backend, uploadUrl } from '../api/backend.js'
import { api, fixUrl, upgradePoster } from '../api/client.js'
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
  SaveIcon,
} from '../components/icons.jsx'

const PASTELS = ['#A8D8C9', '#F7C9D9', '#C9D6F0', '#F5E1A4', '#D9C2F0', '#BFE3D0', '#F0C9B8', '#B8A6F0']

function fmtHours(seconds) {
  const h = seconds / 3600
  if (h < 1) return `${Math.round(seconds / 60)} мин`
  return `${h.toFixed(1)} ч`
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
  const [openSection, setOpenSection] = useState(null)

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
            <h1>
              {profile.username}
              {(profile.isMaster || profile.isAdmin) && (
                <span className="master-badge">Q<span className="master-badge-tip">У этого пользователя роль — <em>МАСТЕР</em>.<br/>Мастера выполняют роль модерации, они могут удалять посты на стене и комментарии.</span></span>
              )}
            </h1>
            {!editing && profile.bio && <div className="bio">{profile.bio}</div>}
            <div className="joined">
              На QIK с {new Date(profile.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="profile-actions">
            {!isSelf && (
              <>
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
          <div className="edit-form" style={{ marginTop: 18 }}>
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

            <button className="btn btn-primary profile-save-btn" onClick={saveProfile}><SaveIcon width={18} height={18} />Сохранить</button>
          </div>
        )}

        {/* level */}
        <div className="level-block">
          <div className="level-head">
            <div className="level-badge">
              <span className="lvl">Уровень {level.level}</span>
            </div>
            {isSelf && (
              <button className="btn btn-ghost btn-sm profile-edit-btn" onClick={() => setEditing((e) => !e)} title={editing ? 'Отмена' : 'Редактировать'}>
                <EditIcon width={15} height={15} />
                <span className="edit-btn-label">{editing ? 'Отмена' : 'Редактировать'}</span>
              </button>
            )}
          </div>
          <div className="level-bar">
            <div className="level-bar-fill" style={{ width: `${Math.round(level.progress * 100)}%` }} />
          </div>
          <div className="level-meta">
            <span>{level.xpInLevel} / {level.xpForNext} до {level.level + 1} ур.</span>
            <span className="level-xp">{data.xp} XP</span>
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
      <GenreSection uid={uid} open={openSection === 'genres'} onToggle={() => setOpenSection(openSection === 'genres' ? null : 'genres')} />

      {/* achievements */}
      <ProfileSection
        icon={<TrophyIcon />}
        title="Достижения"
        count={`${achievementsUnlocked}/${achievements.length}`}
        open={openSection === 'achievements'}
        onToggle={() => setOpenSection(openSection === 'achievements' ? null : 'achievements')}
        preview={
          <div className="ach-grid" style={{ marginTop: 0 }}>
            {achievements.filter(a => a.unlocked).slice(0, 4).map(a => (
              <div key={a.id} className="ach unlocked" style={{ padding: '8px 12px' }}>
                <div className="ach-icon" style={{ fontSize: 18 }}>{a.icon}</div>
                <div className="ach-info"><b style={{ fontSize: 13 }}>{a.title}</b></div>
              </div>
            ))}
          </div>
        }
      >
        <AchievementsGrid achievements={achievements} />
      </ProfileSection>

      {/* history */}
      <ProfileSection
        icon={<ClockIcon />}
        title="История просмотров"
        open={openSection === 'history'}
        onToggle={() => setOpenSection(openSection === 'history' ? null : 'history')}
      >
        <WatchHistory uid={uid} />
      </ProfileSection>

      {/* bookmarks */}
      <ProfileSection
        icon={<BookmarkIcon />}
        title="Закладки"
        count={String(stats.bookmarks)}
        open={openSection === 'bookmarks'}
        onToggle={() => setOpenSection(openSection === 'bookmarks' ? null : 'bookmarks')}
      >
        <UserBookmarks uid={uid} />
      </ProfileSection>

      {/* friends */}
      <ProfileSection
        icon={<UsersIcon />}
        title="Друзья"
        count={String(stats.friends)}
        open={openSection === 'friends'}
        onToggle={() => setOpenSection(openSection === 'friends' ? null : 'friends')}
        preview={stats.friends > 0 ? <FriendsPreview uid={uid} /> : null}
      >
        <UserFriends uid={uid} />
      </ProfileSection>

      {/* comments */}
      <ProfileSection
        icon={<MessageIcon />}
        title="Комментарии"
        open={openSection === 'comments'}
        onToggle={() => setOpenSection(openSection === 'comments' ? null : 'comments')}
      >
        <UserComments uid={uid} />
      </ProfileSection>

      {/* wall */}
      <ProfileSection
        icon={<MessageIcon />}
        title="Стена"
        open={openSection === 'wall'}
        onToggle={() => setOpenSection(openSection === 'wall' ? null : 'wall')}
      >
        <Comments profileUserId={uid} />
      </ProfileSection>
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

function ProfileSection({ icon, title, count, open, onToggle, preview, children }) {
  return (
    <section className="profile-section">
      <div className="profile-section-head">
        <h3>{icon}{title}{count != null && <span style={{ fontSize: 14, color: 'var(--text-faint)', fontWeight: 400 }}>{count}</span>}</h3>
        <button className="profile-section-toggle" onClick={onToggle}>
          {open ? 'Свернуть ▲' : 'Развернуть ▼'}
        </button>
      </div>
      {!open && preview && <div className="profile-section-preview">{preview}</div>}
      {open && <div className="profile-section-body">{children}</div>}
    </section>
  )
}

function GenreSection({ uid, open, onToggle }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    backend.genreBreakdown(uid).then(setData).catch(() => setData({ total: 0, items: [] }))
  }, [uid])

  if (!data || data.total === 0) return null

  const top3 = data.items.slice(0, 3)
  const colors = ['#b8a6f0', '#a6e3d0', '#f7c9d9']

  return (
    <section className="profile-section">
      <div className="profile-section-head">
        <h3><StarIcon />Любимые жанры</h3>
        <button className="profile-section-toggle" onClick={onToggle}>
          {open ? 'Свернуть ▲' : 'Развернуть ▼'}
        </button>
      </div>
      {!open && (
        <div className="profile-section-preview">
          <div className="genre-preview">
            {top3.map((g, i) => (
              <span key={g.name} className="genre-chip" style={{ background: colors[i] }}>
                {g.name} {g.percent}%
              </span>
            ))}
            {data.items.length > 3 && (
              <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>
                + ещё {data.items.length - 3}
              </span>
            )}
          </div>
        </div>
      )}
      {open && (
        <div className="profile-section-body">
          <GenreChart uid={uid} data={data} />
        </div>
      )}
    </section>
  )
}

function FriendsPreview({ uid }) {
  const [items, setItems] = useState(null)
  useEffect(() => {
    backend.userFriends(uid).then(r => setItems((Array.isArray(r) ? r : []).slice(0, 6))).catch(() => setItems([]))
  }, [uid])

  if (!items || items.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="preview-avatars">
        {items.slice(0, 5).map(f => (
          <Avatar key={f.id} user={f} size={36} />
        ))}
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>
        {items.length === 6 ? '…' : ''}
      </span>
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
  const [allItems, setAllItems] = useState(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    backend.userBookmarks(uid)
      .then((r) => setAllItems(Array.isArray(r) ? r : []))
      .catch(() => setAllItems([]))
  }, [uid])

  if (!allItems) return <div className="comment-empty">Загрузка…</div>

  const counts = {}
  for (const b of allItems) {
    const s = b.status || ''
    counts[s] = (counts[s] || 0) + 1
  }
  const totalAll = allItems.length
  const favoriteCount = allItems.filter(b => b.isFavorite).length

  const filtered = filter
    ? filter === 'favorite'
      ? allItems.filter(b => b.isFavorite)
      : allItems.filter(b => b.status === filter)
    : allItems

  return (
    <>
      <div className="chips" style={{ marginBottom: 18 }}>
        {BOOKMARK_FILTERS.map((f) => {
          let n = 0
          if (f.key === '') n = totalAll
          else if (f.key === 'favorite') n = favoriteCount
          else n = counts[f.key] || 0
          return (
            <button
              key={f.key}
              className={`chip ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className="chip-count">{n}</span>
            </button>
          )
        })}
      </div>
      {filtered.length === 0 ? (
        <div className="comment-empty">{filter ? 'Нет закладок с этим статусом.' : 'Закладок пока нет.'}</div>
      ) : (
      <div className="grid">
        {filtered.map((b) => (
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

function UserComments({ uid }) {
  const [items, setItems] = useState(null)
  const [animeMap, setAnimeMap] = useState({})

  useEffect(() => {
    backend.userComments(uid)
      .then(async (r) => {
        const list = Array.isArray(r) ? r : []
        setItems(list)
        // Fetch anime info for all unique animeIds
        const ids = [...new Set(list.map((c) => c.animeId).filter(Boolean))]
        if (ids.length) {
          const map = {}
          await Promise.all(
            ids.map(async (id) => {
              try {
                const a = await api.anime(id)
                if (a) map[id] = a
              } catch {}
            })
          )
          setAnimeMap(map)
        }
      })
      .catch(() => setItems([]))
  }, [uid])

  if (!items) return <div className="comment-empty">Загрузка…</div>
  if (items.length === 0) return <div className="comment-empty">Комментариев пока нет.</div>

  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 16, lineHeight: 1.5 }}>
        Комментарии, которые пользователь оставил на страницах аниме.
      </div>
      <div className="history-list">
        {items.map((c) => {
        const a = animeMap[c.animeId]
        const img = a ? (a.poster?.medium || a.poster?.small) : null
        const title = a?.title || `Аниме #${c.animeId}`
        const url = a?.anime_url || c.animeId
        return (
          <Link key={c.id} to={`/anime/${url}#comments`} className="history-row" style={{ alignItems: 'flex-start' }}>
            <div className="history-poster">
              {img ? (
                <img src={fixUrl(img)} alt={title} loading="lazy" />
              ) : (
                <div className="skel" style={{ width: '100%', height: '100%' }} />
              )}
            </div>
            <div className="history-info" style={{ flex: 1 }}>
              <div className="history-title" style={{ fontWeight: 600 }}>
                {title}
              </div>
              {c.body && <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>{c.body}</div>}
            </div>
            <div className="history-time">{historyTime(c.createdAt)}</div>
          </Link>
        )
      })}
      </div>
    </>
  )
}

// palette for genre slices
const PIE_COLORS = [
  '#b8a6f0', '#a6e3d0', '#f7c9d9', '#f5e1a4', '#c9d6f0',
  '#f0c9b8', '#bfe3d0', '#d9c2f0', '#ffd76a', '#8fd3ff',
  '#ff9bb3', '#9be8c2',
]

function GenreChart({ uid, data: prefetched }) {
  const [fetched, setFetched] = useState(null)
  const data = prefetched || fetched

  useEffect(() => {
    if (prefetched) return
    backend.genreBreakdown(uid).then(setFetched).catch(() => setFetched({ total: 0, items: [] }))
  }, [uid, prefetched])

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
