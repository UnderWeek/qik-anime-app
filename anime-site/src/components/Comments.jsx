import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { backend, uploadUrl } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from './Avatar.jsx'
import Lightbox from './Lightbox.jsx'
import { EditIcon, TrashIcon, ImageIcon, CloseIcon, HeartIcon } from './icons.jsx'

function timeAgo(iso) {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`
  return d.toLocaleDateString('ru-RU')
}

// Reusable comments block. Pass `animeId` for anime comments, or `profileUserId`
// for a user's profile wall.
export default function Comments({ animeId, profileUserId, onCountChange }) {
  const { user, openAuth, requireAuth, showToast } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [attach, setAttach] = useState(null) // { file, preview }
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef(null)

  const isProfile = profileUserId != null

  const report = useCallback(
    (arr) => {
      if (onCountChange) onCountChange(arr.length)
    },
    [onCountChange]
  )

  const load = useCallback(() => {
    setLoading(true)
    const p = isProfile
      ? backend.profileComments(profileUserId)
      : backend.listComments(animeId)
    p.then((res) => {
      const arr = Array.isArray(res) ? res : []
      setList(arr)
      report(arr)
    })
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [animeId, profileUserId, isProfile, report])

  useEffect(() => {
    load()
  }, [load])

  function pickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      showToast('Файл больше 8 МБ')
      return
    }
    setAttach({ file, preview: URL.createObjectURL(file) })
  }

  function clearAttach() {
    if (attach?.preview) URL.revokeObjectURL(attach.preview)
    setAttach(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit(e) {
    e.preventDefault()
    if (!requireAuth()) return
    const body = text.trim()
    if (!body && !attach) return
    setBusy(true)
    try {
      let imageUrl
      if (attach) {
        setUploading(true)
        const up = await backend.uploadImage(attach.file)
        imageUrl = up.url
        setUploading(false)
      }
      const payload = isProfile
        ? { targetUserId: profileUserId, body, imageUrl }
        : { animeId, body, imageUrl }
      const c = await backend.addComment(payload)
      const next = [c, ...list]
      setList(next)
      report(next)
      setText('')
      clearAttach()
    } catch (err) {
      showToast(err.message || 'Ошибка')
    } finally {
      setBusy(false)
      setUploading(false)
    }
  }

  function startEdit(c) {
    setEditingId(c.id)
    setEditText(c.body)
  }

  async function saveEdit(id) {
    const body = editText.trim()
    const target = list.find((c) => c.id === id)
    if (!body && !target?.imageUrl) return
    try {
      const updated = await backend.updateComment(id, body)
      setList((prev) => prev.map((c) => (c.id === id ? { ...updated } : c)))
      setEditingId(null)
      showToast('Комментарий обновлён')
    } catch (err) {
      showToast(err.message || 'Ошибка')
    }
  }

  async function remove(id) {
    if (!window.confirm('Удалить комментарий?')) return
    try {
      await backend.deleteComment(id)
      const next = list.filter((c) => c.id !== id)
      setList(next)
      report(next)
      showToast('Комментарий удалён')
    } catch (err) {
      showToast(err.message || 'Ошибка')
    }
  }

  async function toggleLike(c) {
    if (!requireAuth()) return
    // optimistic update
    setList((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? {
              ...x,
              likedByMe: !x.likedByMe,
              likeCount: x.likeCount + (x.likedByMe ? -1 : 1),
            }
          : x
      )
    )
    try {
      const res = await backend.likeComment(c.id)
      setList((prev) =>
        prev.map((x) =>
          x.id === c.id ? { ...x, likedByMe: res.liked, likeCount: res.likeCount } : x
        )
      )
    } catch (err) {
      showToast(err.message || 'Ошибка')
      load() // revert by reloading
    }
  }

  const placeholder = isProfile
    ? 'Написать на стене профиля…'
    : 'Поделитесь мнением об аниме…'

  return (
    <div>
      {user ? (
        <form className="comment-form" onSubmit={submit}>
          <Avatar user={user} size={40} />
          <div style={{ flex: 1 }}>
            <textarea
              className="comment-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              maxLength={5000}
            />

            {attach && (
              <div className="attach-preview">
                <img src={attach.preview} alt="превью" />
                <button type="button" className="rm" onClick={clearAttach} aria-label="Убрать">
                  <CloseIcon width={14} height={14} />
                </button>
              </div>
            )}

            <div className="comment-attach-row">
              <button
                type="button"
                className="attach-btn"
                onClick={() => fileRef.current?.click()}
              >
                <ImageIcon width={15} height={15} /> Картинка / GIF
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                hidden
                onChange={pickFile}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || (!text.trim() && !attach)}
              >
                {uploading ? 'Загрузка…' : busy ? 'Отправка…' : 'Отправить'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="comment-login">
          <button onClick={() => openAuth('login')}>Войдите</button>, чтобы оставить комментарий
        </div>
      )}

      {loading ? (
        <div className="comment-empty">Загрузка комментариев…</div>
      ) : list.length === 0 ? (
        <div className="comment-empty">
          {isProfile ? 'На стене пока пусто.' : 'Пока нет комментариев. Будьте первым!'}
        </div>
      ) : (
        <div className="comment-list">
          {list.map((c) => (
            <div className="comment" key={c.id}>
              <Link to={c.author ? `/u/${c.author.id}` : '#'}>
                <Avatar user={c.author} size={40} />
              </Link>
              <div className="comment-body">
                <div className="comment-top">
                  <Link to={c.author ? `/u/${c.author.id}` : '#'} className="author">
                    {c.author?.username || 'Аноним'}
                  </Link>
                  <span className="time">{timeAgo(c.createdAt)}</span>
                  {c.updatedAt !== c.createdAt && <span className="time">(изменён)</span>}
                </div>

                {editingId === c.id ? (
                  <>
                    <textarea
                      className="comment-input"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      maxLength={5000}
                      style={{ background: 'var(--surface-2)' }}
                    />
                    <div className="comment-actions">
                      <button onClick={() => saveEdit(c.id)}>сохранить</button>
                      <button onClick={() => setEditingId(null)}>отмена</button>
                    </div>
                  </>
                ) : (
                  <>
                    {c.body && <div className="comment-text">{c.body}</div>}
                    {c.imageUrl && (
                      <img
                        className="comment-image"
                        src={uploadUrl(c.imageUrl)}
                        alt="вложение"
                        loading="lazy"
                        onClick={() => setLightbox(uploadUrl(c.imageUrl))}
                      />
                    )}
                    <div className="comment-actions">
                      <button
                        className={`like-btn ${c.likedByMe ? 'liked' : ''}`}
                        onClick={() => toggleLike(c)}
                      >
                        <HeartIcon
                          width={14}
                          height={14}
                          fill={c.likedByMe ? 'currentColor' : 'none'}
                          style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }}
                        />
                        {c.likeCount > 0 ? c.likeCount : 'нравится'}
                      </button>
                      {user && (user.id === c.author?.id || user.isAdmin || user.isMaster) && (
                        <>
                          <button onClick={() => startEdit(c)}>
                            <EditIcon width={13} height={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                            изменить
                          </button>
                          <button className="del" onClick={() => remove(c.id)}>
                            <TrashIcon width={13} height={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                            удалить
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}
