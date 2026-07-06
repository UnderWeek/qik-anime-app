import { useRef, useEffect, useState } from 'react'
import { animate } from 'motion/react'

// ---- droplet ---------------------------------------------------------------

function Droplet({ navRef, activeKey }) {
  const dropletRef = useRef(null)
  const prevKey = useRef(activeKey)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!navRef.current || !activeKey) return
    const el = navRef.current.querySelector(`[data-nav-key="${activeKey}"]`)
    if (!el) return
    const navRect = navRef.current.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const targetLeft = elRect.left - navRect.left
    const targetWidth = elRect.width

    const drop = dropletRef.current
    if (!drop) return

    const isJump = prevKey.current && prevKey.current !== activeKey
    prevKey.current = activeKey

    // Cancel any pending phase-2 timer
    if (timerRef.current) clearTimeout(timerRef.current)

    if (isJump) {
      // Phase 1 — stretch: widen and flatten slightly, shift toward target
      const dir = targetLeft > targetWidth * 0.5 ? 1 : -1
      const stretchLeft = targetLeft - dir * targetWidth * 0.25
      const stretchW = targetWidth * 1.35
      const stretchRadius = 17 // slightly flattened

      animate(drop,
        { left: stretchLeft, width: stretchW, borderRadius: stretchRadius },
        { duration: 0.3, ease: [0.33, 0, 0.1, 1] }
      )

      // Phase 2 — settle: spring to exact position, size, and fully round pill
      timerRef.current = setTimeout(() => {
        animate(drop,
          { left: targetLeft, width: targetWidth, borderRadius: 24 },
          { type: 'spring', stiffness: 45, damping: 14, mass: 1.3 }
        )
      }, 240)
    } else {
      // Initial mount — place at target without animation
      drop.style.left = `${targetLeft}px`
      drop.style.width = `${targetWidth}px`
      drop.style.borderRadius = '24px'
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [activeKey, navRef])

  return <div ref={dropletRef} className="glass-droplet" />
}

// ---- item ------------------------------------------------------------------

function NavItem({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button
      data-nav-key={item.key}
      className={`glass-nav-item${active ? ' active' : ''}`}
      onClick={onClick}
      aria-label={item.label}
    >
      <Icon width={19} height={19} />
      <span className="glass-nav-label">{item.label}</span>
    </button>
  )
}

// ---- bar -------------------------------------------------------------------

/**
 * GlassNav — Apple Liquid Glass bottom navigation bar.
 *
 * Props:
 *   items   – [{ key, label, icon: Component, onClick }]
 *   activeKey – string, the currently active item key
 */
export default function GlassNav({ items, activeKey, iconOnly }) {
  const navRef = useRef(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Delay rendering the droplet until after mount so layout is stable
    requestAnimationFrame(() => setMounted(true))
  }, [])

  return (
    <nav className={`glass-nav${iconOnly ? ' icon-only' : ''}`} ref={navRef}>
      {mounted && <Droplet navRef={navRef} activeKey={activeKey} />}
      {items.map((item) => (
        <NavItem
          key={item.key}
          item={item}
          active={item.key === activeKey}
          onClick={item.onClick}
        />
      ))}
    </nav>
  )
}
