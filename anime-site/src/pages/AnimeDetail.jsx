import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useApi } from '../hooks/useApi.js'
import { api, poster } from '../api/client.js'
import { backend } from '../api/backend.js'
import AnimeCard from '../components/AnimeCard.jsx'
import Section from '../components/Section.jsx'
import Carousel from '../components/Carousel.jsx'
import BookmarkButton from '../components/BookmarkButton.jsx'
import RatingWidget from '../components/RatingWidget.jsx'
import OpeningRatingWidget from '../components/OpeningRatingWidget.jsx'
import Comments from '../components/Comments.jsx'
import SuggestModal from '../components/SuggestModal.jsx'
import Lightbox from '../components/Lightbox.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PlayIcon, ArrowLeft, UsersIcon } from '../components/icons.jsx'
import SEO, { animeJsonLd, breadcrumbJsonLd } from '../components/SEO.jsx'

function fmtNum(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K'
  return String(n)
}

export default function AnimeDetail() {
  const { url } = useParams()
  const location = useLocation()
  const { user, requireAuth } = useAuth()
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [posterZoom, setPosterZoom] = useState(null)
  const [commentCount, setCommentCount] = useState(null)
  const { data: anime, loading, error } = useApi(() => api.anime(url), [url])
  const { data: recs } = useApi(
    () => (anime?.anime_id ? api.recommendations(anime.anime_id) : Promise.resolve([])),
    [anime?.anime_id]
  )

  // QIK-native comment count (not the YummyAnime API one)
  useEffect(() => {
    if (!anime?.anime_id) return
    backend
      .commentCount(anime.anime_id)
      .then((n) => setCommentCount(typeof n === 'number' ? n : 0))
      .catch(() => {})
  }, [anime?.anime_id])

  // Scroll to comments section when navigated with #comments hash
  useEffect(() => {
    if (location.hash === '#comments' && !loading && anime) {
      const el = document.getElementById('comments')
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [location.hash, loading, anime])

  if (loading) {
    return (
      <div className="container page">
        <SEO title="Загрузка…" />
        <div className="skel" style={{ height: 360, borderRadius: 16, marginBottom: 34 }} />
        <div className="skel skel-line" style={{ width: '40%', height: 24 }} />
      </div>
    )
  }

  if (error || !anime) {
    return (
      <div className="container page">
        <SEO title="Аниме не найдено" description="Запрашиваемое аниме не найдено. Возможно, ссылка устарела." />
        <div className="state">
          <h2>Аниме не найдено</h2>
          <p>Возможно, ссылка устарела.</p>
          <Link to="/catalog" className="btn btn-ghost" style={{ marginTop: 18 }}>
            В каталог
          </Link>
        </div>
      </div>
    )
  }

  const bg = poster(anime, 'big') || poster(anime, 'fullsize') || poster(anime, 'huge')
  const img = poster(anime, 'big') || poster(anime, 'medium')
  const rate = anime.rating?.average
  const recList = Array.isArray(recs) ? recs : []
  const desc = anime.description?.replace(/<[^>]+>/g, '').substring(0, 300) || ''
  const shareImage = img || 'https://quickik.ru/og-image.png'

  const info = [
    ['Тип', anime.type?.name],
    ['Статус', anime.anime_status?.title],
    ['Год', anime.year],
    ['Эпизоды', anime.episodes?.aired ? `${anime.episodes.aired}${anime.episodes.count ? ` из ${anime.episodes.count}` : ''}` : null],
    ['Возраст', anime.min_age?.title_long || anime.min_age?.title],
    ['Студия', anime.studios?.[0]?.title],
    ['Озвучка', anime.translates?.map((t) => t.title).join(', ')],
    ['Первоисточник', anime.original],
  ].filter(([, v]) => v)

  return (
    <div className="page">
      <SEO
        title={`${anime.title} — смотреть онлайн`}
        description={desc || `Смотреть ${anime.title} онлайн. ${anime.type?.name || 'Аниме'}${anime.year ? `, ${anime.year} год` : ''}.`}
        image={shareImage}
        url={`https://quickik.ru/anime/${url}`}
        type="video.tv_show"
        canonical={`https://quickik.ru/anime/${url}`}
        jsonLd={[
          animeJsonLd(anime, 'https://quickik.ru'),
          breadcrumbJsonLd([
            { name: 'Главная', url: '/' },
            { name: 'Каталог', url: '/catalog' },
            { name: anime.title },
          ], 'https://quickik.ru'),
        ]}
      />

      <div className="detail-hero">
        <div className="detail-hero-bg" style={{ backgroundImage: `url(${bg})` }} />
        <div className="detail-hero-overlay" />
        <div className="container">
          <div className="detail-hero-inner">
            <div className="detail-poster" onClick={() => setPosterZoom(bg || img)} style={{ cursor: 'pointer' }} title="Увеличить постер">
              {img && <img src={img} alt={anime.title} />}
            </div>
            <div className="detail-info">
              <Link to="/catalog" className="section-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <ArrowLeft width={14} height={14} /> Каталог
              </Link>
              <h1>{anime.title}</h1>
              {anime.other_titles?.length > 0 && (
                <div className="detail-alt">{anime.other_titles.slice(0, 3).join(' · ')}</div>
              )}

              <div className="detail-stats">
                {rate > 0 && (
                  <div className="stat">
                    <b className="gold">{rate.toFixed(2)}</b>
                    <span>Рейтинг</span>
                  </div>
                )}
                <div className="stat">
                  <b>{fmtNum(anime.views)}</b>
                  <span>Просмотры</span>
                </div>
                {anime.year && (
                  <div className="stat">
                    <b>{anime.year}</b>
                    <span>Год</span>
                  </div>
                )}
                {anime.episodes?.aired ? (
                  <div className="stat">
                    <b>{anime.episodes.aired}</b>
                    <span>Эпизоды</span>
                  </div>
                ) : null}
              </div>

              {anime.genres?.length > 0 && (
                <div className="detail-genres">
                  {anime.genres.map((g) => (
                    <Link key={g.id} to={`/catalog?genre=${g.id}`} className="chip">
                      {g.title}
                    </Link>
                  ))}
                </div>
              )}

              <div className="hero-actions">
                <Link to={`/anime/${url}/watch`} className="btn btn-primary">
                  <PlayIcon width={16} height={16} /> Смотреть онлайн
                </Link>
                <BookmarkButton anime={anime} posterUrl={img} />
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    if (!requireAuth()) return
                    setSuggestOpen(true)
                  }}
                >
                  <UsersIcon width={16} height={16} /> Посоветовать
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="detail-body">
          <div>
            <Section title="Описание">
              <p className="prose">{anime.description || 'Описание отсутствует.'}</p>
            </Section>

            {recList.length > 0 && (
              <Section title="Похожие аниме">
                <Carousel>
                  {recList.slice(0, 18).map((a) => (
                    <AnimeCard key={a.anime_id} anime={a} />
                  ))}
                </Carousel>
              </Section>
            )}

            <Section title="Комментарии">
              <div id="comments"><Comments animeId={anime.anime_id} onCountChange={setCommentCount} /></div>
            </Section>
          </div>

          <aside>
            <RatingWidget animeId={anime.anime_id} />
            <OpeningRatingWidget animeId={anime.anime_id} />
            <div className="info-card">
              {info.map(([k, v]) => (
                <div className="info-row" key={k}>
                  <span className="k">{k}</span>
                  <span className="v">{v}</span>
                </div>
              ))}
              <div className="info-row">
                <span className="k">Комментарии</span>
                <span className="v">{commentCount == null ? '…' : fmtNum(commentCount)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {suggestOpen && (
        <SuggestModal anime={anime} posterUrl={img} onClose={() => setSuggestOpen(false)} />
      )}
      {posterZoom && <Lightbox src={posterZoom} onClose={() => setPosterZoom(null)} />}
    </div>
  )
}
