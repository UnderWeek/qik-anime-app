// Client for the QIK Anime backend (NestJS)
// Resolution order for the API base URL:
//   1. VITE_QIK_API_URL env (explicit override)
//   2. Same host the site is opened from, on port 3001
//      → so a friend opening http://192.168.1.42:5173 will hit
//        http://192.168.1.42:3001/api automatically (LAN works out of the box)
//   3. localhost fallback (SSR / no window)

function resolveBase() {
  const env = import.meta.env.VITE_QIK_API_URL?.trim()
  if (env) return env
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { origin, protocol, hostname } = window.location
    if (import.meta.env.DEV) return `${protocol}//${hostname}:3001/api`
    return `${origin}/api`
  }
  return 'http://localhost:3001/api'
}

const BASE = resolveBase()

// Origin of the backend (without the /api suffix) — used for serving /uploads/*
export const BACKEND_ORIGIN = BASE.replace(/\/api\/?$/, '')

// Turn a stored relative upload path into an absolute URL
export function uploadUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  return `${BACKEND_ORIGIN}${path}`
}

const TOKEN_KEY = 'qik_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const t = getToken()
    if (t) headers.Authorization = `Bearer ${t}`
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const msg = Array.isArray(data?.message)
      ? data.message.join('. ')
      : data?.message || `Ошибка ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data
}

export const backend = {
  // ---- auth ----
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me', { auth: true }),

  // ---- bookmarks ----
  listBookmarks: (status) =>
    request(`/bookmarks${status ? `?status=${status}` : ''}`, { auth: true }),
  getBookmark: (animeId) => request(`/bookmarks/anime/${animeId}`, { auth: true }),
  upsertBookmark: (payload) =>
    request('/bookmarks', { method: 'PUT', body: payload, auth: true }),
  removeBookmark: (animeId) =>
    request(`/bookmarks/anime/${animeId}`, { method: 'DELETE', auth: true }),

  // ---- ratings ----
  getRating: (animeId) => request(`/ratings/anime/${animeId}`, { auth: true }),
  rate: (animeId, score) =>
    request('/ratings', { method: 'PUT', body: { animeId, score }, auth: true }),
  removeRating: (animeId) =>
    request(`/ratings/anime/${animeId}`, { method: 'DELETE', auth: true }),

  // ---- comments ----
  listComments: (animeId) => request(`/comments/anime/${animeId}`, { auth: true }),
  commentCount: (animeId) => request(`/comments/anime/${animeId}/count`),
  profileComments: (userId) => request(`/comments/profile/${userId}`, { auth: true }),
  addComment: (payload) =>
    request('/comments', { method: 'POST', body: payload, auth: true }),
  updateComment: (id, body) =>
    request(`/comments/${id}`, { method: 'PATCH', body: { body }, auth: true }),
  deleteComment: (id) =>
    request(`/comments/${id}`, { method: 'DELETE', auth: true }),
  likeComment: (id) =>
    request(`/comments/${id}/like`, { method: 'POST', auth: true }),

  // ---- uploads (multipart) ----
  uploadImage: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const headers = {}
    const t = getToken()
    if (t) headers.Authorization = `Bearer ${t}`
    const res = await fetch(`${BASE}/uploads/image`, {
      method: 'POST',
      headers,
      body: fd,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const msg = Array.isArray(data?.message)
        ? data.message.join('. ')
        : data?.message || `Ошибка ${res.status}`
      throw new Error(msg)
    }
    return data // { url }
  },

  // ---- watch progress ----
  saveProgress: (payload) =>
    request('/progress', { method: 'PUT', body: payload, auth: true }),
  progressForAnime: (animeId) =>
    request(`/progress/anime/${animeId}`, { auth: true }),
  removeEpisode: (animeId, episodeNumber) =>
    request(`/progress/anime/${animeId}/${encodeURIComponent(episodeNumber)}`, {
      method: 'DELETE',
      auth: true,
    }),
  continueWatching: (limit = 12) =>
    request(`/progress/continue?limit=${limit}`, { auth: true }),
  watchHistory: (userId, limit = 100) =>
    request(`/progress/user/${userId}/history?limit=${limit}`, { auth: true }),
  genreBreakdown: (userId) => request(`/progress/user/${userId}/genres`),

  // ---- profiles / users ----
  profile: (id) => request(`/users/${id}/profile`, { auth: true }),
  updateProfile: (payload) =>
    request('/users/me', { method: 'PATCH', body: payload, auth: true }),
  searchUsers: (q) =>
    request(`/users/search?q=${encodeURIComponent(q)}`, { auth: true }),
  userBookmarks: (id, status) =>
    request(`/users/${id}/bookmarks${status ? `?status=${status}` : ''}`),
  userFriends: (id) => request(`/users/${id}/friends`),

  // ---- friends ----
  listFriends: () => request('/friends', { auth: true }),
  pendingFriends: () => request('/friends/pending', { auth: true }),
  requestFriend: (targetId) =>
    request(`/friends/request/${targetId}`, { method: 'POST', auth: true }),
  acceptFriend: (requestId) =>
    request(`/friends/accept/${requestId}`, { method: 'POST', auth: true }),
  removeFriend: (otherId) =>
    request(`/friends/${otherId}`, { method: 'DELETE', auth: true }),

  // ---- notifications ----
  notifications: () => request('/notifications', { auth: true }),
  unreadCount: () => request('/notifications/unread-count', { auth: true }),
  markAllRead: () => request('/notifications/read-all', { method: 'POST', auth: true }),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'POST', auth: true }),
  removeNotification: (id) =>
    request(`/notifications/${id}`, { method: 'DELETE', auth: true }),

  // ---- suggestions ----
  suggestAnime: (payload) =>
    request('/suggestions', { method: 'POST', body: payload, auth: true }),
}

export default backend
