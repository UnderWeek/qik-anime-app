import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { User } from './user.entity';
import { Bookmark } from '../bookmarks/bookmark.entity';
import { Rating } from '../ratings/rating.entity';
import { Comment } from '../comments/comment.entity';
import { Friendship } from '../friends/friendship.entity';
import {
  ActivityStats,
  buildAchievements,
  computeXp,
  levelForXp,
} from '../common/gamification';
import { frameById, framesForLevel } from '../common/frames';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    @InjectRepository(Bookmark)
    private readonly bookmarks: Repository<Bookmark>,
    @InjectRepository(Rating)
    private readonly ratings: Repository<Rating>,
    @InjectRepository(Comment)
    private readonly comments: Repository<Comment>,
    @InjectRepository(Friendship)
    private readonly friendships: Repository<Friendship>,
  ) {}

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findByUsername(username: string) {
    return this.repo.findOne({ where: { username } });
  }

  findByLogin(login: string) {
    return this.repo.findOne({
      where: [{ email: login }, { username: login }],
    });
  }

  create(data: Partial<User>) {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  async updateProfile(
    id: number,
    data: {
      bio?: string;
      avatarColor?: string;
      avatarUrl?: string | null;
      bannerUrl?: string | null;
      avatarFrame?: string;
    },
  ) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Пользователь не найден');

    if (data.bio !== undefined) user.bio = data.bio;
    if (data.avatarColor !== undefined) user.avatarColor = data.avatarColor;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    if (data.bannerUrl !== undefined) user.bannerUrl = data.bannerUrl;

    if (data.avatarFrame !== undefined) {
      const frame = frameById(data.avatarFrame);
      if (!frame) throw new BadRequestException('Неизвестная рамка');
      // verify the frame is unlocked for the user's level
      const stats = await this.activityStats(id);
      const level = levelForXp(computeXp(stats)).level;
      if (level < frame.minLevel) {
        throw new BadRequestException(
          `Рамка откроется на ${frame.minLevel} уровне`,
        );
      }
      user.avatarFrame = data.avatarFrame;
    }

    await this.repo.save(user);
    return this.toPublic(user);
  }

  // Safe public projection (private fields included only for self)
  toPublic(user: User, includeEmail = true) {
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      email: includeEmail ? user.email : undefined,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl || null,
      bannerUrl: user.bannerUrl || null,
      avatarFrame: user.avatarFrame || null,
      bio: user.bio || '',
      createdAt: user.createdAt,
    };
  }

  async search(query: string, excludeId?: number) {
    const q = (query || '').trim();
    if (!q) return [];
    const rows = await this.repo.find({
      where: { username: Like(`%${q}%`) },
      take: 20,
      order: { username: 'ASC' },
    });
    return rows
      .filter((u) => u.id !== excludeId)
      .map((u) => ({
        id: u.id,
        username: u.username,
        avatarColor: u.avatarColor,
        avatarUrl: u.avatarUrl || null,
        avatarFrame: u.avatarFrame || null,
      }));
  }

  // Gather activity counters for gamification
  async activityStats(userId: number): Promise<ActivityStats> {
    const user = await this.findById(userId);
    const [bookmarks, ratings, comments, friends] = await Promise.all([
      this.bookmarks.count({ where: { user: { id: userId } } }),
      this.ratings.count({ where: { user: { id: userId } } }),
      this.comments.count({ where: { user: { id: userId } } }),
      this.friendships
        .createQueryBuilder('f')
        .where('f.status = :s', { s: 'accepted' })
        .andWhere('(f.requesterId = :id OR f.addresseeId = :id)', {
          id: userId,
        })
        .getCount(),
    ]);
    return {
      watchedEpisodes: user?.watchedEpisodes || 0,
      watchedSeconds: user?.watchedSeconds || 0,
      ratings,
      comments,
      bookmarks,
      friends,
      reZeroS4: !!user?.reZeroS4,
    };
  }

  // Full profile payload with level + achievements + stats
  async profile(userId: number, viewerId?: number) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');

    const stats = await this.activityStats(userId);
    const xp = computeXp(stats);
    const level = levelForXp(xp);
    const achievements = buildAchievements(stats);

    return {
      user: this.toPublic(user, viewerId === userId),
      stats: {
        watchedEpisodes: stats.watchedEpisodes,
        watchedSeconds: stats.watchedSeconds,
        watchedHours: Math.round((stats.watchedSeconds / 3600) * 10) / 10,
        ratings: stats.ratings,
        comments: stats.comments,
        bookmarks: stats.bookmarks,
        friends: stats.friends,
      },
      xp,
      level,
      achievements,
      achievementsUnlocked: achievements.filter((a) => a.unlocked).length,
      frames: framesForLevel(level.level),
    };
  }
}
