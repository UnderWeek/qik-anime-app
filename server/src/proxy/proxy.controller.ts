import { BadRequestException, Controller, Get, Header, Inject, Query, Redirect, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AnilibriaService } from '../watch-rooms/anilibria.service';

const ALLOWED_HOSTS = ['static.yani.tv', 'imgproxy.yani.tv'];

const FALLBACK_HOSTS = ['static.yani.tv', 'imgproxy.yani.tv'];

function buildFallbackUrls(url: string): string[] {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const host of FALLBACK_HOSTS) {
      const u = `https://${host}${path}`;
      if (!seen.has(u)) { seen.add(u); urls.push(u); }
    }
    if (!seen.has(url)) urls.push(url);
    return urls;
  } catch { return [url]; }
}

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

const cache = new Map<string, { body: Buffer; contentType: string; ts: number }>();
const MAX_CACHE = 500;

@Controller('proxy')
export class ProxyController {
  constructor(private readonly anilibria: AnilibriaService) {}

  @Get('image')
  @Header('Cache-Control', 'public, max-age=604800, immutable')
  async image(
    @Query('url') url: string,
    @Query('q') q: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!url) throw new BadRequestException('url is required');

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid url');
    }

    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      throw new BadRequestException('Host not allowed');
    }

    const ext = (parsed.pathname.split('.').pop() || '').toLowerCase();
    const contentType = EXT_TO_MIME[`.${ext}`] || 'image/jpeg';
    res.set('Content-Type', contentType);

    // Check in-memory cache first
    const cached = cache.get(url);
    if (cached) {
      cached.ts = Date.now();
      return cached.body;
    }

    // Try yani.tv CDNs
    const urls = buildFallbackUrls(url);
    for (const upstreamUrl of urls) {
      try {
        const upstream = await fetch(upstreamUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            Accept: 'image/avif,image/webp,image/*,*/*',
            Referer: 'https://quickik.ru/',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (!upstream.ok) {
          console.error(`[proxy] upstream ${upstream.status} for ${upstreamUrl}`);
          continue;
        }

        const buf = Buffer.from(await upstream.arrayBuffer());

        if (cache.size >= MAX_CACHE) {
          let oldestKey = '';
          let oldestTs = Infinity;
          for (const [k, v] of cache) {
            if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; }
          }
          cache.delete(oldestKey);
        }

        cache.set(url, { body: buf, contentType, ts: Date.now() });
        return buf;
      } catch (err) {
        console.error(`[proxy] fetch failed for ${upstreamUrl}: ${err.message}`);
      }
    }

    // Fallback to AniLibria poster by alias/title
    if (q) {
      try {
        // Try direct release lookup by alias first (more accurate)
        let release = await this.anilibria.release(q);
        if (!release) {
          const results = await this.anilibria.search(q, 1);
          release = results[0] || null;
        }
        if (release) {
          let posterUrl = this.anilibria.posterUrl(release);
          if (posterUrl) {
            // AniLibria returns relative paths like /storage/...
            if (posterUrl.startsWith('/')) {
              posterUrl = `https://www.anilibria.top${posterUrl}`;
            }
            console.log(`[proxy] anilibria fallback for "${q}" → ${posterUrl}`);
            const upstream = await fetch(posterUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              },
              signal: AbortSignal.timeout(10000),
            });
            if (upstream.ok) {
              const buf = Buffer.from(await upstream.arrayBuffer());
              cache.set(url, { body: buf, contentType: 'image/jpeg', ts: Date.now() });
              res.set('Content-Type', 'image/jpeg');
              return buf;
            }
          }
        }
      } catch (err) {
        console.error(`[proxy] anilibria fallback failed: ${err.message}`);
      }
    }

    console.error(`[proxy] all fallbacks failed for ${url}`);
    throw new BadRequestException('Failed to fetch image');
  }
}
