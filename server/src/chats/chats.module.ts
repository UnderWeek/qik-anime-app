import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Friendship } from '../friends/friendship.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatMessage } from './chat-message.entity';
import { Chat } from './chat.entity';
import { ChatsController } from './chats.controller';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, ChatMessage, User, Friendship]),
    JwtModule.register({}),
    NotificationsModule,
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsGateway],
  exports: [ChatsService],
})
export class ChatsModule {}
