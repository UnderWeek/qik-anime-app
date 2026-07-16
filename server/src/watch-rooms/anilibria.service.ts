import { Injectable } from '@nestjs/common';

const BASE = 'https://www.anilibria.top/api/v1';

export interface AnilibriaRelease {
  id: number;
  name: { main: string; english?: string };
  alias: string;
  year: number;
  poster?: { src: string; optimized?: { src: string } };
  season?: { value: string };
}

export interface AnilibriaEpisode {
  id: string;
  name?: string;
  ordinal: number;
  hls_480?: string;
  hls_720?: string;
  hls_1080?: string;
  duration?: number;
}

@Injectable()
export class AnilibriaService {
  async search(query: string, limit = 10): Promise<AnilibriaRelease[]> {
    try {
      const url = `${BASE}/app/search/releases?query=${encodeURIComponent(query)}&limit=${limit}`;
      const resp = await fetch(url);
      if (!resp.ok) return [];
      const data = await resp.json();
      return Array.isArray(data) ? data.slice(0, limit) : [];
    } catch {
      return [];
    }
  }

  async release(idOrAlias: string): Promise<any> {
    try {
      const resp = await fetch(
        `${BASE}/anime/releases/${idOrAlias}?include=episodes`
      );
      if (!resp.ok) return null;
      return resp.json();
    } catch {
      return null;
    }
  }

  async releaseEpisodes(idOrAlias: string) {
    const rel = await this.release(idOrAlias);
    if (!rel) return null;
    return {
      id: rel.id,
      name: rel.name,
      alias: rel.alias,
      year: rel.year,
      poster: rel.poster,
      episodes: (rel.episodes || []).map((ep: any) => ({
        id: ep.id,
        ordinal: ep.ordinal,
        name: ep.name,
        duration: ep.duration,
        hls_480: ep.hls_480,
        hls_720: ep.hls_720,
        hls_1080: ep.hls_1080,
      })),
    };
  }

  async episode(episodeId: string): Promise<AnilibriaEpisode | null> {
    try {
      const resp = await fetch(
        `${BASE}/anime/releases/episodes/${episodeId}`
      );
      if (!resp.ok) return null;
      return resp.json();
    } catch {
      return null;
    }
  }

  posterUrl(release: any): string {
    return release?.poster?.optimized?.src || release?.poster?.src || '';
  }
}
