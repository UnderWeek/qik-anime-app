import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('chats')
@Index(['user1', 'user2'], { unique: true })
export class Chat {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user1: User;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user2: User;

  @Column({ type: 'text', default: '' })
  lastMessage: string;

  @CreateDateColumn()
  lastMessageAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
