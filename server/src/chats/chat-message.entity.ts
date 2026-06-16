import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Chat } from './chat.entity';

@Entity('chat_messages')
@Index(['chat', 'id'])
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Chat, { onDelete: 'CASCADE' })
  chat: Chat;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  sender: User;

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ nullable: true, type: 'text' })
  imageUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
