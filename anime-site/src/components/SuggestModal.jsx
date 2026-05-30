import { useState, useEffect } from 'react'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from './Avatar.jsx'
import { CloseIcon, CheckIcon } from './icons.jsx'

// Modal to suggest an anime to one of your friends.
export default function SuggestModal({ anime, posterUrl, onClose }) {
  const { showToast } = useAuth()
  const [friends, setFriends] = useState(null)
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState(null)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState([])

  useEffect(() => {
    backend
      .listFriends()
      .then((r) => setFriends(Array.isArray(r) ? r : []))
      .catch(() => setFriends([]))
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function send(friend) {
    setSending(true)
    setSelected(friend.id)
    try {
      await backend.suggestAnime({
        toUserId: friend.id,
        animeId: anime.anime_id,
        animeUrl: anime.anime_url || anime.url,
        animeTitle: anime.title,
        animePoster: posterUrl || '',
        note: note.trim() || undefined,
      })
      setSentTo((prev) => [...prev, friend.id])
      showToast(`Отправлено: ${friend.username}`)
    } catch (e) {
      showToast(e.message || 'Ошибка')
    } finally {
      setSending(false)
      setSelected(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть">
          <CloseIcon width={18} height={18} />
        </button>
        <h2>Посоветовать друзьям</h2>
        <p className="sub">«{anime.title}»</p>

        <div className="field">
          <label>Сообщение (необязательно)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Зацени, тебе понравится!"
          />
        </div>

        {friends === null ? (
          <div className="comment-empty">Загрузка друзей…</div>
        ) : friends.length === 0 ? (
          <div className="comment-empty">У вас пока нет друзей, чтобы что-то советовать.</div>
        ) : (
          <div className="friend-list" style={{ gridTemplateColumns: '1fr', maxHeight: 300, overflowY: 'auto' }}>
            {friends.map((f) => {
              const done = sentTo.includes(f.id)
              return (
                <div key={f.id} className="friend-row">
                  <Avatar user={f} size={40} />
                  <span className="fr-name">{f.username}</span>
                  <div className="fr-actions">
                    {done ? (
                      <span className="btn btn-ghost btn-sm" style={{ cursor: 'default' }}>
                        <CheckIcon width={15} height={15} /> Отправлено
                      </span>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={sending && selected === f.id}
                        onClick={() => send(f)}
                      >
                        {sending && selected === f.id ? '…' : 'Советовать'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
