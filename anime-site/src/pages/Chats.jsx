import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { BACKEND_ORIGIN, backend, getToken, uploadUrl } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import Lightbox from '../components/Lightbox.jsx'
import { ArrowLeft, ImageIcon, CloseIcon } from '../components/icons.jsx'
import SEO from '../components/SEO.jsx'

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
  const [searchParams] = useSearchParams()
  const openChatId = searchParams.get('chat')
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const autoOpenedRef = useRef(false)
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

  // Auto-open chat from notification link
  useEffect(() => {
    if (!openChatId || !chats.length || autoOpenedRef.current) return
    const target = chats.find((c) => String(c.id) === openChatId)
    if (target) {
      autoOpenedRef.current = true
      setActiveChat(target)
      setMessages([])
      setMsgsLoading(true)
      backend.chatMessages(target.id).then((msgs) => {
        setMessages(Array.isArray(msgs) ? msgs : [])
        setMsgsLoading(false)
      }).catch(() => {
        setMessages([])
        setMsgsLoading(false)
      })
    }
  }, [chats, openChatId])

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
    <div className="container page">
      <SEO
        title="Чаты"
        description="Личные сообщения на QIK Anime."
        canonical="https://quickik.ru/chats"
      />

      <div className="state" style={{ padding: 40 }}>
        <span style={{ fontSize: 40 }}>🚧</span>
        <h2 style={{ marginTop: 16 }}>Чаты временно недоступны</h2>
        <p style={{ color: 'var(--text-faint)', marginTop: 8, maxWidth: 420, textAlign: 'center' }}>
          Мы работаем над улучшением чатов. Скоро они вернутся.
        </p>
      </div>

    </div>
  )
}
