import { useSearchParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi.js'
import { api } from '../api/client.js'
import AnimeCard, { CardSkeleton } from '../components/AnimeCard.jsx'

export default function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''

  const { data, loading, error } = useApi(
    () => (q ? api.search(q, { limit: 30 }) : Promise.resolve([])),
    [q]
  )

  const results = Array.isArray(data) ? data : []

  return (
    <div className="container page">
      <div className="section-head" style={{ marginBottom: 24 }}>
        <h2 className="section-title">
          Поиск{q ? `: «${q}»` : ''}
        </h2>
        {!loading && results.length > 0 && (
          <span className="section-link">{results.length} результатов</span>
        )}
      </div>

      {!q ? (
        <div className="state">
          <h2>Введите запрос</h2>
          <p>Используйте строку поиска вверху, чтобы найти аниме.</p>
        </div>
      ) : loading ? (
        <div className="grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="state">
          <h2>Ошибка поиска</h2>
          <p>Попробуйте ещё раз.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="state">
          <h2>Ничего не найдено</h2>
          <p>По запросу «{q}» нет результатов.</p>
        </div>
      ) : (
        <div className="grid">
          {results.map((a) => (
            <AnimeCard key={a.anime_id || a.anime_url} anime={a} />
          ))}
        </div>
      )}
    </div>
  )
}
