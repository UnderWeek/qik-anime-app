import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from './Avatar.jsx'
import { BellIcon, CheckIcon, TrashIcon } from './icons.jsx'

function timeAgo(iso) {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч`
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн`
  return d.toLocaleDateString('ru-RU')
}

export default function NotificationBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  const loadCount = useCallback(() => {
    if (!user) return
    backend
      .unreadCount()
      .then((r) => setUnread(r.count || 0))
      .catch(() => {})
  }, [user])

  // poll unread count
  useEffect(() => {
    if (!user) {
      setUnread(0)
      setList([])
      return
    }
    loadCount()
    const t = setInterval(loadCount, 20000)
    return () => clearInterval(t)
  }, [user, loadCount])

  // close on outside click
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      try {
        const items = await backend.notifications()
        setList(Array.isArray(items) ? items : [])
        // mark all as read on open
        if (unread > 0) {
          await backend.markAllRead()
          setUnread(0)
        }
      } catch {
        /* ignore */
      }
    }
  }

  async function remove(id, e) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await backend.removeNotification(id)
      setList((prev) => prev.filter((n) => n.id !== id))
    } catch {
      /* ignore */
    }
  }

  if (!user) return null

  return (
    <div className="account-wrap" ref={ref}>
      <button className="theme-toggle" onClick={toggle} aria-label="Уведомления" style={{ position: 'relative' }}>
        <BellIcon width={18} height={18} />
        {unread > 0 && <span className="notif-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-menu">
          <div className="notif-head">
            <b>Уведомления</b>
            {list.length > 0 && (
              <Link to="#" onClick={(e) => { e.preventDefault(); setOpen(false) }} style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
                Закрыть
              </Link>
            )}
          </div>

          {list.length === 0 ? (
            <div className="notif-empty">Пока пусто</div>
          ) : (
            <div className="notif-list">
              {list.map((n) => {
                const content = (
                  <>
                    {n.actor ? (
                      <Avatar user={n.actor} size={38} />
                    ) : n.animePoster ? (
                      <img className="notif-poster" src={fix(n.animePoster)} alt="" />
                    ) : (
                      <span className="notif-ic">🔔</span>
                    )}
                    <div className="notif-body">
                      <div className="notif-msg">{n.message}</div>
                      <div className="notif-time">{timeAgo(n.createdAt)}</div>
                    </div>
                    <button className="notif-del" onClick={(e) => remove(n.id, e)} aria-label="Удалить">
                      <TrashIcon width={14} height={14} />
                    </button>
                  </>
                )
                // anime suggestions / replies link to anime; friend events link to actor profile
                // room_invite links to the room
                const to =
                  n.type === 'room_invite' && n.roomId
                    ? `/rooms/${n.roomId}`
                    : n.type === 'anime_suggestion' && (n.animeUrl || n.animeId)
                    ? `/anime/${n.animeUrl || n.animeId}`
                    : n.type === 'friend_request' || n.type === 'friend_accept'
                    ? n.actor
                      ? `/u/${n.actor.id}`
                      : '/friends'
                    : null
                return to ? (
                  <Link key={n.id} to={to} className="notif-item" onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id} className="notif-item">{content}</div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// local copy to avoid circular import weight; mirrors uploadUrl/fixUrl behaviour
import { uploadUrl } from '../api/backend.js'
import { fixUrl } from '../api/client.js'
function fix(u) {
  if (!u) return ''
  if (u.startsWith('/uploads')) return uploadUrl(u)
  return fixUrl(u)
}
