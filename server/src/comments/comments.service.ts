import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Comment } from './comment.entity';
import { CommentLike } from './comment-like.entity';
import { User } from '../users/user.entity';
import { CreateCommentDto, UpdateCommentDto } from './dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly repo: Repository<Comment>,
    @InjectRepository(CommentLike)
    private readonly likes: Repository<CommentLike>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  private base(c: Comment, likeCount = 0, likedByMe = false) {
    return {
      id: c.id,
      animeId: c.animeId,
      targetUserId: c.targetUserId,
      body: c.body,
      imageUrl: c.imageUrl || null,
      parentId: c.parentId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      likeCount,
      likedByMe,
      author: c.user
        ? {
            id: c.user.id,
            username: c.user.username,
            avatarColor: c.user.avatarColor,
            avatarUrl: c.user.avatarUrl || null,
            avatarFrame: c.user.avatarFrame || null,
          }
        : null,
    };
  }

  // attach like counts + likedByMe to a list of comments
  private async withLikes(rows: Comment[], viewerId?: number) {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const allLikes = await this.likes.find({
      where: { comment: { id: In(ids) } },
      relations: ['comment', 'user'],
    });
    const countMap: Record<number, number> = {};
    const mineSet = new Set<number>();
    for (const l of allLikes) {
      countMap[l.comment.id] = (countMap[l.comment.id] || 0) + 1;
      if (viewerId && l.user.id === viewerId) mineSet.add(l.comment.id);
    }
    return rows.map((c) =>
      this.base(c, countMap[c.id] || 0, mineSet.has(c.id)),
    );
  }

  async listForAnime(animeId: number, viewerId?: number) {
    const rows = await this.repo.find({
      where: { animeId },
      order: { createdAt: 'DESC' },
    });
    return this.withLikes(rows, viewerId);
  }

  async listForProfile(targetUserId: number, viewerId?: number) {
    const rows = await this.repo.find({
      where: { targetUserId },
      order: { createdAt: 'DESC' },
    });
    return this.withLikes(rows, viewerId);
  }

  // number of comments authored by a user (for profile stats)
  countByUser(userId: number) {
    return this.repo.count({ where: { user: { id: userId } } });
  }

  // recent comments authored by a user (anime comments, not profile wall)
  async listByUser(userId: number, viewerId?: number, limit = 20) {
    const rows = await this.repo.find({
      where: { user: { id: userId }, animeId: Not(0) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return this.withLikes(rows, viewerId);
  }

  // number of comments on an anime (for the QIK-native comment counter)
  countForAnime(animeId: number) {
    return this.repo.count({ where: { animeId } });
  }

  async create(userId: number, dto: CreateCommentDto) {
    const body = (dto.body || '').trim();
    if (!body && !dto.imageUrl)
      throw new BadRequestException('Комментарий не может быть пустым');

    const comment = this.repo.create({
      user: { id: userId } as any,
      animeId: dto.animeId ?? 0,
      targetUserId: dto.targetUserId ?? null,
      body,
      imageUrl: dto.imageUrl || null,
      parentId: dto.parentId ?? null,
    });
    const saved = await this.repo.save(comment);
    const full = await this.repo.findOne({ where: { id: saved.id } });
    return this.base(full, 0, false);
  }

  async update(userId: number, id: number, dto: UpdateCommentDto) {
    const comment = await this.repo.findOne({ where: { id } });
    if (!comment) throw new NotFoundException('Комментарий не найден');
    const actor = await this.users.findOne({ where: { id: userId } });
    const canEdit = comment.user.id === userId || actor?.isAdmin || actor?.isMaster;
    if (!canEdit)
      throw new ForbiddenException('Можно редактировать только свои комментарии');
    const body = (dto.body || '').trim();
    if (!body && !comment.imageUrl)
      throw new BadRequestException('Комментарий не может быть пустым');
    comment.body = body;
    const saved = await this.repo.save(comment);
    const count = await this.likes.count({ where: { comment: { id } } });
    return this.base(saved, count, false);
  }

  async remove(userId: number, id: number) {
    const comment = await this.repo.findOne({ where: { id }, relations: ['user'] });
    if (!comment) throw new NotFoundException('Комментарий не найден');
    const actor = await this.users.findOne({ where: { id: userId } });
    const canDelete = comment.user.id === userId || actor?.isAdmin || actor?.isMaster;
    if (!canDelete)
      throw new ForbiddenException('Можно удалять только свои комментарии');
    await this.repo.remove(comment);
    return { ok: true };
  }

  // toggle a like; returns the new like state + count
  async toggleLike(userId: number, commentId: number) {
    const comment = await this.repo.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Комментарий не найден');

    const existing = await this.likes
      .createQueryBuilder('l')
      .where('l.commentId = :commentId', { commentId })
      .andWhere('l.userId = :userId', { userId })
      .getOne();

    let liked: boolean;
    if (existing) {
      await this.likes.remove(existing);
      liked = false;
    } else {
      await this.likes.save(
        this.likes.create({
          user: { id: userId } as any,
          comment: { id: commentId } as any,
        }),
      );
      liked = true;
    }
    const likeCount = await this.likes.count({
      where: { comment: { id: commentId } },
    });
    return { liked, likeCount };
  }
}
