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

// Watch-list statuses, similar to common anime trackers
export type BookmarkStatus =
  | 'watching'
  | 'planned'
  | 'completed'
  | 'on_hold'
  | 'dropped'
  | 'rewatching'
  | 'favorite';

@Entity('bookmarks')
@Index(['user', 'animeId'], { unique: true })
export class Bookmark {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (u) => u.bookmarks, { onDelete: 'CASCADE' })
  user: User;

  // Anime identity coming from the external YummyAnime API
  @Column()
  animeId: number;

  @Column({ nullable: true, type: 'text' })
  animeUrl: string;

  // Snapshot of anime meta so we can render lists without re-fetching
  @Column({ nullable: true, type: 'text' })
  animeTitle: string;

  @Column({ nullable: true, type: 'text' })
  animePoster: string;

  @Column({ default: 'planned', type: 'text' })
  status: BookmarkStatus;

  @Column({ nullable: true, type: 'integer' })
  episodeCount: number;

  @Column({ nullable: true, type: 'text' })
  genres: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
