import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { poster } from '../api/client.js'
import { PlayIcon, StarIcon, FireIcon } from './icons.jsx'

export default function Hero({ items = [] }) {
  const slides = items.slice(0, 6)
  const [i, setI] = useState(0)
  const timer = useRef(null)

  useEffect(() => {
    if (slides.length <= 1) return
    timer.current = setInterval(() => setI((p) => (p + 1) % slides.length), 6000)
    return () => clearInterval(timer.current)
  }, [slides.length])

  function go(n) {
    setI(n)
    clearInterval(timer.current)
    timer.current = setInterval(() => setI((p) => (p + 1) % slides.length), 6000)
  }

  if (!slides.length) return null

  return (
    <div className="hero">
      {slides.map((a, idx) => {
        const url = a.anime_url || a.url
        const bg =
          poster(a, 'mega') ||
          poster(a, 'huge') ||
          poster(a, 'fullsize') ||
          poster(a, 'big')
        return (
          <div className={`hero-slide ${idx === i ? 'active' : ''}`} key={url || idx}>
            <img className="hero-bg" src={bg} alt="" aria-hidden />
            <div className="hero-overlay" />
            <div className="hero-content">
              <div className="hero-tag">
                <FireIcon width={13} height={13} /> В тренде сейчас
              </div>
              <h1 className="hero-title">{a.title}</h1>
              <p className="hero-desc">{a.description || 'Описание появится позже.'}</p>
              <div className="hero-actions">
                <Link to={`/anime/${url}/watch`} className="btn btn-primary">
                  <PlayIcon width={16} height={16} /> Смотреть
                </Link>
                <Link to={`/anime/${url}`} className="btn btn-ghost">
                  Подробнее
                </Link>
                {a.rating?.average > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ffd76a', fontWeight: 700, marginLeft: 6 }}>
                    <StarIcon width={15} height={15} />
                    {a.rating.average.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
      <div className="hero-dots">
        {slides.map((_, idx) => (
          <button
            key={idx}
            className={idx === i ? 'active' : ''}
            onClick={() => go(idx)}
            aria-label={`Слайд ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
