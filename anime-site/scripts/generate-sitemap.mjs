// Generate sitemap.xml for QIK Anime
// Usage: node scripts/generate-sitemap.mjs
// Set BASE_URL to your production domain.

const BASE_URL = process.env.SITE_URL || 'https://quickik.ru'
const OUT = 'public/sitemap.xml'

const staticRoutes = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/catalog', priority: '0.9', changefreq: 'daily' },
  { path: '/schedule', priority: '0.8', changefreq: 'daily' },
  { path: '/search', priority: '0.5', changefreq: 'weekly' },
]

function entry(loc, priority, changefreq) {
  return `  <url>
    <loc>${loc}</loc>
    <priority>${priority}</priority>
    <changefreq>${changefreq}</changefreq>
  </url>`
}

async function main() {
  let animeUrls = []

  // Try to fetch top anime from the API for dynamic entries
  try {
    const res = await fetch(
      'https://api.yani.tv/anime?limit=100&sort=views',
      { headers: { Accept: 'application/json', Lang: 'ru' } }
    )
    if (!res.ok) {
      console.warn(`API returned ${res.status} ${res.statusText}`)
    } else {
      const json = await res.json()
      const list = json.response || json
      if (Array.isArray(list)) {
        animeUrls = list
          .filter((a) => a.anime_url)
          .map((a) => ({
            path: `/anime/${a.anime_url}`,
            priority: '0.7',
            changefreq: 'weekly',
          }))
        console.log(`Fetched ${animeUrls.length} anime URLs from API`)
      } else {
        console.warn('Unexpected API response shape:', typeof list)
      }
    }
  } catch (e) {
    console.warn('Could not fetch anime list for sitemap:', e.message)
  }

  const urls = [...staticRoutes, ...animeUrls]
  const today = new Date().toISOString().split('T')[0]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => entry(`${BASE_URL}${u.path}`, u.priority, u.changefreq)).join('\n')}
</urlset>
`

  const fs = await import('fs')
  fs.writeFileSync(OUT, xml.trim() + '\n', 'utf-8')
  console.log(`Sitemap written to ${OUT} with ${urls.length} URLs (${today})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
