import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { CommentLike } from './comment-like.entity';

@Entity('comments')
@Index(['animeId'])
@Index(['targetUserId'])
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (u) => u.comments, { eager: true, onDelete: 'CASCADE' })
  user: User;

  // anime comments use animeId; profile comments use targetUserId (animeId = 0)
  @Column({ default: 0 })
  animeId: number;

  @Column({ nullable: true, type: 'integer' })
  targetUserId: number | null;

  @Column({ type: 'text', default: '' })
  body: string;

  // optional attached image / gif (stored URL path served from /uploads)
  @Column({ nullable: true, type: 'text' })
  imageUrl: string | null;

  // optional parent for one-level replies
  @Column({ nullable: true, type: 'integer' })
  parentId: number | null;

  @OneToMany(() => CommentLike, (l) => l.comment)
  likes: CommentLike[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
