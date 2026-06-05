import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, poster } from '../api/client.js'
import { backend, uploadUrl } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import Lightbox from '../components/Lightbox.jsx'
import { ArrowLeft, CloseIcon, ImageIcon, UsersIcon } from '../components/icons.jsx'

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
    try {
      return JSON.parse(payload)
    } catch {
      return null
    }
  }
  if (typeof payload === 'object') return payload
  return null
}

function withStartFrom(url, seconds = 0, syncTag = '') {
  if (!url) return ''
  const sec = Math.max(0, Math.floor(Number(seconds) || 0))
  try {
    const u = new URL(url)
    u.searchParams.set('start_from', String(sec))
    if (syncTag) u.searchParams.set('sync', syncTag)
    return u.toString()
  } catch {
    const sep = url.includes('?') ? '&' : '?'
    const sync = syncTag ? `&sync=${encodeURIComponent(syncTag)}` : ''
    return `${url}${sep}start_from=${sec}${sync}`
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

  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [selectedAnime, setSelectedAnime] = useState(null)
  const [animeVideos, setAnimeVideos] = useState([])
  const [videoLoading, setVideoLoading] = useState(false)
  const [dub, setDub] = useState(null)
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
  const suppressEventsUntilRef = useRef(0)
  const stateVersionRef = useRef(0)
  const membersVersionRef = useRef(0)
  const messageIdRef = useRef(0)
  const pollingRef = useRef(false)
  const sendStateRef = useRef(false)
  const lastPushAtRef = useRef(0)

  const isOwner = !!user && room?.ownerId === user.id

  const kodikVideos = useMemo(
    () =>
      (Array.isArray(animeVideos) ? animeVideos : []).filter((v) =>
        /kodik/i.test(v?.data?.player || v?.player || '')
      ),
    [animeVideos]
  )

  const dubbings = useMemo(() => {
    const seen = new Set()
    const list = []
    kodikVideos.forEach((v) => {
      const title = v?.data?.dubbing || 'Озвучка'
      if (seen.has(title)) return
      seen.add(title)
      list.push(title)
    })
    return list
  }, [kodikVideos])

  const episodes = useMemo(
    () =>
      kodikVideos
        .filter((v) => (v?.data?.dubbing || 'Озвучка') === dub)
        .sort((a, b) => (a.index || 0) - (b.index || 0)),
    [kodikVideos, dub]
  )

  const syncPlayerFromState = useCallback(
    (nextState, remoteActor = false) => {
      if (!nextState?.iframeUrl) return

      const currentVideoId = nextState.videoId || ''
      const videoChanged =
        currentVideoId !== videoRef.current ||
        nextState.iframeUrl !== iframeBaseRef.current

      if (videoChanged) {
        iframeBaseRef.current = nextState.iframeUrl
        videoRef.current = currentVideoId
        localTimeRef.current = Number(nextState.currentTime || 0)
        localPausedRef.current = !!nextState.isPaused
        suppressEventsUntilRef.current = Date.now() + 1800
        const url = withStartFrom(
          nextState.iframeUrl,
          nextState.currentTime,
          String(nextState.updatedAt || Date.now())
        )
        setIframeSrc(url)
        if (iframeRef.current) iframeRef.current.src = url
        return
      }

      if (!remoteActor) return
      const targetTime = Number(nextState.currentTime || 0)
      const delta = Math.abs(localTimeRef.current - targetTime)
      suppressEventsUntilRef.current = Date.now() + 1200

      const post = (payload) => {
        const win = iframeRef.current?.contentWindow
        if (!win) return
        try {
          win.postMessage(payload, '*')
        } catch {
          /* ignore */
        }
      }

      const command = (method, value) => {
        const base = { key: 'kodik_player_api', value: { method, value } }
        post(base)
        post(JSON.stringify(base))
      }

      if (delta > 6) {
        command('seek', targetTime)
        command('setCurrentTime', targetTime)
      }
      if (nextState.isPaused !== localPausedRef.current) {
        command(nextState.isPaused ? 'pause' : 'play')
      }
      if (delta > 18) {
        const url = withStartFrom(nextState.iframeUrl, nextState.currentTime, String(Date.now()))
        setIframeSrc(url)
        if (iframeRef.current) iframeRef.current.src = url
      }
      localTimeRef.current = targetTime
      localPausedRef.current = !!nextState.isPaused
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
        setState(snap.state)
        const fromRemote = !!user && snap.state.lastActorId != null && snap.state.lastActorId !== user.id
        syncPlayerFromState(snap.state, fromRemote)
      }
      if (Array.isArray(snap.members)) setMembers(snap.members)
      if (Array.isArray(snap.messages)) {
        setMessages((prev) => (replaceMessages ? snap.messages : mergeMessages(prev, snap.messages)))
      }
    },
    [syncPlayerFromState, user]
  )

  const sendState = useCallback(
    async (payload, immediate = false) => {
      if (!roomId || !user) return
      const now = Date.now()
      if (!immediate && now - lastPushAtRef.current < 1200) return
      if (sendStateRef.current && !immediate) return
      lastPushAtRef.current = now
      sendStateRef.current = true
      try {
        const res = await backend.updateWatchRoomState(roomId, payload)
        if (res?.stateVersion != null) stateVersionRef.current = res.stateVersion
        if (res?.state) setState(res.state)
      } catch (err) {
        if (err.status === 404) {
          showToast('Комната была закрыта')
          navigate('/rooms')
          return
        }
      } finally {
        sendStateRef.current = false
      }
    },
    [navigate, roomId, showToast, user]
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
    }, 1500)

    return () => window.clearInterval(timer)
  }, [applySnapshot, navigate, roomId, showToast, user])

  useEffect(() => {
    if (!state?.iframeUrl) {
      setIframeSrc('')
      return
    }
    if (!iframeSrc) {
      setIframeSrc(withStartFrom(state.iframeUrl, state.currentTime, String(state.updatedAt || Date.now())))
    }
  }, [iframeSrc, state?.currentTime, state?.iframeUrl, state?.updatedAt])

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
      const nextTime = Number(rawTime)

      if (key.includes('time') && Number.isFinite(nextTime)) {
        localTimeRef.current = Math.max(0, nextTime)
        sendState(
          {
            currentTime: localTimeRef.current,
            isPaused: localPausedRef.current,
          },
          false
        )
      }

      if (key.includes('pause')) {
        localPausedRef.current = true
        sendState(
          {
            currentTime: localTimeRef.current,
            isPaused: true,
          },
          true
        )
      }

      if (key.includes('play')) {
        localPausedRef.current = false
        sendState(
          {
            currentTime: localTimeRef.current,
            isPaused: false,
          },
          true
        )
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [sendState, state?.iframeUrl])

  useEffect(
    () => () => {
      if (attach?.preview) URL.revokeObjectURL(attach.preview)
    },
    [attach]
  )

  useEffect(() => {
    if (dubbings.length && !dub) setDub(dubbings[0])
  }, [dub, dubbings])

  useEffect(() => {
    if (episodes.length) {
      setVideoId((prev) =>
        episodes.some((v) => v.video_id === prev) ? prev : episodes[0].video_id
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
    try {
      const raw = await api.videos(anime.anime_id)
      const list = Array.isArray(raw) ? raw : []
      const kodikOnly = list.filter((v) =>
        /kodik/i.test(v?.data?.player || v?.player || '')
      )
      setAnimeVideos(kodikOnly)
      if (!kodikOnly.length) showToast('Для этого аниме нет серий в Kodik')
    } catch {
      setAnimeVideos([])
      showToast('Не удалось загрузить серии')
    } finally {
      setVideoLoading(false)
    }
  }

  async function pushAnimeToRoom() {
    if (!selectedAnime) return
    const episode = episodes.find((v) => v.video_id === videoId) || episodes[0]
    if (!episode?.iframe_url) {
      showToast('Выберите доступную серию Kodik')
      return
    }
    const payload = {
      animeId: selectedAnime.anime_id,
      animeUrl: selectedAnime.anime_url,
      animeTitle: selectedAnime.title,
      animePoster: poster(selectedAnime, 'big') || poster(selectedAnime, 'medium') || '',
      videoId: episode.video_id,
      episodeNumber: String(episode.number || episode.index || ''),
      dubbing: dub || episode?.data?.dubbing || '',
      iframeUrl: episode.iframe_url,
      currentTime: 0,
      isPaused: true,
    }
    try {
      const res = await backend.updateWatchRoomState(roomId, payload)
      if (res?.state) {
        stateVersionRef.current = res.stateVersion || stateVersionRef.current
        setState(res.state)
        syncPlayerFromState(res.state, false)
      }
      showToast('Плеер комнаты обновлен')
    } catch (err) {
      showToast(err.message || 'Не удалось обновить плеер')
    }
  }

  function callKodik(method, value) {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    const payload = { key: 'kodik_player_api', value: { method, value } }
    try {
      win.postMessage(payload, '*')
      win.postMessage(JSON.stringify(payload), '*')
    } catch {
      /* ignore */
    }
  }

  async function pauseToggle() {
    if (!state?.iframeUrl) return
    const paused = !localPausedRef.current
    localPausedRef.current = paused
    suppressEventsUntilRef.current = Date.now() + 1000
    callKodik(paused ? 'pause' : 'play')
    const time = localTimeRef.current || state.currentTime || 0
    await sendState({ currentTime: time, isPaused: paused }, true)
    setState((prev) => (prev ? { ...prev, currentTime: time, isPaused: paused } : prev))
  }

  async function shiftTime(delta) {
    if (!state?.iframeUrl) return
    const next = Math.max(0, Math.floor((localTimeRef.current || state.currentTime || 0) + delta))
    localTimeRef.current = next
    suppressEventsUntilRef.current = Date.now() + 1000
    callKodik('seek', next)
    callKodik('setCurrentTime', next)
    await sendState({ currentTime: next, isPaused: localPausedRef.current }, true)
    setState((prev) => (prev ? { ...prev, currentTime: next } : prev))
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

          <div className="player-wrap">
            {state?.iframeUrl ? (
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="Kodik room player"
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
            <button className="btn btn-ghost btn-sm" onClick={() => shiftTime(-10)} disabled={!state?.iframeUrl}>
              -10 сек
            </button>
            <button className="btn btn-primary btn-sm" onClick={pauseToggle} disabled={!state?.iframeUrl}>
              {localPausedRef.current ? 'Play' : 'Pause'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => shiftTime(10)} disabled={!state?.iframeUrl}>
              +10 сек
            </button>
            <span className="room-sync-tip">
              Синхронизация идет по времени и паузам через состояние комнаты.
            </span>
          </div>

          <div className="room-picker">
            <div className="control-label">Подобрать аниме (Kodik)</div>
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
                      ? 'Загружаем Kodik серии...'
                      : kodikVideos.length
                        ? `Найдено серий: ${kodikVideos.length}`
                        : 'Серии в Kodik не найдены'}
                  </div>
                </div>
              </div>
            )}

            {kodikVideos.length > 0 && (
              <div className="room-episode-picker">
                {dubbings.length > 1 && (
                  <div className="control-group" style={{ maxWidth: 280 }}>
                    <div className="control-label">Озвучка</div>
                    <select className="select" value={dub || ''} onChange={(e) => setDub(e.target.value)}>
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
                        key={ep.video_id}
                        className={`ep-btn ${videoId === ep.video_id ? 'active' : ''}`}
                        type="button"
                        onClick={() => setVideoId(ep.video_id)}
                      >
                        {ep.number}
                      </button>
                    ))}
                  </div>
                </div>

                <button className="btn btn-primary" type="button" onClick={pushAnimeToRoom}>
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
