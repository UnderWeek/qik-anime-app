import { useState, useEffect, useCallback } from 'react'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
function Bars({ value, hover, setHover, onSelect, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const s = i + 1
        const on = hover ? s <= hover : s <= value
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className="rate-bar"
            style={{
              width: 16,
              height: 24,
              background: on ? 'linear-gradient(135deg, #ffd76a, #f5b642)' : undefined,
              boxShadow: on ? '0 0 6px rgba(255, 215, 106, 0.4)' : undefined,
            }}
          />
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
    <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -3, marginRight: 5 }}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>Опенинг
        </div>
        <Bars value={opScore || 0} hover={hoverOp} setHover={setHoverOp} onSelect={(s) => rate('opening', s)} disabled={busy} />
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -3, marginRight: 5 }}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="21" y1="5" x2="9" y2="7"/></svg>Эндинг
        </div>
        <Bars value={edScore || 0} hover={hoverEd} setHover={setHoverEd} onSelect={(s) => rate('ending', s)} disabled={busy} />
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
