// YummyAnime API client
// Docs: https://old.yummyani.me/api/swagger
// Base server: https://api.yani.tv

const BASE_URL = 'https://api.yani.tv'
const STATIC_URL = 'https://static.yani.tv'

// Backend origin for proxying blocked CDN images (static.yani.tv is blocked in Russia)
const BACKEND_ORIGIN = (() => {
  const env = import.meta.env.VITE_QIK_API_URL?.trim()
  if (env) return env.replace(/\/api\/?$/, '')
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location
    if (import.meta.env.DEV) return `${protocol}//${hostname}:3001`
    return `${protocol}//${hostname}`
  }
  return 'http://localhost:3001'
})()

// The X-Application token is required by the docs for production usage.
// The public endpoints respond without it, but if you have your own token
// (https://yummyani.me/dev/applications) put it here to be safe.
// Private token gives higher rate limits; falls back to public.
const APP_TOKEN =
  import.meta.env.VITE_YUMMY_PRIVATE_TOKEN ||
  import.meta.env.VITE_YUMMY_APP_TOKEN ||
  ''

function buildHeaders(extra = {}) {
  const headers = {
    Accept: 'application/json, image/avif, image/webp',
    Lang: 'ru',
    ...extra,
  }
  if (APP_TOKEN) headers['X-Application'] = APP_TOKEN
  return headers
}

async function request(path, { params, ...options } = {}) {
  let url = `${BASE_URL}${path}`
  if (params) {
    const usp = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return
      if (Array.isArray(v)) v.forEach((item) => usp.append(k, item))
      else usp.append(k, v)
    })
    const qs = usp.toString()
    if (qs) url += `?${qs}`
  }

  const res = await fetch(url, {
    ...options,
    headers: buildHeaders(options.headers),
  })

  if (!res.ok) {
    const err = new Error(`API ${res.status} ${res.statusText}`)
    err.status = res.status
    throw err
  }

  const json = await res.json()
  // YummyAnime wraps payloads in { response: ... }
  return json.response !== undefined ? json.response : json
}

// Normalize protocol-relative poster URLs (//static.yani.tv/...)
// static.yani.tv is blocked for some users → route through our backend proxy
export function fixUrl(url) {
  if (!url) return ''
  if (url.startsWith('//')) url = `https:${url}`
  if (url.startsWith('/')) url = `${STATIC_URL}${url}`
  if (/^https?:\/\/(static|imgproxy)\.yani\.tv\//i.test(url)) {
    return `${BACKEND_ORIGIN}/api/proxy/image?url=${encodeURIComponent(url)}`
  }
  return url
}

const POSTER_SIZES = ['mega', 'huge', 'fullsize', 'big', 'medium', 'small']

export function poster(obj, size = 'medium') {
  if (!obj || !obj.poster) return ''
  const p = obj.poster
  // Try requested size first, then chain from largest to smallest
  if (p[size]) return fixUrl(p[size])
  for (const s of POSTER_SIZES) {
    if (p[s]) return fixUrl(p[s])
  }
  return ''
}

// Upgrade a stored YummyAnime poster URL to a higher-quality size by swapping
// the size folder segment (e.g. /small/ -> /big/). Safe no-op for other URLs.
export function upgradePoster(url, size = 'big') {
  if (!url) return ''
  const fixed = fixUrl(url)
  return fixed.replace(
    /\/posters\/(small|medium|big|huge|mega|full|fullsize)\//,
    `/posters/${size}/`
  )
}

export const api = {
  // Main page aggregated feed
  feed: () => request('/feed'),

  // List / filter anime
  list: (params) => request('/anime', { params }),

  // Single anime by alias or id
  anime: (urlOrId) => request(`/anime/${urlOrId}`),

  // Catalog meta (genres, types)
  catalog: () => request('/anime/catalog'),

  genres: () => request('/anime/genres'),

  schedule: () => request('/anime/schedule'),

  search: (q, params = {}) => request('/search', { params: { q, ...params } }),

  videos: (id) => request(`/anime/${id}/videos`),

  recommendations: (id) => request(`/anime/${id}/recommendations`),

  trailers: (id) => request(`/anime/${id}/trailers`),
}

export default api
