import { useState, useEffect, useRef, useCallback } from 'react'
import { api, poster } from '../api/client.js'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import { sendPlayerCommand, subscribePlayerEvents } from '../utils/playerApi.js'
import SEO from '../components/SEO.jsx'
import { PlayIcon, StarIcon } from '../components/icons.jsx'

const QUESTION_TIME = 12 // seconds to listen
const HINT_TIME = 6 // after this many seconds, show search field

export default function Quiz() {
  const { user, openAuth } = useAuth()
  const [state, setState] = useState('idle') // idle | loading | listening | guessing | reveal
  const [question, setQuestion] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(0)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME)
  const [showHint, setShowHint] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [totalPlayed, setTotalPlayed] = useState(0)
  const [wrongsInRow, setWrongsInRow] = useState(0)
  const excludeRef = useRef([])
  const iframeRef = useRef(null)
  const timerRef = useRef(null)

  const loadQuestion = useCallback(async () => {
    setState('loading')
    setSearchText('')
    setResults([])
    setTimeLeft(QUESTION_TIME)
    setShowHint(false)
    setResultMsg('')
    try {
      const q = await backend.quizQuestion(excludeRef.current)
      if (q.error) {
        setResultMsg(q.error)
        setState('idle')
        return
      }
      setQuestion(q)
      excludeRef.current.push(q.animeId)
      setState('listening')
    } catch {
      setResultMsg('Ошибка загрузки вопроса')
      setState('idle')
    }
  }, [])

  const startGame = useCallback(() => {
    excludeRef.current = []
    setScore(0)
    setRound(0)
    setTotalPlayed(0)
    setWrongsInRow(0)
    loadQuestion()
  }, [loadQuestion])

  // Timer
  useEffect(() => {
    if (state !== 'listening' && state !== 'guessing') return undefined
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        if (t === QUESTION_TIME - HINT_TIME) setShowHint(true)
        if (t === QUESTION_TIME - HINT_TIME + 2 && state === 'listening') {
          setState('guessing')
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [state])

  // Control player: seek to opening start, play for 10 sec, then pause
  useEffect(() => {
    if (state !== 'listening' || !question?.iframeUrl) return
    const iframe = iframeRef.current
    if (!iframe) return

    // Load the iframe
    const src = question.iframeUrl.startsWith('//')
      ? `https:${question.iframeUrl}`
      : question.iframeUrl
    iframe.src = src

    // Wait for iframe to load, then seek + play
    function onLoad() {
      setTimeout(() => {
        sendPlayerCommand(iframeRef, 'seekTo', question.openStart)
        setTimeout(() => sendPlayerCommand(iframeRef, 'play'), 300)
        // Pause after 10 seconds
        setTimeout(() => sendPlayerCommand(iframeRef, 'pause'), 10000)
      }, 2000)
    }
    iframe.addEventListener('load', onLoad, { once: true })
    return () => iframe.removeEventListener('load', onLoad)
  }, [state, question])

  // Listen for timeupdate to detect natural pause
  useEffect(() => {
    if (!iframeRef.current || state !== 'listening') return undefined
    const unsub = subscribePlayerEvents(iframeRef, (event) => {
      if (event.type === 'time' && event.time > question.openEnd) {
        sendPlayerCommand(iframeRef, 'pause')
      }
    })
    return () => unsub()
  }, [state, question])

  async function runSearch(e) {
    e.preventDefault()
    const q = searchText.trim()
    if (!q || q.length < 2) return
    setSearching(true)
    try {
      const res = await api.search(q, { limit: 8 })
      setResults(Array.isArray(res) ? res : [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function guess(anime) {
    clearInterval(timerRef.current)
    const correct = anime.anime_id === question.animeId
    const titleMatch = searchText.trim().toLowerCase() === question.animeTitle.toLowerCase()

    if (correct || titleMatch) {
      const bonus = state === 'listening' ? 2 : 1
      setScore((s) => s + 1 + bonus)
      setWrongsInRow(0)
      setResultMsg(`Правильно! ${question.animeTitle}`)
    } else {
      setWrongsInRow((w) => w + 1)
      setResultMsg(`Неверно. Правильный ответ: ${question.animeTitle}`)
    }

    setTotalPlayed((t) => t + 1)
    setRound((r) => r + 1)
    setState('reveal')
    sendPlayerCommand(iframeRef, 'pause')
  }

  function nextRound() {
    if (wrongsInRow >= 3) {
      setResultMsg('3 ошибки подряд — игра окончена. Начните заново!')
      setState('idle')
      return
    }
    loadQuestion()
  }

  if (!user) {
    return (
      <div className="container page">
        <SEO title="Квиз" />
        <div className="state">
          <h2>Нужна авторизация</h2>
          <p style={{ marginBottom: 20 }}>Войдите в аккаунт, чтобы играть в квиз.</p>
          <button className="btn btn-primary" onClick={() => openAuth('login')}>Войти</button>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <SEO title="Квиз по опенингам" description="Угадай аниме по опенингу." canonical="https://quickik.ru/quiz" />

      <div className="section-head" style={{ marginBottom: 24 }}>
        <h2 className="section-title">Квиз по опенингам</h2>
        <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 4 }}>
          Счёт: {score} · Раунд: {round} · Угадано: {score}/{totalPlayed || 0}
        </div>
      </div>

      {/* Player — visible for volume control */}
      {(state === 'listening' || state === 'guessing') && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 6 }}>
            Не смотрите на видео — слушайте опенинг. Громкость регулируется в плеере.
          </div>
          <div style={{ borderRadius: 12, overflow: 'hidden', maxWidth: 320, opacity: 0.3 }}>
            <iframe
              ref={iframeRef}
              title="quiz-player"
              allow="autoplay"
              style={{ width: '100%', aspectRatio: '16/9', border: 0, pointerEvents: 'none' }}
            />
          </div>
        </div>
      )}

      {state === 'idle' && (
        <div className="state">
          {resultMsg && <p style={{ color: resultMsg.includes('Правильно') ? '#4ade80' : 'var(--text-faint)', marginBottom: 16 }}>{resultMsg}</p>}
          <p style={{ marginBottom: 20, maxWidth: 400 }}>
            Угадайте аниме по фрагменту опенинга. <br />
            Будет проигран отрывок 10 секунд — введите название.
          </p>
          <button className="btn btn-primary" onClick={startGame}>
            <PlayIcon width={16} height={16} /> Начать
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="state"><p>Загрузка...</p></div>
      )}

      {(state === 'listening' || state === 'guessing') && question && (
        <div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {timeLeft}
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>Слушайте опенинг</div>
              <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>
                {state === 'listening' ? 'Секунд до подсказки: ' + Math.max(0, timeLeft - (QUESTION_TIME - HINT_TIME)) : 'Введите название аниме'}
              </div>
            </div>
          </div>

          {(showHint || state === 'guessing') && (
            <form onSubmit={runSearch} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                className="select"
                style={{ flex: 1 }}
                placeholder="Название аниме..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" type="submit" disabled={searching || searchText.length < 2}>
                {searching ? '...' : 'Найти'}
              </button>
            </form>
          )}

          {results.length > 0 && (
            <div className="room-search-results" style={{ marginBottom: 14 }}>
              {results.map((a) => {
                const img = poster(a, 'big') || poster(a, 'medium') || poster(a, 'small')
                return (
                  <button
                    key={a.anime_id || a.anime_url}
                    className={`room-search-item ${state === 'reveal' && a.anime_id === question.animeId ? 'active' : ''}`}
                    onClick={() => guess(a)}
                    type="button"
                    disabled={state === 'reveal'}
                  >
                    <div className="room-search-poster">
                      {img ? <img src={img} alt="" /> : <div className="room-search-no-poster" />}
                    </div>
                    <div className="room-search-info">
                      <div className="room-search-title">{a.title}</div>
                      <div className="room-search-meta">
                        {a.year && <span>{a.year}</span>}
                        {a.rating?.average > 0 && (
                          <span className="room-search-rate">
                            <StarIcon width={11} height={11} /> {a.rating.average.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {state === 'reveal' && (
        <div className="state">
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {resultMsg.includes('Правильно') ? '🎉' : '😔'}
          </div>
          <p style={{ marginBottom: 8, fontWeight: 600 }}>{resultMsg}</p>
          {question?.animePoster && (
            <img src={question.animePoster} alt="" style={{ width: 120, borderRadius: 12, marginBottom: 16 }} />
          )}
          <button className="btn btn-primary" onClick={nextRound}>
            Дальше
          </button>
        </div>
      )}
    </div>
  )
}
