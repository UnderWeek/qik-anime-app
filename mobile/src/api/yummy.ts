import { YUMMY_API_BASE, YUMMY_STATIC_URL, YUMMY_APP_TOKEN } from './config';

// YummyAnime API client — mirrors anime-site/src/api/client.js.
// Swagger: server/docs/yummyanime-api.json. Base: https://api.yani.tv.

function buildHeaders(extra: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Lang: 'ru',
    ...extra,
  };
  if (YUMMY_APP_TOKEN) headers['X-Application'] = YUMMY_APP_TOKEN;
  return headers;
}

interface YummyParams {
  [k: string]: string | number | undefined | null | string[] | number[];
}

async function request<T = any>(path: string, { params, ...options }: any = {}): Promise<T> {
  let url = `${YUMMY_API_BASE}${path}`;
  if (params) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]: [string, any]) => {
      if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v)) v.forEach((item) => usp.append(k, String(item)));
      else usp.append(k, String(v));
    });
    const qs = usp.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, { ...options, headers: buildHeaders(options.headers) });
  if (!res.ok) {
    const err: any = new Error(`YummyAnime API ${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  let json: any = {};
  if (text) {
    try { json = JSON.parse(text); } catch { json = text; }
  }
  // YummyAnime wraps payloads in { response: ... }
  return json.response !== undefined ? json.response : json;
}

// Normalize poster URLs.
// static.yani.tv is blocked in RF — swap to imgproxy.yani.tv proactively
// so that CSS background-image, OG meta tags, and other non-<img> usages work.
export function fixUrl(url?: string | null): string {
  if (!url) return '';
  let u = url;
  if (u.startsWith('//')) u = `https:${u}`;
  if (u.startsWith('/')) u = `${YUMMY_STATIC_URL}${u}`;
  // Proactive host swap: static.yani.tv → imgproxy.yani.tv (RF block)
  u = u.replace(/^https?:\/\/static\.yani\.tv\//i, 'https://imgproxy.yani.tv/');
  return u;
}

const POSTER_SIZES = ['mega', 'huge', 'fullsize', 'big', 'medium', 'small'];

export function poster(obj: any, size: string = 'medium'): string {
  if (!obj || !obj.poster) return '';
  const p = obj.poster;
  if (p[size]) return fixUrl(p[size]);
  for (const s of POSTER_SIZES) {
    if (p[s]) return fixUrl(p[s]);
  }
  return '';
}

export function upgradePoster(url: string, size = 'big'): string {
  if (!url) return '';
  const fixed = fixUrl(url);
  return fixed.replace(
    /\/posters\/(small|medium|big|huge|mega|full|fullsize)\//,
    `/posters/${size}/`,
  );
}

// Fallback chain for failed static.yani.tv images (imgproxy mirror).
export function posterFallbackChain(originalUrl: string): string[] {
  const chain: string[] = [];
  if (/static\.yani\.tv/i.test(originalUrl)) {
    chain.push(originalUrl.replace(/^https?:\/\/static\.yani\.tv\//i, 'https://imgproxy.yani.tv/'));
  }
  return chain;
}

export const api = {
  feed: () => request('/feed'),
  list: (params: YummyParams) => request('/anime', { params }),
  anime: (urlOrId: string | number) => request(`/anime/${urlOrId}`),
  catalog: () => request('/anime/catalog'),
  genres: () => request('/anime/genres'),
  schedule: () => request('/anime/schedule'),
  search: (q: string, params: YummyParams = {}) => request('/search', { params: { q, ...params } }),
  videos: (id: string | number) => request(`/anime/${id}/videos`),
  recommendations: (id: string | number) => request(`/anime/${id}/recommendations`),
  trailers: (id: string | number) => request(`/anime/${id}/trailers`),
  studio: (url: string) => request(`/anime/studio/${url}`),
};

export default api;
