import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';

const ALLOWED_HOSTS = ['static.yani.tv', 'imgproxy.yani.tv'];

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

// Small bounded cache — avoids re-fetching the same posters from yani.tv
const cache = new Map<string, { body: Buffer; contentType: string; ts: number }>();
const MAX_CACHE = 100;

@Controller('proxy')
export class ProxyController {
  @Get('image')
  async image(@Query('url') url: string, @Res() res: Response) {
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

    // Browser caches for a week — most requests won't even reach the server
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, immutable',
    });

    // Serve from cache
    const cached = cache.get(url);
    if (cached) {
      cached.ts = Date.now();
      res.send(cached.body);
      return;
    }

    // Fetch from upstream
    try {
      const upstream = await fetch(url);
      if (!upstream.ok) {
        res.status(upstream.status).end();
        return;
      }

      const buf = Buffer.from(await upstream.arrayBuffer());

      // Evict oldest if at capacity
      if (cache.size >= MAX_CACHE) {
        let oldestKey = '';
        let oldestTs = Infinity;
        for (const [k, v] of cache) {
          if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; }
        }
        cache.delete(oldestKey);
      }

      cache.set(url, { body: buf, contentType, ts: Date.now() });
      res.send(buf);
    } catch {
      res.status(502).end();
    }
  }
}
