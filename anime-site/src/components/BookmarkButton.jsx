import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import { BookmarkIcon, BookmarkFill, ChevronDown, CheckIcon, TrashIcon } from './icons.jsx'

const OPTIONS = [
  { value: 'watching', label: 'Смотрю' },
  { value: 'planned', label: 'В планах' },
  { value: 'completed', label: 'Просмотрено' },
  { value: 'on_hold', label: 'Отложено' },
  { value: 'dropped', label: 'Брошено' },
  { value: 'favorite', label: 'Любимое' },
]

export function statusLabel(value) {
  return OPTIONS.find((o) => o.value === value)?.label || value
}

const MENU_WIDTH = 210

export default function BookmarkButton({ anime, posterUrl }) {
  const { user, requireAuth, showToast } = useAuth()
  const [status, setStatus] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const animeId = anime?.anime_id

  useEffect(() => {
    if (!user || !animeId) {
      setStatus(null)
      return
    }
    let alive = true
    backend
      .getBookmark(animeId)
      .then((bm) => alive && setStatus(bm?.status || null))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [user, animeId])

  // Position the portal menu under the button (fixed coords relative to viewport)
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const update = () => {
      const r = btnRef.current.getBoundingClientRect()
      let left = r.left
      // keep menu inside viewport horizontally
      if (left + MENU_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - MENU_WIDTH - 8
      }
      setCoords({ top: r.bottom + 8, left: Math.max(8, left) })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (
        btnRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      )
        return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function choose(value) {
    if (!requireAuth()) return
    setBusy(true)
    try {
      await backend.upsertBookmark({
        animeId,
        animeUrl: anime.anime_url || anime.url,
        animeTitle: anime.title,
        animePoster: posterUrl || '',
        status: value,
      })
      setStatus(value)
      showToast(`Добавлено: «${statusLabel(value)}»`)
    } catch (e) {
      showToast(e.message || 'Ошибка')
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await backend.removeBookmark(animeId)
      setStatus(null)
      showToast('Удалено из закладок')
    } catch (e) {
      showToast(e.message || 'Ошибка')
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  function toggle() {
    if (!requireAuth()) return
    setOpen((o) => !o)
  }

  const menu = open
    ? createPortal(
        <div
          className="bm-menu bm-menu-portal"
          ref={menuRef}
          style={{ top: coords.top, left: coords.left, width: MENU_WIDTH }}
        >
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              className={status === o.value ? 'active' : ''}
              onClick={() => choose(o.value)}
            >
              {o.label}
              {status === o.value && <CheckIcon width={15} height={15} />}
            </button>
          ))}
          {status && (
            <>
              <div className="sep" />
              <button className="remove" onClick={remove}>
                <TrashIcon width={15} height={15} /> Убрать из закладок
              </button>
            </>
          )}
        </div>,
        document.body
      )
    : null

  return (
    <div className="bm-control">
      <button
        ref={btnRef}
        className={status ? 'btn btn-primary' : 'btn btn-ghost'}
        onClick={toggle}
        disabled={busy}
      >
        {status ? <BookmarkFill width={16} height={16} /> : <BookmarkIcon width={16} height={16} />}
        {status ? statusLabel(status) : 'В закладки'}
        <ChevronDown width={14} height={14} />
      </button>
      {menu}
    </div>
  )
}
