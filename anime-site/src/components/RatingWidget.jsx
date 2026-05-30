import { useState, useEffect } from 'react'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import { StarIcon } from './icons.jsx'

export default function RatingWidget({ animeId }) {
  const { user, openAuth, requireAuth, showToast } = useAuth()
  const [summary, setSummary] = useState(null)
  const [hover, setHover] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!animeId) return
    let alive = true
    backend
      .getRating(animeId)
      .then((s) => alive && setSummary(s))
      .catch(() => alive && setSummary({ average: 0, count: 0, userScore: null }))
    return () => {
      alive = false
    }
  }, [animeId, user])

  async function rate(score) {
    if (!requireAuth()) return
    setBusy(true)
    try {
      const s = await backend.rate(animeId, score)
      setSummary(s)
      showToast(`Ваша оценка: ${score}/10`)
    } catch (e) {
      showToast(e.message || 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    setBusy(true)
    try {
      const s = await backend.removeRating(animeId)
      setSummary(s)
      showToast('Оценка удалена')
    } catch (e) {
      showToast(e.message || 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  const avg = summary?.average || 0
  const count = summary?.count || 0
  const mine = summary?.userScore || 0
  const display = hover || mine

  return (
    <div className="rate-box">
      <div className="rate-head">
        <div className="rate-avg">
          {avg ? avg.toFixed(1) : '—'}
          <small>/10</small>
        </div>
        <div className="rate-count">
          Сообщество QIK
          <br />
          {count} {pluralize(count)}
        </div>
      </div>

      <div className="rate-stars" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 10 }).map((_, i) => {
          const val = i + 1
          return (
            <span
              key={val}
              className={`rate-star ${val <= display ? 'on' : ''}`}
              onMouseEnter={() => setHover(val)}
              onClick={() => !busy && rate(val)}
              role="button"
              aria-label={`Оценка ${val}`}
            >
              <StarIcon width={20} height={20} />
            </span>
          )
        })}
      </div>

      {user ? (
        mine ? (
          <div className="rate-mine">
            Ваша оценка: <b style={{ color: 'var(--accent)' }}>{mine}/10</b>
            <button onClick={clear} disabled={busy}>
              сбросить
            </button>
          </div>
        ) : (
          <div className="rate-mine">Наведите и кликните, чтобы поставить оценку</div>
        )
      ) : (
        <div className="rate-login-hint">
          <button onClick={() => openAuth('login')}>Войдите</button>, чтобы оценить аниме
        </div>
      )}
    </div>
  )
}

function pluralize(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'оценка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'оценки'
  return 'оценок'
}
