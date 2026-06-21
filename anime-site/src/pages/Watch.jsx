import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi.js'
import { api, poster } from '../api/client.js'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ArrowLeft, CheckIcon, TrashIcon } from '../components/icons.jsx'
import SEO from '../components/SEO.jsx'

export default function Watch() {
  const { url } = useParams()
  const [searchParams] = useSearchParams()
  const resumeEp = searchParams.get('ep') // episode number from "continue watching"
  const navigate = useNavigate()
  const { user, openAuth, showToast } = useAuth()
  const { data: anime } = useApi(() => api.anime(url), [url])
  const animeId = anime?.anime_id

  const { data: videos, loading, error } = useApi(
    () => (animeId ? api.videos(animeId) : Promise.resolve(null)),
    [animeId]
  )

  const list = Array.isArray(videos) ? videos : []

  const dubbings = useMemo(() => {
    const set = []
    const seen = new Set()
    list.forEach((v) => {
      const d = v.data?.dubbing || 'Озвучка'
      if (!seen.has(d)) {
        seen.add(d)
        set.push(d)
      }
    })
    return set
  }, [list])

  const [dub, setDub] = useState(null)
  const [player, setPlayer] = useState(null)
  const [epIndex, setEpIndex] = useState(null)
  const [watched, setWatched] = useState({}) // episodeNumber -> row
  const [creatingRoom, setCreatingRoom] = useState(false)
  const savedRef = useRef({})

  useEffect(() => {
    if (dubbings.length && !dub) setDub(dubbings[0])
  }, [dubbings, dub])

  const players = useMemo(() => {
    const out = []
    const seen = new Set()
    list
      .filter((v) => (v.data?.dubbing || 'Озвучка') === dub)
      .forEach((v) => {
        const p = v.data?.player || 'Плеер'
        if (!seen.has(p)) {
          seen.add(p)
          out.push(p)
        }
      })
    return out
  }, [list, dub])

  useEffect(() => {
    if (players.length) setPlayer((prev) => (players.includes(prev) ? prev : players[0]))
  }, [players])

  const episodes = useMemo(() => {
    return list
      .filter((v) => (v.data?.dubbing || 'Озвучка') === dub && (v.data?.player || 'Плеер') === player)
      .sort((a, b) => (a.index || 0) - (b.index || 0))
  }, [list, dub, player])

  // load watched markers for this anime
  useEffect(() => {
    if (!user || !animeId) {
      setWatched({})
      savedRef.current = {}
      return
    }
    backend
      .progressForAnime(animeId)
      .then((res) => {
        const map = {}
        ;(res.episodes || []).forEach((e) => {
          map[e.episodeNumber] = e
        })
        setWatched(map)
        savedRef.current = map
      })
      .catch(() => {})
  }, [user, animeId])

  useEffect(() => {
    if (episodes.length) {
      // Prefer the episode from "continue watching" query param
      const target = resumeEp && episodes.find((e) => String(e.number) === resumeEp)
      if (target) {
        setEpIndex(target.video_id)
      } else {
        setEpIndex((prev) => (episodes.some((e) => e.video_id === prev) ? prev : episodes[0].video_id))
      }
    } else {
      setEpIndex(null)
    }
  }, [episodes, resumeEp])

  const current = episodes.find((e) => e.video_id === epIndex) || episodes[0]

  // Visiting an episode marks it watched immediately (no time tracking).
  useEffect(() => {
    if (!user || !current || !animeId) return
    const epNum = String(current.number)
    if (savedRef.current[epNum]?.completed) return // already watched

    backend
      .saveProgress({
        animeId,
        animeUrl: anime?.anime_url || url,
        animeTitle: anime?.title,
        animePoster: poster(anime, 'big') || poster(anime, 'medium') || '',
        genres: (anime?.genres || []).map((g) => g.title).filter(Boolean),
        episodeNumber: epNum,
        episodeIndex: current.index || 0,
        videoId: current.video_id,
        dubbing: dub,
        player,
        duration: current.duration || undefined,
      })
      .then((row) => {
        savedRef.current = { ...savedRef.current, [row.episodeNumber]: row }
        setWatched((prev) => ({ ...prev, [row.episodeNumber]: row }))
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, current?.video_id, animeId])

  async function removeWatched(epNum) {
    try {
      await backend.removeEpisode(animeId, epNum)
      const next = { ...savedRef.current }
      delete next[epNum]
      savedRef.current = next
      setWatched(next)
    } catch {
      /* ignore */
    }
  }

  async function createRoomFromEpisode() {
    if (!user) {
      openAuth('login')
      return
    }

    // Для комнат только Kodik — ищем Kodik-эпизод с тем же номером
    const kodikEp = /kodik/i.test(current?.iframe_url || '')
      ? current
      : episodes.find((ep) => String(ep.number) === String(current?.number) && /kodik/i.test(ep.iframe_url || ''))

    if (!kodikEp?.iframe_url) {
      showToast('Для комнат нужен плеер Kodik — переключитесь на Kodik в селекторе плеера')
      return
    }

    setCreatingRoom(true)
    try {
      const room = await backend.createWatchRoom({
        animeId,
        animeUrl: anime?.anime_url || url,
        animeTitle: anime?.title,
        animePoster: poster(anime, 'big') || poster(anime, 'medium') || '',
        videoId: kodikEp.video_id,
        episodeNumber: String(kodikEp.number || ''),
        dubbing: dub || '',
        iframeUrl: kodikEp.iframe_url,
      })
      if (room?.room?.id) navigate(`/rooms/${room.room.id}`)
    } catch (err) {
      showToast(err.message || 'Не удалось создать комнату')
    } finally {
      setCreatingRoom(false)
    }
  }

  const currentWatched = current ? watched[String(current.number)] : null
  // videos still loading OR not yet arrived → show loading, never "unavailable"
  const stillLoading = loading || (!error && videos == null)

  const watchImage = anime ? (poster(anime, 'big') || poster(anime, 'medium')) : ''

  if (!user) {
    return (
      <div className="container page">
        <SEO
          title={anime ? `Смотреть «${anime.title}»` : 'Просмотр'}
          description={anime ? `Смотреть ${anime.title} онлайн бесплатно.` : 'Просмотр аниме онлайн.'}
          image={watchImage || 'https://quickik.ru/og-image.png'}
          url={`https://quickik.ru/anime/${url}/watch`}
          canonical={`https://quickik.ru/anime/${url}/watch`}
        />
        <Link
          to={`/anime/${url}`}
          className="section-link"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20 }}
        >
          <ArrowLeft width={14} height={14} /> Назад к аниме
        </Link>
        <div className="state">
          <h2>Нужна авторизация</h2>
          <p style={{ marginBottom: 20 }}>Войдите в аккаунт, чтобы смотреть серии.</p>
          <button className="btn btn-primary" onClick={() => openAuth('login')}>
            Войти
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <SEO
        title={anime ? `Смотреть «${anime.title}»` : 'Просмотр'}
        description={anime ? `Смотреть ${anime.title} онлайн бесплатно.` : 'Просмотр аниме онлайн.'}
        image={watchImage || 'https://quickik.ru/og-image.png'}
        url={`https://quickik.ru/anime/${url}/watch`}
        type="video.movie"
        canonical={`https://quickik.ru/anime/${url}/watch`}
      />

      <Link
        to={`/anime/${url}`}
        className="section-link"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}
      >
        <ArrowLeft width={14} height={14} /> {anime?.title || 'Назад'}
      </Link>

      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 20 }}>
        {anime ? `Смотреть «${anime.title}»` : 'Просмотр'}
      </h1>

      {stillLoading ? (
        <>
          <div className="player-wrap skel" />
          <div style={{ marginTop: 16, color: 'var(--text-faint)', fontSize: 14 }}>
            Загрузка плеера…
          </div>
        </>
      ) : error ? (
        <div className="state">
          <h2>Не удалось загрузить</h2>
          <p>Попробуйте обновить страницу.</p>
        </div>
      ) : list.length === 0 ? (
        <div className="state">
          <h2>Видео недоступно</h2>
          <p>Для этого аниме пока нет доступных плееров.</p>
        </div>
      ) : (
        <>
          <div className="player-wrap">
            {current?.iframe_url ? (
              <iframe
                src={current.iframe_url}
                title={`Эпизод ${current.number}`}
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media"
              />
            ) : (
              <div className="state">Выберите эпизод</div>
            )}
          </div>

          <div className="room-entry-row">
            <button
              className="btn btn-primary btn-sm"
              onClick={createRoomFromEpisode}
              disabled={creatingRoom || !current}
            >
              {creatingRoom ? 'Создаем комнату...' : 'Смотреть вместе в комнате'}
            </button>
            <Link to="/rooms" className="btn btn-ghost btn-sm">
              Все комнаты
            </Link>
          </div>

          {user && current && (
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                fontSize: 14,
                color: 'var(--text-dim)',
              }}
            >
              <span style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <CheckIcon width={15} height={15} /> Серия {current.number} отмечена просмотренной
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => removeWatched(String(current.number))}
                disabled={!currentWatched}
              >
                <TrashIcon width={14} height={14} /> Убрать из просмотренных
              </button>
            </div>
          )}

          <div className="player-controls">
            {dubbings.length > 1 && (
              <div className="control-group" style={{ maxWidth: 260 }}>
                <div className="control-label">Озвучка</div>
                <select className="select" value={dub || ''} onChange={(e) => setDub(e.target.value)}>
                  {dubbings.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {players.length > 1 && (
              <div className="control-group" style={{ maxWidth: 260 }}>
                <div className="control-label">Плеер</div>
                <select className="select" value={player || ''} onChange={(e) => setPlayer(e.target.value)}>
                  {players.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="control-group" style={{ flexBasis: '100%' }}>
              <div className="control-label">
                Эпизоды · {episodes.length}
                {current ? ` · сейчас: ${current.number}` : ''}
              </div>
              <div className="episode-grid">
                {episodes.map((ep) => {
                  const sv = watched[String(ep.number)]
                  const isActive = ep.video_id === epIndex
                  return (
                    <button
                      key={ep.video_id}
                      className={`ep-btn ${isActive ? 'active' : ''} ${sv?.completed ? 'watched' : ''}`}
                      onClick={() => setEpIndex(ep.video_id)}
                      title={sv?.completed ? 'Просмотрено' : ''}
                    >
                      {ep.number}
                      {sv?.completed && !isActive ? ' ✓' : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
