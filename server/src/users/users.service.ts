import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { User } from './user.entity';
import { Bookmark } from '../bookmarks/bookmark.entity';
import { Rating } from '../ratings/rating.entity';
import { Comment } from '../comments/comment.entity';
import { Friendship } from '../friends/friendship.entity';
import { WatchProgress } from '../progress/watch-progress.entity';
import {
  ActivityStats,
  buildAchievements,
  computeXp,
  levelForXp,
} from '../common/gamification';
import { frameById, framesForLevel } from '../common/frames';

export const ONLINE_THRESHOLD_SECONDS = 300; // 5 min — window where user is considered online
const LAST_SEEN_THROTTLE_MS = 180_000; // 3 min — minimum interval between DB writes

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
    @InjectRepository(WatchProgress)
    private readonly progress: Repository<WatchProgress>,
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

  async touchLastSeen(user: User): Promise<void> {
    const now = new Date();
    if (user.lastSeenAt) {
      const elapsed = now.getTime() - new Date(user.lastSeenAt).getTime();
      if (elapsed < LAST_SEEN_THROTTLE_MS) return;
    }
    user.lastSeenAt = now;
    await this.repo.save(user, { listeners: false });
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
      isAdmin: !!user.isAdmin,
      isMaster: !!user.isMaster,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt || null,
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
        lastSeenAt: u.lastSeenAt || null,
      }));
  }

  // Gather activity counters for gamification
  async activityStats(userId: number): Promise<ActivityStats> {
    const user = await this.findById(userId);
    if (!user) {
      return {
        watchedEpisodes: 0, watchedSeconds: 0,
        ratings: 0, comments: 0, bookmarks: 0, friends: 0,
      };
    }

    const [allBookmarks, ratings, comments, friends, watchedAnimeIds] = await Promise.all([
      this.bookmarks.find({ where: { user: { id: userId } } }),
      this.ratings.count({ where: { user: { id: userId } } }),
      this.comments.count({ where: { user: { id: userId } } }),
      this.friendships
        .createQueryBuilder('f')
        .where('f.status = :s', { s: 'accepted' })
        .andWhere('(f.requesterId = :id OR f.addresseeId = :id)', {
          id: userId,
        })
        .getCount(),
      this.progress
        .createQueryBuilder('p')
        .select('DISTINCT p.animeId')
        .where('p.userId = :uid', { uid: userId })
        .getRawMany(),
    ]);

    const watchedAnimeSet = new Set(watchedAnimeIds.map((r: any) => r.animeId));

    const AVG_EP_SECONDS = 1440; // 24 min per episode
    let extraEpisodes = 0;
    let extraSeconds = 0;
    const bookmarkCounts: Record<string, number> = {};
    let totalBookmarks = 0;

    for (const bm of allBookmarks) {
      totalBookmarks++;
      bookmarkCounts[bm.status] = (bookmarkCounts[bm.status] || 0) + 1;

      // Count episodes from completed/watching bookmarks (dedup against actual watch progress)
      if ((bm.status === 'completed' || bm.status === 'watching' || bm.status === 'rewatching') && bm.episodeCount) {
        if (!watchedAnimeSet.has(bm.animeId)) {
          const episodes = bm.status === 'watching'
            ? Math.max(1, Math.floor(bm.episodeCount * 0.5))
            : bm.episodeCount;
          extraEpisodes += episodes;
          extraSeconds += episodes * AVG_EP_SECONDS;
        }
      }
    }

    return {
      watchedEpisodes: user.watchedEpisodes + extraEpisodes,
      watchedSeconds: user.watchedSeconds + extraSeconds,
      ratings,
      comments,
      bookmarks: totalBookmarks,
      friends,
      reZeroS4: !!user.reZeroS4,
      bookmarkCounts,
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
        bookmarkCounts: stats.bookmarkCounts || {},
      },
      xp,
      level,
      achievements,
      achievementsUnlocked: achievements.filter((a) => a.unlocked).length,
      frames: framesForLevel(level.level),
    };
  }
}
