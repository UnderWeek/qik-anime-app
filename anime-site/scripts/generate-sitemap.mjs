// Generate sitemap.xml for QIK Anime + ping search engines
// Usage: node scripts/generate-sitemap.mjs [--ping]
// Set BASE_URL to your production domain.

const BASE_URL = process.env.SITE_URL || 'https://quickik.ru'
const OUT = process.env.OUT || 'public/sitemap.xml'
const PING = process.argv.includes('--ping')

const staticRoutes = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/catalog', priority: '0.9', changefreq: 'daily' },
  { path: '/schedule', priority: '0.9', changefreq: 'daily' },
  { path: '/ratings', priority: '0.8', changefreq: 'daily' },
  { path: '/search', priority: '0.5', changefreq: 'weekly' },
]

function entry(loc, priority, changefreq, lastmod) {
  const lastmodXml = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''
  return `  <url>
    <loc>${loc}</loc>
    <priority>${priority}</priority>
    <changefreq>${changefreq}</changefreq>${lastmodXml}
  </url>`
}

async function fetchAllAnime() {
  const all = []
  // Fetch up to 500 anime in pages of 100
  for (let page = 0; page < 5; page++) {
    try {
      const res = await fetch(
        `https://api.yani.tv/anime?limit=100&offset=${page * 100}&sort=views`,
        { headers: { Accept: 'application/json', Lang: 'ru' } }
      )
      if (!res.ok) {
        console.warn(`API page ${page} returned ${res.status}`)
        break
      }
      const json = await res.json()
      const list = json.response || json
      if (!Array.isArray(list) || list.length === 0) break
      all.push(...list)
    } catch (e) {
      console.warn(`API page ${page} error: ${e.message}`)
      break
    }
  }
  return all
}

async function main() {
  const animeList = await fetchAllAnime()
  console.log(`Fetched ${animeList.length} anime from API`)

  const today = new Date().toISOString().split('T')[0]

  const animeUrls = animeList
    .filter((a) => a.anime_url)
    .map((a) => ({
      path: `/anime/${a.anime_url}`,
      priority: '0.7',
      changefreq: 'weekly',
      lastmod: today,
    }))

  const urls = [...staticRoutes.map((r) => ({ ...r, lastmod: today })), ...animeUrls]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => entry(`${BASE_URL}${u.path}`, u.priority, u.changefreq, u.lastmod)).join('\n')}
</urlset>
`

  const fs = await import('fs')
  const path = await import('path')

  const outDir = path.dirname(OUT)
  if (outDir && outDir !== '.') {
    fs.mkdirSync(outDir, { recursive: true })
  }
  fs.writeFileSync(OUT, xml.trim() + '\n', 'utf-8')
  console.log(`Sitemap written to ${OUT} with ${urls.length} URLs`)

  if (PING) {
    const encoded = encodeURIComponent(`${BASE_URL}/sitemap.xml`)
    const engines = [
      `https://www.google.com/ping?sitemap=${encoded}`,
      `https://webmaster.yandex.ru/ping?sitemap=${encoded}`,
    ]
    for (const url of engines) {
      try {
        const res = await fetch(url)
        console.log(`Ping ${url} → ${res.status} ${res.statusText}`)
      } catch (e) {
        console.warn(`Ping failed: ${url} — ${e.message}`)
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
