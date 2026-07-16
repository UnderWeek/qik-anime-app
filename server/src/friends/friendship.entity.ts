import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export type FriendshipStatus = 'pending' | 'accepted';

// Directional row: `requester` asked to befriend `addressee`.
// When accepted, the pair are friends (we treat it symmetrically in queries).
@Entity('friendships')
@Index(['requester', 'addressee'], { unique: true })
export class Friendship {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  requester: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  addressee: User;

  @Column({ default: 'pending', type: 'text' })
  status: FriendshipStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
