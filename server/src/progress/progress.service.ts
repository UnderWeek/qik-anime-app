import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchProgress } from './watch-progress.entity';
import { User } from '../users/user.entity';
import { Bookmark } from '../bookmarks/bookmark.entity';
import { SaveProgressDto } from './dto';

// Average episode length fallback (seconds) when the player doesn't report one.
const DEFAULT_EP_SECONDS = 1440; // 24 min

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(WatchProgress)
    private readonly repo: Repository<WatchProgress>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Bookmark)
    private readonly bookmarks: Repository<Bookmark>,
  ) {}

  // Visiting an episode marks it watched immediately (no time tracking).
  async save(userId: number, dto: SaveProgressDto) {
    let row = await this.repo.findOne({
      where: {
        user: { id: userId },
        animeId: dto.animeId,
        episodeNumber: dto.episodeNumber,
      },
    });

    const isNew = !row || !row.completed;
    const duration = dto.duration || row?.duration || DEFAULT_EP_SECONDS;

    if (!row) {
      row = this.repo.create({
        user: { id: userId } as any,
        animeId: dto.animeId,
        episodeNumber: dto.episodeNumber,
      });
    }

    row.animeUrl = dto.animeUrl ?? row.animeUrl;
    row.animeTitle = dto.animeTitle ?? row.animeTitle;
    row.animePoster = dto.animePoster ?? row.animePoster;
    if (dto.genres && dto.genres.length) row.genres = dto.genres.join(',');
    row.episodeIndex = dto.episodeIndex ?? row.episodeIndex ?? 0;
    row.videoId = dto.videoId ?? row.videoId;
    row.dubbing = dto.dubbing ?? row.dubbing;
    row.player = dto.player ?? row.player;
    row.duration = duration;
    row.seconds = duration; // treated as fully watched
    row.completed = true;

    await this.repo.save(row);

    // bump aggregate stats only the first time this episode is completed
    if (isNew) {
      const user = await this.users.findOne({ where: { id: userId } });
      if (user) {
        user.watchedEpisodes = (user.watchedEpisodes || 0) + 1;
        user.watchedSeconds = (user.watchedSeconds || 0) + duration;

        // Hidden achievement: any episode of Re:Zero season 4
        if (!user.reZeroS4 && this.isReZeroS4(dto.animeTitle, dto.animeUrl)) {
          user.reZeroS4 = true;
        }
        await this.users.save(user);
      }
    }

    return row;
  }

  private isReZeroS4(title?: string, url?: string): boolean {
    const t = `${title || ''} ${url || ''}`.toLowerCase();
    const isReZero =
      t.includes('re:zero') ||
      t.includes('re zero') ||
      t.includes('rezero') ||
      t.includes('ре:зеро') ||
      t.includes('ре зеро') ||
      t.includes('zhizn-s-nulya') ||
      t.includes('zhizn_s_nulya') ||
      t.includes('с нуля');
    const isS4 =
      t.includes('4') ||
      t.includes('сезон 4') ||
      t.includes('season 4') ||
      t.includes('4th') ||
      t.includes('iv');
    return isReZero && isS4;
  }

  // progress for a single anime (all episodes the user touched)
  async forAnime(userId: number, animeId: number) {
    const rows = await this.repo.find({
      where: { user: { id: userId }, animeId },
      order: { episodeIndex: 'ASC' },
    });
    const last = [...rows].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )[0];
    return { episodes: rows, last: last || null };
  }

  // remove a single episode from watched history
  async removeEpisode(userId: number, animeId: number, episodeNumber: string) {
    const row = await this.repo.findOne({
      where: { user: { id: userId }, animeId, episodeNumber },
    });
    if (!row) throw new NotFoundException('Серия не найдена');

    if (row.completed) {
      const user = await this.users.findOne({ where: { id: userId } });
      if (user) {
        user.watchedEpisodes = Math.max(0, (user.watchedEpisodes || 0) - 1);
        user.watchedSeconds = Math.max(
          0,
          (user.watchedSeconds || 0) - (row.duration || 0),
        );
        await this.users.save(user);
      }
    }
    await this.repo.remove(row);
    return { ok: true };
  }

  // "continue watching" list across all anime (latest touched episode per anime)
  async continueWatching(userId: number, limit = 12) {
    const rows = await this.repo.find({
      where: { user: { id: userId } },
      order: { updatedAt: 'DESC' },
    });
    const seen = new Set<number>();
    const result = [];
    for (const r of rows) {
      if (seen.has(r.animeId)) continue;
      seen.add(r.animeId);
      result.push(r);
      if (result.length >= limit) break;
    }
    return result;
  }

  // Full watch history (newest first), one entry per episode
  async history(userId: number, limit = 100) {
    const rows = await this.repo.find({
      where: { user: { id: userId } },
      order: { updatedAt: 'DESC' },
      take: limit,
    });
    return rows;
  }

  // Genre breakdown — each anime contributes its genres once (per-anime, not per-episode)
  async genreBreakdown(userId: number) {
    const [rows, bookmarkRows] = await Promise.all([
      this.repo.find({ where: { user: { id: userId } }, select: ['animeId', 'genres'] }),
      this.bookmarks.find({
        where: { user: { id: userId } },
        select: ['animeId', 'genres', 'status'],
      }),
    ]);

    const countedAnimeIds = new Set<number>();
    const counts: Record<string, number> = {};
    let total = 0;

    function addGenres(animeId: number, genres: string) {
      if (!genres) return;
      if (countedAnimeIds.has(animeId)) return;
      countedAnimeIds.add(animeId);
      for (const g of genres.split(',')) {
        const name = g.trim();
        if (!name) continue;
        counts[name] = (counts[name] || 0) + 1;
        total++;
      }
    }

    // Genres from watched episodes — dedup by animeId (one anime = one vote)
    for (const r of rows) {
      addGenres(r.animeId, r.genres);
    }

    // Genres from bookmarks (completed/watching/rewatching)
    for (const bm of bookmarkRows) {
      if (!['completed', 'watching', 'rewatching'].includes(bm.status)) continue;
      addGenres(bm.animeId, bm.genres);
    }

    const items = Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percent: total ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);
    return { total, items };
  }
}
