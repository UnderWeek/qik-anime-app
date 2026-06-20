import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { api, poster } from '../api/client.js'
import { BACKEND_ORIGIN, backend, getToken, uploadUrl } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import Lightbox from '../components/Lightbox.jsx'
import { ArrowLeft, CloseIcon, ImageIcon, UsersIcon, UserPlusIcon, StarIcon } from '../components/icons.jsx'

function timeAgo(iso) {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'сейчас'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return d.toLocaleDateString('ru-RU')
}

function animePosterUrl(anime) {
  return poster(anime, 'big') || poster(anime, 'medium') || poster(anime, 'small') || ''
}

export default function RoomWatch() {
  const { id } = useParams()
  const roomId = Number(id)
  const navigate = useNavigate()
  const { user, openAuth, showToast } = useAuth()

  const [loading, setLoading] = useState(true)
  const [room, setRoom] = useState(null)
  const [state, setState] = useState(null)
  const [iframeSrc, setIframeSrc] = useState('')
  const [members, setMembers] = useState([])
  const [messages, setMessages] = useState([])
  const [isHost, setIsHost] = useState(false)

  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [selectedAnime, setSelectedAnime] = useState(null)
  const [animeVideos, setAnimeVideos] = useState([])
  const [videoLoading, setVideoLoading] = useState(false)
  const [selectedDub, setSelectedDub] = useState(null)
  const [videoId, setVideoId] = useState(null)
  const [pushingVideo, setPushingVideo] = useState(false)

  const [chatText, setChatText] = useState('')
  const [attach, setAttach] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [friendsList, setFriendsList] = useState([])
  const [inviting, setInviting] = useState(null)
  const inviteRef = useRef(null)
  const fileRef = useRef(null)
  const iframeRef = useRef(null)
  const socketRef = useRef(null)

  // ---- episode filtering ----
  const kodikEpisodes = useMemo(() => {
    return (Array.isArray(animeVideos) ? animeVideos : [])
      .filter((v) => /kodik/i.test(v.iframe_url || ''))
  }, [animeVideos])

  const dubbings = useMemo(() => {
    const seen = new Set()
    const out = []
    kodikEpisodes.forEach((v) => {
      const d = v.data?.dubbing || 'Озвучка'
      if (!seen.has(d)) { seen.add(d); out.push(d) }
    })
    return out
  }, [kodikEpisodes])

  const episodes = useMemo(
    () =>
      kodikEpisodes
        .filter((v) => (v.data?.dubbing || 'Озвучка') === selectedDub)
        .sort((a, b) => (a.index || 0) - (b.index || 0)),
    [kodikEpisodes, selectedDub]
  )

  const activeEpisode = useMemo(
    () => episodes.find((ep) => String(ep.video_id) === String(videoId)) || episodes[0] || null,
    [episodes, videoId]
  )

  function loadIframeUrl(url) {
    if (!url) { setIframeSrc(''); return }
    setIframeSrc(url)
    if (iframeRef.current) iframeRef.current.src = url
  }

  // ---- applySnapshot ----
  const applySnapshot = useCallback((snap) => {
    if (!snap) return
    if (snap.room) {
      setRoom(snap.room)
      if (user && snap.room.hostId !== undefined) {
        setIsHost(snap.room.hostId === user.id)
      }
    }
    if (snap.state) {
      setState(snap.state)
      if (snap.state.iframeUrl && snap.state.iframeUrl !== iframeSrc) {
        loadIframeUrl(snap.state.iframeUrl)
      }
    }
    if (Array.isArray(snap.members)) setMembers(snap.members)
    if (Array.isArray(snap.messages)) {
      const map = new Map()
      snap.messages.forEach((m) => map.set(m.id, m))
      setMessages((prev) => {
        prev.forEach((m) => map.set(m.id, m))
        return [...map.values()].sort((a, b) => a.id - b.id)
      })
    }
  }, [user, iframeSrc])

  // ---- loadRoom ----
  const loadRoom = useCallback(async () => {
    if (!user) { setLoading(false); return }
    if (!Number.isFinite(roomId)) { navigate('/rooms'); return }

    setLoading(true)
    try {
      const snap = await backend.watchRoom(roomId)
      applySnapshot(snap)
    } catch (err) {
      if (err.status === 403) {
        try {
          const snap = await backend.joinWatchRoomById(roomId)
          applySnapshot(snap)
          showToast('Вы присоединились к комнате по приглашению')
          setLoading(false)
          return
        } catch {
          showToast('Вы не состоите в этой комнате')
        }
      } else if (err.status === 404) showToast('Комната не найдена')
      else showToast(err.message || 'Ошибка загрузки комнаты')
      navigate('/rooms')
    } finally {
      setLoading(false)
    }
  }, [applySnapshot, navigate, roomId, showToast, user])

  useEffect(() => { loadRoom() }, [loadRoom])

  // ---- Socket.IO ----
  useEffect(() => {
    if (!roomId || !user) return undefined
    const token = getToken()
    if (!token) return undefined

    const socket = io(`${BACKEND_ORIGIN}/watch-rooms`, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('room:join', { roomId })
    })

    socket.on('room:snapshot', (snap) => { applySnapshot(snap) })

    socket.on('room:members', (payload) => {
      if (Array.isArray(payload?.members)) setMembers(payload.members)
    })

    socket.on('room:message', (payload) => {
      if (payload) {
        setMessages((prev) => {
          const map = new Map()
          prev.forEach((m) => map.set(m.id, m))
          map.set(payload.id, payload)
          return [...map.values()].sort((a, b) => a.id - b.id)
        })
      }
    })

    socket.on('room:closed', () => {
      showToast('Комната закрыта')
      navigate('/rooms')
    })

    return () => {
      try { socket.emit('room:leave', { roomId }) } catch { /* ignore */ }
      socket.disconnect()
      socketRef.current = null
    }
  }, [applySnapshot, navigate, roomId, showToast, user])

  // ---- Cleanup ----
  useEffect(
    () => () => { if (attach?.preview) URL.revokeObjectURL(attach.preview) },
    [attach]
  )

  useEffect(() => {
    if (dubbings.length) {
      setSelectedDub((prev) => (dubbings.includes(prev) ? prev : dubbings[0]))
    } else {
      setSelectedDub(null)
    }
  }, [dubbings])

  useEffect(() => {
    if (episodes.length) {
      setVideoId((prev) =>
        episodes.some((ep) => String(ep.video_id) === String(prev))
          ? prev
          : String(episodes[0].video_id)
      )
    } else {
      setVideoId(null)
    }
  }, [episodes])

  // Auto-load episodes for the current room anime
  useEffect(() => {
    const aid = state?.animeId
    if (!aid) return
    if (selectedAnime && selectedAnime.anime_id !== aid) return
    if (selectedAnime?.anime_id === aid && animeVideos.length > 0) return

    let cancelled = false
    async function load() {
      setVideoLoading(true)
      try {
        const raw = await api.videos(aid)
        if (cancelled) return
        const list = Array.isArray(raw) ? raw.filter((v) => !!v?.iframe_url) : []
        setAnimeVideos(list)
        setSelectedAnime({
          anime_id: aid,
          anime_url: state.animeUrl,
          title: state.animeTitle,
          poster: { medium: state.animePoster },
        })
        if (state.videoId) setVideoId(String(state.videoId))
      } catch {
        if (!cancelled) setAnimeVideos([])
      } finally {
        if (!cancelled) setVideoLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [state?.animeId])

  // ---- Actions ----
  async function runSearch(e) {
    e.preventDefault()
    const q = searchText.trim()
    if (!q) return
    setSearching(true)
    try {
      const res = await api.search(q, { limit: 12 })
      setSearchResults(Array.isArray(res) ? res : [])
    } catch {
      setSearchResults([])
      showToast('Не удалось выполнить поиск')
    } finally {
      setSearching(false)
    }
  }

  async function pickAnime(anime) {
    setSelectedAnime(anime)
    setVideoLoading(true)
    setAnimeVideos([])
    try {
      const raw = await api.videos(anime.anime_id)
      const list = Array.isArray(raw) ? raw.filter((v) => !!v?.iframe_url) : []
      const kodik = list.filter((v) => /kodik/i.test(v.iframe_url || ''))
      setAnimeVideos(list)
      if (!kodik.length) showToast('Для этого аниме нет плеера Kodik')
    } catch {
      setAnimeVideos([])
      showToast('Не удалось загрузить серии')
    } finally {
      setVideoLoading(false)
    }
  }

  async function pushEpisode(episode) {
    if (!isHost) {
      showToast('Управление плеером доступно только ведущему')
      return
    }
    if (!selectedAnime || !episode?.iframe_url) {
      showToast('Выберите серию для комнаты')
      return
    }

    const dubName = episode.data?.dubbing || 'Озвучка'

    const payload = {
      animeId: selectedAnime.anime_id,
      animeUrl: selectedAnime.anime_url,
      animeTitle: selectedAnime.title,
      animePoster: animePosterUrl(selectedAnime) || state?.animePoster || '',
      videoId: String(episode.video_id || ''),
      episodeNumber: String(episode.number || episode.index || ''),
      dubbing: dubName,
      iframeUrl: episode.iframe_url,
    }

    setPushingVideo(true)
    try {
      await backend.setWatchRoomVideo(roomId, payload)
      setVideoId(String(episode.video_id))
      showToast('Плеер комнаты обновлён')
    } catch (err) {
      showToast(err.message || 'Не удалось обновить плеер')
    } finally {
      setPushingVideo(false)
    }
  }

  async function pushVideoToRoom() {
    await pushEpisode(activeEpisode)
  }

  async function copyCode() {
    if (!room?.code) return
    try {
      await navigator.clipboard.writeText(room.code)
      showToast('Код скопирован')
    } catch {
      showToast(`Код комнаты: ${room.code}`)
    }
  }

  async function toggleInvite() {
    const next = !inviteOpen
    setInviteOpen(next)
    if (next && friendsList.length === 0) {
      try {
        const friends = await backend.listFriends()
        setFriendsList(Array.isArray(friends) ? friends : [])
      } catch { setFriendsList([]) }
    }
  }

  async function inviteFriend(targetId) {
    setInviting(targetId)
    try {
      await backend.inviteToRoom(roomId, targetId)
      showToast('Приглашение отправлено')
      setInviteOpen(false)
    } catch (err) {
      showToast(err.message || 'Не удалось пригласить')
    } finally {
      setInviting(null)
    }
  }

  useEffect(() => {
    if (!inviteOpen) return
    function onClick(e) {
      if (inviteRef.current && !inviteRef.current.contains(e.target)) setInviteOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [inviteOpen])

  function pickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { showToast('Файл больше 8 МБ'); return }
    if (attach?.preview) URL.revokeObjectURL(attach.preview)
    setAttach({ file, preview: URL.createObjectURL(file) })
  }

  function clearAttach() {
    if (attach?.preview) URL.revokeObjectURL(attach.preview)
    setAttach(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function sendChatMessage(e) {
    e.preventDefault()
    const body = chatText.trim()
    if (!body && !attach) return
    setSending(true)
    try {
      let imageUrl
      if (attach) {
        setUploading(true)
        const up = await backend.uploadImage(attach.file)
        imageUrl = up?.url
      }
      const msg = await backend.sendWatchRoomMessage(roomId, { body, imageUrl })
      setMessages((prev) => {
        const map = new Map()
        prev.forEach((m) => map.set(m.id, m))
        map.set(msg.id, msg)
        return [...map.values()].sort((a, b) => a.id - b.id)
      })
      setChatText('')
      clearAttach()
    } catch (err) {
      showToast(err.message || 'Не удалось отправить сообщение')
    } finally {
      setUploading(false)
      setSending(false)
    }
  }

  async function leaveRoom() {
    if (!window.confirm('Выйти из комнаты?')) return
    try { await backend.leaveWatchRoom(roomId) } catch { /* ignore */ } finally { navigate('/rooms') }
  }

  async function closeRoom() {
    if (!window.confirm('Закрыть комнату? История чата и фото будут удалены.')) return
    try {
      await backend.closeWatchRoom(roomId)
      showToast('Комната закрыта и очищена')
      navigate('/rooms')
    } catch (err) {
      showToast(err.message || 'Не удалось закрыть комнату')
    }
  }

  // ---- Render ----
  if (!user) {
    return (
      <div className="container page">
        <div className="state">
          <h2>Нужна авторизация</h2>
          <p>Чтобы зайти в комнату совместного просмотра, нужно войти в аккаунт.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => openAuth('login')}>Войти</button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container page">
        <div className="state"><p>Загрузка комнаты...</p></div>
      </div>
    )
  }

  return (
    <div className="container page">
      <div className="room-topbar">
        <Link to="/rooms" className="section-link room-back">
          <ArrowLeft width={14} height={14} /> Все комнаты
        </Link>
        <div className="room-top-actions">
          <button className="btn btn-ghost btn-sm" onClick={copyCode}>Код: {room?.code}</button>
          <div style={{ position: 'relative' }} ref={inviteRef}>
            <button className="btn btn-ghost btn-sm" onClick={toggleInvite}>
              <UserPlusIcon width={14} height={14} /> Пригласить
            </button>
            {inviteOpen && (
              <div className="notif-menu room-invite-menu" style={{ right: 0, top: '100%', marginTop: 8, minWidth: 220 }}>
                <div className="notif-head"><b>Друзья</b></div>
                {friendsList.length === 0 ? (
                  <div className="notif-empty">Нет друзей для приглашения</div>
                ) : (
                  <div className="notif-list" style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {friendsList.map((f) => {
                      const alreadyHere = members.some((m) => m.user?.id === f.id)
                      return (
                        <div key={f.id} className="notif-item" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar user={f} size={32} />
                            <span>{f.username}</span>
                          </div>
                          {alreadyHere ? (
                            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>В комнате</span>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={inviting === f.id}
                              onClick={() => inviteFriend(f.id)}
                              style={{ fontSize: 12 }}
                            >
                              {inviting === f.id ? '...' : 'Пригласить'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          {room?.ownerId === user.id ? (
            <button className="btn btn-danger btn-sm" onClick={closeRoom}>Закрыть комнату</button>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={leaveRoom}>Выйти</button>
          )}
        </div>
      </div>

      <div className="room-watch-grid">
        <section className="room-main">
          <div className="room-main-head">
            <h1>{state?.animeTitle || 'Выберите аниме для комнаты'}</h1>
            <div className="room-main-sub">
              {state?.episodeNumber ? `Серия ${state.episodeNumber}` : 'Серия не выбрана'}
              {state?.dubbing ? ` · ${state.dubbing}` : ''}
            </div>
          </div>

          <div className="room-player-wrap player-wrap">
            {state?.iframeUrl ? (
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="Room player — Kodik"
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media"
              />
            ) : (
              <div className="state" style={{ padding: 20 }}>
                Выберите аниме и серию в блоке ниже.
              </div>
            )}
          </div>

          <div className="room-sync-info" style={{ marginTop: 14, fontSize: 13, color: 'var(--text-faint)', display: 'flex', gap: 16, alignItems: 'center' }}>
            {isHost ? (
              <span className="room-host-badge">Вы ведущий</span>
            ) : (
              <span className="room-viewer-badge">
                Ведущий: {members.find((m) => m.isHost)?.user?.username || '—'}
              </span>
            )}
          </div>

          <div className="room-picker">
            <div className="control-label">Подобрать аниме (только Kodik)</div>
            {!isHost && (
              <div className="room-viewer-hint">Управление плеером доступно только ведущему</div>
            )}
            <form className="room-search-form" onSubmit={runSearch}>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Название аниме"
              />
              <button className="btn btn-ghost btn-sm" type="submit" disabled={searching || !searchText.trim()}>
                {searching ? 'Поиск...' : 'Найти'}
              </button>
            </form>

            {!!searchResults.length && (
              <div className="room-search-results">
                {searchResults.map((a) => {
                  const img = poster(a, 'big') || poster(a, 'medium') || poster(a, 'small')
                  const rate = a.rating?.average
                  return (
                    <button
                      key={a.anime_id || a.anime_url}
                      className={`room-search-item ${selectedAnime?.anime_id === a.anime_id ? 'active' : ''}`}
                      onClick={() => pickAnime(a)}
                      type="button"
                    >
                      <div className="room-search-poster">
                        {img ? <img src={img} alt="" /> : <div className="room-search-no-poster" />}
                      </div>
                      <div className="room-search-info">
                        <div className="room-search-title">{a.title}</div>
                        <div className="room-search-meta">
                          {a.year && <span>{a.year}</span>}
                          {rate > 0 && (
                            <span className="room-search-rate">
                              <StarIcon width={11} height={11} /> {rate.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {selectedAnime && (
              <div className="room-selected-anime">
                <div>
                  <b>{selectedAnime.title}</b>
                  <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>
                    {videoLoading
                      ? 'Загружаем серии...'
                      : kodikEpisodes.length
                        ? `Kodik-серий: ${kodikEpisodes.length}`
                        : 'Нет серий Kodik'}
                  </div>
                </div>
              </div>
            )}

            {kodikEpisodes.length > 0 && (
              <div className="room-episode-picker">
                {dubbings.length > 1 && (
                  <div className="control-group" style={{ maxWidth: 280 }}>
                    <div className="control-label">Озвучка</div>
                    <select className="select" value={selectedDub || ''} onChange={(e) => setSelectedDub(e.target.value)}>
                      {dubbings.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="control-group" style={{ flexBasis: '100%' }}>
                  <div className="control-label">Серия</div>
                  <div className="episode-grid">
                    {episodes.map((ep) => (
                      <button
                        key={String(ep.video_id)}
                        className={`ep-btn ${String(videoId) === String(ep.video_id) ? 'active' : ''}`}
                        type="button"
                        onClick={() => setVideoId(String(ep.video_id))}
                      >
                        {ep.number}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="btn btn-primary room-set-btn"
                  type="button"
                  onClick={pushVideoToRoom}
                  disabled={pushingVideo || !isHost}
                >
                  {pushingVideo ? 'Отправка...' : 'Поставить в комнату'}
                </button>
              </div>
            )}
          </div>

          <div className="room-members">
            <div className="control-label">
              <UsersIcon width={14} height={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Участники ({members.length})
            </div>
            <div className="room-members-list">
              {members.map((m) => (
                <div className="room-member" key={m.user?.id || m.id}>
                  <Avatar user={m.user} size={34} />
                  <div>
                    <div className="room-member-name">
                      {m.user?.username || 'Пользователь'}
                      {m.isHost ? ' (ведущий)' : m.isOwner ? ' (владелец)' : ''}
                    </div>
                    <div className="room-member-meta">{timeAgo(m.joinedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="room-chat">
          <h3>Чат комнаты</h3>
          <div className="room-chat-list">
            {messages.length === 0 ? (
              <div className="comment-empty">Сообщений пока нет.</div>
            ) : (
              messages.map((m) => (
                <div className="room-chat-item" key={m.id}>
                  <Avatar user={m.author} size={34} />
                  <div className="room-chat-body">
                    <div className="room-chat-top">
                      <span>{m.author?.username || 'Пользователь'}</span>
                      <span>{timeAgo(m.createdAt)}</span>
                    </div>
                    {m.body ? <div className="comment-text">{m.body}</div> : null}
                    {m.imageUrl ? (
                      <img
                        className="comment-image"
                        src={uploadUrl(m.imageUrl)}
                        alt="chat"
                        onClick={() => setLightbox(uploadUrl(m.imageUrl))}
                      />
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <form className="room-chat-form" onSubmit={sendChatMessage}>
            <textarea
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Написать сообщение..."
              maxLength={5000}
            />
            {attach && (
              <div className="attach-preview">
                <img src={attach.preview} alt="preview" />
                <button type="button" className="rm" onClick={clearAttach} aria-label="Удалить">
                  <CloseIcon width={13} height={13} />
                </button>
              </div>
            )}
            <div className="comment-attach-row">
              <button type="button" className="attach-btn" onClick={() => fileRef.current?.click()}>
                <ImageIcon width={14} height={14} /> Фото
              </button>
              <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp" onChange={pickFile} />
              <button className="btn btn-primary btn-sm" type="submit" disabled={sending || (!chatText.trim() && !attach)}>
                {uploading ? 'Загрузка...' : sending ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </form>
        </aside>
      </div>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}
