import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import { PushService } from '../push/push.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    private readonly push: PushService,
  ) {}

  // Create a notification. Skips self-notifications.
  async create(params: {
    recipientId: number;
    actorId?: number;
    type: NotificationType;
    message: string;
    animeId?: number;
    animeUrl?: string;
    animeTitle?: string;
    animePoster?: string;
    roomId?: number;
    roomCode?: string;
    chatId?: number;
  }) {
    if (params.actorId && params.actorId === params.recipientId) return null;
    const n = this.repo.create({
      recipient: { id: params.recipientId } as any,
      actor: params.actorId ? ({ id: params.actorId } as any) : null,
      type: params.type,
      message: params.message,
      animeId: params.animeId ?? null,
      animeUrl: params.animeUrl,
      animeTitle: params.animeTitle,
      animePoster: params.animePoster,
      roomId: params.roomId ?? null,
      roomCode: params.roomCode ?? null,
      chatId: params.chatId ?? null,
    });
    const saved = await this.repo.save(n);
    // Fire-and-forget push to recipient devices
    const payload = PushService.notificationPayload(saved);
    if (payload) {
      this.logger.log(`Queueing push for user=${params.recipientId} type=${params.type}`);
      this.push.sendToUser(params.recipientId, payload).catch((err) => {
        this.logger.error(`Push rejected for user=${params.recipientId}: ${err?.message || err}`);
      });
    } else {
      this.logger.warn(`No push payload for type=${params.type}`);
    }
    return saved;
  }

  private toPublic(n: Notification) {
    return {
      id: n.id,
      type: n.type,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt,
      animeId: n.animeId,
      animeUrl: n.animeUrl,
      animeTitle: n.animeTitle,
      animePoster: n.animePoster,
      roomId: n.roomId,
      roomCode: n.roomCode,
      actor: n.actor
        ? {
            id: n.actor.id,
            username: n.actor.username,
            avatarColor: n.actor.avatarColor,
            avatarUrl: n.actor.avatarUrl || null,
            avatarFrame: n.actor.avatarFrame || null,
            lastSeenAt: n.actor.lastSeenAt || null,
          }
        : null,
    };
  }

  async list(userId: number) {
    const rows = await this.repo.find({
      where: { recipient: { id: userId } },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return rows.map((n) => this.toPublic(n));
  }

  async unreadCount(userId: number) {
    const count = await this.repo.count({
      where: { recipient: { id: userId }, read: false },
    });
    return { count };
  }

  async markAllRead(userId: number) {
    await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ read: true })
      .where('recipientId = :id AND read = 0', { id: userId })
      .execute();
    return { ok: true };
  }

  async markRead(userId: number, id: number) {
    await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ read: true })
      .where('recipientId = :uid AND id = :id', { uid: userId, id })
      .execute();
    return { ok: true };
  }

  async remove(userId: number, id: number) {
    await this.repo
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('recipientId = :uid AND id = :id', { uid: userId, id })
      .execute();
    return { ok: true };
  }
}
