import { useState, useRef, useCallback } from 'react'
import { api } from '../api/client.js'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import { PlayIcon, StarIcon } from '../components/icons.jsx'

const DIFFS = ['easy', 'medium', 'hard']

export default function QuizEmoji() {
  const { user, openAuth } = useAuth()
  const [state, setState] = useState('select')
  const [question, setQuestion] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(0)
  const [totalPlayed, setTotalPlayed] = useState(0)
  const [wrongsInRow, setWrongsInRow] = useState(0)
  const [resultMsg, setResultMsg] = useState('')
  const [diff, setDiff] = useState('easy')
  const [options, setOptions] = useState([])
  const excludeRef = useRef([])

  const loadQuestion = useCallback(async () => {
    setState('loading')
    setSearchText('')
    setResults([])
    setResultMsg('')
    setOptions([])
    try {
      const q = await backend.quizEmoji(excludeRef.current, diff)
      if (q.error) {
        setResultMsg(q.error)
        setState('idle')
        return
      }
      setQuestion(q)
      excludeRef.current.push(q.animeId)
      if (q.options) setOptions(q.options)
      setState('image')
    } catch {
      setResultMsg('Ошибка загрузки')
      setState('idle')
    }
  }, [diff])

  function selectDifficulty(d) {
    setDiff(d)
    setResultMsg('')
    setState('idle')
  }

  function startGame() {
    excludeRef.current = []
    setScore(0)
    setRound(0)
    setTotalPlayed(0)
    setWrongsInRow(0)
    loadQuestion()
  }

  async function runSearch(e) {
    e.preventDefault()
    const q = searchText.trim()
    if (!q || q.length < 2) return
    setSearching(true)
    try {
      const res = await api.search(q, { limit: 6 })
      setResults(Array.isArray(res) ? res : [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function normalize(s) {
    return (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '')
  }

  function guess(anime) {
    const idMatch = anime.anime_id === question.animeId
    const titleMatch = normalize(anime.title) === normalize(question.animeTitle)
    const correct = idMatch || titleMatch
    if (correct) {
      setScore((s) => s + 1)
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
      <div className="state">
        <h2>Нужна авторизация</h2>
        <p style={{ marginBottom: 20 }}>Войдите в аккаунт, чтобы играть.</p>
        <button className="btn btn-primary" onClick={() => openAuth('login')}>Войти</button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 20, marginTop: -8 }}>
        Счёт: {score} · Раунд: {round} · Угадано: {score}/{totalPlayed || 0}
      </div>

      {state === 'select' && (
        <div className="state">
          <p style={{ marginBottom: 16 }}>Выберите уровень сложности:</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { k: 'easy', l: 'Легко', d: '4 варианта ответов, популярные аниме' },
              { k: 'medium', l: 'Средне', d: '6 вариантов, любое аниме' },
              { k: 'hard', l: 'Сложно', d: 'Вводишь название сам' },
            ].map((d) => (
              <button
                key={d.k}
                className={`btn ${diff === d.k ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => selectDifficulty(d.k)}
                style={{ flex: '1 1 160px', maxWidth: 240, padding: '14px 10px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word' }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{d.l}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{d.d}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {state === 'idle' && (
        <div className="state">
          {resultMsg && <p style={{ color: resultMsg.includes('Правильно') ? '#4ade80' : 'var(--text-faint)', marginBottom: 16 }}>{resultMsg}</p>}
          <p style={{ color: 'var(--text-faint)', marginBottom: 6, fontSize: 13 }}>
            {diff === 'easy' ? 'Легко' : diff === 'medium' ? 'Средне' : 'Сложно'}
            {' — '}
            <button className="link" onClick={() => setState('select')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>сменить</button>
          </p>
          <button className="btn btn-primary" onClick={startGame}>
            <PlayIcon width={16} height={16} /> Начать
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="state"><p>Генерация эмодзи...</p></div>
      )}

      {(state === 'image' || state === 'guessing') && question && (
        <div>
          <div style={{
            fontSize: 48, textAlign: 'center', padding: '40px 20px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
            borderRadius: 18, marginBottom: 20, letterSpacing: 4, lineHeight: 1.4,
          }}>
            {question.emoji}
          </div>

          {diff === 'hard' ? (
            <form onSubmit={runSearch} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                className="select" style={{ flex: 1 }}
                placeholder="Название аниме..."
                value={searchText} onChange={(e) => setSearchText(e.target.value)}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" type="submit" disabled={searching || searchText.length < 2}>
                {searching ? '...' : 'Найти'}
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 440, margin: '0 auto' }}>
              {options.map((a) => (
                <button
                  key={a.animeId}
                  className="btn btn-ghost"
                  style={{ textAlign: 'left', padding: '10px 16px', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                  onClick={() => guess(a)}
                  disabled={state === 'reveal'}
                >
                  {a.animeTitle}
                  {a.year ? <span style={{ opacity: 0.5, marginLeft: 8, fontSize: 13 }}>{a.year}</span> : null}
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="room-search-results" style={{ marginBottom: 14 }}>
              {results.map((a) => (
                <button
                  key={a.anime_id || a.anime_url}
                  className="room-search-item"
                  onClick={() => guess(a)}
                  type="button" disabled={state === 'reveal'}
                >
                  <div className="room-search-info">
                    <div className="room-search-title">{a.title}</div>
                    <div className="room-search-meta">
                      {a.year && <span>{a.year}</span>}
                      {a.rating?.average > 0 && (
                        <span className="room-search-rate"><StarIcon width={11} height={11} /> {a.rating.average.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
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
          {question?.emoji && (
            <div style={{ fontSize: 32, marginBottom: 16, letterSpacing: 2 }}>{question.emoji}</div>
          )}
          <button className="btn btn-primary" onClick={nextRound}>Дальше</button>
        </div>
      )}
    </div>
  )
}
