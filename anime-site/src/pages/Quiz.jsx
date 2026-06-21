import { useState, useEffect, useRef, useCallback } from 'react'
import { api, poster } from '../api/client.js'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import SEO from '../components/SEO.jsx'
import { PlayIcon, StarIcon } from '../components/icons.jsx'

const FRAME_SECONDS = 5

export default function Quiz() {
  const { user, openAuth } = useAuth()
  const [state, setState] = useState('idle')
  const [question, setQuestion] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(0)
  const [totalPlayed, setTotalPlayed] = useState(0)
  const [wrongsInRow, setWrongsInRow] = useState(0)
  const [resultMsg, setResultMsg] = useState('')
  const [timeLeft, setTimeLeft] = useState(FRAME_SECONDS)
  const excludeRef = useRef([])
  const iframeRef = useRef(null)
  const timerRef = useRef(null)

  const loadQuestion = useCallback(async () => {
    setState('loading')
    setSearchText('')
    setResults([])
    setResultMsg('')
    setTimeLeft(FRAME_SECONDS)
    try {
      const q = await backend.quizQuestion(excludeRef.current)
      if (q.error) {
        setResultMsg(q.error)
        setState('idle')
        return
      }
      setQuestion(q)
      excludeRef.current.push(q.animeId)

      // Load iframe
      if (iframeRef.current) {
        iframeRef.current.src = q.iframeUrl
      }
      setState('image')
    } catch {
      setResultMsg('Ошибка загрузки')
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

  // Timer for frame display
  useEffect(() => {
    if (state !== 'image') return undefined
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          setState('guessing')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [state])

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
    if (correct) {
      const bonus = state === 'image' ? 2 : 1
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
  }

  function nextRound() {
    if (wrongsInRow >= 3) {
      setResultMsg('3 ошибки подряд — игра окончена.')
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
          <p style={{ marginBottom: 20 }}>Войдите в аккаунт, чтобы играть.</p>
          <button className="btn btn-primary" onClick={() => openAuth('login')}>Войти</button>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <SEO title="Квиз по кадрам" description="Угадай аниме по кадру из серии." canonical="https://quickik.ru/quiz" />

      <div className="section-head" style={{ marginBottom: 24 }}>
        <h2 className="section-title">Квиз по кадрам</h2>
        <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 4 }}>
          Счёт: {score} · Раунд: {round} · Угадано: {score}/{totalPlayed || 0}
        </div>
      </div>

      {state === 'idle' && (
        <div className="state">
          {resultMsg && <p style={{ color: resultMsg.includes('Правильно') ? '#4ade80' : 'var(--text-faint)', marginBottom: 16 }}>{resultMsg}</p>}
          <p style={{ marginBottom: 20, maxWidth: 400 }}>
            Угадайте аниме по случайному кадру из серии.
          </p>
          <button className="btn btn-primary" onClick={startGame}>
            <PlayIcon width={16} height={16} /> Начать
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="state"><p>Загрузка...</p></div>
      )}

      {(state === 'image' || state === 'guessing') && question && (
        <div>
          <div style={{
            borderRadius: 14, overflow: 'hidden', maxWidth: 560, marginBottom: 20,
            aspectRatio: '16/9', background: '#000', position: 'relative',
          }}>
            {state === 'image' && (
              <div style={{
                position: 'absolute', top: 12, right: 12, zIndex: 2,
                background: 'rgba(0,0,0,0.7)', color: '#fff',
                borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 600,
              }}>
                {timeLeft}с
              </div>
            )}
            <iframe
              ref={iframeRef}
              title="quiz-frame"
              allow="autoplay"
              style={{ width: '100%', height: '100%', border: 0 }}
            />
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 14 }}>
            Кадр из серии №{question.episodeNumber}. {state === 'image' ? 'Смотрите на кадр!' : 'Какое это аниме?'}
          </p>

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

          {results.length > 0 && (
            <div className="room-search-results" style={{ marginBottom: 14 }}>
              {results.map((a) => {
                const img = poster(a, 'big') || poster(a, 'medium') || poster(a, 'small')
                return (
                  <button
                    key={a.anime_id || a.anime_url}
                    className="room-search-item"
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
