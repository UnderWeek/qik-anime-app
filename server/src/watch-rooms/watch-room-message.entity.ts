import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { WatchRoom } from './watch-room.entity';

@Entity('watch_room_messages')
@Index(['room', 'id'])
export class WatchRoomMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => WatchRoom, { onDelete: 'CASCADE' })
  room: WatchRoom;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ nullable: true, type: 'text' })
  imageUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
