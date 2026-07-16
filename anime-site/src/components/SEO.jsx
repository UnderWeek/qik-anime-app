import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'QIK Anime'
const SITE_URL = 'https://quickik.ru'
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`
const DEFAULT_DESCRIPTION =
  'QIK Anime — смотреть аниме онлайн, каталог с фильтрами по жанрам и годам, рейтинги опенингов и эндингов, закладки, комментарии'

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  canonical,
  jsonLd,
}) {
  const fullTitle = title ? `${title} — QIK Anime` : `${SITE_NAME} — смотреть аниме онлайн`

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content="аниме, смотреть аниме онлайн, каталог аниме, аниме бесплатно, рейтинг аниме, закладки аниме, опенинги, эндинги, аниме онлайн" />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="ru_RU" />
      {url && <meta property="og:url" content={url} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {canonical && <link rel="canonical" href={canonical} />}
      <link rel="alternate" hreflang="ru" href={canonical || SITE_URL} />
      <link rel="alternate" hreflang="x-default" href={canonical || SITE_URL} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd, null, 2)}</script>
      )}
    </Helmet>
  )
}

// Structured data helpers

export function animeJsonLd(anime, siteUrl) {
  if (!anime) return null

  const img = anime.poster?.big || anime.poster?.medium || anime.poster?.small || ''
  const posterUrl = img
    ? img.startsWith('//')
      ? `https:${img}`
      : img
    : ''

  return {
    '@context': 'https://schema.org',
    '@type': anime.type?.name === 'Фильм' ? 'Movie' : 'TVSeries',
    name: anime.title,
    alternateName: anime.other_titles?.slice(0, 3).join(', ') || undefined,
    description: anime.description?.substring(0, 300) || undefined,
    image: posterUrl || undefined,
    datePublished: String(anime.year) || undefined,
    genre: anime.genres?.map((g) => g.title) || undefined,
    actor: anime.studios?.map((s) => ({ '@type': 'Organization', name: s.title })) || undefined,
    ...(anime.rating?.average > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: anime.rating.average.toFixed(2),
        ratingCount: anime.rating?.counters || 0,
        bestRating: 10,
        worstRating: 0,
      },
    }),
    url: `${siteUrl}/anime/${anime.anime_url || anime.url || anime.anime_id}`,
  }
}

export function websiteJsonLd(siteUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbJsonLd(items, siteUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url ? `${siteUrl}${item.url}` : undefined,
    })),
  }
}

export function itemListJsonLd(items, siteUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteUrl}/anime/${item.anime_url || item.animeId || item.url}`,
      name: item.title || item.name,
      image: item.poster || item.image || undefined,
    })),
  }
}

export function organizationJsonLd(siteUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: siteUrl,
    logo: `${siteUrl}/favicon.svg`,
    sameAs: [],
  }
}
