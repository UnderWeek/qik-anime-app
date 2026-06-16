import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import { BACKEND_ORIGIN, backend, getToken, uploadUrl } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import Lightbox from '../components/Lightbox.jsx'
import { ArrowLeft, ImageIcon, CloseIcon } from '../components/icons.jsx'

function timeAgo(iso) {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'сейчас'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч`
  return d.toLocaleDateString('ru-RU')
}

export default function Chats() {
  const { user, ready, openAuth, showToast } = useAuth()
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [text, setText] = useState('')
  const [attach, setAttach] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef(null)
  const msgEndRef = useRef(null)
  const socketRef = useRef(null)

  const loadChats = useCallback(async () => {
    try {
      const list = await backend.listChats()
      setChats(Array.isArray(list) ? list : [])
    } catch { setChats([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (user) { setLoading(true); loadChats() } else setLoading(false) }, [user, loadChats])

  // Scroll to bottom when messages change
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Socket connection
  useEffect(() => {
    if (!user || !activeChat) return undefined
    const token = getToken()
    if (!token) return undefined

    const socket = io(`${BACKEND_ORIGIN}/chat`, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('chat:join', { chatId: activeChat.id })
    })

    socket.on('chat:message', (msg) => {
      if (msg) {
        setMessages((prev) => {
          const map = new Map()
          prev.forEach((m) => map.set(m.id, m))
          map.set(msg.id, msg)
          return [...map.values()].sort((a, b) => a.id - b.id)
        })
        // Update last message in chat list
        setChats((prev) =>
          prev.map((c) =>
            c.id === activeChat.id ? { ...c, lastMessage: msg.body || '[изображение]', lastMessageAt: msg.createdAt } : c
          )
        )
      }
    })

    return () => {
      try { socket.emit('chat:leave', { chatId: activeChat.id }) } catch { /* ignore */ }
      socket.disconnect()
      socketRef.current = null
    }
  }, [activeChat, user])

  async function openChat(chat) {
    setActiveChat(chat)
    setMsgsLoading(true)
    setMessages([])
    try {
      const msgs = await backend.chatMessages(chat.id)
      setMessages(Array.isArray(msgs) ? msgs : [])
    } catch {
      setMessages([])
    } finally {
      setMsgsLoading(false)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body && !attach) return
    setSending(true)
    try {
      let imageUrl
      if (attach) {
        setUploading(true)
        const up = await backend.uploadImage(attach.file)
        imageUrl = up?.url
      }
      const msg = await backend.sendChatMessage(activeChat.id, { body, imageUrl })
      setMessages((prev) => {
        const map = new Map()
        prev.forEach((m) => map.set(m.id, m))
        map.set(msg.id, msg)
        return [...map.values()].sort((a, b) => a.id - b.id)
      })
      setText('')
      clearAttach()
    } catch (err) {
      showToast(err.message || 'Не удалось отправить')
    } finally {
      setUploading(false)
      setSending(false)
    }
  }

  function pickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { showToast('Файл больше 8 МБ'); return }
    if (attach?.preview) URL.revokeObjectURL(attach.preview)
    setAttach({ file, preview: URL.createObjectURL(file) })
  }

  function clearAttach() {
    if (attach?.preview) URL.revokeObjectURL(attach.preview)
    setAttach(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  useEffect(() => () => { if (attach?.preview) URL.revokeObjectURL(attach.preview) }, [attach])

  if (ready && !user) {
    return (
      <div className="container page">
        <div className="state">
          <h2>Нужна авторизация</h2>
          <p>Войдите в аккаунт, чтобы использовать чаты.</p>
          <button className="btn btn-primary" onClick={() => openAuth('login')}>Войти</button>
        </div>
      </div>
    )
  }

  return (
    <div className="container page" style={{ paddingBottom: activeChat ? 0 : undefined }}>
      <div className="chat-layout">
        {/* Chat list */}
        <div className={`chat-list-panel${activeChat ? ' hidden-mobile' : ''}`}>
          <h1 style={{ marginBottom: 18 }}>Чаты</h1>
          {loading ? (
            <div className="comment-empty">Загрузка...</div>
          ) : chats.length === 0 ? (
            <div className="state" style={{ padding: 20 }}>
              <p style={{ color: 'var(--text-faint)' }}>Нет чатов.</p>
              <p style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 8 }}>
                Чаты создаются автоматически при первом сообщении другу. Откройте профиль друга чтобы начать.
              </p>
              <Link to="/friends" className="btn btn-ghost" style={{ marginTop: 14 }}>К друзьям</Link>
            </div>
          ) : (
            chats.map((c) => (
              <button
                key={c.id}
                className={`chat-list-item${activeChat?.id === c.id ? ' active' : ''}`}
                onClick={() => openChat(c)}
                type="button"
              >
                <Avatar user={c.with} size={44} />
                <div className="chat-list-info">
                  <div className="chat-list-name">{c.with?.username || 'Пользователь'}</div>
                  <div className="chat-list-preview">{c.lastMessage || 'Нет сообщений'}</div>
                </div>
                <div className="chat-list-time">{timeAgo(c.lastMessageAt)}</div>
              </button>
            ))
          )}
        </div>

        {/* Chat window */}
        {activeChat && (
          <div className="chat-window">
            <div className="chat-window-head">
              <button className="btn btn-ghost btn-sm chat-back-btn" onClick={() => setActiveChat(null)} type="button">
                <ArrowLeft width={16} height={16} />
              </button>
              <Avatar user={activeChat.with} size={34} />
              <div>
                <div className="chat-window-name">{activeChat.with?.username || 'Пользователь'}</div>
              </div>
              <Link to={`/u/${activeChat.with?.id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>Профиль</Link>
            </div>

            <div className="chat-messages">
              {msgsLoading ? (
                <div className="comment-empty">Загрузка...</div>
              ) : messages.length === 0 ? (
                <div className="comment-empty">Нет сообщений. Напишите первое!</div>
              ) : (
                messages.map((m) => {
                  const isMine = m.sender?.id === user?.id
                  return (
                    <div key={m.id} className={`chat-msg${isMine ? ' mine' : ''}`}>
                      {!isMine && <Avatar user={m.sender} size={26} />}
                      <div className="chat-msg-bubble">
                        {m.body && <div className="chat-msg-text">{m.body}</div>}
                        {m.imageUrl && (
                          <img
                            className="chat-msg-img"
                            src={uploadUrl(m.imageUrl)}
                            alt=""
                            onClick={() => setLightbox(uploadUrl(m.imageUrl))}
                          />
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={msgEndRef} />
            </div>

            <form className="chat-input-bar" onSubmit={sendMessage}>
              {attach && (
                <div className="attach-preview">
                  <img src={attach.preview} alt="preview" />
                  <button type="button" className="rm" onClick={clearAttach}><CloseIcon width={13} height={13} /></button>
                </div>
              )}
              <div className="chat-input-row">
                <button type="button" className="attach-btn" onClick={() => fileRef.current?.click()}>
                  <ImageIcon width={15} height={15} />
                </button>
                <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp" onChange={pickFile} />
                <input
                  className="chat-input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Сообщение..."
                  maxLength={5000}
                />
                <button className="btn btn-primary btn-sm" type="submit" disabled={sending || (!text.trim() && !attach)}>
                  {uploading ? '...' : sending ? '...' : 'Отпр'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}
