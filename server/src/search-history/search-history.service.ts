import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchHistory } from './search-history.entity';

@Injectable()
export class SearchHistoryService {
  constructor(
    @InjectRepository(SearchHistory)
    private readonly repo: Repository<SearchHistory>,
  ) {}

  async save(userId: number, query: string) {
    const q = query.trim();
    if (!q) return null;

    let entry = await this.repo.findOne({ where: { userId, query: q } });
    if (entry) {
      entry.updatedAt = new Date();
      return this.repo.save(entry);
    }

    entry = this.repo.create({ userId, query: q });
    return this.repo.save(entry);
  }

  async list(userId: number, limit = 20) {
    return this.repo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: limit,
    });
  }

  async remove(userId: number, id: number) {
    const entry = await this.repo.findOne({ where: { id, userId } });
    if (entry) await this.repo.remove(entry);
    return { ok: true };
  }

  async clear(userId: number) {
    await this.repo.delete({ userId });
    return { ok: true };
  }
}
