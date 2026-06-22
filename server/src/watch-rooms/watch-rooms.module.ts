import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JWT_SECRET } from '../auth/jwt.strategy';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/user.entity';
import { WatchRoomMessage } from './watch-room-message.entity';
import { WatchRoomParticipant } from './watch-room-participant.entity';
import { WatchRoom } from './watch-room.entity';
import { AnilibriaService } from './anilibria.service';
import { WatchRoomsController } from './watch-rooms.controller';
import { WatchRoomsGateway } from './watch-rooms.gateway';
import { WatchRoomsService } from './watch-rooms.service';

@Module({
  imports: [
    JwtModule.register({
      secret: JWT_SECRET,
    }),
    TypeOrmModule.forFeature([WatchRoom, WatchRoomParticipant, WatchRoomMessage, User]),
    NotificationsModule,
  ],
  controllers: [WatchRoomsController],
  providers: [WatchRoomsService, WatchRoomsGateway, AnilibriaService],
  exports: [WatchRoomsService, WatchRoomsGateway],
})
export class WatchRoomsModule {}
