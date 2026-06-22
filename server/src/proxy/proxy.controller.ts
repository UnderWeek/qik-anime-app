import { BadRequestException, Controller, Get, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

const ALLOWED_HOSTS = ['static.yani.tv', 'imgproxy.yani.tv'];

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

const cache = new Map<string, { body: Buffer; contentType: string; ts: number }>();
const MAX_CACHE = 100;

@Controller('proxy')
export class ProxyController {
  @Get('image')
  @Header('Cache-Control', 'public, max-age=604800, immutable')
  async image(@Query('url') url: string, @Res({ passthrough: true }) res: Response) {
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

    const cached = cache.get(url);
    if (cached) {
      cached.ts = Date.now();
      return cached.body;
    }

    try {
      const upstream = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'image/avif,image/webp,image/*,*/*',
          Referer: 'https://quickik.ru/',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!upstream.ok) {
        console.error(`[proxy] upstream ${upstream.status} for ${url}`);
        throw new BadRequestException(`Upstream returned ${upstream.status}`);
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
      if (err instanceof BadRequestException) throw err;
      console.error(`[proxy] fetch failed for ${url}: ${err.message}`);
      throw new BadRequestException('Failed to fetch image');
    }
  }
}
