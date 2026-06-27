import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushSubscriptionEntity } from './push-subscription.entity';
import { Notification } from '../notifications/notification.entity';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    webpush.setVapidDetails('mailto:admin@quickik.ru', publicKey, privateKey);
    vapidConfigured = true;
  }
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly repo: Repository<PushSubscriptionEntity>,
  ) {}

  async subscribe(userId: number, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    const existing = await this.repo.findOne({
      where: { user: { id: userId }, endpoint: sub.endpoint },
    });
    if (existing) return { ok: true };

    const row = this.repo.create({
      user: { id: userId } as any,
      endpoint: sub.endpoint,
      keys: JSON.stringify(sub.keys),
    });
    await this.repo.save(row);
    return { ok: true };
  }

  async unsubscribe(userId: number, endpoint: string) {
    await this.repo.delete({ user: { id: userId }, endpoint });
    return { ok: true };
  }

  /** Send a push notification to all devices of a user. */
  async sendToUser(userId: number, payload: { title: string; body: string; url: string }) {
    ensureVapid();
    if (!vapidConfigured) return;

    const subs = await this.repo.find({ where: { user: { id: userId } } });
    if (!subs.length) return;

    const data = JSON.stringify(payload);

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: JSON.parse(sub.keys),
          },
          data,
        );
      } catch (err: any) {
        // 410 Gone — subscription expired, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.repo.remove(sub);
        } else {
          this.logger.warn(`Push failed for user ${userId}: ${err.message}`);
        }
      }
    }
  }

  /** Build a push payload from an in-app notification. */
  static notificationPayload(n: Notification): { title: string; body: string; url: string } | null {
    const body = n.message || '';
    const title = 'QIK Anime';

    let url = '/';
    if (n.type === 'friend_request' || n.type === 'friend_accept') {
      url = '/friends';
    } else if (n.type === 'anime_suggestion' && n.animeUrl) {
      url = `/anime/${n.animeUrl}`;
    } else if (n.type === 'comment_reply' && n.animeId) {
      url = `/anime/${n.animeUrl || n.animeId}#comments`;
    } else if (n.type === 'room_invite' && n.roomId) {
      url = `/rooms/${n.roomId}`;
    } else if (n.type === 'chat_message' && n.chatId) {
      url = `/chats`;
    }

    return { title, body, url };
  }
}
