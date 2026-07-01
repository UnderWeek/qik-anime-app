// YummyAnime API client
// Swagger: server/docs/yummyanime-api.json
// Base server: https://api.yani.tv

const BASE_URL = 'https://api.yani.tv'
const STATIC_URL = 'https://static.yani.tv'

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

// Normalize poster URLs.
export function fixUrl(url) {
  if (!url) return ''
  if (url.startsWith('//')) url = `https:${url}`
  if (url.startsWith('/')) url = `${STATIC_URL}${url}`
  return url
}

// Build fallback chain for a failed static.yani.tv image.
function buildChain(originalUrl) {
  const chain = []
  if (/static\.yani\.tv/i.test(originalUrl)) {
    chain.push(originalUrl.replace(/^https?:\/\/static\.yani\.tv\//i, 'https://imgproxy.yani.tv/'))
  }
  return chain
}

// Global image error fallback — tries next CDN in chain on load failure.
export function initImageFallback() {
  document.addEventListener('error', (e) => {
    const img = e.target
    if (!img || img.tagName !== 'IMG') return
    const src = img.getAttribute('src')
    if (!src || !/yani\.tv/i.test(src)) return

    let step = parseInt(img.getAttribute('data-fb-step') || '0', 10)
    if (step < 0) return // already exhausted all fallbacks

    // First failure: save original URL, build chain
    let chain
    if (step === 0) {
      img.setAttribute('data-fb-orig', src)
      chain = buildChain(src)
      img.setAttribute('data-fb-chain', JSON.stringify(chain))
    } else {
      chain = JSON.parse(img.getAttribute('data-fb-chain') || '[]')
    }

    // Move to next fallback
    step++
    const nextUrl = chain[step - 1]
    if (!nextUrl) {
      img.setAttribute('data-fb-step', '-1') // exhausted
      return
    }

    img.setAttribute('data-fb-step', String(step))
    img.setAttribute('src', nextUrl)
  }, true)
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

  studio: (url) => request(`/anime/studio/${url}`),
}

export default api
