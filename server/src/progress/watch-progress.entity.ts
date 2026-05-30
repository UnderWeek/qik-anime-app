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

// Tracks where a user stopped watching: episode + second.
// One row per (user, anime, episode).
@Entity('watch_progress')
@Index(['user', 'animeId', 'episodeNumber'], { unique: true })
export class WatchProgress {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  animeId: number;

  @Column({ nullable: true, type: 'text' })
  animeUrl: string;

  @Column({ nullable: true, type: 'text' })
  animeTitle: string;

  @Column({ nullable: true, type: 'text' })
  animePoster: string;

  // comma-separated genre titles, used for the profile genre breakdown
  @Column({ nullable: true, type: 'text' })
  genres: string;

  // episode identity / source so we can resume the same player+dub
  @Column({ type: 'text' })
  episodeNumber: string;

  @Column({ type: 'integer', default: 0 })
  episodeIndex: number;

  @Column({ type: 'integer', nullable: true })
  videoId: number;

  @Column({ nullable: true, type: 'text' })
  dubbing: string;

  @Column({ nullable: true, type: 'text' })
  player: string;

  // playback position
  @Column({ type: 'integer', default: 0 })
  seconds: number;

  @Column({ type: 'integer', default: 0 })
  duration: number;

  // marked when watched >= ~85%
  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
