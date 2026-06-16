import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmark } from './bookmark.entity';
import { ImportAnixartDto, UpsertBookmarkDto } from './dto';
import { yummyAnime } from '../common/yummyanime.client';

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(Bookmark)
    private readonly repo: Repository<Bookmark>,
  ) {}

  list(userId: number, status?: string) {
    const where: any = { user: { id: userId } };
    if (status) where.status = status;
    return this.repo.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  async getForAnime(userId: number, animeId: number) {
    return this.repo.findOne({
      where: { user: { id: userId }, animeId },
    });
  }

  async upsert(userId: number, dto: UpsertBookmarkDto) {
    let bm = await this.repo.findOne({
      where: { user: { id: userId }, animeId: dto.animeId },
    });

    if (bm) {
      bm.status = dto.status;
      if (dto.animeUrl) bm.animeUrl = dto.animeUrl;
      if (dto.animeTitle) bm.animeTitle = dto.animeTitle;
      if (dto.animePoster) bm.animePoster = dto.animePoster;
    } else {
      bm = this.repo.create({
        user: { id: userId } as any,
        animeId: dto.animeId,
        animeUrl: dto.animeUrl,
        animeTitle: dto.animeTitle,
        animePoster: dto.animePoster,
        status: dto.status,
      });
    }
    return this.repo.save(bm);
  }

  async remove(userId: number, animeId: number) {
    const bm = await this.repo.findOne({
      where: { user: { id: userId }, animeId },
    });
    if (!bm) throw new NotFoundException('Закладка не найдена');
    await this.repo.remove(bm);
    return { ok: true };
  }

  async importAnixart(userId: number, dto: ImportAnixartDto) {
    const statusMap: Record<string, string> = {
      'Просмотрено': 'completed',
      'Смотрю': 'watching',
      'В планах': 'planned',
      'Отложено': 'on_hold',
      'Брошено': 'dropped',
    };

    let imported = 0;
    let failed = 0;
    const failures: string[] = [];

    // Process with limited concurrency (3 parallel searches, 150ms apart)
    const CONCURRENCY = 3;
    const DELAY_MS = 150;

    const queue = dto.entries.filter((e) => statusMap[e.status]);

    async function processOne(entry: typeof queue[0]) {
      const bookmarkStatus = statusMap[entry.status];
      const info = await yummyAnime.findAnime(entry.titleRu, entry.titleOrig);
      if (!info) {
        failed++;
        if (failures.length < 10) failures.push(entry.titleRu);
        return;
      }
      await this.upsert(userId, {
        animeId: info.anime_id,
        status: bookmarkStatus as any,
        animeUrl: info.anime_url,
        animeTitle: info.title,
        animePoster: yummyAnime.posterUrl(info, 'medium'),
      });
      imported++;
    }

    for (let i = 0; i < queue.length; i += CONCURRENCY) {
      const batch = queue.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((e) => processOne.call(this, e)));
      if (i + CONCURRENCY < queue.length) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    return {
      imported,
      failed,
      total: dto.entries.length,
      sampleFailures: failures,
    };
  }
}
