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
    const randomPage = () => Math.floor(Math.random() * 120) + 1;

    for (let i = 0; i < attempts; i++) {
      try {
        const page = randomPage();
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
              headers: { Accept: 'application/json', Lang: 'ru' },
            });
            const vData = await vResp.json();
            const episodes = vData?.response || vData;
            if (!Array.isArray(episodes) || !episodes.length) continue;

            const episode = episodes.find((ep) => {
              if (!ep?.iframe_url) return false;
              // Look for opening timestamp in episode data
              const d = ep.data || ep;
              const fields = [
                d?.op_start, d?.opening_start, d?.opening, d?.intro_start,
                d?.op_start_sec, d?.opening_time, d?.op_time,
              ];
              return fields.some((f) => typeof f === 'number' && f >= 0);
            });

            if (!episode) continue;

            const d = episode.data || episode;
            const openStart =
              d?.op_start ?? d?.opening_start ?? d?.opening ?? d?.intro_start ??
              d?.op_start_sec ?? d?.opening_time ?? d?.op_time ?? 0;

            return {
              animeId: id,
              animeTitle: anime.title,
              animeUrl: anime.anime_url,
              animePoster: anime.poster?.medium || anime.poster?.small || '',
              episodeNumber: episode.number || 1,
              iframeUrl: episode.iframe_url,
              openStart: Math.floor(Number(openStart)),
              openEnd: Math.floor(Number(openStart)) + 10,
            };
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    return { error: 'Не удалось найти аниме с сериями. Попробуйте позже.' };
  }
}
