import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('opening_ratings')
@Index(['user', 'animeId', 'type'], { unique: true })
export class OpeningRating {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  animeId: number;

  // 'opening' or 'ending'
  @Column({ type: 'text' })
  type: string;

  @Column({ type: 'integer' })
  score: number; // 1..10

  @CreateDateColumn()
  createdAt: Date;
}
