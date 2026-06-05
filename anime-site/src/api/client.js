// YummyAnime API client
// Docs: https://old.yummyani.me/api/swagger
// Base server: https://api.yani.tv

const BASE_URL = 'https://api.yani.tv'
const STATIC_URL = 'https://static.yani.tv'

// The X-Application token is required by the docs for production usage.
// The public endpoints respond without it, but if you have your own token
// (https://yummyani.me/dev/applications) put it here to be safe.
const APP_TOKEN = import.meta.env.VITE_YUMMY_APP_TOKEN || ''

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
export function fixUrl(url) {
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  // Relative poster paths must go to the static CDN, not the website host.
  if (url.startsWith('/')) return `${STATIC_URL}${url}`
  return url
}

export function poster(obj, size = 'medium') {
  if (!obj || !obj.poster) return ''
  const p = obj.poster
  return fixUrl(p[size] || p.medium || p.small || p.big || p.fullsize || '')
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
