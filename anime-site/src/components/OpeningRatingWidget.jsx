import { useState, useEffect, useCallback } from 'react'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'

function Stars({ value, hover, setHover, onSelect, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const s = i + 1
        const filled = hover ? s <= hover : s <= value
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            style={{
              width: 22, height: 22, background: 'none', border: 'none',
              cursor: disabled ? 'default' : 'pointer', fontSize: 18,
              color: filled ? '#ffd76a' : 'var(--border)',
              transition: 'color 0.1s', padding: 0, lineHeight: 1,
            }}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}

export default function OpeningRatingWidget({ animeId }) {
  const { user, requireAuth, showToast } = useAuth()
  const [data, setData] = useState(null)
  const [hoverOp, setHoverOp] = useState(0)
  const [hoverEd, setHoverEd] = useState(0)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    backend.getOpeningRatings(animeId).then(setData).catch(() => {})
  }, [animeId])

  useEffect(() => { load() }, [load])

  async function rate(type, score) {
    if (!requireAuth()) return
    setBusy(true)
    try {
      const res = await backend.rateOpening({ animeId, type, score })
      setData({ opening: res.opening.userScore, ending: res.ending.userScore })
      showToast('Оценка сохранена')
    } catch (err) {
      showToast(err.message || 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  async function clear(type) {
    try {
      await backend.removeOpeningRating(animeId, type)
      setData((prev) => ({ ...prev, [type]: null }))
      showToast('Оценка удалена')
    } catch (err) {
      showToast(err.message || 'Ошибка')
    }
  }

  if (!user) {
    return (
      <div className="info-card" style={{ fontSize: 14, color: 'var(--text-faint)' }}>
        <button onClick={() => requireAuth()} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Войдите</button>, чтобы оценить опенинг и эндинг.
      </div>
    )
  }

  const opScore = data?.opening ?? null
  const edScore = data?.ending ?? null

  return (
    <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
          🎵 Опенинг
        </div>
        <Stars value={opScore || 0} hover={hoverOp} setHover={setHoverOp} onSelect={(s) => rate('opening', s)} disabled={busy} />
        {opScore ? (
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
            Ваша оценка: {opScore}/10{' '}
            <button onClick={() => clear('opening')} style={{ color: '#ff8a8a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>сбросить</button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>Оцените опенинг</div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
          🎶 Эндинг
        </div>
        <Stars value={edScore || 0} hover={hoverEd} setHover={setHoverEd} onSelect={(s) => rate('ending', s)} disabled={busy} />
        {edScore ? (
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
            Ваша оценка: {edScore}/10{' '}
            <button onClick={() => clear('ending')} style={{ color: '#ff8a8a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>сбросить</button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>Оцените эндинг</div>
        )}
      </div>
    </div>
  )
}
