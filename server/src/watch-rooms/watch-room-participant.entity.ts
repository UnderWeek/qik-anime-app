import {
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { WatchRoom } from './watch-room.entity';

@Entity('watch_room_participants')
@Index(['room', 'user'], { unique: true })
export class WatchRoomParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => WatchRoom, { onDelete: 'CASCADE' })
  room: WatchRoom;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
