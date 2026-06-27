import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Friendship } from '../friends/friendship.entity';
import { ChatMessage } from './chat-message.entity';
import { Chat } from './chat.entity';
import { SendMessageDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chat)
    private readonly chats: Repository<Chat>,
    @InjectRepository(ChatMessage)
    private readonly messages: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Friendship)
    private readonly friendships: Repository<Friendship>,
    private readonly notifications: NotificationsService,
  ) {}

  private toUser(u: User) {
    return u
      ? {
          id: u.id,
          username: u.username,
          avatarColor: u.avatarColor,
          avatarUrl: u.avatarUrl || null,
          lastSeenAt: u.lastSeenAt || null,
        }
      : null;
  }

  private messageView(m: ChatMessage) {
    return {
      id: m.id,
      body: m.body || '',
      imageUrl: m.imageUrl || null,
      createdAt: m.createdAt,
      sender: this.toUser(m.sender),
    };
  }

  private chatView(c: Chat, userId: number) {
    const other = c.user1?.id === userId ? c.user2 : c.user1;
    return {
      id: c.id,
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      with: this.toUser(other),
    };
  }

  async list(userId: number) {
    const rows = await this.chats
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user1', 'u1')
      .leftJoinAndSelect('c.user2', 'u2')
      .where('c.user1Id = :uid OR c.user2Id = :uid', { uid: userId })
      .orderBy('c.lastMessageAt', 'DESC')
      .getMany();

    return rows.map((c) => this.chatView(c, userId));
  }

  async getOrCreate(userId: number, friendId: number) {
    if (userId === friendId) throw new BadRequestException('Нельзя создать чат с собой');

    // Check friendship
    const friendship = await this.friendships.findOne({
      where: [
        { requester: { id: userId }, addressee: { id: friendId }, status: 'accepted' },
        { requester: { id: friendId }, addressee: { id: userId }, status: 'accepted' },
      ],
    });

    if (!friendship) throw new ForbiddenException('Вы не друзья');

    // Find or create chat (bidirectional)
    let chat = await this.chats
      .createQueryBuilder('c')
      .where('(c.user1Id = :uid AND c.user2Id = :fid) OR (c.user1Id = :fid AND c.user2Id = :uid)', {
        uid: userId,
        fid: friendId,
      })
      .getOne();

    if (!chat) {
      chat = this.chats.create({
        user1: { id: Math.min(userId, friendId) } as any,
        user2: { id: Math.max(userId, friendId) } as any,
      });
      await this.chats.save(chat);
    }

    // Reload with relations
    const full = await this.chats
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user1', 'u1')
      .leftJoinAndSelect('c.user2', 'u2')
      .where('c.id = :id', { id: chat.id })
      .getOne();

    const msgs = await this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 's')
      .where('m.chatId = :cid', { cid: chat.id })
      .orderBy('m.id', 'DESC')
      .limit(80)
      .getMany();

    return {
      chat: this.chatView(full, userId),
      messages: msgs.reverse().map((m) => this.messageView(m)),
    };
  }

  async sendMessage(chatId: number, userId: number, dto: SendMessageDto) {
    const chat = await this.chats.findOne({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Чат не найден');

    if (chat.user1?.id !== userId && chat.user2?.id !== userId) {
      throw new ForbiddenException('Вы не участник этого чата');
    }

    const body = (dto.body || '').trim();
    const imageUrl = (dto.imageUrl || '').trim() || null;

    if (!body && !imageUrl) throw new BadRequestException('Сообщение не может быть пустым');

    const row = this.messages.create({
      chat: { id: chatId } as any,
      sender: { id: userId } as any,
      body,
      imageUrl,
    });
    const saved = await this.messages.save(row);

    // Update last message
    chat.lastMessage = body || '[изображение]';
    chat.lastMessageAt = new Date();
    await this.chats.save(chat);

    const full = await this.messages.findOne({
      where: { id: saved.id },
      relations: ['sender'],
    });

    // Notify the other participant
    const otherId = chat.user1?.id === userId ? chat.user2?.id : chat.user1?.id;
    if (otherId) {
      const sender = await this.users.findOne({ where: { id: userId } });
      this.notifications.create({
        recipientId: otherId,
        actorId: userId,
        type: 'chat_message',
        message: `${sender?.username || 'Пользователь'}: ${body ? body.slice(0, 80) : '[изображение]'}`,
        chatId,
      }).catch(() => {});
    }

    return this.messageView(full);
  }

  async getMessages(chatId: number, userId: number) {
    const chat = await this.chats.findOne({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Чат не найден');
    if (chat.user1?.id !== userId && chat.user2?.id !== userId) {
      throw new ForbiddenException('Вы не участник этого чата');
    }

    const msgs = await this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 's')
      .where('m.chatId = :cid', { cid: chatId })
      .orderBy('m.id', 'DESC')
      .limit(100)
      .getMany();

    return msgs.reverse().map((m) => this.messageView(m));
  }
}
