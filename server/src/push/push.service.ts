import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushSubscriptionEntity } from './push-subscription.entity';
import { Notification } from '../notifications/notification.entity';
import { APP_ROOT } from '../common/runtime-paths';

const VAPID_FILE = resolve(APP_ROOT, 'vapid.json');

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const logger = new Logger('PushService');

  // 1. Env vars take priority
  let publicKey = process.env.VAPID_PUBLIC_KEY;
  let privateKey = process.env.VAPID_PRIVATE_KEY;

  // 2. Fall back to vapid.json file
  if (!publicKey || !privateKey) {
    try {
      if (existsSync(VAPID_FILE)) {
        const saved = JSON.parse(readFileSync(VAPID_FILE, 'utf-8'));
        publicKey = saved.publicKey;
        privateKey = saved.privateKey;
      }
    } catch { /* ignore */ }
  }

  // 3. Auto-generate and persist
  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    try {
      writeFileSync(VAPID_FILE, JSON.stringify(keys));
    } catch { /* can't persist — will regenerate next restart */ }
    logger.warn('VAPID keys auto-generated and saved to vapid.json. Add them to .env for production.');
  }

  if (publicKey && privateKey) {
    webpush.setVapidDetails('mailto:admin@quickik.ru', publicKey, privateKey);
    vapidConfigured = true;
  } else {
    logger.error('Push notifications disabled: no VAPID keys configured');
  }
}

let _cachedPublicKey: string | null = null;

function loadPublicKey(): string | null {
  if (_cachedPublicKey !== null) return _cachedPublicKey;
  const env = process.env.VAPID_PUBLIC_KEY;
  if (env) { _cachedPublicKey = env; return env; }
  try {
    if (existsSync(VAPID_FILE)) {
      const saved = JSON.parse(readFileSync(VAPID_FILE, 'utf-8'));
      _cachedPublicKey = saved.publicKey || null;
      return _cachedPublicKey;
    }
  } catch { /* ignore */ }
  return null;
}

export function getVapidPublicKey(): string | null {
  ensureVapid();
  return loadPublicKey();
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
    if (existing) {
      this.logger.log(`Device already subscribed: user=${userId}`);
      return { ok: true };
    }

    const row = this.repo.create({
      user: { id: userId } as any,
      endpoint: sub.endpoint,
      keys: JSON.stringify(sub.keys),
    });
    await this.repo.save(row);
    this.logger.log(`Device subscribed: user=${userId} endpoint=${sub.endpoint.slice(0, 60)}...`);
    return { ok: true };
  }

  async unsubscribe(userId: number, endpoint: string) {
    await this.repo.delete({ user: { id: userId }, endpoint });
    return { ok: true };
  }

  /** Send a push notification to all devices of a user. */
  async sendToUser(userId: number, payload: { title: string; body: string; url: string }) {
    ensureVapid();
    if (!vapidConfigured) {
      this.logger.error('Cannot send push: VAPID keys not configured');
      return;
    }

    const subs = await this.repo.find({ where: { user: { id: userId } } });
    if (!subs.length) {
      this.logger.log(`No devices for user=${userId}, push skipped`);
      return;
    }

    this.logger.log(`Sending push to user=${userId} subs=${subs.length} title="${payload.title}" body="${payload.body.slice(0, 60)}"`);
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
        this.logger.log(`Push sent to user=${userId} ok`);
      } catch (err: any) {
        // 410 Gone — subscription expired, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          this.logger.warn(`Push sub expired for user=${userId}, removing`);
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
