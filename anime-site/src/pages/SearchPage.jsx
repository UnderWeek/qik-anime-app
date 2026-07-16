import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi.js'
import { api } from '../api/client.js'
import { backend } from '../api/backend.js'
import { useAuth } from '../context/AuthContext.jsx'
import AnimeCard, { CardSkeleton } from '../components/AnimeCard.jsx'
import SEO, { breadcrumbJsonLd } from '../components/SEO.jsx'
import { SearchIcon, CloseIcon } from '../components/icons.jsx'

export default function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const navigate = useNavigate()
  const { user } = useAuth()

  const [history, setHistory] = useState([])

  const { data, loading, error } = useApi(
    () => (q ? api.search(q, { limit: 30 }) : Promise.resolve([])),
    [q]
  )

  const results = Array.isArray(data) ? data : []

  useEffect(() => {
    if (user) {
      backend.searchHistory().then(setHistory).catch(() => {})
    }
  }, [user, q])

  useEffect(() => {
    if (q.trim() && user) {
      backend.saveSearch(q.trim()).catch(() => {})
    }
  }, [q, user])

  function clearHistory() {
    backend.clearSearchHistory().then(() => setHistory([])).catch(() => {})
  }

  function removeItem(id, e) {
    e.stopPropagation()
    backend.deleteSearch(id).then(() => {
      setHistory((prev) => prev.filter((h) => h.id !== id))
    }).catch(() => {})
  }

  return (
    <div className="container page">
      <SEO
        title={q ? `Поиск: ${q}` : 'Поиск аниме'}
        description={q ? `Результаты поиска аниме по запросу «${q}» — найдите нужное аниме в каталоге QIK Anime.` : 'Поиск аниме в каталоге QIK Anime по названию.'}
        canonical={q ? `https://quickik.ru/search?q=${encodeURIComponent(q)}` : 'https://quickik.ru/search'}
        jsonLd={breadcrumbJsonLd([{ name: 'Главная', url: '/' }, { name: q ? `Поиск: ${q}` : 'Поиск' }], 'https://quickik.ru')}
      />

      <div className="section-head" style={{ marginBottom: 24 }}>
        <h2 className="section-title">
          Поиск{q ? `: «${q}»` : ''}
        </h2>
        {!loading && results.length > 0 && (
          <span className="section-link">{results.length} результатов</span>
        )}
      </div>

      {!q ? (
        <div className="search-empty">
          <div className="state">
            <h2>Введите запрос</h2>
            <p>Используйте строку поиска вверху, чтобы найти аниме.</p>
          </div>

          {user ? (
            <div className="search-history">
              <div className="search-history-head">
                <h3>История поиска</h3>
                {history.length > 0 && (
                  <button className="search-history-clear" onClick={clearHistory}>Очистить</button>
                )}
              </div>
              {history.length > 0 ? (
                <div className="search-history-list">
                  {history.map((h) => (
                    <button
                      key={h.id}
                      className="search-history-item"
                      onClick={() => navigate(`/search?q=${encodeURIComponent(h.query)}`)}
                    >
                      <SearchIcon width={14} height={14} />
                      <span className="search-history-text">{h.query}</span>
                      <span
                        className="search-history-remove"
                        onClick={(e) => removeItem(h.id, e)}
                        title="Удалить"
                      >
                        <CloseIcon width={12} height={12} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="search-history-empty">Здесь будут ваши недавние поисковые запросы.</p>
              )}
            </div>
          ) : (
            <p className="search-history-login-hint">
              <button className="link" onClick={() => navigate('/')}>Войдите</button>, чтобы сохранять историю поиска.
            </p>
          )}
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
