import { JwtService } from '@nestjs/jwt';
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

function chatChannel(chatId: number) {
  return `chat:${chatId}`;
}

@WebSocketGateway({
  namespace: '/chat',
  path: '/api/socket.io',
  cors: { origin: true, credentials: true },
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly usersBySocket = new Map<string, number>();

  constructor(private readonly jwt: JwtService) {}

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) return authToken;
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) return queryToken;
    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7).trim();
    return '';
  }

  private userId(client: Socket) {
    return this.usersBySocket.get(client.id) || 0;
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.emit('chat:error', { message: 'auth_required' });
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: JWT_SECRET });
      const userId = Number(payload?.sub || 0);
      if (!userId) throw new Error('invalid_user');
      this.usersBySocket.set(client.id, userId);
      client.emit('chat:ready', { userId });
    } catch {
      client.emit('chat:error', { message: 'invalid_token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.usersBySocket.delete(client.id);
  }

  @SubscribeMessage('chat:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { chatId?: number },
  ) {
    const userId = this.userId(client);
    const chatId = Number(body?.chatId || 0);
    if (!userId || !chatId) return { ok: false, message: 'bad_request' };
    await client.join(chatChannel(chatId));
    return { ok: true };
  }

  @SubscribeMessage('chat:leave')
  async onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { chatId?: number },
  ) {
    const chatId = Number(body?.chatId || 0);
    if (!chatId) return { ok: false };
    await client.leave(chatChannel(chatId));
    return { ok: true };
  }

  emitMessage(chatId: number, payload: any) {
    this.server.to(chatChannel(chatId)).emit('chat:message', payload);
  }
}
