import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Bookmark } from '../bookmarks/bookmark.entity';
import { Rating } from '../ratings/rating.entity';
import { Comment } from '../comments/comment.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true, type: 'text' })
  avatarColor: string;

  // uploaded avatar image url (overrides the colored initial when set)
  @Column({ nullable: true, type: 'text' })
  avatarUrl: string;

  // uploaded profile banner url
  @Column({ nullable: true, type: 'text' })
  bannerUrl: string;

  // selected avatar frame id (some are unlocked by level)
  @Column({ nullable: true, type: 'text' })
  avatarFrame: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  // total seconds watched, accumulated from watch progress completions
  @Column({ type: 'integer', default: 0 })
  watchedSeconds: number;

  // number of episodes completed
  @Column({ type: 'integer', default: 0 })
  watchedEpisodes: number;

  // special hidden achievement: watched an episode of Re:Zero season 4
  @Column({ type: 'boolean', default: false })
  reZeroS4: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Bookmark, (b) => b.user)
  bookmarks: Bookmark[];

  @OneToMany(() => Rating, (r) => r.user)
  ratings: Rating[];

  @OneToMany(() => Comment, (c) => c.user)
  comments: Comment[];
}
