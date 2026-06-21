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

          // Get MAL ID from material_data
          const malId =
            anime.material_data?.mal_id ??
            anime.material_data?.myanimelist_id ??
            null;
          if (!malId) continue;

          try {
            // Find an episode with iframe_url
            const vResp = await fetch(`https://api.yani.tv/anime/${id}/videos`, {
              headers: { Accept: 'application/json', Lang: 'ru' } },
            );
            const vData = await vResp.json();
            const episodes = vData?.response || vData;
            if (!Array.isArray(episodes) || !episodes.length) continue;

            // Try up to 3 episodes to find one with AniSkip data
            const withIframe = episodes
              .filter((ep) => !!ep?.iframe_url)
              .sort(() => Math.random() - 0.5)
              .slice(0, 3);

            for (const episode of withIframe) {
              const epNumber = episode.number || episode.index || 1;

              try {
                // Query AniSkip API
                const skipResp = await fetch(
                  `https://api.aniskip.com/v2/skip-times/${malId}/${epNumber}?types[]=op&types[]=ed&episodeLength=${episode.duration || 1500}`,
                  { headers: { Accept: 'application/json' } }
                );

                if (!skipResp.ok) continue;
                const skipData = await skipResp.json();

                if (skipData?.found && skipData?.results?.length > 0) {
                  const op = skipData.results.find(
                    (r) => r.skipType === 'op'
                  );
                  if (!op) continue;

                  return {
                    animeId: id,
                    animeTitle: anime.title,
                    animeUrl: anime.anime_url,
                    animePoster: anime.poster?.medium || anime.poster?.small || '',
                    episodeNumber: epNumber,
                    iframeUrl: episode.iframe_url,
                    openStart: op.interval.startTime,
                    openEnd: op.interval.endTime,
                  };
                }
              } catch {
                continue;
              }
            }
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
