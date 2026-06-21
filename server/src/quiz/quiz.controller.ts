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
        const page = Math.floor(Math.random() * 150) + 1;
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

          const shikiId = anime.remote_ids?.shikimori_id || 0;
          if (!shikiId) continue;

          try {
            const ssResp = await fetch(
              `https://shikimori.one/api/animes/${shikiId}/screenshots`,
              { headers: { 'User-Agent': 'QIK-Anime/1.0' } }
            );
            if (!ssResp.ok) continue;
            const screenshots = await ssResp.json();
            if (!Array.isArray(screenshots) || screenshots.length < 3) continue;

            // Pick a random screenshot
            const ss = screenshots[Math.floor(Math.random() * screenshots.length)];
            const imageUrl = `https://shikimori.one${ss.original || ss.preview}`;

            return {
              animeId: id,
              animeTitle: anime.title,
              animeUrl: anime.anime_url,
              imageUrl,
            };
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    return { error: 'Не удалось найти аниме со скриншотами.' };
  }
}
