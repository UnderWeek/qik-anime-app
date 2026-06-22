import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { BACKEND_ORIGIN, backend, getToken, uploadUrl } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import Lightbox from '../components/Lightbox.jsx'
import { ArrowLeft, CloseIcon, ImageIcon, UsersIcon, UserPlusIcon, PlayIcon } from '../components/icons.jsx'
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
  const videoRef = useRef(null)
  const socketRef = useRef(null)
  const hlsRef = useRef(null)

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

  useEffect(() => { isHostRef.current = isHost }, [isHost])
  useEffect(() => { localPausedRef.current = localPaused }, [localPaused])

  const isM3u8 = state?.iframeUrl?.includes('.m3u8')

  // ---- episode filtering ----
  const playerEpisodes = useMemo(() => Array.isArray(animeVideos) ? animeVideos : [], [animeVideos])
  const episodes = useMemo(() => [...playerEpisodes].sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0)), [playerEpisodes])
  const activeEpisode = useMemo(() => episodes.find((ep) => String(ep.id) === String(videoId)) || episodes[0] || null, [episodes, videoId])

  // ---- HLS init ----
  useEffect(() => {
    const video = videoRef.current
    if (!video || !iframeSrc?.includes('.m3u8')) return
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }

    if (Hls.isSupported()) {
      const hls = new Hls()
      hls.loadSource(iframeSrc)
      hls.attachMedia(video)
      hlsRef.current = hls
      return () => { hls.destroy(); hlsRef.current = null }
    }
    video.src = iframeSrc
  }, [iframeSrc])

  // ---- applySnapshot ----
  const applySnapshot = useCallback((snap) => {
    if (!snap) return
    if (snap.room) {
      setRoom(snap.room)
      if (user && snap.room.hostId !== undefined) setIsHost(snap.room.hostId === user.id)
    }
    if (snap.state) {
      setState(snap.state)
      if (snap.state.iframeUrl && snap.state.iframeUrl !== iframeSrc) {
        setIframeSrc(snap.state.iframeUrl)
      } else if (snap.state.iframeUrl && videoRef.current) {
        suppressRef.current = Date.now() + 1500
        const t = snap.state.currentTime || 0
        const p = !!snap.state.isPaused
        videoRef.current.currentTime = t
        if (p) videoRef.current.pause(); else videoRef.current.play()
        localTimeRef.current = t; localPausedRef.current = p
        localTickAtRef.current = Date.now()
        setLocalPaused(p); setClockSeconds(Math.floor(t))
      }
    }
    if (Array.isArray(snap.members)) setMembers(snap.members)
    if (Array.isArray(snap.messages)) {
      const map = new Map(); snap.messages.forEach((m) => map.set(m.id, m))
      setMessages((prev) => { prev.forEach((m) => map.set(m.id, m)); return [...map.values()].sort((a, b) => a.id - b.id) })
    }
  }, [user, iframeSrc])

  // ---- loadRoom ----
  const loadRoom = useCallback(async () => {
    if (!user) { setLoading(false); return }
    if (!Number.isFinite(roomId)) { navigate('/rooms'); return }
    setLoading(true)
    try {
      const snap = await backend.watchRoom(roomId); applySnapshot(snap)
    } catch (err) {
      if (err.status === 403) {
        try { const snap = await backend.joinWatchRoomById(roomId); applySnapshot(snap); showToast('Вы присоединились'); setLoading(false); return } catch { showToast('Вы не в комнате') }
      } else if (err.status === 404) showToast('Комната не найдена')
      else showToast(err.message || 'Ошибка')
      navigate('/rooms')
    } finally { setLoading(false) }
  }, [applySnapshot, navigate, roomId, showToast, user])
  useEffect(() => { loadRoom() }, [loadRoom])

  // ---- sync helpers ----
  const advanceLocalClock = useCallback(() => {
    const now = Date.now()
    if (!localPausedRef.current) localTimeRef.current += Math.max(0, (now - localTickAtRef.current) / 1000)
    localTickAtRef.current = now
  }, [])

  const sendState = useCallback(async (payload, force) => {
    if (!isHostRef.current || sendingRef.current) return
    if (!force && Date.now() - lastSendRef.current < 250) return
    sendingRef.current = true; lastSendRef.current = Date.now()
    try { await backend.updateWatchRoomState(roomId, payload) }
    catch (err) { if (err.status === 404 || err.status === 403) { showToast('Комната закрыта'); navigate('/rooms') } }
    finally { sendingRef.current = false }
  }, [navigate, roomId, showToast])

  function togglePlayPause() {
    const video = videoRef.current; if (!video) return
    const next = !localPausedRef.current
    if (next) video.pause(); else video.play()
    localPausedRef.current = next; localTickAtRef.current = Date.now(); setLocalPaused(next)
    sendState({ currentTime: Math.floor(localTimeRef.current), isPaused: next }, true)
  }

  // ---- Player events ----
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isM3u8) return undefined

    function onTime() { const t = video.currentTime; if (Date.now() < suppressRef.current) return; localTimeRef.current = t; localTickAtRef.current = Date.now(); setClockSeconds(Math.floor(t)) }
    function onPlay() { localPausedRef.current = false; localTickAtRef.current = Date.now(); setLocalPaused(false); if (isHostRef.current) sendState({ currentTime: Math.floor(video.currentTime), isPaused: false }, true) }
    function onPause() { localPausedRef.current = true; setLocalPaused(true); if (isHostRef.current) sendState({ currentTime: Math.floor(video.currentTime), isPaused: true }, true) }
    function onSeek() { localTimeRef.current = video.currentTime; localTickAtRef.current = Date.now(); setClockSeconds(Math.floor(video.currentTime)); if (isHostRef.current) sendState({ currentTime: Math.floor(video.currentTime), isPaused: localPausedRef.current }, true) }

    video.addEventListener('timeupdate', onTime)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('seeked', onSeek)
    return () => { video.removeEventListener('timeupdate', onTime); video.removeEventListener('play', onPlay); video.removeEventListener('pause', onPause); video.removeEventListener('seeked', onSeek) }
  }, [isM3u8, sendState])

  // Host heartbeat
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

  const applySnapshotRef = useRef(applySnapshot)
  useEffect(() => { applySnapshotRef.current = applySnapshot }, [applySnapshot])

  // ---- Socket.IO ----
  useEffect(() => {
    if (!roomId || !user) return undefined
    const token = getToken(); if (!token) return undefined
    const socket = io(`${BACKEND_ORIGIN}/watch-rooms`, { path: '/api/socket.io', transports: ['websocket', 'polling'], auth: { token }, reconnection: true, reconnectionAttempts: Infinity })
    socketRef.current = socket
    socket.on('connect', () => { socket.emit('room:join', { roomId }) })
    socket.on('room:snapshot', (snap) => { applySnapshotRef.current(snap) })
    socket.on('room:state', (remote) => {
      if (isHostRef.current || !remote || !videoRef.current) return
      const targetTime = remote.currentTime || 0
      const targetPaused = !!remote.isPaused
      const drift = Math.abs(localTimeRef.current - targetTime)
      if (drift > 1.5) { suppressRef.current = Date.now() + 1500; videoRef.current.currentTime = targetTime }
      if (targetPaused !== localPausedRef.current) { suppressRef.current = Date.now() + 1500; if (targetPaused) videoRef.current.pause(); else videoRef.current.play(); localPausedRef.current = targetPaused; localTickAtRef.current = Date.now(); setLocalPaused(targetPaused) }
      localTimeRef.current = targetTime; localTickAtRef.current = Date.now(); setClockSeconds(Math.floor(targetTime))
    })
    socket.on('room:members', (p) => { if (Array.isArray(p?.members)) setMembers(p.members) })
    socket.on('room:message', (p) => { if (p) setMessages((prev) => { const m = new Map(); prev.forEach((x) => m.set(x.id, x)); m.set(p.id, p); return [...m.values()].sort((a, b) => a.id - b.id) }) })
    socket.on('room:closed', () => { showToast('Комната закрыта'); navigate('/rooms') })
    return () => { try { socket.emit('room:leave', { roomId }) } catch { } socket.disconnect(); socketRef.current = null }
  }, [navigate, roomId, showToast, user])

  // ---- Cleanup ----
  useEffect(() => () => { if (attach?.preview) URL.revokeObjectURL(attach.preview) }, [attach])

  // ---- Search & Episodes ----
  async function runSearch(e) { e.preventDefault(); const q = searchText.trim(); if (!q) return; setSearching(true); try { const res = await backend.searchAnilibria(q); setSearchResults(Array.isArray(res) ? res : []) } catch { setSearchResults([]); showToast('Ошибка поиска') } finally { setSearching(false) } }

  async function pickAnime(release) { setSelectedAnime(release); setVideoLoading(true); setAnimeVideos([]); try { const full = await backend.anilibriaRelease(release.id); setAnimeVideos(Array.isArray(full?.episodes) ? full.episodes : []); if (!full?.episodes?.length) showToast('Нет эпизодов') } catch { setAnimeVideos([]); showToast('Ошибка загрузки') } finally { setVideoLoading(false) } }

  async function pushEpisode(episode) {
    if (!isHost) { showToast('Только ведущий'); return }
    const streamUrl = episode.hls_720 || episode.hls_1080 || episode.hls_480
    if (!streamUrl) { showToast('Нет стрима'); return }
    setPushingVideo(true)
    try {
      await backend.setWatchRoomVideo(roomId, {
        animeId: selectedAnime.id, animeUrl: selectedAnime.alias || String(selectedAnime.id),
        animeTitle: selectedAnime.name?.main || '', animePoster: (selectedAnime.poster?.optimized?.src || selectedAnime.poster?.src) || '',
        videoId: episode.id, episodeNumber: String(episode.ordinal || ''), dubbing: 'AniLibria', iframeUrl: streamUrl,
      })
      setVideoId(episode.id); showToast('Поставлено')
    } catch (err) { showToast(err.message || 'Ошибка') } finally { setPushingVideo(false) }
  }

  async function pushVideoToRoom() { await pushEpisode(activeEpisode) }
  async function copyCode() { if (!room?.code) return; try { await navigator.clipboard.writeText(room.code); showToast('Код скопирован') } catch { showToast(`Код: ${room.code}`) } }
  async function toggleInvite() { const next = !inviteOpen; setInviteOpen(next); if (next && !friendsList.length) { try { const f = await backend.listFriends(); setFriendsList(Array.isArray(f) ? f : []) } catch { setFriendsList([]) } } }
  async function inviteFriend(targetId) { setInviting(targetId); try { await backend.inviteToRoom(roomId, targetId); showToast('Приглашение отправлено'); setInviteOpen(false) } catch (err) { showToast(err.message || 'Ошибка') } finally { setInviting(null) } }
  useEffect(() => { if (!inviteOpen) return; function onClick(e) { if (inviteRef.current && !inviteRef.current.contains(e.target)) setInviteOpen(false) } document.addEventListener('mousedown', onClick); return () => document.removeEventListener('mousedown', onClick) }, [inviteOpen])
  function pickFile(e) { const f = e.target.files?.[0]; if (!f) return; if (f.size > 8*1024*1024) { showToast('>8 МБ'); return } if (attach?.preview) URL.revokeObjectURL(attach.preview); setAttach({ file: f, preview: URL.createObjectURL(f) }) }
  function clearAttach() { if (attach?.preview) URL.revokeObjectURL(attach.preview); setAttach(null); if (fileRef.current) fileRef.current.value = '' }
  async function sendChatMessage(e) { e.preventDefault(); const b = chatText.trim(); if (!b && !attach) return; setSending(true); try { let iu; if (attach) { setUploading(true); const up = await backend.uploadImage(attach.file); iu = up?.url } const msg = await backend.sendWatchRoomMessage(roomId, { body: b, imageUrl: iu }); setMessages((prev) => { const m = new Map(); prev.forEach((x) => m.set(x.id, x)); m.set(msg.id, msg); return [...m.values()].sort((a, b) => a.id - b.id) }); setChatText(''); clearAttach() } catch (err) { showToast(err.message || 'Ошибка') } finally { setUploading(false); setSending(false) } }
  async function leaveRoom() { if (!confirm('Выйти?')) return; try { await backend.leaveWatchRoom(roomId) } catch { } finally { navigate('/rooms') } }
  async function closeRoom() { if (!confirm('Закрыть?')) return; try { await backend.closeWatchRoom(roomId); showToast('Закрыта') } catch (err) { showToast(err.message || 'Ошибка') } }

  // ---- Render ----
  if (!user) return (<div className="container page"><div className="state"><h2>Нужна авторизация</h2><p>Войдите чтобы зайти в комнату.</p><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => openAuth('login')}>Войти</button></div></div>)
  if (loading) return (<div className="container page"><div className="state"><p>Загрузка комнаты...</p></div></div>)

  return (
    <div className="container page">
      <div className="room-topbar">
        <Link to="/rooms" className="section-link room-back"><ArrowLeft width={14} height={14} /> Все комнаты</Link>
        <div className="room-top-actions">
          <button className="btn btn-ghost btn-sm" onClick={copyCode}>Код: {room?.code}</button>
          <div style={{ position: 'relative' }} ref={inviteRef}>
            <button className="btn btn-ghost btn-sm" onClick={toggleInvite}><UserPlusIcon width={14} height={14} /> Пригласить</button>
            {inviteOpen && (
              <div className="notif-menu room-invite-menu" style={{ right: 0, top: '100%', marginTop: 8, minWidth: 220 }}>
                <div className="notif-head"><b>Друзья</b></div>
                {friendsList.length === 0 ? <div className="notif-empty">Нет друзей</div> : (
                  <div className="notif-list" style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {friendsList.map((f) => {
                      const already = members.some((m) => m.user?.id === f.id)
                      return (<div key={f.id} className="notif-item" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar user={f} size={32} /><span>{f.username}</span></div>{already ? <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>В комнате</span> : <button className="btn btn-primary btn-sm" disabled={inviting === f.id} onClick={() => inviteFriend(f.id)} style={{ fontSize: 12 }}>{inviting === f.id ? '...' : 'Пригласить'}</button>}</div>)
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          {room?.ownerId === user.id ? <button className="btn btn-danger btn-sm" onClick={closeRoom}>Закрыть</button> : <button className="btn btn-ghost btn-sm" onClick={leaveRoom}>Выйти</button>}
        </div>
      </div>

      <div className="room-watch-grid">
        <section className="room-main">
          <div className="room-main-head"><h1>{state?.animeTitle || 'Выберите аниме'}</h1><div className="room-main-sub">{state?.episodeNumber ? `Серия ${state.episodeNumber}` : 'Серия не выбрана'}{state?.dubbing ? ` · ${state.dubbing}` : ''}</div></div>

          <div className="room-player-wrap player-wrap">
            {isM3u8 ? (
              <video ref={videoRef} controls playsInline style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 14 }} />
            ) : state?.iframeUrl ? (
              <iframe src={iframeSrc} title="Player" allowFullScreen allow="autoplay; fullscreen; encrypted-media" />
            ) : (
              <div className="state" style={{ padding: 20 }}>Выберите аниме и серию ниже.</div>
            )}
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={togglePlayPause} disabled={!state?.iframeUrl}>{localPaused ? <><PlayIcon width={14} height={14} /> Запустить</> : 'Пауза'}</button>
            <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{isHost ? 'Вы ведущий' : `Ведущий: ${members.find((m) => m.isHost)?.user?.username || '—'}`}{state?.iframeUrl && ` · ${Math.floor(clockSeconds / 60)}:${String(Math.floor(clockSeconds % 60)).padStart(2, '0')}`}</span>
          </div>

          <div className="room-picker">
            <div className="control-label">Подобрать аниме</div>
            {!isHost && <div className="room-viewer-hint">Управление плеером — только ведущий</div>}
            <form className="room-search-form" onSubmit={runSearch}><input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Название аниме" /><button className="btn btn-ghost btn-sm" type="submit" disabled={searching || !searchText.trim()}>{searching ? '...' : 'Найти'}</button></form>
            {!!searchResults.length && (
              <div className="room-search-results">
                {searchResults.map((r) => { const img = r.poster?.optimized?.src || r.poster?.src; return (<button key={r.id} className={`room-search-item ${selectedAnime?.id === r.id ? 'active' : ''}`} onClick={() => pickAnime(r)} type="button"><div className="room-search-poster">{img ? <img src={img} alt="" /> : <div className="room-search-no-poster" />}</div><div className="room-search-info"><div className="room-search-title">{r.name?.main || r.name}</div><div className="room-search-meta">{r.year && <span>{r.year}</span>}{r.season?.value && <span>{r.season.value}</span>}</div></div></button>) })}
              </div>
            )}
            {selectedAnime && (<div className="room-selected-anime"><div><b>{selectedAnime.name?.main || selectedAnime.name}</b><div style={{ color: 'var(--text-faint)', fontSize: 13 }}>{videoLoading ? 'Загружаем...' : playerEpisodes.length ? `Серий: ${playerEpisodes.length}` : 'Нет серий'}</div></div></div>)}
            {playerEpisodes.length > 0 && (
              <div className="room-episode-picker">
                <div className="control-group" style={{ flexBasis: '100%' }}><div className="control-label">Серия</div><div className="episode-grid">{episodes.map((ep) => (<button key={ep.id} className={`ep-btn ${videoId === ep.id ? 'active' : ''}`} type="button" onClick={() => setVideoId(ep.id)}>{ep.ordinal}</button>))}</div></div>
                <button className="btn btn-primary room-set-btn" type="button" onClick={pushVideoToRoom} disabled={pushingVideo || !isHost}>{pushingVideo ? '...' : 'Поставить в комнату'}</button>
              </div>
            )}
          </div>

          <div className="room-members"><div className="control-label"><UsersIcon width={14} height={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Участники ({members.length})</div><div className="room-members-list">{members.map((m) => (<div className="room-member" key={m.user?.id || m.id}><Avatar user={m.user} size={34} /><div><div className="room-member-name">{m.user?.username || 'Пользователь'}{m.isHost ? ' (ведущий)' : m.isOwner ? ' (владелец)' : ''}</div><div className="room-member-meta">{timeAgo(m.joinedAt)}</div></div></div>))}</div></div>
        </section>

        <aside className="room-chat"><h3>Чат комнаты</h3><div className="room-chat-list">{messages.length === 0 ? <div className="comment-empty">Сообщений пока нет.</div> : messages.map((m) => (<div className="room-chat-item" key={m.id}><Avatar user={m.author} size={34} /><div className="room-chat-body"><div className="room-chat-top"><span>{m.author?.username || 'Пользователь'}</span><span>{timeAgo(m.createdAt)}</span></div>{m.body ? <div className="comment-text">{m.body}</div> : null}{m.imageUrl ? <img className="comment-image" src={uploadUrl(m.imageUrl)} alt="" onClick={() => setLightbox(uploadUrl(m.imageUrl))} /> : null}</div></div>))}</div><form className="room-chat-form" onSubmit={sendChatMessage}><textarea value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Сообщение..." maxLength={5000} />{attach && <div className="attach-preview"><img src={attach.preview} alt="" /><button type="button" className="rm" onClick={clearAttach}><CloseIcon width={13} height={13} /></button></div>}<div className="comment-attach-row"><button type="button" className="attach-btn" onClick={() => fileRef.current?.click()}><ImageIcon width={14} height={14} /> Фото</button><input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp" onChange={pickFile} /><button className="btn btn-primary btn-sm" type="submit" disabled={sending || (!chatText.trim() && !attach)}>{uploading ? 'Загрузка...' : sending ? '...' : 'Отпр'}</button></div></form></aside>
      </div>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}
