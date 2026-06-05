import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, poster } from '../api/client.js'
import { backend, uploadUrl } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import Lightbox from '../components/Lightbox.jsx'
import { ArrowLeft, CloseIcon, ImageIcon, UsersIcon } from '../components/icons.jsx'

const POLL_MS = 1000
const HEARTBEAT_MS = 3000
const RELOAD_DRIFT_SECONDS = 4

function timeAgo(iso) {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'сейчас'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return d.toLocaleDateString('ru-RU')
}

function getPlayerName(v) {
  return (v?.data?.player || v?.player || 'Плеер').trim()
}

function getDubbingName(v) {
  return (v?.data?.dubbing || 'Озвучка').trim()
}

function parseMessagePayload(payload) {
  if (!payload) return null
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch {
      return null
    }
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

function buildSyncedIframeUrl(url, seconds = 0, isPaused = true, syncTag = '') {
  if (!url) return ''
  const sec = Math.floor(normalizeTime(seconds))
  try {
    const u = new URL(url)
    u.searchParams.set('start_from', String(sec))
    u.searchParams.set('start', String(sec))
    u.searchParams.set('t', String(sec))
    u.searchParams.set('time', String(sec))
    if (!isPaused) {
      u.searchParams.set('autoplay', '1')
      u.searchParams.set('autoPlay', 'true')
      u.searchParams.set('play', '1')
    }
    if (syncTag) u.searchParams.set('sync', syncTag)
    return u.toString()
  } catch {
    const sep = url.includes('?') ? '&' : '?'
    const sync = syncTag ? `&sync=${encodeURIComponent(syncTag)}` : ''
    const auto = isPaused ? '' : '&autoplay=1&play=1&autoPlay=true'
    return `${url}${sep}start_from=${sec}&start=${sec}&t=${sec}${auto}${sync}`
  }
}

function mergeMessages(prev, next) {
  if (!next?.length) return prev
  const map = new Map()
  prev.forEach((m) => map.set(m.id, m))
  next.forEach((m) => map.set(m.id, m))
  return [...map.values()].sort((a, b) => a.id - b.id)
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
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [selectedDub, setSelectedDub] = useState(null)
  const [videoId, setVideoId] = useState(null)

  const [chatText, setChatText] = useState('')
  const [attach, setAttach] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [lightbox, setLightbox] = useState(null)
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
  const sendingStateRef = useRef(false)
  const lastPushAtRef = useRef(0)
  const lastHeartbeatRef = useRef(0)

  const isOwner = !!user && room?.ownerId === user.id
  const iAmActor = !!user && state?.lastActorId === user.id

  const players = useMemo(() => {
    const seen = new Set()
    const out = []
    ;(Array.isArray(animeVideos) ? animeVideos : []).forEach((v) => {
      const playerName = getPlayerName(v)
      if (seen.has(playerName)) return
      seen.add(playerName)
      out.push(playerName)
    })
    return out
  }, [animeVideos])

  const dubbings = useMemo(() => {
    const seen = new Set()
    const out = []
    ;(Array.isArray(animeVideos) ? animeVideos : [])
      .filter((v) => getPlayerName(v) === selectedPlayer)
      .forEach((v) => {
        const dub = getDubbingName(v)
        if (seen.has(dub)) return
        seen.add(dub)
        out.push(dub)
      })
    return out
  }, [animeVideos, selectedPlayer])

  const episodes = useMemo(
    () =>
      (Array.isArray(animeVideos) ? animeVideos : [])
        .filter(
          (v) =>
            getPlayerName(v) === selectedPlayer &&
            getDubbingName(v) === selectedDub
        )
        .sort((a, b) => (a.index || 0) - (b.index || 0)),
    [animeVideos, selectedDub, selectedPlayer]
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

  const reloadIframe = useCallback((url, targetSeconds, isPaused, reason = '') => {
    if (!url) return
    const src = buildSyncedIframeUrl(url, targetSeconds, isPaused, `${Date.now()}-${reason}`)
    setIframeSrc(src)
    if (iframeRef.current) iframeRef.current.src = src
  }, [])

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
        iframeBaseRef.current = nextState.iframeUrl
        videoRef.current = nextVideoId
        reloadIframe(nextState.iframeUrl, targetTime, nextPaused, 'video')
      } else if (nextState.iframeUrl) {
        const drift = Math.abs(localTimeRef.current - targetTime)
        const pauseChanged = nextPaused !== localPausedRef.current
        if (forceReload || (remoteUpdate && (pauseChanged || drift > RELOAD_DRIFT_SECONDS))) {
          reloadIframe(nextState.iframeUrl, targetTime, nextPaused, 'state')
        }
      }

      localTimeRef.current = targetTime
      localPausedRef.current = nextPaused
      localTickAtRef.current = Date.now()
      setClockSeconds(Math.floor(targetTime))
      setState(nextState)
    },
    [reloadIframe]
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
    if (!user) {
      setLoading(false)
      return
    }
    if (!Number.isFinite(roomId)) {
      navigate('/rooms')
      return
    }

    setLoading(true)
    try {
      const snap = await backend.watchRoom(roomId)
      applySnapshot(snap, true)
    } catch (err) {
      if (err.status === 403) showToast('Вы не состоите в этой комнате')
      else if (err.status === 404) showToast('Комната не найдена')
      else showToast(err.message || 'Ошибка загрузки комнаты')
      navigate('/rooms')
    } finally {
      setLoading(false)
    }
  }, [applySnapshot, navigate, roomId, showToast, user])

  useEffect(() => {
    loadRoom()
  }, [loadRoom])

  useEffect(() => {
    if (!roomId || !user) return undefined
    const timer = window.setInterval(async () => {
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      advanceLocalClock()
      const rounded = Math.floor(localTimeRef.current)
      setClockSeconds((prev) => (prev === rounded ? prev : rounded))

      if (!user || localPausedRef.current || state?.lastActorId !== user.id) return
      if (Date.now() - lastHeartbeatRef.current < HEARTBEAT_MS) return
      lastHeartbeatRef.current = Date.now()
      sendState(
        {
          currentTime: Math.floor(localTimeRef.current),
          isPaused: false,
        },
        false
      )
    }, 1000)

    return () => window.clearInterval(timer)
  }, [advanceLocalClock, sendState, state?.lastActorId, user])

  useEffect(() => {
    if (!state?.iframeUrl) {
      setIframeSrc('')
      return
    }
    if (!iframeSrc) {
      reloadIframe(state.iframeUrl, expectedRoomTime(state), !!state.isPaused, 'init')
    }
  }, [iframeSrc, reloadIframe, state])

  useEffect(() => {
    function onMessage(event) {
      const frame = iframeRef.current
      if (!frame?.contentWindow || event.source !== frame.contentWindow) return
      if (!state?.iframeUrl) return
      if (Date.now() < suppressEventsUntilRef.current) return
      const payload = parseMessagePayload(event.data)
      if (!payload) return

      const key = String(payload.key || payload.type || payload.event || '').toLowerCase()
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

      if (key.includes('pause')) {
        localPausedRef.current = true
        if (iAmActor) {
          sendState(
            {
              currentTime: Math.floor(localTimeRef.current),
              isPaused: true,
            },
            true
          )
        }
      }

      if (key.includes('play')) {
        localPausedRef.current = false
        localTickAtRef.current = Date.now()
        if (iAmActor) {
          sendState(
            {
              currentTime: Math.floor(localTimeRef.current),
              isPaused: false,
            },
            true
          )
        }
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [iAmActor, sendState, state?.iframeUrl])

  useEffect(
    () => () => {
      if (attach?.preview) URL.revokeObjectURL(attach.preview)
    },
    [attach]
  )

  useEffect(() => {
    if (players.length && !selectedPlayer) setSelectedPlayer(players[0])
  }, [players, selectedPlayer])

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
      setAnimeVideos(list)
      if (!list.length) showToast('Для этого аниме нет доступных плееров')
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

    const playerName = getPlayerName(activeEpisode)
    const dubName = getDubbingName(activeEpisode)

    const payload = {
      animeId: selectedAnime.anime_id,
      animeUrl: selectedAnime.anime_url,
      animeTitle: selectedAnime.title,
      animePoster: poster(selectedAnime, 'big') || poster(selectedAnime, 'medium') || '',
      videoId: String(activeEpisode.video_id || ''),
      episodeNumber: String(activeEpisode.number || activeEpisode.index || ''),
      dubbing: `${playerName}${dubName ? ` · ${dubName}` : ''}`,
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
      showToast('Плеер комнаты обновлен')
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

    const nextState = {
      ...state,
      currentTime: syncTime,
      isPaused: nextPaused,
      lastActorId: user?.id ?? state.lastActorId,
      updatedAt: new Date().toISOString(),
    }
    applyState(nextState, 'self', { forceReload: true })
    await sendState(
      {
        currentTime: syncTime,
        isPaused: nextPaused,
      },
      true
    )
  }

  async function syncNow() {
    if (!state?.iframeUrl) return
    advanceLocalClock()
    reloadIframe(state.iframeUrl, localTimeRef.current, localPausedRef.current, 'manual')
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

  function pickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      showToast('Файл больше 8 МБ')
      return
    }
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
    try {
      await backend.leaveWatchRoom(roomId)
    } catch {
      /* ignore */
    } finally {
      navigate('/rooms')
    }
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
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => openAuth('login')}>
            Войти
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container page">
        <div className="state">
          <p>Загрузка комнаты...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <div className="room-topbar">
        <Link to="/rooms" className="section-link room-back">
          <ArrowLeft width={14} height={14} />
          Все комнаты
        </Link>
        <div className="room-top-actions">
          <button className="btn btn-ghost btn-sm" onClick={copyCode}>
            Код: {room?.code}
          </button>
          {isOwner ? (
            <button className="btn btn-danger btn-sm" onClick={closeRoom}>
              Закрыть комнату
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={leaveRoom}>
              Выйти
            </button>
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
                title="Room player"
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media"
              />
            ) : (
              <div className="state" style={{ padding: 20 }}>
                Выберите аниме и серию в блоке ниже.
              </div>
            )}
          </div>

          <div className="room-player-controls">
            <button className="btn btn-primary btn-sm" onClick={pauseToggle} disabled={!state?.iframeUrl}>
              {localPausedRef.current ? 'Play в комнате' : 'Pause в комнате'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={syncNow} disabled={!state?.iframeUrl}>
              Синхронизировать сейчас
            </button>
            <span className="room-sync-tip">
              Время комнаты: {clockSeconds} сек. Синхронизация работает для любых плееров, при расхождении плеер может перезагружаться.
            </span>
          </div>

          <div className="room-picker">
            <div className="control-label">Подобрать аниме (любой плеер)</div>
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
                      : animeVideos.length
                        ? `Найдено серий: ${animeVideos.length}`
                        : 'Серии не найдены'}
                  </div>
                </div>
              </div>
            )}

            {animeVideos.length > 0 && (
              <div className="room-episode-picker">
                {players.length > 1 && (
                  <div className="control-group" style={{ maxWidth: 280 }}>
                    <div className="control-label">Плеер</div>
                    <select className="select" value={selectedPlayer || ''} onChange={(e) => setSelectedPlayer(e.target.value)}>
                      {players.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {dubbings.length > 1 && (
                  <div className="control-group" style={{ maxWidth: 280 }}>
                    <div className="control-label">Озвучка</div>
                    <select className="select" value={selectedDub || ''} onChange={(e) => setSelectedDub(e.target.value)}>
                      {dubbings.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
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
              <input
                ref={fileRef}
                type="file"
                hidden
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={pickFile}
              />
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
