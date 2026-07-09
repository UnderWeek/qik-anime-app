// QIK Anime backend client — mirrors anime-site/src/api/backend.js.
import { request, uploadMultipart } from './client';

export const backend = {
  // ---- auth ----
  register: (payload: { email: string; username: string; password: string }) =>
    request('/auth/register', { method: 'POST', body: payload }),
  login: (payload: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me', { auth: true }),

  // ---- bookmarks ----
  listBookmarks: (status?: string) =>
    request(`/bookmarks${status ? `?status=${status}` : ''}`, { auth: true }),
  getBookmark: (animeId: number | string) =>
    request(`/bookmarks/anime/${animeId}`, { auth: true }),
  upsertBookmark: (payload: { animeId: number; status: string; episodes?: number }) =>
    request('/bookmarks', { method: 'PUT', body: payload, auth: true }),
  removeBookmark: (animeId: number | string) =>
    request(`/bookmarks/anime/${animeId}`, { method: 'DELETE', auth: true }),

  // ---- ratings ----
  getRating: (animeId: number | string) => request(`/ratings/anime/${animeId}`, { auth: true }),
  rate: (animeId: number, score: number) =>
    request('/ratings', { method: 'PUT', body: { animeId, score }, auth: true }),
  removeRating: (animeId: number | string) =>
    request(`/ratings/anime/${animeId}`, { method: 'DELETE', auth: true }),
  getOpeningRatings: (animeId: number | string) =>
    request(`/ratings/opening/${animeId}`, { auth: true }),
  rateOpening: (payload: { animeId: number; type: string; score: number }) =>
    request('/ratings/opening', { method: 'PUT', body: payload, auth: true }),
  removeOpeningRating: (animeId: number | string, type: string) =>
    request(`/ratings/opening/${animeId}/${type}`, { method: 'DELETE', auth: true }),
  topAnime: () => request('/ratings/top/anime'),
  topOpenings: () => request('/ratings/top/openings'),
  topEndings: () => request('/ratings/top/endings'),
  topUsers: () => request('/ratings/top/users'),

  // ---- comments ----
  listComments: (animeId: number | string) =>
    request(`/comments/anime/${animeId}`, { auth: true }),
  commentCount: (animeId: number | string) => request(`/comments/anime/${animeId}/count`),
  profileComments: (userId: number) => request(`/comments/profile/${userId}`, { auth: true }),
  userComments: (userId: number) => request(`/comments/user/${userId}`, { auth: true }),
  addComment: (payload: { animeId: number; body: string; parentId?: number }) =>
    request('/comments', { method: 'POST', body: payload, auth: true }),
  updateComment: (id: number, body: string) =>
    request(`/comments/${id}`, { method: 'PATCH', body: { body }, auth: true }),
  deleteComment: (id: number) => request(`/comments/${id}`, { method: 'DELETE', auth: true }),
  likeComment: (id: number) => request(`/comments/${id}/like`, { method: 'POST', auth: true }),

  // ---- uploads ----
  uploadImage: (file: { uri: string; name?: string; type?: string }) =>
    uploadMultipart('/uploads/image', file),

  // ---- watch progress ----
  saveProgress: (payload: {
    animeId: number;
    episode: number;
    second: number;
    duration: number;
    title?: string;
    poster?: string;
  }) => request('/progress', { method: 'PUT', body: payload, auth: true }),
  progressForAnime: (animeId: number | string) =>
    request(`/progress/anime/${animeId}`, { auth: true }),
  removeEpisode: (animeId: number | string, episodeNumber: string | number) =>
    request(`/progress/anime/${animeId}/${encodeURIComponent(episodeNumber)}`, {
      method: 'DELETE',
      auth: true,
    }),
  continueWatching: (limit = 12) =>
    request(`/progress/continue?limit=${limit}`, { auth: true }),
  watchHistory: (userId: number, limit = 100) =>
    request(`/progress/user/${userId}/history?limit=${limit}`, { auth: true }),
  genreBreakdown: (userId: number) => request(`/progress/user/${userId}/genres`, { auth: true }),

  // ---- profiles / users ----
  profile: (id: number) => request(`/users/${id}/profile`, { auth: true }),
  updateProfile: (payload: any) =>
    request('/users/me', { method: 'PATCH', body: payload, auth: true }),
  searchUsers: (q: string) => request(`/users/search?q=${encodeURIComponent(q)}`, { auth: true }),
  userBookmarks: (id: number, status?: string) =>
    request(`/users/${id}/bookmarks${status ? `?status=${status}` : ''}`),
  userFriends: (id: number) => request(`/users/${id}/friends`),

  // ---- friends ----
  listFriends: () => request('/friends', { auth: true }),
  pendingFriends: () => request('/friends/pending', { auth: true }),
  requestFriend: (targetId: number) =>
    request(`/friends/request/${targetId}`, { method: 'POST', auth: true }),
  acceptFriend: (requestId: number) =>
    request(`/friends/accept/${requestId}`, { method: 'POST', auth: true }),
  removeFriend: (otherId: number) =>
    request(`/friends/${otherId}`, { method: 'DELETE', auth: true }),

  // ---- notifications ----
  notifications: () => request('/notifications', { auth: true }),
  unreadCount: () => request('/notifications/unread-count', { auth: true }),
  markAllRead: () => request('/notifications/read-all', { method: 'POST', auth: true }),
  markRead: (id: number) => request(`/notifications/${id}/read`, { method: 'POST', auth: true }),
  removeNotification: (id: number) =>
    request(`/notifications/${id}`, { method: 'DELETE', auth: true }),

  // ---- anilibria (via watch-rooms proxy) ----
  searchAnilibria: (q: string) =>
    request(`/watch-rooms/search-anilibria?q=${encodeURIComponent(q)}`, { auth: true }),
  anilibriaEpisode: (id: number | string) => request(`/watch-rooms/anilibria-episode/${id}`, { auth: true }),
  anilibriaRelease: (id: number | string) => request(`/watch-rooms/anilibria-release/${id}`, { auth: true }),

  // ---- watch rooms ----
  listWatchRooms: () => request('/watch-rooms', { auth: true }),
  createWatchRoom: (payload: any = {}) =>
    request('/watch-rooms', { method: 'POST', body: payload, auth: true }),
  joinWatchRoom: (code: string) =>
    request('/watch-rooms/join', { method: 'POST', body: { code }, auth: true }),
  joinWatchRoomById: (id: number | string) =>
    request(`/watch-rooms/${id}/join`, { method: 'POST', auth: true }),
  watchRoom: (id: number | string) => request(`/watch-rooms/${id}`, { auth: true }),
  updateWatchRoomState: (id: number | string, payload: any) =>
    request(`/watch-rooms/${id}/state`, { method: 'PATCH', body: payload, auth: true }),
  setWatchRoomVideo: (id: number | string, payload: any) =>
    request(`/watch-rooms/${id}/video`, { method: 'POST', body: payload, auth: true }),
  sendWatchRoomMessage: (id: number | string, payload: { body: string }) =>
    request(`/watch-rooms/${id}/messages`, { method: 'POST', body: payload, auth: true }),
  leaveWatchRoom: (id: number | string) =>
    request(`/watch-rooms/${id}/leave`, { method: 'POST', auth: true }),
  inviteToRoom: (id: number | string, targetId: number) =>
    request(`/watch-rooms/${id}/invite`, { method: 'POST', body: { targetId }, auth: true }),
  closeWatchRoom: (id: number | string) =>
    request(`/watch-rooms/${id}`, { method: 'DELETE', auth: true }),

  // ---- suggestions ----
  suggestAnime: (payload: { friendId: number; animeId: number; message?: string }) =>
    request('/suggestions', { method: 'POST', body: payload, auth: true }),

  // ---- import ----
  importAnixartBookmarks: (entries: any[]) =>
    request('/bookmarks/import/anixart', { method: 'POST', body: { entries }, auth: true }),

  // ---- admin ----
  adminStats: () => request('/admin/stats', { auth: true }),
  adminUsers: (params: any = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== ''),
    );
    const qs = new URLSearchParams(clean as Record<string, string>).toString();
    return request(`/admin/users${qs ? '?' + qs : ''}`, { auth: true });
  },
  adminDeleteUser: (id: number) => request(`/admin/users/${id}`, { method: 'DELETE', auth: true }),
  adminToggleMaster: (id: number) =>
    request(`/admin/users/${id}/master`, { method: 'PATCH', auth: true }),
  adminClaim: (secret: string) =>
    request('/admin/claim', { method: 'POST', body: { secret }, auth: true }),
  adminServer: () => request('/admin/server', { auth: true }),
  adminAudit: (page = 1) => request(`/admin/audit?page=${page}&limit=50`, { auth: true }),
  adminRegistrations: (days = 30) =>
    request(`/admin/registrations?days=${days}`, { auth: true }),

  // ---- quiz ----
  quizQuestion: (exclude?: number[]) => {
    const qs = exclude?.length ? `?exclude=${exclude.join(',')}` : '';
    return request(`/quiz/question${qs}`, { auth: true });
  },
  quizEmoji: (exclude?: number[], difficulty?: string) => {
    const params = new URLSearchParams();
    if (exclude?.length) params.set('exclude', exclude.join(','));
    if (difficulty) params.set('diff', difficulty);
    const qs = params.toString();
    return request(`/quiz/emoji${qs ? '?' + qs : ''}`, { auth: true });
  },

  // ---- chats ----
  listChats: () => request('/chats', { auth: true }),
  startChat: (friendId: number) =>
    request('/chats/start', { method: 'POST', body: { friendId }, auth: true }),
  chatMessages: (chatId: number | string) => request(`/chats/${chatId}/messages`, { auth: true }),
  sendChatMessage: (chatId: number | string, payload: { body: string }) =>
    request(`/chats/${chatId}/messages`, { method: 'POST', body: payload, auth: true }),

  // ---- search history ----
  searchHistory: () => request('/search-history', { auth: true }),
  saveSearch: (query: string) =>
    request('/search-history', { method: 'POST', body: { query }, auth: true }),
  deleteSearch: (id: number) => request(`/search-history/${id}`, { method: 'DELETE', auth: true }),
  clearSearchHistory: () => request('/search-history/clear', { method: 'DELETE', auth: true }),

  // ---- issues (masters/admins) ----
  listIssues: (status?: string) =>
    request(`/issues${status ? '?status=' + status : ''}`, { auth: true }),
  createIssue: (title: string) => request('/issues', { method: 'POST', body: { title }, auth: true }),
  updateIssue: (id: number, status: string) =>
    request(`/issues/${id}`, { method: 'PATCH', body: { status }, auth: true }),
  assignIssue: (id: number) => request(`/issues/${id}/assign`, { method: 'POST', auth: true }),
  deleteIssue: (id: number) => request(`/issues/${id}`, { method: 'DELETE', auth: true }),
  uploadAttachment: (issueId: number, file: { uri: string; name?: string; type?: string }) =>
    uploadMultipart(`/issues/${issueId}/attachments`, file),
  deleteAttachment: (issueId: number, attachmentId: number) =>
    request(`/issues/${issueId}/attachments/${attachmentId}`, { method: 'DELETE', auth: true }),

  // ---- push ----
  pushKey: () => request('/push/key'),
  pushSubscribe: (sub: any) => request('/push/subscribe', { method: 'POST', body: sub, auth: true }),
  pushUnsubscribe: (endpoint: string) =>
    request('/push/subscribe', { method: 'DELETE', body: { endpoint }, auth: true }),
};

export default backend;
