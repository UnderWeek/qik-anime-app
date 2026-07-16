import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { JWT_SECRET } from '../auth/jwt.strategy';
import { User } from '../users/user.entity';
import { WatchRoomsService } from './watch-rooms.service';

function roomChannel(roomId: number) {
  return `watch-room:${roomId}`;
}

@WebSocketGateway({
  namespace: '/watch-rooms',
  path: '/api/socket.io',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class WatchRoomsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly usersBySocket = new Map<string, number>();

  constructor(
    private readonly jwt: JwtService,
    private readonly rooms: WatchRoomsService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) return authToken;

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) return queryToken;

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }
    return '';
  }

  private userId(client: Socket) {
    return this.usersBySocket.get(client.id) || 0;
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.emit('room:error', { message: 'auth_required' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync(token, { secret: JWT_SECRET });
      const userId = Number(payload?.sub || 0);
      if (!userId) throw new Error('invalid_user');
      this.usersBySocket.set(client.id, userId);
      this.usersRepo.update(userId, { lastSeenAt: new Date() }).catch(() => {});
      client.emit('room:ready', { userId });
    } catch {
      client.emit('room:error', { message: 'invalid_token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.usersBySocket.get(client.id);
    if (userId) {
      this.usersRepo.update(userId, { lastSeenAt: new Date() }).catch(() => {});
    }
    this.usersBySocket.delete(client.id);
  }

  @SubscribeMessage('room:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: number },
  ) {
    const userId = this.userId(client);
    const roomId = Number(body?.roomId || 0);
    if (!userId || !roomId) return { ok: false, message: 'bad_request' };

    const canJoin = await this.rooms.isMember(roomId, userId);
    if (!canJoin) return { ok: false, message: 'forbidden' };

    await client.join(roomChannel(roomId));

    const snap = await this.rooms.snapshotForRoom(roomId);
    this.emitSnapshot(roomId, snap);

    return { ok: true };
  }

  @SubscribeMessage('room:leave')
  async onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: number },
  ) {
    const roomId = Number(body?.roomId || 0);
    if (!roomId) return { ok: false };
    await client.leave(roomChannel(roomId));
    return { ok: true };
  }

  emitSnapshot(roomId: number, snapshot: any) {
    this.server.to(roomChannel(roomId)).emit('room:snapshot', snapshot);
  }

  emitState(roomId: number, payload: any) {
    this.server.to(roomChannel(roomId)).emit('room:state', payload);
  }

  emitMembers(roomId: number, payload: any) {
    this.server.to(roomChannel(roomId)).emit('room:members', payload);
  }

  emitMessage(roomId: number, payload: any) {
    this.server.to(roomChannel(roomId)).emit('room:message', payload);
  }

  emitClosed(roomId: number) {
    this.server.to(roomChannel(roomId)).emit('room:closed', { roomId });
  }
}
