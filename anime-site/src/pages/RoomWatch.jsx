import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { BACKEND_ORIGIN, backend, getToken, uploadUrl } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import Lightbox from '../components/Lightbox.jsx'
import { ArrowLeft, CloseIcon, ImageIcon, UsersIcon, UserPlusIcon, PlayIcon } from '../components/icons.jsx'
import { sendPlayerCommand, subscribePlayerEvents } from '../utils/playerApi.js'
import Hls from 'hls.js'

function timeAgo(iso) {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'сейчас'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return d.toLocaleDateString('ru-RU')
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
  const videoRef = useRef(null)
  const socketRef = useRef(null)

  // ---- sync state ----
  const [clockSeconds, setClockSeconds] = useState(0)
  const [localPaused, setLocalPaused] = useState(true)
  const localTimeRef = useRef(0)
  const localPausedRef = useRef(true)
  const localTickAtRef = useRef(Date.now())
  const isHostRef = useRef(false)
  const suppressRef = useRef(0)
  const sendingRef = useRef(false)
  const lastSendRef = useRef(0)
  const heartbeatRef = useRef(null)
  const playerUnsubRef = useRef(null)

  useEffect(() => { isHostRef.current = isHost }, [isHost])
  useEffect(() => { localPausedRef.current = localPaused }, [localPaused])

  // ---- episode filtering ----
  const playerEpisodes = useMemo(() => {
    return (Array.isArray(animeVideos) ? animeVideos : [])
  }, [animeVideos])

  const episodes = useMemo(
    () => [...playerEpisodes].sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0)),
    [playerEpisodes]
  )

  const activeEpisode = useMemo(
    () => episodes.find((ep) => String(ep.id) === String(videoId)) || episodes[0] || null,
    [episodes, videoId]
  )

  const hlsRef = useRef(null)

  function loadIframeUrl(url) {
    if (!url) { setIframeSrc(''); return }
    setIframeSrc(url)
    if (iframeRef.current) iframeRef.current.src = url
  }

  // Init HLS.js for .m3u8 streams
  useEffect(() => {
    const video = videoRef.current
    if (!video || !iframeSrc?.includes('.m3u8')) return

    if (Hls.isSupported()) {
      const hls = new Hls()
      hls.loadSource(iframeSrc)
      hls.attachMedia(video)
      hlsRef.current = hls
      return () => { hls.destroy(); hlsRef.current = null }
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = iframeSrc
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    }
  }, [iframeSrc])

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
      } else if (snap.state.iframeUrl && (iframeRef.current?.contentWindow || videoRef.current)) {
        // Same URL — apply sync state to already-loaded player
        suppressRef.current = Date.now() + 1500
        const t = snap.state.currentTime || 0
        const p = !!snap.state.isPaused
        if (videoRef.current) {
          videoRef.current.currentTime = t
          if (p) videoRef.current.pause()
          else videoRef.current.play()
        } else {
          sendPlayerCommand(iframeRef, 'seekTo', Math.floor(t))
          sendPlayerCommand(iframeRef, p ? 'pause' : 'play')
        }
        localTimeRef.current = t
        localPausedRef.current = p
        localTickAtRef.current = Date.now()
        setLocalPaused(p)
        setClockSeconds(Math.floor(t))
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

  // ---- sync helpers ----
  const advanceLocalClock = useCallback(() => {
    const now = Date.now()
    if (!localPausedRef.current) {
      localTimeRef.current += Math.max(0, (now - localTickAtRef.current) / 1000)
    }
    localTickAtRef.current = now
  }, [])

  const sendState = useCallback(async (payload, force) => {
    if (!isHostRef.current || sendingRef.current) return
    if (!force && Date.now() - lastSendRef.current < 250) return
    sendingRef.current = true
    lastSendRef.current = Date.now()
    try {
      await backend.updateWatchRoomState(roomId, payload)
    } catch (err) {
      if (err.status === 404 || err.status === 403) {
        showToast('Комната была закрыта')
        navigate('/rooms')
      }
    } finally {
      sendingRef.current = false
    }
  }, [navigate, roomId, showToast])

  function togglePlayPause() {
    const video = videoRef.current
    const iframe = iframeRef.current
    const next = !localPausedRef.current

    if (video) {
      if (next) video.pause()
      else video.play()
    } else if (iframe) {
      suppressRef.current = Date.now() + 1500
      sendPlayerCommand(iframeRef, next ? 'pause' : 'play')
    }

    localPausedRef.current = next
    localTickAtRef.current = Date.now()
    setLocalPaused(next)
    const t = Math.floor(localTimeRef.current)
    sendState({ currentTime: t, isPaused: next }, true)
  }

  // Keep applySnapshot stable for socket
  const applySnapshotRef = useRef(applySnapshot)
  useEffect(() => { applySnapshotRef.current = applySnapshot }, [applySnapshot])

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

    socket.on('room:snapshot', (snap) => { applySnapshotRef.current(snap) })

    socket.on('room:state', (remote) => {
      if (isHostRef.current || !remote) return
      const targetTime = remote.currentTime || 0
      const targetPaused = !!remote.isPaused
      const drift = Math.abs(localTimeRef.current - targetTime)

      // HTML5 video: direct control
      if (videoRef.current) {
        const v = videoRef.current
        if (drift > 1) {
          suppressRef.current = Date.now() + 1500
          v.currentTime = targetTime
        }
        if (targetPaused !== localPausedRef.current) {
          suppressRef.current = Date.now() + 1500
          if (targetPaused) v.pause()
          else v.play()
          localPausedRef.current = targetPaused
          localTickAtRef.current = Date.now()
          setLocalPaused(targetPaused)
        }
      } else if (iframeRef.current) {
        if (drift > 1) {
          suppressRef.current = Date.now() + 1500
          sendPlayerCommand(iframeRef, 'seekTo', Math.floor(targetTime))
        }
        if (targetPaused !== localPausedRef.current) {
          suppressRef.current = Date.now() + 1500
          sendPlayerCommand(iframeRef, targetPaused ? 'pause' : 'play')
          localPausedRef.current = targetPaused
          localTickAtRef.current = Date.now()
          setLocalPaused(targetPaused)
        }
      }
      localTimeRef.current = targetTime
      localTickAtRef.current = Date.now()
      setClockSeconds(Math.floor(targetTime))
    })

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
  }, [navigate, roomId, showToast, user])

  // ---- Player events + sync ----
  const stateRef = useRef(null)
  useEffect(() => { stateRef.current = state }, [state])

  const isM3u8 = state?.iframeUrl?.includes('.m3u8')

  useEffect(() => {
    if (!state?.iframeUrl) return undefined
    setLocalPaused(true)
    localTimeRef.current = state.currentTime || 0
    localPausedRef.current = true
    localTickAtRef.current = Date.now()
    setClockSeconds(Math.floor(state.currentTime || 0))

    // HTML5 video events (AniLibria)
    if (isM3u8) {
      const video = videoRef.current
      if (!video) return undefined

      function onTimeUpdate() {
        const t = video.currentTime
        if (Date.now() < suppressRef.current) return
        localTimeRef.current = t
        localTickAtRef.current = Date.now()
        setClockSeconds(Math.floor(t))
      }
      function onPlayEvent() {
        localPausedRef.current = false
        localTickAtRef.current = Date.now()
        setLocalPaused(false)
        if (isHostRef.current) {
          sendState({ currentTime: Math.floor(video.currentTime), isPaused: false }, true)
        }
      }
      function onPauseEvent() {
        localPausedRef.current = true
        setLocalPaused(true)
        if (isHostRef.current) {
          sendState({ currentTime: Math.floor(video.currentTime), isPaused: true }, true)
        }
      }
      function onSeeked() {
        localTimeRef.current = video.currentTime
        localTickAtRef.current = Date.now()
        setClockSeconds(Math.floor(video.currentTime))
      }

      video.addEventListener('timeupdate', onTimeUpdate)
      video.addEventListener('play', onPlayEvent)
      video.addEventListener('pause', onPauseEvent)
      video.addEventListener('seeked', onSeeked)
      return () => {
        video.removeEventListener('timeupdate', onTimeUpdate)
        video.removeEventListener('play', onPlayEvent)
        video.removeEventListener('pause', onPauseEvent)
        video.removeEventListener('seeked', onSeeked)
      }
    }

    // PostMessage events (iframe/Kodik)
    const unsub = subscribePlayerEvents(iframeRef, (event) => {
      if (Date.now() < suppressRef.current) return

      if (event.type === 'time' && event.time !== undefined) {
        localTimeRef.current = event.time
        localTickAtRef.current = Date.now()
        setClockSeconds(Math.floor(event.time))
      } else if (event.type === 'play') {
        localPausedRef.current = false
        localTickAtRef.current = Date.now()
        setLocalPaused(false)
        if (isHostRef.current) {
          sendState({ currentTime: Math.floor(localTimeRef.current), isPaused: false }, true)
        }
      } else if (event.type === 'pause') {
        localPausedRef.current = true
        setLocalPaused(true)
        if (isHostRef.current) {
          sendState({ currentTime: Math.floor(localTimeRef.current), isPaused: true }, true)
        }
      } else if (event.type === 'seek' && event.time !== undefined) {
        localTimeRef.current = event.time
        localTickAtRef.current = Date.now()
        setClockSeconds(Math.floor(event.time))
      }
    })

    playerUnsubRef.current = unsub
    return () => { unsub(); playerUnsubRef.current = null }
  }, [isM3u8, sendState, state?.iframeUrl])

  // Host heartbeat every second while playing
  useEffect(() => {
    if (!isHost || !state?.iframeUrl) return undefined
    heartbeatRef.current = setInterval(() => {
      if (localPausedRef.current) return
      advanceLocalClock()
      sendState({ currentTime: Math.floor(localTimeRef.current), isPaused: false })
    }, 1000)
    return () => clearInterval(heartbeatRef.current)
  }, [advanceLocalClock, isHost, sendState, state?.iframeUrl])

  // Clock tick
  useEffect(() => {
    if (!state?.iframeUrl) return undefined
    const iv = setInterval(() => { advanceLocalClock(); setClockSeconds(Math.floor(localTimeRef.current)) }, 250)
    return () => clearInterval(iv)
  }, [advanceLocalClock, state?.iframeUrl])

  // ---- Cleanup ----
  useEffect(
    () => () => { if (attach?.preview) URL.revokeObjectURL(attach.preview) },
    [attach]
  )

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

  // ---- Actions ----
  async function runSearch(e) {
    e.preventDefault()
    const q = searchText.trim()
    if (!q) return
    setSearching(true)
    try {
      const res = await backend.searchAnilibria(q)
      setSearchResults(Array.isArray(res) ? res : [])
    } catch {
      setSearchResults([])
      showToast('Не удалось выполнить поиск')
    } finally {
      setSearching(false)
    }
  }

  async function pickAnime(release) {
    setSelectedAnime(release)
    setVideoLoading(true)
    setAnimeVideos([])
    try {
      const full = await backend.anilibriaRelease(release.id)
      const eps = Array.isArray(full?.episodes) ? full.episodes : []
      setAnimeVideos(eps)
      if (!eps.length) showToast('Нет эпизодов')
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
    if (!selectedAnime || !episode?.id) {
      showToast('Выберите серию для комнаты')
      return
    }

    // Get streaming URL from AniLibria
    setPushingVideo(true)
    try {
      const epData = await backend.anilibriaEpisode(episode.id)
      if (!epData?.hls_720 && !epData?.hls_1080) {
        showToast('Нет доступного стрима для этого эпизода')
        setPushingVideo(false)
        return
      }

      const streamUrl = epData.hls_720 || epData.hls_1080

      const payload = {
        animeId: selectedAnime.id,
        animeUrl: selectedAnime.alias || String(selectedAnime.id),
        animeTitle: selectedAnime.name?.main || selectedAnime.name || '',
        animePoster: (selectedAnime.poster?.optimized?.src || selectedAnime.poster?.src) || state?.animePoster || '',
        videoId: episode.id,
        episodeNumber: String(episode.ordinal || ''),
        dubbing: 'AniLibria',
        iframeUrl: streamUrl,
      }

      await backend.setWatchRoomVideo(roomId, payload)
      setVideoId(episode.id)
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
              state.iframeUrl.includes('.m3u8') ? (
                <video
                  ref={videoRef}
                  controls
                  style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 14 }}
                />
              ) : (
                <iframe
                  ref={iframeRef}
                  src={iframeSrc}
                  title="Room player — Kodik"
                  allowFullScreen
                  allow="autoplay; fullscreen; encrypted-media"
                />
              )
            ) : (
              <div className="state" style={{ padding: 20 }}>
                Выберите аниме и серию в блоке ниже.
              </div>
            )}
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={togglePlayPause}
              disabled={!state?.iframeUrl}
            >
              {localPaused ? (
                <><PlayIcon width={14} height={14} /> Запустить плеер</>
              ) : (
                'Пауза'
              )}
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>
              {isHost ? 'Вы ведущий' : `Ведущий: ${members.find((m) => m.isHost)?.user?.username || '—'}`}
              {state?.iframeUrl && ` · ${Math.floor(clockSeconds / 60)}:${String(Math.floor(clockSeconds % 60)).padStart(2, '0')}`}
            </span>
          </div>

          <div className="room-picker">
            <div className="control-label">Подобрать аниме</div>
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
                {searchResults.map((r) => {
                  const img = r.poster?.optimized?.src || r.poster?.src
                  return (
                    <button
                      key={r.id}
                      className={`room-search-item ${selectedAnime?.id === r.id ? 'active' : ''}`}
                      onClick={() => pickAnime(r)}
                      type="button"
                    >
                      <div className="room-search-poster">
                        {img ? <img src={img} alt="" /> : <div className="room-search-no-poster" />}
                      </div>
                      <div className="room-search-info">
                        <div className="room-search-title">{r.name?.main || r.name}</div>
                        <div className="room-search-meta">
                          {r.year && <span>{r.year}</span>}
                          {r.season?.value && <span>{r.season.value}</span>}
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
                  <b>{selectedAnime.name?.main || selectedAnime.name}</b>
                  <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>
                    {videoLoading
                      ? 'Загружаем серии...'
                      : playerEpisodes.length
                        ? `Доступно серий: ${playerEpisodes.length}`
                        : 'Нет доступных серий'}
                  </div>
                </div>
              </div>
            )}

            {playerEpisodes.length > 0 && (
              <div className="room-episode-picker">
                <div className="control-group" style={{ flexBasis: '100%' }}>
                  <div className="control-label">Серия</div>
                  <div className="episode-grid">
                    {episodes.map((ep) => (
                      <button
                        key={ep.id}
                        className={`ep-btn ${videoId === ep.id ? 'active' : ''}`}
                        type="button"
                        onClick={() => setVideoId(ep.id)}
                      >
                        {ep.ordinal}
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
