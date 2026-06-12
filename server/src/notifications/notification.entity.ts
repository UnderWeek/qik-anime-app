import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export type NotificationType =
  | 'friend_request'
  | 'friend_accept'
  | 'anime_suggestion'
  | 'comment_reply'
  | 'room_invite'
  | 'system';

@Entity('notifications')
@Index(['recipient', 'read'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  // who receives the notification
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  recipient: User;

  // who triggered it (optional)
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true, eager: true })
  actor: User | null;

  @Column({ type: 'text' })
  type: NotificationType;

  @Column({ type: 'text', default: '' })
  message: string;

  // optional payload for navigation (anime suggestion etc.)
  @Column({ nullable: true, type: 'integer' })
  animeId: number | null;

  @Column({ nullable: true, type: 'text' })
  animeUrl: string;

  @Column({ nullable: true, type: 'text' })
  animeTitle: string;

  @Column({ nullable: true, type: 'text' })
  animePoster: string;

  @Column({ nullable: true, type: 'integer' })
  roomId: number | null;

  @Column({ nullable: true, type: 'text' })
  roomCode: string;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
