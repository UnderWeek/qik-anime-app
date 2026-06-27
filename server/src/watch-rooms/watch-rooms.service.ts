import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import { basename, isAbsolute, relative, resolve } from 'path';
import { Repository } from 'typeorm';
import { UPLOAD_DIR_ABSOLUTE } from '../common/runtime-paths';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateWatchRoomDto,
  InviteToRoomDto,
  JoinWatchRoomDto,
  SendWatchRoomMessageDto,
  SetWatchRoomVideoDto,
  UpdateWatchRoomStateDto,
} from './dto';
import { WatchRoomMessage } from './watch-room-message.entity';
import { WatchRoomParticipant } from './watch-room-participant.entity';
import { WatchRoom } from './watch-room.entity';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class WatchRoomsService {
  constructor(
    @InjectRepository(WatchRoom)
    private readonly rooms: Repository<WatchRoom>,
    @InjectRepository(WatchRoomParticipant)
    private readonly participants: Repository<WatchRoomParticipant>,
    @InjectRepository(WatchRoomMessage)
    private readonly messages: Repository<WatchRoomMessage>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  private toUser(u: User) {
    return u
      ? {
          id: u.id,
          username: u.username,
          avatarColor: u.avatarColor,
          avatarUrl: u.avatarUrl || null,
          avatarFrame: u.avatarFrame || null,
          lastSeenAt: u.lastSeenAt || null,
        }
      : null;
  }

  private roomBase(room: WatchRoom) {
    return {
      id: room.id,
      code: room.code,
      ownerId: room.owner?.id,
      owner: this.toUser(room.owner),
      hostId: room.hostId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  private roomState(room: WatchRoom) {
    return {
      animeId: room.animeId,
      animeUrl: room.animeUrl,
      animeTitle: room.animeTitle,
      animePoster: room.animePoster,
      videoId: room.videoId,
      episodeNumber: room.episodeNumber,
      dubbing: room.dubbing,
      iframeUrl: room.iframeUrl,
      currentTime: room.currentTime || 0,
      isPaused: !!room.isPaused,
      hostId: room.hostId,
    };
  }

  private memberView(p: WatchRoomParticipant, ownerId: number, hostId: number) {
    return {
      id: p.user?.id,
      joinedAt: p.joinedAt,
      isOwner: p.user?.id === ownerId,
      isHost: p.user?.id === hostId,
      user: this.toUser(p.user),
    };
  }

  private messageView(m: WatchRoomMessage) {
    return {
      id: m.id,
      body: m.body || '',
      imageUrl: m.imageUrl || null,
      createdAt: m.createdAt,
      author: this.toUser(m.user),
    };
  }

  private normalizeCode(code: string) {
    return (code || '')
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9]/g, '');
  }

  private codeCandidate(size = 7) {
    let out = '';
    for (let i = 0; i < size; i += 1) {
      const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
      out += ROOM_CODE_ALPHABET[idx];
    }
    return out;
  }

  private async generateUniqueCode() {
    for (let i = 0; i < 24; i += 1) {
      const code = this.codeCandidate();
      const exists = await this.rooms.findOne({ where: { code } });
      if (!exists) return code;
    }
    throw new BadRequestException('Не удалось создать код комнаты');
  }

  private normalizeText(v?: string) {
    if (v === undefined) return undefined;
    const t = `${v}`.trim();
    return t || null;
  }

  private async roomOrThrow(roomId: number) {
    const room = await this.rooms.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Комната не найдена');
    return room;
  }

  private async membersForRoom(roomId: number) {
    return this.participants
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'user')
      .where('p.roomId = :roomId', { roomId })
      .orderBy('p.joinedAt', 'ASC')
      .getMany();
  }

  private async latestMessages(roomId: number, limit = 120) {
    const rows = await this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .where('m.roomId = :roomId', { roomId })
      .orderBy('m.id', 'DESC')
      .limit(limit)
      .getMany();
    return rows.reverse();
  }

  private async assertMember(roomId: number, userId: number) {
    const room = await this.roomOrThrow(roomId);
    const member = await this.participants.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    if (!member) throw new ForbiddenException('Вы не состоите в этой комнате');
    return { room, member };
  }

  private async deleteUploadedFile(imageUrl: string | null | undefined) {
    if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
    const filename = basename(imageUrl.split('?')[0]);
    if (!filename) return;
    const fullPath = resolve(UPLOAD_DIR_ABSOLUTE, filename);
    const rel = relative(UPLOAD_DIR_ABSOLUTE, fullPath);
    if (rel.startsWith('..') || isAbsolute(rel)) return;
    await unlink(fullPath).catch(() => undefined);
  }

  private async destroyRoom(room: WatchRoom) {
    const rows = await this.messages.find({
      where: { room: { id: room.id } },
    });
    await Promise.all(rows.map((row) => this.deleteUploadedFile(row.imageUrl)));
    await this.rooms.remove(room);
  }

  private async buildSnapshot(room: WatchRoom) {
    const members = await this.membersForRoom(room.id);
    const messages = await this.latestMessages(room.id);
    return {
      room: this.roomBase(room),
      state: this.roomState(room),
      members: members.map((m) => this.memberView(m, room.owner.id, room.hostId)),
      messages: messages.map((m) => this.messageView(m)),
    };
  }

  async isMember(roomId: number, userId: number) {
    const member = await this.participants.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    return !!member;
  }

  async snapshotForRoom(roomId: number) {
    const room = await this.roomOrThrow(roomId);
    return this.buildSnapshot(room);
  }

  async list(userId: number) {
    const rows = await this.participants
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.room', 'room')
      .leftJoinAndSelect('room.owner', 'owner')
      .where('p.userId = :userId', { userId })
      .orderBy('room.updatedAt', 'DESC')
      .getMany();

    const roomIds = [...new Set(rows.map((row) => row.room?.id).filter(Boolean))];
    const countRows = roomIds.length
      ? await this.participants
          .createQueryBuilder('p')
          .select('p.roomId', 'roomId')
          .addSelect('COUNT(*)', 'count')
          .where('p.roomId IN (:...roomIds)', { roomIds })
          .groupBy('p.roomId')
          .getRawMany()
      : [];

    const countMap = new Map<number, number>();
    countRows.forEach((row) => {
      countMap.set(Number(row.roomId), Number(row.count));
    });

    return rows
      .filter((row) => row.room)
      .map((row) => ({
        ...this.roomBase(row.room),
        membersCount: countMap.get(row.room.id) || 1,
        state: this.roomState(row.room),
      }));
  }

  async create(userId: number, dto: CreateWatchRoomDto) {
    const room = this.rooms.create({
      code: await this.generateUniqueCode(),
      owner: { id: userId } as any,
      hostId: userId,
      currentTime: 0,
      isPaused: true,
      animeId: dto.animeId ?? null,
      animeUrl: this.normalizeText(dto.animeUrl),
      animeTitle: this.normalizeText(dto.animeTitle),
      animePoster: this.normalizeText(dto.animePoster),
      videoId: this.normalizeText(dto.videoId),
      episodeNumber: this.normalizeText(dto.episodeNumber),
      dubbing: this.normalizeText(dto.dubbing),
      iframeUrl: this.normalizeText(dto.iframeUrl),
    });
    const saved = await this.rooms.save(room);
    await this.participants.save(
      this.participants.create({
        room: { id: saved.id } as any,
        user: { id: userId } as any,
      }),
    );
    const full = await this.roomOrThrow(saved.id);
    return this.buildSnapshot(full);
  }

  async join(userId: number, dto: JoinWatchRoomDto) {
    const code = this.normalizeCode(dto.code);
    if (!code || code.length < 4) {
      throw new BadRequestException('Неверный код комнаты');
    }
    const room = await this.rooms.findOne({ where: { code } });
    if (!room) throw new NotFoundException('Комната не найдена');

    const exists = await this.participants.findOne({
      where: { room: { id: room.id }, user: { id: userId } },
    });

    if (!exists) {
      await this.participants.save(
        this.participants.create({
          room: { id: room.id } as any,
          user: { id: userId } as any,
        }),
      );
      await this.rooms.save(room);
    }

    return this.buildSnapshot(room);
  }

  async joinById(roomId: number, userId: number) {
    const room = await this.roomOrThrow(roomId);
    const exists = await this.participants.findOne({
      where: { room: { id: room.id }, user: { id: userId } },
    });

    if (!exists) {
      await this.participants.save(
        this.participants.create({
          room: { id: room.id } as any,
          user: { id: userId } as any,
        }),
      );
      await this.rooms.save(room);
    }

    return this.buildSnapshot(room);
  }

  async get(roomId: number, userId: number) {
    const { room } = await this.assertMember(roomId, userId);
    return this.buildSnapshot(room);
  }

  async setVideo(roomId: number, userId: number, dto: SetWatchRoomVideoDto) {
    const { room } = await this.assertMember(roomId, userId);
    if (room.hostId !== userId) {
      throw new ForbiddenException('Управлять плеером может только ведущий');
    }

    const setTextField = (key: string, value?: string) => {
      if (value === undefined) return;
      (room as any)[key] = this.normalizeText(value);
    };

    if (dto.animeId !== undefined) room.animeId = dto.animeId;
    setTextField('animeUrl', dto.animeUrl);
    setTextField('animeTitle', dto.animeTitle);
    setTextField('animePoster', dto.animePoster);
    setTextField('videoId', dto.videoId);
    setTextField('episodeNumber', dto.episodeNumber);
    setTextField('dubbing', dto.dubbing);
    setTextField('iframeUrl', dto.iframeUrl);
    room.currentTime = 0;
    room.isPaused = true;

    await this.rooms.save(room);

    return this.roomState(room);
  }

  async updateState(roomId: number, userId: number, dto: UpdateWatchRoomStateDto) {
    const { room } = await this.assertMember(roomId, userId);
    if (room.hostId !== userId) {
      throw new ForbiddenException('Управлять плеером может только ведущий');
    }

    if (dto.currentTime !== undefined && Number.isFinite(dto.currentTime)) {
      room.currentTime = Math.max(0, dto.currentTime);
    }
    if (dto.isPaused !== undefined) {
      room.isPaused = dto.isPaused;
    }

    await this.rooms.save(room);
    return this.roomState(room);
  }

  async sendMessage(roomId: number, userId: number, dto: SendWatchRoomMessageDto) {
    const { room } = await this.assertMember(roomId, userId);
    const body = (dto.body || '').trim();
    const imageUrl = this.normalizeText(dto.imageUrl);

    if (!body && !imageUrl) {
      throw new BadRequestException('Сообщение не может быть пустым');
    }
    if (imageUrl && !imageUrl.startsWith('/uploads/')) {
      throw new BadRequestException('Разрешены только локально загруженные изображения');
    }

    const row = this.messages.create({
      room: { id: room.id } as any,
      user: { id: userId } as any,
      body,
      imageUrl,
    });
    const saved = await this.messages.save(row);

    const full = await this.messages.findOne({ where: { id: saved.id }, relations: ['user'] });
    return this.messageView(full);
  }

  async leave(roomId: number, userId: number) {
    const { room, member } = await this.assertMember(roomId, userId);
    const iAmOwner = room.owner.id === userId;
    const iAmHost = room.hostId === userId;

    if (!iAmOwner) {
      await this.participants.remove(member);
      // If the leaver was host, transfer host to owner
      if (iAmHost) {
        room.hostId = room.owner.id;
      }
      await this.rooms.save(room);
      return { ok: true, roomClosed: false };
    }

    const members = await this.membersForRoom(room.id);
    if (members.length <= 1) {
      await this.destroyRoom(room);
      return { ok: true, roomClosed: true };
    }

    const nextOwner = members.find((m) => m.user?.id !== userId);
    await this.participants.remove(member);
    room.owner = { id: nextOwner.user.id } as any;
    // Transfer host to new owner
    room.hostId = nextOwner.user.id;
    await this.rooms.save(room);

    return { ok: true, roomClosed: false, newOwnerId: nextOwner.user.id };
  }

  async invite(roomId: number, userId: number, dto: InviteToRoomDto) {
    const { room } = await this.assertMember(roomId, userId);
    const target = await this.users.findOne({ where: { id: dto.targetId } });
    if (!target) throw new NotFoundException('Пользователь не найден');

    const already = await this.participants.findOne({
      where: { room: { id: roomId }, user: { id: dto.targetId } },
    });
    if (already) throw new BadRequestException('Пользователь уже в комнате');

    const actor = await this.users.findOne({ where: { id: userId } });
    await this.notifications.create({
      recipientId: dto.targetId,
      actorId: userId,
      type: 'room_invite',
      message: `${actor?.username || 'Пользователь'} приглашает вас в комнату «${room.animeTitle || 'без названия'}»`,
      roomId: room.id,
      roomCode: room.code,
    });

    return { ok: true };
  }

  async close(roomId: number, userId: number) {
    const { room } = await this.assertMember(roomId, userId);
    if (room.owner.id !== userId) {
      throw new ForbiddenException('Закрыть комнату может только владелец');
    }
    await this.destroyRoom(room);
    return { ok: true };
  }
}
