import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const DEEPSEEK_TOKEN = process.env.DEEPSEEK_TOKEN || '';

function isSequel(title) {
  const t = (title || '').toLowerCase();
  const pats = [
    /сезон\s*[2-9]/, /2nd\s*season/, /3rd\s*season/, /[2-9]\s*сезон/,
    /part\s*[2-9]/i, /[2-9]\s*часть/, /season\s*[2-9]/i,
    /фильм/i, /movie/i, /film/i,
  ];
  return pats.some((p) => p.test(t));
}

async function randomAnime(excludedIds: number[], firstOnly: boolean) {
  for (let i = 0; i < 30; i++) {
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
        if (firstOnly && isSequel(anime.title)) continue;
        if (!anime.title || anime.title.length < 3) continue;

        return {
          animeId: id,
          animeTitle: anime.title,
          animeUrl: anime.anime_url,
          year: anime.year,
          shikiId: anime.remote_ids?.shikimori_id || 0,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function generateEmoji(title: string) {
  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_TOKEN}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'Ты — генератор эмодзи-загадок. Тебе дают название аниме, ты описываешь его сюжет только эмодзи (8-15 штук), без слов. Ответ — только эмодзи, ничего больше.',
        },
        { role: 'user', content: `Аниме: ${title}` },
      ],
      max_tokens: 60,
      temperature: 0.8,
    }),
  });
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

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
      const anime = await randomAnime(excludedIds, false);
      if (!anime || !anime.shikiId) continue;

      try {
        const ssResp = await fetch(
          `https://shikimori.one/api/animes/${anime.shikiId}/screenshots`,
          { headers: { 'User-Agent': 'QIK-Anime/1.0' } }
        );
        if (!ssResp.ok) continue;
        const screenshots = await ssResp.json();
        if (!Array.isArray(screenshots) || screenshots.length < 3) continue;

        const ss = screenshots[Math.floor(Math.random() * screenshots.length)];
        return {
          animeId: anime.animeId,
          animeTitle: anime.animeTitle,
          animeUrl: anime.animeUrl,
          imageUrl: `https://shikimori.one${ss.original || ss.preview}`,
        };
      } catch {
        continue;
      }
    }
    return { error: 'Не удалось найти аниме со скриншотами.' };
  }

  @Get('emoji')
  async emoji(
    @Query('exclude') exclude?: string,
    @Query('diff') diff?: string,
  ) {
    const excludedIds = (exclude || '')
      .split(',')
      .map(Number)
      .filter((n) => Number.isFinite(n));

    const isEasy = diff === 'easy';
    const isMedium = diff === 'medium';
    const isHard = diff === 'hard';
    const firstOnly = isEasy || isHard;
    const optionsCount = isEasy ? 4 : isMedium ? 6 : 0;

    const anime = await randomAnime(excludedIds, firstOnly);
    if (!anime) return { error: 'Не удалось найти аниме.' };

    const emoji = await generateEmoji(anime.animeTitle);
    if (!emoji) return { error: 'Не удалось сгенерировать эмодзи.' };

    const result: any = {
      animeId: anime.animeId,
      animeTitle: anime.animeTitle,
      animeUrl: anime.animeUrl,
      emoji,
    };

    // Generate wrong options for easy/medium
    if (optionsCount > 0) {
      const wrongExcluded = [...excludedIds, anime.animeId];
      const wrongOptions = [];
      for (let i = 0; i < optionsCount * 3 && wrongOptions.length < optionsCount - 1; i++) {
        const w = await randomAnime(wrongExcluded, false);
        if (!w) break;
        wrongExcluded.push(w.animeId);
        wrongOptions.push({ animeId: w.animeId, animeTitle: w.animeTitle, year: w.year, animeUrl: w.animeUrl });
      }
      // Mix correct + wrong, shuffle
      const all = [
        { animeId: anime.animeId, animeTitle: anime.animeTitle, year: anime.year, animeUrl: anime.animeUrl, correct: true },
        ...wrongOptions,
      ].sort(() => Math.random() - 0.5);
      result.options = all;
    }

    return result;
  }
}
