import { useState } from 'react'
import { useApi } from '../hooks/useApi.js'
import { api } from '../api/client.js'
import Hero from '../components/Hero.jsx'
import Section from '../components/Section.jsx'
import AnimeCard, { CardSkeleton } from '../components/AnimeCard.jsx'
import ContinueWatching from '../components/ContinueWatching.jsx'
import SEO, { websiteJsonLd } from '../components/SEO.jsx'

function Row({ items, scroll }) {
  return (
    <div className={scroll ? 'row-scroll' : 'grid'}>
      {items.map((a) => (
        <AnimeCard key={a.anime_id || a.anime_url} anime={a} />
      ))}
    </div>
  )
}

function GridSkeleton({ count = 12 }) {
  return (
    <div className="grid">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

function ResetBanner() {
  const [hidden, setHidden] = useState(() => localStorage.getItem('qik_reset_banner_hidden') === '1')
  if (hidden) return null

  function dismiss() {
    localStorage.setItem('qik_reset_banner_hidden', '1')
    setHidden(true)
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '18px 22px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      fontSize: 14.5,
      lineHeight: 1.55,
      color: 'var(--text-secondary)',
    }}>
      <span style={{ fontSize: 28, flexShrink: 0 }}>😔</span>
      <div style={{ flex: 1 }}>
        <strong style={{ color: 'var(--text-primary)' }}>База данных была сброшена</strong><br />
        При деплое 20 июня я допустил ошибку — CI/CD затёр базу. Бэкапов не было, и все аккаунты с закладками потеряны. Мне очень жаль.<br />
        Придётся создать новый аккаунт. Я настроил ежедневные бэкапы, и такого больше не случится.
      </div>
      <button onClick={dismiss} style={{
        background: 'none', border: 'none', color: 'var(--text-faint)',
        cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px', flexShrink: 0,
      }}>✕</button>
    </div>
  )
}

export default function Home() {
  const { data: feed, loading, error } = useApi(() => api.feed(), [])

  if (error) {
    return (
      <div className="container page">
        <SEO />
        <ResetBanner />
        <div className="state">
          <h2>Не удалось загрузить</h2>
          <p>Проверьте подключение к сети и попробуйте обновить страницу.</p>
        </div>
      </div>
    )
  }

  const carousel = feed?.top_carousel?.items || []
  const fresh = feed?.new || []
  const newVideos = dedupe(feed?.new_videos || [])
  const announcements = feed?.announcements || []

  return (
    <div className="container page">
      <SEO url="https://quickik.ru" jsonLd={websiteJsonLd('https://quickik.ru')} />
      <ResetBanner />

      {loading ? (
        <div className="hero skel" style={{ height: 440, marginBottom: 52 }} />
      ) : (
        <Hero items={carousel} />
      )}

      <ContinueWatching />

      <Section title="Новые серии" link="/catalog?sort=last_view_date">
        {loading ? <GridSkeleton /> : <Row items={newVideos.slice(0, 12)} />}
      </Section>

      <Section title="Свежие релизы" link="/catalog">
        {loading ? <GridSkeleton /> : <Row items={fresh.slice(0, 12)} />}
      </Section>

      <Section title="Анонсы" link="/catalog?status=anons">
        {loading ? <GridSkeleton count={6} /> : <Row items={announcements.slice(0, 12)} />}
      </Section>
    </div>
  )
}

// new_videos can list the same anime multiple times (different episodes)
function dedupe(list) {
  const seen = new Set()
  const out = []
  for (const a of list) {
    const id = a.anime_id || a.anime_url
    if (seen.has(id)) continue
    seen.add(id)
    out.push(a)
  }
  return out
}
