import {
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Comment } from './comment.entity';

@Entity('comment_likes')
@Index(['user', 'comment'], { unique: true })
export class CommentLike {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Comment, (c) => c.likes, { onDelete: 'CASCADE' })
  comment: Comment;

  @CreateDateColumn()
  createdAt: Date;
}
