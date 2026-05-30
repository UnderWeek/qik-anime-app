import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './rating.entity';
import { RateDto } from './dto';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private readonly repo: Repository<Rating>,
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
}
