import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('quiz')
@UseGuards(JwtAuthGuard)
export class QuizController {
  @Get('question')
  async question(@Query('exclude') exclude?: string) {
    const excludedIds = (exclude || '')
      .split(',')
      .map(Number)
      .filter((n) => Number.isFinite(n));

    for (let i = 0; i < 20; i++) {
      try {
        const page = Math.floor(Math.random() * 120) + 1;
        const resp = await fetch(
          `https://api.yani.tv/anime?limit=20&page=${page}`,
          { headers: { Accept: 'application/json', Lang: 'ru' } }
        );
        const data = await resp.json();
        const list = data?.response || data;
        if (!Array.isArray(list) || !list.length) continue;

        const shuffled = list.sort(() => Math.random() - 0.5);
        for (const anime of shuffled) {
          const id = anime.anime_id;
          if (!id || excludedIds.includes(id)) continue;

          try {
            const vResp = await fetch(`https://api.yani.tv/anime/${id}/videos`, {
              headers: { Accept: 'application/json', Lang: 'ru' } },
            );
            const vData = await vResp.json();
            const episodes = vData?.response || vData;
            if (!Array.isArray(episodes) || !episodes.length) continue;

            const withIframe = episodes.filter((ep) => !!ep?.iframe_url);
            if (!withIframe.length) continue;

            const episode = withIframe[Math.floor(Math.random() * withIframe.length)];
            const duration = episode.duration || 1500;
            // Random timestamp in the middle 60% of the video (avoid intro/credits)
            const screenshotTime = Math.floor(duration * 0.2 + Math.random() * duration * 0.6);

            return {
              animeId: id,
              animeTitle: anime.title,
              animeUrl: anime.anime_url,
              animePoster: anime.poster?.medium || anime.poster?.small || '',
              episodeNumber: episode.number || 1,
              iframeUrl: episode.iframe_url,
              screenshotTime,
            };
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    return { error: 'Не удалось найти аниме с сериями.' };
  }
}
