import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmark } from './bookmark.entity';
import { UpsertBookmarkDto } from './dto';

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
}
