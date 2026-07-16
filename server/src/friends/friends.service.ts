import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship } from './friendship.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friendship)
    private readonly repo: Repository<Friendship>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  private pub(u: User) {
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

  // find a friendship row between two users regardless of direction
  private async between(a: number, b: number) {
    return this.repo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.requester', 'req')
      .leftJoinAndSelect('f.addressee', 'addr')
      .where(
        '(req.id = :a AND addr.id = :b) OR (req.id = :b AND addr.id = :a)',
        { a, b },
      )
      .getOne();
  }

  async request(userId: number, targetId: number) {
    if (userId === targetId)
      throw new BadRequestException('Нельзя добавить самого себя');

    const target = await this.users.findOne({ where: { id: targetId } });
    if (!target) throw new NotFoundException('Пользователь не найден');

    const existing = await this.between(userId, targetId);
    if (existing) {
      if (existing.status === 'accepted')
        throw new BadRequestException('Вы уже друзья');
      // If the other side already requested us, accept it
      if (existing.requester.id === targetId) {
        existing.status = 'accepted';
        await this.repo.save(existing);
        const me = await this.users.findOne({ where: { id: userId } });
        await this.notifications.create({
          recipientId: targetId,
          actorId: userId,
          type: 'friend_accept',
          message: `${me?.username || 'Пользователь'} теперь у вас в друзьях`,
        });
        return { status: 'accepted' };
      }
      throw new BadRequestException('Заявка уже отправлена');
    }

    const fr = this.repo.create({
      requester: { id: userId } as any,
      addressee: { id: targetId } as any,
      status: 'pending',
    });
    await this.repo.save(fr);

    const me = await this.users.findOne({ where: { id: userId } });
    await this.notifications.create({
      recipientId: targetId,
      actorId: userId,
      type: 'friend_request',
      message: `${me?.username || 'Пользователь'} хочет добавить вас в друзья`,
    });

    return { status: 'pending' };
  }

  async accept(userId: number, requestId: number) {
    const fr = await this.repo.findOne({ where: { id: requestId } });
    if (!fr) throw new NotFoundException('Заявка не найдена');
    if (fr.addressee.id !== userId)
      throw new ForbiddenException('Это не ваша заявка');
    fr.status = 'accepted';
    await this.repo.save(fr);

    const me = await this.users.findOne({ where: { id: userId } });
    await this.notifications.create({
      recipientId: fr.requester.id,
      actorId: userId,
      type: 'friend_accept',
      message: `${me?.username || 'Пользователь'} принял вашу заявку в друзья`,
    });

    return { ok: true };
  }

  async remove(userId: number, otherId: number) {
    const fr = await this.between(userId, otherId);
    if (!fr) throw new NotFoundException('Связь не найдена');
    if (fr.requester.id !== userId && fr.addressee.id !== userId)
      throw new ForbiddenException();
    await this.repo.remove(fr);
    return { ok: true };
  }

  // list accepted friends of a user
  async listFriends(userId: number) {
    const rows = await this.repo
      .createQueryBuilder('f')
      .innerJoinAndSelect('f.requester', 'req')
      .innerJoinAndSelect('f.addressee', 'addr')
      .where('f.status = :s', { s: 'accepted' })
      .andWhere('(req.id = :id OR addr.id = :id)', { id: userId })
      .getMany();

    return rows
      .map((f) => {
        const isRequester = f.requester?.id === userId
        const friend = isRequester ? f.addressee : f.requester
        if (!friend?.id) return null // guard against orphan rows
        return this.pub(friend)
      })
      .filter(Boolean);
  }

  // incoming + outgoing pending requests for the current user
  async pending(userId: number) {
    const rows = await this.repo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.requester', 'req')
      .leftJoinAndSelect('f.addressee', 'addr')
      .where('f.status = :s', { s: 'pending' })
      .andWhere('(req.id = :id OR addr.id = :id)', { id: userId })
      .getMany();

    return {
      incoming: rows
        .filter((f) => f.addressee.id === userId)
        .map((f) => ({ requestId: f.id, user: this.pub(f.requester) })),
      outgoing: rows
        .filter((f) => f.requester.id === userId)
        .map((f) => ({ requestId: f.id, user: this.pub(f.addressee) })),
    };
  }

  async friendsCount(userId: number) {
    return this.repo
      .createQueryBuilder('f')
      .innerJoin('f.requester', 'req')
      .innerJoin('f.addressee', 'addr')
      .where('f.status = :s', { s: 'accepted' })
      .andWhere('(req.id = :id OR addr.id = :id)', { id: userId })
      .getCount();
  }

  // relationship status of current user toward another (for UI buttons)
  async statusToward(userId: number, otherId: number) {
    if (userId === otherId) return 'self';
    const fr = await this.between(userId, otherId);
    if (!fr) return 'none';
    if (fr.status === 'accepted') return 'friends';
    return fr.requester.id === userId ? 'outgoing' : 'incoming';
  }
}
