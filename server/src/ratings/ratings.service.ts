import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './rating.entity';
import { OpeningRating } from './opening-rating.entity';
import { RateDto, RateOpeningDto } from './dto';
import { levelForXp } from '../common/gamification';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private readonly repo: Repository<Rating>,
    @InjectRepository(OpeningRating)
    private readonly openingRepo: Repository<OpeningRating>,
  ) {}

  // Aggregate community rating for an anime + the current user's own score
  async summary(animeId: number, userId?: number) {
    const rows = await this.repo.find({ where: { animeId } });
    const count = rows.length;
    const average =
      count > 0 ? rows.reduce((s, r) => s + r.score, 0) / count : 0;

    // distribution 1..10
    const distribution: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) distribution[i] = 0;
    rows.forEach((r) => (distribution[r.score] = (distribution[r.score] || 0) + 1));

    let userScore: number | null = null;
    if (userId) {
      const own = rows.find((r) => (r as any).userId === userId);
      // userId column isn't selected by default; query explicitly if needed
      if (!own) {
        const mine = await this.repo
          .createQueryBuilder('r')
          .where('r.animeId = :animeId', { animeId })
          .andWhere('r.userId = :userId', { userId })
          .getOne();
        userScore = mine ? mine.score : null;
      } else {
        userScore = own.score;
      }
    }

    return {
      animeId,
      average: Number(average.toFixed(2)),
      count,
      distribution,
      userScore,
    };
  }

  async rate(userId: number, dto: RateDto) {
    let rating = await this.repo
      .createQueryBuilder('r')
      .where('r.animeId = :animeId', { animeId: dto.animeId })
      .andWhere('r.userId = :userId', { userId })
      .getOne();

    if (rating) {
      rating.score = dto.score;
    } else {
      rating = this.repo.create({
        user: { id: userId } as any,
        animeId: dto.animeId,
        score: dto.score,
      });
    }
    await this.repo.save(rating);
    return this.summary(dto.animeId, userId);
  }

  async remove(userId: number, animeId: number) {
    const rating = await this.repo
      .createQueryBuilder('r')
      .where('r.animeId = :animeId', { animeId })
      .andWhere('r.userId = :userId', { userId })
      .getOne();
    if (!rating) throw new NotFoundException('Оценка не найдена');
    await this.repo.remove(rating);
    return this.summary(animeId, userId);
  }

  // ---- OP/ED ratings ----

  async rateOpening(userId: number, dto: RateOpeningDto) {
    let rating = await this.openingRepo
      .createQueryBuilder('r')
      .where('r.animeId = :animeId', { animeId: dto.animeId })
      .andWhere('r.type = :type', { type: dto.type })
      .andWhere('r.userId = :userId', { userId })
      .getOne();

    if (rating) {
      rating.score = dto.score;
    } else {
      rating = this.openingRepo.create({
        user: { id: userId } as any,
        animeId: dto.animeId,
        type: dto.type,
        score: dto.score,
      });
    }
    await this.openingRepo.save(rating);
    return this.openingSummary(dto.animeId, userId);
  }

  async getOpeningRatings(animeId: number, userId?: number) {
    const scores: { opening: number | null; ending: number | null } = { opening: null, ending: null };
    if (!userId) return scores;

    const rows = await this.openingRepo
      .createQueryBuilder('r')
      .where('r.animeId = :animeId', { animeId })
      .andWhere('r.userId = :userId', { userId })
      .getMany();

    for (const r of rows) {
      if (r.type === 'opening') scores.opening = r.score;
      if (r.type === 'ending') scores.ending = r.score;
    }
    return scores;
  }

  async removeOpeningRating(userId: number, animeId: number, type: string) {
    const rating = await this.openingRepo
      .createQueryBuilder('r')
      .where('r.animeId = :animeId', { animeId })
      .andWhere('r.type = :type', { type })
      .andWhere('r.userId = :userId', { userId })
      .getOne();
    if (!rating) throw new NotFoundException('Оценка не найдена');
    await this.openingRepo.remove(rating);
    return { ok: true };
  }

  private async openingSummary(animeId: number, userId?: number) {
    const scores = await this.getOpeningRatings(animeId, userId);

    const [opRows, edRows] = await Promise.all([
      this.openingRepo.find({ where: { animeId, type: 'opening' } }),
      this.openingRepo.find({ where: { animeId, type: 'ending' } }),
    ]);

    const avg = (rows: OpeningRating[]) =>
      rows.length > 0
        ? Number((rows.reduce((s, r) => s + r.score, 0) / rows.length).toFixed(2))
        : 0;

    return {
      animeId,
      opening: { average: avg(opRows), count: opRows.length, userScore: scores.opening },
      ending: { average: avg(edRows), count: edRows.length, userScore: scores.ending },
    };
  }

  // ---- leaderboards ----

  async topAnime(limit = 20) {
    const rows = await this.repo
      .createQueryBuilder('r')
      .select('r.animeId', 'animeId')
      .addSelect('ROUND(AVG(r.score), 2)', 'average')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.animeId')
      .having('COUNT(*) >= 3')
      .orderBy('AVG(r.score)', 'DESC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({ animeId: Number(r.animeId), average: Number(r.average), count: Number(r.count) }));
  }

  async topOpenings(limit = 20) {
    return this.topByType('opening', limit);
  }

  async topEndings(limit = 20) {
    return this.topByType('ending', limit);
  }

  private async topByType(type: string, limit: number) {
    const rows = await this.openingRepo
      .createQueryBuilder('r')
      .select('r.animeId', 'animeId')
      .addSelect('ROUND(AVG(r.score), 2)', 'average')
      .addSelect('COUNT(*)', 'count')
      .where('r.type = :type', { type })
      .groupBy('r.animeId')
      .having('COUNT(*) >= 1')
      .orderBy('AVG(r.score)', 'DESC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({ animeId: Number(r.animeId), average: Number(r.average), count: Number(r.count) }));
  }

  async topUsers(limit = 20) {
    // Full XP matching computeXp(): watchedEpisodes*10 + watchedSeconds/60 +
    // ratings*5 + comments*8 + bookmarkXp(per status) + friends*15.
    // Also includes extra episodes/seconds from bookmarks (deduped against progress).
    const AVG_EP_SECONDS = 1440; // 24 min per episode
    const rows: any[] = await this.repo.manager.query(
      `SELECT u.id as userId,
              u.watchedEpisodes,
              u.watchedSeconds,
              COALESCE(rc.c, 0) as ratingCount,
              COALESCE(cc.c, 0) as commentCount,
              COALESCE(fc.c, 0) as friendCount,
              COALESCE(bc.completed, 0) as bm_completed,
              COALESCE(bc.watching, 0) as bm_watching,
              COALESCE(bc.rewatching, 0) as bm_rewatching,
              COALESCE(bc.planned, 0) as bm_planned,
              COALESCE(bc.on_hold, 0) as bm_on_hold,
              COALESCE(bc.dropped, 0) as bm_dropped,
              COALESCE(bc.favorite, 0) as bm_favorite,
              COALESCE(bc.extraEpisodes, 0) as bm_extraEpisodes
       FROM users u
       LEFT JOIN (SELECT "userId", COUNT(*) as c FROM ratings GROUP BY "userId") rc ON rc."userId" = u.id
       LEFT JOIN (SELECT "userId", COUNT(*) as c FROM comments GROUP BY "userId") cc ON cc."userId" = u.id
       LEFT JOIN (
         SELECT uid, COUNT(*) as c FROM (
           SELECT "requesterId" as uid FROM friendships WHERE status = 'accepted'
           UNION ALL
           SELECT "addresseeId" as uid FROM friendships WHERE status = 'accepted'
         ) f GROUP BY uid
       ) fc ON fc.uid = u.id
       LEFT JOIN (
         SELECT b."userId",
           SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN b.status = 'watching' THEN 1 ELSE 0 END) as watching,
           SUM(CASE WHEN b.status = 'rewatching' THEN 1 ELSE 0 END) as rewatching,
           SUM(CASE WHEN b.status = 'planned' THEN 1 ELSE 0 END) as planned,
           SUM(CASE WHEN b.status = 'on_hold' THEN 1 ELSE 0 END) as on_hold,
           SUM(CASE WHEN b.status = 'dropped' THEN 1 ELSE 0 END) as dropped,
           SUM(CASE WHEN b.status = 'favorite' THEN 1 ELSE 0 END) as favorite,
           SUM(CASE WHEN b.status IN ('completed','watching','rewatching')
                 AND COALESCE(b."episodeCount", 0) > 0
                 AND b."animeId" NOT IN (SELECT wp."animeId" FROM watch_progress wp WHERE wp."userId" = b."userId")
             THEN CASE WHEN b.status = 'watching'
                  THEN CASE WHEN CAST(COALESCE(b."episodeCount", 0) * 0.5 AS INTEGER) > 1
                       THEN CAST(COALESCE(b."episodeCount", 0) * 0.5 AS INTEGER) ELSE 1 END
                  ELSE COALESCE(b."episodeCount", 0) END
             ELSE 0 END) as extraEpisodes
         FROM bookmarks b
         GROUP BY b."userId"
       ) bc ON bc."userId" = u.id
       ORDER BY (u.watchedEpisodes * 10 + CAST(u.watchedSeconds / 60 AS INTEGER)
                 + COALESCE(rc.c, 0) * 5 + COALESCE(cc.c, 0) * 8
                 + COALESCE(bc.completed, 0) * 8 + COALESCE(bc.watching, 0) * 5
                 + COALESCE(bc.rewatching, 0) * 5 + COALESCE(bc.planned, 0) * 2
                 + COALESCE(bc.on_hold, 0) * 2 + COALESCE(bc.favorite, 0) * 3
                 + COALESCE(bc.extraEpisodes, 0) * 10
                 + COALESCE(fc.c, 0) * 15) DESC
       LIMIT ?`,
      [limit]
    );

    return rows.map((r: any) => {
      const bookmarkXp =
        (r.bm_completed || 0) * 8 +
        (r.bm_watching || 0) * 5 +
        (r.bm_rewatching || 0) * 5 +
        (r.bm_planned || 0) * 2 +
        (r.bm_on_hold || 0) * 2 +
        (r.bm_dropped || 0) * 0 +
        (r.bm_favorite || 0) * 3;
      const extraXp = (r.bm_extraEpisodes || 0) * 10 + (r.bm_extraEpisodes || 0) * AVG_EP_SECONDS / 60;
      const xp =
        (r.watchedEpisodes || 0) * 10 +
        Math.floor((r.watchedSeconds || 0) / 60) +
        (r.ratingCount || 0) * 5 +
        (r.commentCount || 0) * 8 +
        bookmarkXp +
        Math.floor(extraXp) +
        (r.friendCount || 0) * 15;
      const level = levelForXp(xp).level;
      return { userId: Number(r.userId), xp, level };
    });
  }
}
