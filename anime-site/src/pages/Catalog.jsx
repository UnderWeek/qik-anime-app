import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useApi } from '../hooks/useApi.js'
import AnimeCard, { CardSkeleton } from '../components/AnimeCard.jsx'
import { CloseIcon, SearchIcon } from '../components/icons.jsx'

const SORTS = [
  { v: 'rating', label: 'По рейтингу' },
  { v: 'views', label: 'По просмотрам' },
  { v: 'year', label: 'По году' },
  { v: 'title', label: 'По названию' },
  { v: 'rating_counters', label: 'По числу оценок' },
  { v: 'top', label: 'В топе' },
  { v: 'id', label: 'По дате добавления' },
  { v: 'random', label: 'Случайно' },
]

const TYPES = [
  { v: 'tv', label: 'ТВ-сериал' },
  { v: 'movie', label: 'Фильм' },
  { v: 'ova', label: 'OVA' },
  { v: 'ona', label: 'ONA' },
  { v: 'special', label: 'Спешл' },
  { v: 'shortfilm', label: 'Короткометражка' },
  { v: 'shorttv', label: 'Короткий ТВ' },
]

const STATUSES = [
  { v: 'ongoing', label: 'Онгоинг' },
  { v: 'released', label: 'Вышел' },
  { v: 'announcement', label: 'Анонс' },
]

const TRANSLATES = [
  { v: 'dubbing', label: 'Дубляж' },
  { v: 'multivoice', label: 'Многоголосый' },
  { v: 'twovoice', label: 'Двухголосый' },
  { v: 'onevoice', label: 'Одноголосый' },
  { v: 'subtitles', label: 'Субтитры' },
]

const SEASONS = [
  { v: 'winter', label: 'Зима' },
  { v: 'spring', label: 'Весна' },
  { v: 'summer', label: 'Лето' },
  { v: 'fall', label: 'Осень' },
]

const AGES = [
  { v: '1', label: 'G' },
  { v: '2', label: 'PG' },
  { v: '3', label: 'PG-13' },
  { v: '4', label: 'R-17' },
  { v: '5', label: 'R+' },
]

const PAGE = 24

// helpers for comma-separated multi-value params in the URL
function readArr(params, key) {
  const v = params.get(key)
  return v ? v.split(',').filter(Boolean) : []
}

export default function Catalog() {
  const [params, setParams] = useSearchParams()
  const { data: catData } = useApi(() => api.genres(), [])
  const genres = catData?.genres || []

  // scalar params
  const sort = params.get('sort') || 'rating'
  const order = params.get('order') || 'desc' // desc | asc
  const fromYear = params.get('from_year') || ''
  const toYear = params.get('to_year') || ''
  const epFrom = params.get('ep_from') || ''
  const epTo = params.get('ep_to') || ''
  const minRating = params.get('min_rating') || ''
  const q = params.get('q') || ''

  // multi params
  const types = readArr(params, 'types')
  const statuses = readArr(params, 'status')
  const translates = readArr(params, 'translates')
  const seasons = readArr(params, 'season')
  const ages = readArr(params, 'min_age')
  const genreSel = readArr(params, 'genres')
  const genreExcl = readArr(params, 'exclude_genres')

  const [genreQuery, setGenreQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  const [items, setItems] = useState([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(false)
  const reqId = useRef(0)

  const fetchPage = useCallback(
    async (off, replace) => {
      const id = ++reqId.current
      if (replace) setLoading(true)
      else setLoadingMore(true)
      setError(false)
      try {
        const res = await api.list({
          limit: PAGE,
          offset: off,
          sort,
          sort_forward: order === 'asc',
          types: types.length ? types : undefined,
          status: statuses.length ? statuses : undefined,
          translates: translates.length ? translates : undefined,
          season: seasons.length ? seasons : undefined,
          min_age: ages.length ? ages : undefined,
          genres: genreSel.length ? genreSel : undefined,
          exclude_genres: genreExcl.length ? genreExcl : undefined,
          from_year: fromYear || undefined,
          to_year: toYear || undefined,
          ep_from: epFrom || undefined,
          ep_to: epTo || undefined,
          min_rating: minRating || undefined,
          q: q || undefined,
        })
        if (id !== reqId.current) return
        const list = Array.isArray(res) ? res : []
        setItems((prev) => (replace ? list : [...prev, ...list]))
        setDone(list.length < PAGE)
      } catch (e) {
        if (id === reqId.current) setError(true)
      } finally {
        if (id === reqId.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.toString()]
  )

  useEffect(() => {
    setOffset(0)
    setDone(false)
    fetchPage(0, true)
  }, [fetchPage])

  function loadMore() {
    const next = offset + PAGE
    setOffset(next)
    fetchPage(next, false)
  }

  function setScalar(key, value) {
    const p = new URLSearchParams(params)
    if (value) p.set(key, value)
    else p.delete(key)
    setParams(p)
  }

  function toggleMulti(key, value) {
    const p = new URLSearchParams(params)
    const cur = readArr(p, key)
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
    if (next.length) p.set(key, next.join(','))
    else p.delete(key)
    setParams(p)
  }

  // genre 3-state cycle: none -> include -> exclude -> none
  function cycleGenre(val) {
    const p = new URLSearchParams(params)
    const inc = readArr(p, 'genres')
    const exc = readArr(p, 'exclude_genres')
    const v = String(val)
    if (inc.includes(v)) {
      // include -> exclude
      const ni = inc.filter((x) => x !== v)
      const ne = [...exc, v]
      ni.length ? p.set('genres', ni.join(',')) : p.delete('genres')
      p.set('exclude_genres', ne.join(','))
    } else if (exc.includes(v)) {
      // exclude -> none
      const ne = exc.filter((x) => x !== v)
      ne.length ? p.set('exclude_genres', ne.join(',')) : p.delete('exclude_genres')
    } else {
      // none -> include
      p.set('genres', [...inc, v].join(','))
    }
    setParams(p)
  }

  function reset() {
    setParams(new URLSearchParams())
  }

  const activeCount =
    types.length +
    statuses.length +
    translates.length +
    seasons.length +
    ages.length +
    genreSel.length +
    genreExcl.length +
    (fromYear ? 1 : 0) +
    (toYear ? 1 : 0) +
    (epFrom ? 1 : 0) +
    (epTo ? 1 : 0) +
    (minRating ? 1 : 0)

  const filteredGenres = genres.filter((g) =>
    g.title.toLowerCase().includes(genreQuery.toLowerCase())
  )

  const sidebar = (
    <aside className="catalog-sidebar">
      <div className="cat-filter-head">
        <h3>Фильтры</h3>
        {activeCount > 0 && (
          <button className="cat-reset" onClick={reset}>
            Сбросить ({activeCount})
          </button>
        )}
      </div>

      {/* sort */}
      <div className="filter-group">
        <div className="filter-label">Сортировка</div>
        <select className="select" value={sort} onChange={(e) => setScalar('sort', e.target.value)}>
          {SORTS.map((s) => (
            <option key={s.v} value={s.v}>{s.label}</option>
          ))}
        </select>
        <div className="seg" style={{ marginTop: 8 }}>
          <button className={order === 'desc' ? 'active' : ''} onClick={() => setScalar('order', 'desc')}>
            ↓ убыв.
          </button>
          <button className={order === 'asc' ? 'active' : ''} onClick={() => setScalar('order', 'asc')}>
            ↑ возр.
          </button>
        </div>
      </div>

      {/* type */}
      <div className="filter-group">
        <div className="filter-label">Тип</div>
        <div className="chips">
          {TYPES.map((t) => (
            <button
              key={t.v}
              className={`chip ${types.includes(t.v) ? 'active' : ''}`}
              onClick={() => toggleMulti('types', t.v)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* status */}
      <div className="filter-group">
        <div className="filter-label">Статус</div>
        <div className="chips">
          {STATUSES.map((s) => (
            <button
              key={s.v}
              className={`chip ${statuses.includes(s.v) ? 'active' : ''}`}
              onClick={() => toggleMulti('status', s.v)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* translate */}
      <div className="filter-group">
        <div className="filter-label">Озвучка</div>
        <div className="chips">
          {TRANSLATES.map((t) => (
            <button
              key={t.v}
              className={`chip ${translates.includes(t.v) ? 'active' : ''}`}
              onClick={() => toggleMulti('translates', t.v)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* season */}
      <div className="filter-group">
        <div className="filter-label">Сезон</div>
        <div className="chips">
          {SEASONS.map((s) => (
            <button
              key={s.v}
              className={`chip ${seasons.includes(s.v) ? 'active' : ''}`}
              onClick={() => toggleMulti('season', s.v)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* age rating */}
      <div className="filter-group">
        <div className="filter-label">Возрастной рейтинг</div>
        <div className="chips">
          {AGES.map((a) => (
            <button
              key={a.v}
              className={`chip ${ages.includes(a.v) ? 'active' : ''}`}
              onClick={() => toggleMulti('min_age', a.v)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* year range */}
      <div className="filter-group">
        <div className="filter-label">Год выхода</div>
        <div className="range-row">
          <input
            type="number"
            className="select"
            placeholder="от"
            value={fromYear}
            min="1960"
            max="2030"
            onChange={(e) => setScalar('from_year', e.target.value)}
          />
          <span>—</span>
          <input
            type="number"
            className="select"
            placeholder="до"
            value={toYear}
            min="1960"
            max="2030"
            onChange={(e) => setScalar('to_year', e.target.value)}
          />
        </div>
      </div>

      {/* episodes range */}
      <div className="filter-group">
        <div className="filter-label">Количество серий</div>
        <div className="range-row">
          <input
            type="number"
            className="select"
            placeholder="от"
            value={epFrom}
            min="0"
            onChange={(e) => setScalar('ep_from', e.target.value)}
          />
          <span>—</span>
          <input
            type="number"
            className="select"
            placeholder="до"
            value={epTo}
            min="0"
            onChange={(e) => setScalar('ep_to', e.target.value)}
          />
        </div>
      </div>

      {/* min rating */}
      <div className="filter-group">
        <div className="filter-label">
          Минимальный рейтинг{minRating ? `: ${minRating}` : ''}
        </div>
        <input
          type="range"
          min="0"
          max="10"
          step="0.5"
          value={minRating || 0}
          onChange={(e) => setScalar('min_rating', e.target.value === '0' ? '' : e.target.value)}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>

      {/* genres */}
      <div className="filter-group">
        <div className="filter-label">Жанры</div>
        <div className="genre-search">
          <SearchIcon width={15} height={15} />
          <input
            value={genreQuery}
            onChange={(e) => setGenreQuery(e.target.value)}
            placeholder="Поиск жанра…"
          />
        </div>
        <div className="genre-hint">Клик: ✓ включить · ещё клик: ✕ исключить</div>
        <div className="genre-list">
          {filteredGenres.map((g) => {
            const v = String(g.value)
            const inc = genreSel.includes(v)
            const exc = genreExcl.includes(v)
            return (
              <button
                key={g.value}
                className={`genre-item ${inc ? 'inc' : ''} ${exc ? 'exc' : ''}`}
                onClick={() => cycleGenre(g.value)}
              >
                <span className="mark">{inc ? '✓' : exc ? '✕' : ''}</span>
                {g.title}
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )

  return (
    <div className="container page">
      <div className="section-head" style={{ marginBottom: 22 }}>
        <h2 className="section-title">Каталог аниме</h2>
        <button className="btn btn-ghost btn-sm catalog-filter-toggle" onClick={() => setMobileOpen(true)}>
          Фильтры{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>

      <div className="catalog-layout">
        {/* desktop sidebar */}
        <div className="catalog-sidebar-wrap">{sidebar}</div>

        {/* mobile drawer */}
        {mobileOpen && (
          <div className="drawer" onClick={() => setMobileOpen(false)}>
            <div
              className="drawer-panel"
              style={{ width: 320, maxWidth: '90vw', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="burger"
                style={{ alignSelf: 'flex-end', marginBottom: 8 }}
                onClick={() => setMobileOpen(false)}
                aria-label="Закрыть"
              >
                <CloseIcon width={20} height={20} />
              </button>
              {sidebar}
            </div>
          </div>
        )}

        {/* results */}
        <div className="catalog-results">
          {error && items.length === 0 ? (
            <div className="state">
              <h2>Ошибка загрузки</h2>
              <p>Попробуйте изменить фильтры или обновить страницу.</p>
            </div>
          ) : loading ? (
            <div className="grid">
              {Array.from({ length: PAGE }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="state">
              <h2>Ничего не найдено</h2>
              <p>Под выбранные фильтры нет аниме.</p>
            </div>
          ) : (
            <>
              <div className="grid">
                {items.map((a, idx) => (
                  <AnimeCard key={`${a.anime_id}-${idx}`} anime={a} />
                ))}
              </div>
              {!done && (
                <div className="load-more">
                  <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? 'Загрузка…' : 'Показать ещё'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
