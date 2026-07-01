import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { User } from '../users/user.entity';
import { AuditLog } from './audit-log.entity';
import * as os from 'os';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly audit: Repository<AuditLog>,
  ) {}

  private log(action: string, adminId: number, adminName: string, target?: string, details?: string) {
    return this.audit.save(this.audit.create({ adminId, adminName, action, target, details })).catch(() => {});
  }

  async claimAdmin(userId: number, secret: string) {
    const expected = process.env.ADMIN_SECRET;
    if (!expected || secret !== expected) {
      return { ok: false, error: 'Неверный код' };
    }

    await this.users.update(userId, { isAdmin: true });
    const user = await this.users.findOne({ where: { id: userId }, select: ['username'] });
    await this.log('claim', userId, user?.username || String(userId), undefined, 'Получил права администратора');
    return { ok: true };
  }

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

  async deleteUser(id: number, adminId?: number, adminName?: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) return null;
    await this.users.remove(user);
    if (adminId) {
      await this.log('delete_user', adminId, adminName || '', `${user.username} (ID ${user.id})`);
    }
    return { ok: true };
  }

  async toggleMaster(id: number, adminId?: number, adminName?: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) return null;
    user.isMaster = !user.isMaster;
    await this.users.save(user);
    if (adminId) {
      await this.log(
        user.isMaster ? 'promote_master' : 'demote_master',
        adminId,
        adminName || '',
        `${user.username} (ID ${user.id})`,
      );
    }
    return { ok: true, isMaster: user.isMaster };
  }

  async getServerStats() {
    const freemem = os.freemem();
    const totalmem = os.totalmem();
    const usedmem = totalmem - freemem;

    return {
      memory: {
        total: Math.round(totalmem / 1024 / 1024),
        used: Math.round(usedmem / 1024 / 1024),
        free: Math.round(freemem / 1024 / 1024),
        percent: Math.round((usedmem / totalmem) * 100),
      },
      cpu: {
        loadAvg: os.loadavg().map((v) => Math.round(v * 100) / 100),
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'unknown',
      },
      uptime: Math.round(os.uptime()),
      platform: os.platform(),
      nodeVersion: process.version,
    };
  }

  async getAuditLogs(page = 1, limit = 50) {
    const [rows, total] = await this.audit.findAndCount({
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: rows,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async getRegistrationStats(days = 30) {
    const repo = this.users.manager;
    const rows = await repo.query(
      `SELECT DATE(createdAt) as day, COUNT(*) as count
       FROM users
       WHERE createdAt >= datetime('now', '-' || ? || ' days')
       GROUP BY DATE(createdAt)
       ORDER BY day ASC`,
      [days],
    );
    return rows;
  }

  async listUsers(q?: string, page = 1, limit = 100) {
    const where: any = {};
    if (q) {
      where.username = Like(`%${q}%`);
    }

    const [rows, total] = await this.users.findAndCount({
      where,
      select: ['id', 'username', 'email', 'isAdmin', 'isMaster', 'createdAt', 'watchedEpisodes', 'watchedSeconds', 'lastSeenAt'],
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
        isMaster: !!u.isMaster,
        watchedEpisodes: u.watchedEpisodes,
        watchedHours: Math.round((u.watchedSeconds / 3600) * 10) / 10,
        createdAt: u.createdAt,
        lastSeenAt: u.lastSeenAt || null,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}
