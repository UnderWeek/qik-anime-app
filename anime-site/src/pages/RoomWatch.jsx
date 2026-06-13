import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { api, poster } from '../api/client.js'
import { BACKEND_ORIGIN, backend, getToken, uploadUrl } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import Lightbox from '../components/Lightbox.jsx'
import { ArrowLeft, CloseIcon, ImageIcon, UsersIcon, UserPlusIcon, PlayIcon } from '../components/icons.jsx'

const POLL_MS = 1000
const HEARTBEAT_MS = 3000
const BIG_DRIFT_SECONDS = 25

function timeAgo(iso) {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'сейчас'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return d.toLocaleDateString('ru-RU')
}

function parseMessagePayload(payload) {
  if (!payload) return null
  if (typeof payload === 'string') {
    try { return JSON.parse(payload) } catch { return null }
  }
  if (typeof payload === 'object') return payload
  return null
}

function parseIsoMs(value) {
  const ms = Date.parse(value || '')
  return Number.isFinite(ms) ? ms : 0
}

function normalizeTime(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, n)
}

function expectedRoomTime(nextState) {
  const base = normalizeTime(nextState?.currentTime)
  if (!nextState || nextState.isPaused) return base
  const updatedAt = parseIsoMs(nextState.updatedAt)
  if (!updatedAt) return base
  const elapsed = Math.max(0, (Date.now() - updatedAt) / 1000)
  return base + elapsed
}

function mergeMessages(prev, next) {
  if (!next?.length) return prev
  const map = new Map()
  prev.forEach((m) => map.set(m.id, m))
  next.forEach((m) => map.set(m.id, m))
  return [...map.values()].sort((a, b) => a.id - b.id)
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
  const [clockSeconds, setClockSeconds] = useState(0)

  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [selectedAnime, setSelectedAnime] = useState(null)
  const [animeVideos, setAnimeVideos] = useState([])
  const [videoLoading, setVideoLoading] = useState(false)
  const [selectedDub, setSelectedDub] = useState(null)
  const [videoId, setVideoId] = useState(null)

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
  const iframeBaseRef = useRef('')
  const videoRef = useRef('')
  const localTimeRef = useRef(0)
  const localPausedRef = useRef(true)
  const localTickAtRef = useRef(Date.now())
  const suppressEventsUntilRef = useRef(0)
  const stateVersionRef = useRef(0)
  const membersVersionRef = useRef(0)
  const messageIdRef = useRef(0)
  const pollingRef = useRef(false)
  const socketConnectedRef = useRef(false)
  const socketRef = useRef(null)
  const sendingStateRef = useRef(false)
  const lastPushAtRef = useRef(0)
  const lastHeartbeatRef = useRef(0)
  const lastPlaySignalRef = useRef(0)
  const kodikReadyTimerRef = useRef(null)

  const isOwner = !!user && room?.ownerId === user.id

  // Filter to Kodik-only episodes
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

  const advanceLocalClock = useCallback(() => {
    const now = Date.now()
    if (!localPausedRef.current) {
      const delta = Math.max(0, (now - localTickAtRef.current) / 1000)
      localTimeRef.current += delta
    }
    localTickAtRef.current = now
  }, [])

  function sendKodikCommand(method, value) {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    const payload = { key: 'kodik_player_api', value: { method, value } }
    try {
      win.postMessage(payload, '*')
      win.postMessage(JSON.stringify(payload), '*')
    } catch { /* ignore */ }
  }

  function onIframeLoad() {
    if (kodikReadyTimerRef.current) clearTimeout(kodikReadyTimerRef.current)
    kodikReadyTimerRef.current = setTimeout(() => {
      advanceLocalClock()
      const t = Math.floor(localTimeRef.current)
      if (t > 0) sendKodikCommand('seek', t)
      if (localPausedRef.current) {
        sendKodikCommand('pause')
      } else {
        sendKodikCommand('play')
      }
    }, 1200)
  }

  const applyState = useCallback(
    (nextState, source = 'remote', opts = {}) => {
      if (!nextState) return

      const targetTime = expectedRoomTime(nextState)
      const nextPaused = !!nextState.isPaused
      const nextVideoId = String(nextState.videoId || '')
      const forceReload = !!opts.forceReload
      const remoteUpdate = source === 'remote'
      const sameVideo =
        nextVideoId === videoRef.current &&
        nextState.iframeUrl === iframeBaseRef.current

      if (!sameVideo && nextState.iframeUrl) {
        // New video — set the Kodik iframe (onLoad will seek+play/pause)
        iframeBaseRef.current = nextState.iframeUrl
        videoRef.current = nextVideoId
        const url = nextState.iframeUrl
        setIframeSrc(url)
        if (iframeRef.current) iframeRef.current.src = url
      } else if (nextState.iframeUrl) {
        const drift = Math.abs(localTimeRef.current - targetTime)
        const pauseChanged = nextPaused !== localPausedRef.current

        if (forceReload) {
          // Force reload — onLoad will handle seek+play/pause
          const url = nextState.iframeUrl
          setIframeSrc(url)
          if (iframeRef.current) iframeRef.current.src = url
        } else if (remoteUpdate) {
          // Fire-and-forget via Kodik postMessage API
          suppressEventsUntilRef.current = Date.now() + 900
          if (drift > 2) {
            sendKodikCommand('seek', Math.floor(targetTime))
          }
          if (pauseChanged) {
            sendKodikCommand(nextPaused ? 'pause' : 'play')
          }
          // Big drift or no pause change but big time gap — reload
          if (drift > BIG_DRIFT_SECONDS) {
            const url = nextState.iframeUrl
            setIframeSrc(url)
            if (iframeRef.current) iframeRef.current.src = url
          }
        }
      }

      localTimeRef.current = targetTime
      localPausedRef.current = nextPaused
      localTickAtRef.current = Date.now()
      setClockSeconds(Math.floor(targetTime))
      setState(nextState)
    },
    []
  )

  const applySnapshot = useCallback(
    (snap, replaceMessages = false) => {
      if (!snap) return
      if (typeof snap.stateVersion === 'number') stateVersionRef.current = snap.stateVersion
      if (typeof snap.membersVersion === 'number') membersVersionRef.current = snap.membersVersion
      if (typeof snap.lastMessageId === 'number') messageIdRef.current = snap.lastMessageId

      if (snap.room) setRoom(snap.room)
      if (snap.state) {
        const source =
          user && snap.state.lastActorId != null && snap.state.lastActorId === user.id
            ? 'self'
            : 'remote'
        applyState(snap.state, source)
      }
      if (Array.isArray(snap.members)) setMembers(snap.members)
      if (Array.isArray(snap.messages)) {
        setMessages((prev) => (replaceMessages ? snap.messages : mergeMessages(prev, snap.messages)))
      }
    },
    [applyState, user]
  )

  const sendState = useCallback(
    async (payload, immediate = false) => {
      if (!roomId || !user) return null
      const now = Date.now()
      if (!immediate && now - lastPushAtRef.current < 900) return null
      if (!immediate && sendingStateRef.current) return null
      sendingStateRef.current = true
      lastPushAtRef.current = now

      try {
        const res = await backend.updateWatchRoomState(roomId, payload)
        if (typeof res?.stateVersion === 'number') stateVersionRef.current = res.stateVersion
        if (res?.state) applyState(res.state, 'self')
        return res?.state || null
      } catch (err) {
        if (err.status === 404) {
          showToast('Комната была закрыта')
          navigate('/rooms')
        }
        return null
      } finally {
        sendingStateRef.current = false
      }
    },
    [applyState, navigate, roomId, showToast, user]
  )

  const loadRoom = useCallback(async () => {
    if (!user) { setLoading(false); return }
    if (!Number.isFinite(roomId)) { navigate('/rooms'); return }

    setLoading(true)
    try {
      const snap = await backend.watchRoom(roomId)
      applySnapshot(snap, true)
    } catch (err) {
      if (err.status === 403) {
        // Try auto-join (invite link)
        try {
          const snap = await backend.joinWatchRoomById(roomId)
          applySnapshot(snap, true)
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

  // Socket.IO connection
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
      socketConnectedRef.current = true
      socket.emit('room:join', { roomId })
    })

    socket.on('disconnect', () => { socketConnectedRef.current = false })

    socket.on('room:snapshot', (snap) => { applySnapshot(snap, false) })

    socket.on('room:state', (payload) => {
      if (typeof payload?.stateVersion === 'number') stateVersionRef.current = payload.stateVersion
      if (payload?.state) {
        const source =
          user && payload.state.lastActorId != null && payload.state.lastActorId === user.id
            ? 'self' : 'remote'
        applyState(payload.state, source)
      }
    })

    socket.on('room:members', (payload) => {
      if (typeof payload?.membersVersion === 'number') membersVersionRef.current = payload.membersVersion
      if (Array.isArray(payload?.members)) setMembers(payload.members)
    })

    socket.on('room:message', (payload) => {
      if (typeof payload?.lastMessageId === 'number') messageIdRef.current = payload.lastMessageId
      if (payload?.message) setMessages((prev) => mergeMessages(prev, [payload.message]))
    })

    socket.on('room:closed', () => {
      showToast('Комната закрыта')
      navigate('/rooms')
    })

    return () => {
      socketConnectedRef.current = false
      try { socket.emit('room:leave', { roomId }) } catch { /* ignore */ }
      socket.disconnect()
      socketRef.current = null
    }
  }, [applySnapshot, applyState, navigate, roomId, showToast, user])

  // HTTP polling fallback
  useEffect(() => {
    if (!roomId || !user) return undefined
    const timer = window.setInterval(async () => {
      if (socketConnectedRef.current) return
      if (pollingRef.current) return
      pollingRef.current = true
      try {
        const delta = await backend.watchRoomSync(roomId, {
          stateVersion: stateVersionRef.current,
          membersVersion: membersVersionRef.current,
          messageId: messageIdRef.current,
        })
        applySnapshot(delta, false)
      } catch (err) {
        if (err.status === 404) {
          showToast('Комната была закрыта')
          navigate('/rooms')
        }
      } finally {
        pollingRef.current = false
      }
    }, POLL_MS)

    return () => window.clearInterval(timer)
  }, [applySnapshot, navigate, roomId, showToast, user])

  // Heartbeat: periodically push local time to server while playing
  useEffect(() => {
    if (!isOwner) return undefined
    const timer = window.setInterval(() => {
      advanceLocalClock()
      const rounded = Math.floor(localTimeRef.current)
      setClockSeconds((prev) => (prev === rounded ? prev : rounded))

      if (localPausedRef.current) return
      if (Date.now() - lastHeartbeatRef.current < HEARTBEAT_MS) return
      lastHeartbeatRef.current = Date.now()
      sendState({ currentTime: Math.floor(localTimeRef.current), isPaused: false }, false)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [advanceLocalClock, isOwner, sendState])

  // Init iframe when state has a URL
  useEffect(() => {
    if (!state?.iframeUrl) { setIframeSrc(''); return }
    if (!iframeSrc) {
      const url = state.iframeUrl
      iframeBaseRef.current = url
      setIframeSrc(url)
      if (iframeRef.current) iframeRef.current.src = url
    }
  }, [iframeSrc, state])

  // Listen for Kodik postMessage events (time updates for owner only)
  useEffect(() => {
    function onMessage(event) {
      const frame = iframeRef.current
      if (!frame?.contentWindow || event.source !== frame.contentWindow) return
      if (!state?.iframeUrl) return
      if (Date.now() < suppressEventsUntilRef.current) return

      const payload = parseMessagePayload(event.data)
      if (!payload) return

      const key = String(payload.key || payload.type || payload.event || '').toLowerCase()

      // Time update from Kodik
      const rawTime =
        payload.value?.time ??
        payload.value?.currentTime ??
        payload.value ??
        payload.currentTime ??
        payload.time
      const maybeTime = Number(rawTime)
      if (Number.isFinite(maybeTime)) {
        localTimeRef.current = Math.max(0, maybeTime)
        localTickAtRef.current = Date.now()
      }

      // Pause/Play events — only owner pushes to server
      if (key.includes('pause')) {
        localPausedRef.current = true
        if (isOwner) {
          sendState({ currentTime: Math.floor(localTimeRef.current), isPaused: true }, true)
        }
      }

      if (key.includes('play') && !key.includes('isplaying')) {
        localPausedRef.current = false
        localTickAtRef.current = Date.now()
        if (isOwner) {
          sendState({ currentTime: Math.floor(localTimeRef.current), isPaused: false }, true)
        }
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isOwner, sendState, state?.iframeUrl])

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

  async function pushAnimeToRoom() {
    if (!selectedAnime || !activeEpisode?.iframe_url) {
      showToast('Выберите серию для комнаты')
      return
    }

    const dubName = activeEpisode.data?.dubbing || 'Озвучка'

    const payload = {
      animeId: selectedAnime.anime_id,
      animeUrl: selectedAnime.anime_url,
      animeTitle: selectedAnime.title,
      animePoster: animePosterUrl(selectedAnime),
      videoId: String(activeEpisode.video_id || ''),
      episodeNumber: String(activeEpisode.number || activeEpisode.index || ''),
      dubbing: dubName,
      iframeUrl: activeEpisode.iframe_url,
      currentTime: 0,
      isPaused: true,
    }

    try {
      const res = await backend.updateWatchRoomState(roomId, payload)
      if (res?.state) {
        stateVersionRef.current = res.stateVersion || stateVersionRef.current
        applyState(res.state, 'self', { forceReload: true })
      }
      showToast('Плеер комнаты обновлён')
    } catch (err) {
      showToast(err.message || 'Не удалось обновить плеер')
    }
  }

  async function pauseToggle() {
    if (!state?.iframeUrl) return

    advanceLocalClock()
    const nextPaused = !localPausedRef.current
    const syncTime = Math.floor(localTimeRef.current)
    localPausedRef.current = nextPaused
    localTickAtRef.current = Date.now()
    suppressEventsUntilRef.current = Date.now() + 1000

    // Send command to Kodik player
    sendKodikCommand(nextPaused ? 'pause' : 'play')

    // Update local UI immediately
    setState((prev) => (prev ? { ...prev, currentTime: syncTime, isPaused: nextPaused, updatedAt: new Date().toISOString() } : prev))

    // Update server
    await sendState({ currentTime: syncTime, isPaused: nextPaused }, true)
  }

  async function syncNow() {
    if (!state?.iframeUrl) return
    advanceLocalClock()
    const t = Math.floor(localTimeRef.current)
    sendKodikCommand('seek', t)
    sendKodikCommand(localPausedRef.current ? 'pause' : 'play')
    showToast('Синхронизировано')
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

  // Close invite on outside click
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
      setMessages((prev) => mergeMessages(prev, [msg]))
      if (msg?.id) messageIdRef.current = Math.max(messageIdRef.current, msg.id)
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
          {isOwner ? (
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
                onLoad={onIframeLoad}
              />
            ) : (
              <div className="state" style={{ padding: 20 }}>
                Выберите аниме и серию в блоке ниже.
              </div>
            )}
          </div>

          <div className="room-player-controls">
            <button className="btn btn-primary btn-sm" onClick={pauseToggle} disabled={!state?.iframeUrl}>
              {state?.isPaused ? (
                <><PlayIcon width={14} height={14} /> Play в комнате</>
              ) : (
                'Pause в комнате'
              )}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={syncNow} disabled={!state?.iframeUrl}>
              Синхронизировать сейчас
            </button>
            <span className="room-sync-tip">
              Время комнаты: {clockSeconds} сек. Синхронизация через Kodik API — управление плеером без перезагрузки.
            </span>
          </div>

          <div className="room-picker">
            <div className="control-label">Подобрать аниме (только Kodik)</div>
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
                {searchResults.map((a) => (
                  <button
                    key={a.anime_id || a.anime_url}
                    className={`room-search-item ${selectedAnime?.anime_id === a.anime_id ? 'active' : ''}`}
                    onClick={() => pickAnime(a)}
                    type="button"
                  >
                    {a.title}
                  </button>
                ))}
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

                <button className="btn btn-primary room-set-btn" type="button" onClick={pushAnimeToRoom}>
                  Поставить в комнату
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
                      {m.isOwner ? ' (владелец)' : ''}
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
