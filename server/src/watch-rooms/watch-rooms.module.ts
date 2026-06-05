import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchRoomMessage } from './watch-room-message.entity';
import { WatchRoomParticipant } from './watch-room-participant.entity';
import { WatchRoom } from './watch-room.entity';
import { WatchRoomsController } from './watch-rooms.controller';
import { WatchRoomsService } from './watch-rooms.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WatchRoom, WatchRoomParticipant, WatchRoomMessage]),
  ],
  controllers: [WatchRoomsController],
  providers: [WatchRoomsService],
})
export class WatchRoomsModule {}
