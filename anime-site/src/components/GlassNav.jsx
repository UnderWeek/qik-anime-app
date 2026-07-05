import { useRef, useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring, animate } from 'motion/react'

// ---- droplet ---------------------------------------------------------------
// The shared glass droplet that slides between active items.
// layoutId makes it animate its position/size across renders;
// a lightweight spring on x smooths out fast consecutive moves.

function Droplet({ navRef, activeKey }) {
  const x = useMotionValue(0)
  const w = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 180, damping: 28, mass: 0.8 })
  const springW = useSpring(w, { stiffness: 220, damping: 32, mass: 0.7 })

  useEffect(() => {
    if (!navRef.current) return
    const el = navRef.current.querySelector(`[data-nav-key="${activeKey}"]`)
    if (!el) return
    const navRect = navRef.current.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const left = elRect.left - navRect.left
    const width = elRect.width

    // Animate with brief overshoot for liquid feel
    animate(x, left, {
      type: 'spring',
      stiffness: 200,
      damping: 26,
      mass: 0.8,
    })
    animate(w, width, {
      type: 'spring',
      stiffness: 240,
      damping: 30,
      mass: 0.7,
    })
  }, [activeKey, navRef, x, w])

  return (
    <motion.div
      className="glass-droplet"
      style={{ left: springX, width: springW }}
    />
  )
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
export default function GlassNav({ items, activeKey }) {
  const navRef = useRef(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Delay rendering the droplet until after mount so layout is stable
    requestAnimationFrame(() => setMounted(true))
  }, [])

  return (
    <nav className="glass-nav" ref={navRef}>
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
