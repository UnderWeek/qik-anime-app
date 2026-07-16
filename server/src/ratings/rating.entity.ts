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

@Entity('ratings')
@Index(['user', 'animeId'], { unique: true })
export class Rating {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (u) => u.ratings, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  animeId: number;

  // 1..10 score
  @Column({ type: 'integer' })
  score: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
