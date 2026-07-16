import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Read .env directly as fallback (PM2 may not pass env vars)
import { readFileSync } from 'fs';
import { resolve } from 'path';

function getDeepSeekToken() {
  const key = 'DEEPSEEK_TOKEN';
  if (process.env[key]) return process.env[key];
  try {
    const envPath = resolve(__dirname, '..', '.env');
    const content = readFileSync(envPath, 'utf-8');
    const match = content.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
    if (match) return match[1].trim();
  } catch {}
  return '';
}

function isSequel(title) {
  const t = (title || '').toLowerCase();
  const pats = [
    /сезон\s*[2-9]/, /2nd\s*season/, /3rd\s*season/, /[2-9]\s*сезон/,
    /part\s*[2-9]/i, /[2-9]\s*часть/, /season\s*[2-9]/i,
    /фильм\s*(второй|третий|четв[её]ртый|пятый|шестой|седьмой|восьмой|девятый|десятый|\d)/i,
    /movie\s*[2-9]/i, /film\s*[2-9]/i,
  ];
  return pats.some((p) => p.test(t));
}

async function randomAnime(excludedIds: number[], firstOnly: boolean) {
  // Fetch from several random pages to build a wide pool, then pick randomly.
  // Using different sort orders per page to avoid the same popular anime dominating.
  const SORTS = ['random', 'rating', 'views', 'year', 'id', 'title'];
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const sort = SORTS[Math.floor(Math.random() * SORTS.length)];
      const page = Math.floor(Math.random() * 40) + 1;
      const resp = await fetch(
        `https://api.yani.tv/anime?limit=50&page=${page}&sort=${sort}`,
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
  if (!getDeepSeekToken()) {
    console.error('[QUIZ-EMOJI] getDeepSeekToken() env not set');
    return '';
  }
  try {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getDeepSeekToken()}`,
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
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[QUIZ-EMOJI] API error', resp.status, errText.slice(0, 300));
      return '';
    }
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error('[QUIZ-EMOJI] fetch error', err.message);
    return '';
  }
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
