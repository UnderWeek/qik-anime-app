// Prerender service for QIK Anime SPA
// Renders pages with Puppeteer for search bots, caches for 24h.
//
// Setup on VPS:
//   1. cd server/prerender && npm ci
//   2. pm2 start server.mjs --name anime-prerender
//   3. Add nginx rules from nginx-reference.conf (bot_detect + upstream)
//
// Port: 3002 (internal only, not exposed publicly)

import { createServer } from 'http';
import puppeteer from 'puppeteer';

const PORT = process.env.PRERENDER_PORT || 3002;
const SITE_URL = process.env.SITE_URL || 'https://quickik.ru';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const cache = new Map();

function cacheKey(url) {
  // Normalize: strip host, keep path+query
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function shouldPrerender(userAgent) {
  if (!userAgent) return false;
  const bots = [
    'googlebot', 'yandex', 'bingbot', 'duckduckbot', 'facebot',
    'twitterbot', 'telegrambot', 'whatsapp', 'slack', 'discord',
    'baiduspider', 'petalbot', 'ahrefsbot', 'semrush',
  ];
  const ua = userAgent.toLowerCase();
  return bots.some((b) => ua.includes(b));
}

// Escaped-fragment fallback (_escaped_fragment_=)
function parseEscapedFragment(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('_escaped_fragment_') || null;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`Starting prerender (puppeteer launch)...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const server = createServer(async (req, res) => {
    const start = Date.now();
    const key = cacheKey(req.url);
    const userAgent = req.headers['user-agent'] || '';

    // Only prerender bot requests
    if (!shouldPrerender(userAgent) && !parseEscapedFragment(req.url)) {
      // Non-bot: redirect to SPA
      res.writeHead(302, { Location: `${SITE_URL}${req.url}` });
      res.end();
      return;
    }

    // Check cache
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Prerender': 'cached' });
      res.end(cached.html);
      console.log(`[prerender] CACHE HIT ${key} (${Date.now() - start}ms)`);
      return;
    }

    const pageUrl = `${SITE_URL}${req.url}`;
    console.log(`[prerender] RENDER ${pageUrl}`);

    try {
      const page = await browser.newPage();
      await page.setUserAgent(userAgent || 'Mozilla/5.0 (compatible; Googlebot/2.1)');
      await page.setViewport({ width: 1280, height: 720 });

      // Block images/fonts for speed
      await page.setRequestInterception(true);
      page.on('request', (r) => {
        const type = r.resourceType();
        if (type === 'image' || type === 'font' || type === 'media') {
          r.abort();
        } else {
          r.continue();
        }
      });

      await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      // Wait for React to render
      await page.waitForSelector('#root > *', { timeout: 5000 }).catch(() => {});

      const html = await page.content();
      await page.close();

      // Cache result
      cache.set(key, { html, ts: Date.now() });

      // Limit cache size
      if (cache.size > 500) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) cache.delete(oldest[0]);
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Prerender': 'fresh' });
      res.end(html);
      console.log(`[prerender] OK ${key} (${Date.now() - start}ms)`);
    } catch (e) {
      console.error(`[prerender] ERROR ${pageUrl}: ${e.message}`);
      // Fallback: redirect to SPA
      res.writeHead(302, { Location: pageUrl });
      res.end();
    }
  });

  server.listen(PORT, () => {
    console.log(`Prerender ready on http://127.0.0.1:${PORT}`);
  });

  // Clean old cache entries every hour
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of cache) {
      if (now - val.ts > CACHE_TTL) cache.delete(key);
    }
  }, 3600_000).unref();
}

main().catch((e) => {
  console.error('Prerender failed to start:', e);
  process.exit(1);
});
