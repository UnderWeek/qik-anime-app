import { Link } from 'react-router-dom'
import { poster } from '../api/client.js'
import { StarIcon } from './icons.jsx'

export default function AnimeCard({ anime }) {
  if (!anime) return null
  const url = anime.anime_url || anime.url
  const img = poster(anime, 'mega')
  const rate = anime.rating?.average
  const type = anime.type?.shortname || anime.type?.name
  const year = anime.year

  return (
    <Link to={`/anime/${url}`} className="card">
      <div className="card-poster">
        {img ? (
          <img src={img} alt={anime.title} loading="lazy" />
        ) : (
          <div className="skel" style={{ width: '100%', height: '100%' }} />
        )}
        {rate > 0 && (
          <div className="card-badge rate">
            <StarIcon width={11} height={11} />
            {rate.toFixed(1)}
          </div>
        )}
        {type && <div className="card-badge type">{type}</div>}
      </div>
      <div className="card-title">{anime.title}</div>
      <div className="card-meta">
        {year ? <span>{year}</span> : null}
        {anime.episodes?.aired ? <span>{anime.episodes.aired} эп.</span> : null}
      </div>
    </Link>
  )
}

export function CardSkeleton() {
  return (
    <div className="card">
      <div className="skel skel-poster" />
      <div className="skel skel-line" style={{ width: '85%' }} />
      <div className="skel skel-line" style={{ width: '50%' }} />
    </div>
  )
}
