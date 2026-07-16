import { useState, useMemo } from 'react'
import { useApi } from '../hooks/useApi.js'
import { api } from '../api/client.js'
import AnimeCard, { CardSkeleton } from '../components/AnimeCard.jsx'
import SEO, { breadcrumbJsonLd } from '../components/SEO.jsx'

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

export default function Schedule() {
  const { data, loading, error } = useApi(() => api.schedule(), [])
  const today = new Date().getDay()
  const [day, setDay] = useState(today)

  const byDay = useMemo(() => {
    const groups = Array.from({ length: 7 }, () => [])
    const list = Array.isArray(data) ? data : []
    list.forEach((a) => {
      const ts = a.episodes?.next_date
      if (!ts) return
      const d = new Date(ts * 1000).getDay()
      groups[d].push(a)
    })
    return groups
  }, [data])

  return (
    <div className="container page">
      <SEO
        title="Расписание выхода аниме на неделю"
        description="Расписание выхода новых серий аниме по дням недели. Следите за онгоингами, узнайте когда выйдет следующая серия."
        canonical="https://quickik.ru/schedule"
        jsonLd={breadcrumbJsonLd([{ name: 'Главная', url: '/' }, { name: 'Расписание' }], 'https://quickik.ru')}
      />

      <div className="section-head" style={{ marginBottom: 24 }}>
        <h2 className="section-title">Расписание выхода</h2>
      </div>

      <div className="day-tabs">
        {DAYS.map((name, idx) => (
          <button
            key={idx}
            className={`chip ${idx === day ? 'active' : ''}`}
            onClick={() => setDay(idx)}
          >
            <span className="d-full">{name}</span>
            {byDay[idx]?.length > 0 && (
              <span style={{ opacity: 0.6, marginLeft: 6 }}>{byDay[idx].length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="state">
          <h2>Не удалось загрузить расписание</h2>
        </div>
      ) : byDay[day].length === 0 ? (
        <div className="state">
          <h2>На {DAYS[day].toLowerCase()} релизов нет</h2>
          <p>Выберите другой день недели.</p>
        </div>
      ) : (
        <div className="grid" key={day} style={{ animation: 'cardFlipIn 0.35s ease' }}>
          {byDay[day].map((a) => (
            <ScheduleCard key={a.anime_id} anime={a} />
          ))}
        </div>
      )}
    </div>
  )
}

function ScheduleCard({ anime }) {
  const ts = anime.episodes?.next_date
  const time = ts
    ? new Date(ts * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null
  return (
    <div style={{ position: 'relative' }}>
      <AnimeCard anime={anime} />
      {time && (
        <div className="schedule-badge">
          {anime.episodes?.aired != null ? `${anime.episodes.aired + 1} эп.` : 'Скоро'} · {time}
        </div>
      )}
    </div>
  )
}
