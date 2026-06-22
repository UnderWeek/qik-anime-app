import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import { UsersIcon, PlayIcon } from '../components/icons.jsx'
import SEO from '../components/SEO.jsx'

function formatWhen(iso) {
  if (!iso) return 'только что'
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Rooms() {
  const { user, openAuth, showToast } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinCode, setJoinCode] = useState('')

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      setRooms([])
      return
    }
    setLoading(true)
    try {
      const list = await backend.listWatchRooms()
      setRooms(Array.isArray(list) ? list : [])
    } catch (err) {
      showToast(err.message || 'Не удалось загрузить комнаты')
      setRooms([])
    } finally {
      setLoading(false)
    }
  }, [showToast, user])

  useEffect(() => {
    load()
  }, [load])

  async function createRoom() {
    if (!user) {
      openAuth('login')
      return
    }
    setCreating(true)
    try {
      const room = await backend.createWatchRoom({})
      if (room?.room?.id) navigate(`/rooms/${room.room.id}`)
    } catch (err) {
      showToast(err.message || 'Не удалось создать комнату')
    } finally {
      setCreating(false)
    }
  }

  async function joinRoom(e) {
    e.preventDefault()
    const code = joinCode.trim()
    if (!code) return
    if (!user) {
      openAuth('login')
      return
    }
    setJoining(true)
    try {
      const room = await backend.joinWatchRoom(code)
      if (room?.room?.id) navigate(`/rooms/${room.room.id}`)
    } catch (err) {
      showToast(err.message || 'Не удалось войти в комнату')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="container page">
      <SEO
        title="Комнаты просмотра"
        description="Совместный просмотр аниме в реальном времени. Присоединяйтесь к комнате или создайте свою."
        canonical="https://quickik.ru/rooms"
      />

      <div className="section-head" style={{ marginBottom: 22 }}>
        <h1 className="section-title">Комнаты просмотра</h1>
      </div>

      {user && !user.isMaster && !user.isAdmin ? (
        <div className="state">
          <h2>Комнаты только для мастеров</h2>
          <p style={{ color: 'var(--text-faint)' }}>Совместный просмотр доступен мастерам сообщества.</p>
        </div>
      ) : !user ? (
        <div className="state">
          <h2>Войдите в аккаунт</h2>
          <p>Комнаты и совместный просмотр доступны только авторизованным пользователям.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => openAuth('login')}>
            Войти
          </button>
        </div>
      ) : (
        <>
          <div className="room-actions">
            <button className="btn btn-primary" onClick={createRoom} disabled={creating}>
              {creating ? 'Создаем...' : 'Создать комнату'}
            </button>

            <form className="room-join-form" onSubmit={joinRoom}>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Код комнаты"
                maxLength={24}
              />
              <button className="btn btn-ghost" type="submit" disabled={joining || !joinCode.trim()}>
                {joining ? 'Входим...' : 'Войти'}
              </button>
            </form>
          </div>

          {loading ? (
            <div className="state" style={{ paddingTop: 40 }}>
              <p>Загрузка...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="state" style={{ paddingTop: 40 }}>
              <h2>Пока пусто</h2>
              <p>Создайте комнату и поделитесь кодом с друзьями.</p>
            </div>
          ) : (
            <div className="room-list">
              {rooms.map((room) => (
                <Link to={`/rooms/${room.id}`} key={room.id} className="room-card">
                  <div className="room-card-head">
                    <div>
                      <div className="room-card-title">{room.state?.animeTitle || 'Комната без выбранного аниме'}</div>
                      <div className="room-card-sub">
                        Код: <b>{room.code}</b>
                      </div>
                    </div>
                    <div className="room-card-members">
                      <UsersIcon width={15} height={15} />
                      {room.membersCount || 1}
                    </div>
                  </div>

                  <div className="room-card-meta">
                    <span>{room.state?.episodeNumber ? `Серия ${room.state.episodeNumber}` : 'Серия не выбрана'}</span>
                    <span>{formatWhen(room.updatedAt)}</span>
                  </div>

                  <div className="room-card-cta">
                    <PlayIcon width={13} height={13} />
                    Открыть комнату
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
