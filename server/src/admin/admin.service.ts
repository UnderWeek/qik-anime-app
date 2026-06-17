import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async getStats() {
    const totalUsers = await this.users.count();
    // Use raw query for cross-table stats since we don't have repos for all entities
    const repo = this.users.manager;
    const [bookmarks, ratings, comments] = await Promise.all([
      repo.query('SELECT COUNT(*) as c FROM bookmarks').then((r) => r[0]?.c || 0),
      repo.query('SELECT COUNT(*) as c FROM ratings').then((r) => r[0]?.c || 0),
      repo.query('SELECT COUNT(*) as c FROM comments').then((r) => r[0]?.c || 0),
    ]);

    const watchedEpisodes = await repo
      .query('SELECT COALESCE(SUM(watchedEpisodes), 0) as c FROM users')
      .then((r) => r[0]?.c || 0);

    const watchedSeconds = await repo
      .query('SELECT COALESCE(SUM(watchedSeconds), 0) as c FROM users')
      .then((r) => r[0]?.c || 0);

    const chats = await repo.query('SELECT COUNT(*) as c FROM chats').then((r) => r[0]?.c || 0);
    const rooms = await repo.query('SELECT COUNT(*) as c FROM watch_rooms').then((r) => r[0]?.c || 0);
    const admins = await this.users.count({ where: { isAdmin: true } });

    return {
      totalUsers,
      admins,
      bookmarks,
      ratings,
      comments,
      watchedEpisodes,
      watchedHours: Math.round((Number(watchedSeconds) / 3600) * 10) / 10,
      chats,
      rooms,
    };
  }

  async deleteUser(id: number) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) return null;
    await this.users.remove(user);
    return { ok: true };
  }

  async listUsers(q?: string, page = 1, limit = 100) {
    const where: any = {};
    if (q) {
      where.username = Like(`%${q}%`);
    }

    const [rows, total] = await this.users.findAndCount({
      where,
      select: ['id', 'username', 'email', 'isAdmin', 'createdAt', 'watchedEpisodes', 'watchedSeconds'],
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: rows.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        isAdmin: !!u.isAdmin,
        watchedEpisodes: u.watchedEpisodes,
        watchedHours: Math.round((u.watchedSeconds / 3600) * 10) / 10,
        createdAt: u.createdAt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}
