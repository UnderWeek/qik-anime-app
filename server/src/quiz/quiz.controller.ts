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

    const attempts = 20;

    for (let i = 0; i < attempts; i++) {
      try {
        const page = Math.floor(Math.random() * 120) + 1;
        const resp = await fetch(
          `https://api.yani.tv/anime?limit=20&page=${page}&with_material_data=true`,
          { headers: { Accept: 'application/json', Lang: 'ru' } }
        );
        const data = await resp.json();
        const list = data?.response || data;
        if (!Array.isArray(list) || !list.length) continue;

        const shuffled = list.sort(() => Math.random() - 0.5);
        for (const anime of shuffled) {
          const id = anime.anime_id;
          if (!id || excludedIds.includes(id)) continue;

          const malId =
            anime.material_data?.mal_id ??
            anime.material_data?.myanimelist_id ??
            null;
          if (!malId) continue;

          return {
            animeId: id,
            malId,
            animeTitle: anime.title,
            animeUrl: anime.anime_url,
            animePoster: anime.poster?.medium || anime.poster?.small || '',
          };
        }
      } catch {
        continue;
      }
    }

    return { error: 'Не удалось найти аниме. Попробуйте позже.' };
  }
}
