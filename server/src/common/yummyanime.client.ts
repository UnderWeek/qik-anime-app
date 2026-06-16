const BASE = 'https://api.yani.tv';

export interface YummyAnimeInfo {
  anime_id: number;
  anime_url: string;
  title: string;
  poster?: { medium?: string; big?: string; small?: string };
  rating?: { average?: number };
}

interface YummySearchResult extends YummyAnimeInfo {}

async function request<T = any>(path: string, params: Record<string, any> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', Lang: 'ru' },
  });
  if (!res.ok) throw new Error(`YummyAnime ${res.status}`);
  const json = await res.json();
  return json.response !== undefined ? json.response : json;
}

const searchCache = new Map<string, YummySearchResult[]>();

export const yummyAnime = {
  search(q: string, limit = 5): Promise<YummySearchResult[]> {
    const key = `${q}|${limit}`;
    const cached = searchCache.get(key);
    if (cached) return Promise.resolve(cached);

    return request<YummySearchResult[]>('/search', { q, limit }).then((res) => {
      searchCache.set(key, res);
      return res;
    });
  },

  async findAnime(titleRu: string, titleOrig?: string): Promise<YummyAnimeInfo | null> {
    const titles = [titleRu];
    if (titleOrig && titleOrig !== titleRu) titles.push(titleOrig);

    for (const q of titles) {
      const clean = q.replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
      const queries = [q];
      if (clean && clean !== q) queries.push(clean);

      for (const query of queries) {
        try {
          const results = await yummyAnime.search(query, 5);
          const match = results[0];
          if (match) return match;
        } catch {
          // Continue to next query
        }
      }
    }
    return null;
  },

  posterUrl(info: YummyAnimeInfo, size: 'medium' | 'big' | 'small' = 'medium'): string {
    const p = info.poster;
    if (!p) return '';
    const url = p[size] || p.medium || p.small || p.big || '';
    if (!url) return '';
    return url.startsWith('//') ? `https:${url}` : url;
  },
};
