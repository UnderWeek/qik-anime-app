import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronDown } from './icons.jsx'

// Horizontal carousel with arrow navigation.
// Constrained to its container width (min-width:0) so it never stretches the page.
export default function Carousel({ children }) {
  const trackRef = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    update()
    const el = trackRef.current
    if (!el) return
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // Detect content size changes (e.g. images loading in)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      ro.disconnect()
    }
  }, [update, children])

  function scrollBy(dir) {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' })
  }

  return (
    <div className="carousel">
      <button
        className={`carousel-arrow left ${canLeft ? '' : 'hidden'}`}
        onClick={() => scrollBy(-1)}
        aria-label="Назад"
      >
        <ChevronDown width={20} height={20} style={{ transform: 'rotate(90deg)' }} />
      </button>

      <div className="carousel-track" ref={trackRef}>
        {children}
      </div>

      <button
        className={`carousel-arrow right ${canRight ? '' : 'hidden'}`}
        onClick={() => scrollBy(1)}
        aria-label="Вперёд"
      >
        <ChevronDown width={20} height={20} style={{ transform: 'rotate(-90deg)' }} />
      </button>
    </div>
  )
}
