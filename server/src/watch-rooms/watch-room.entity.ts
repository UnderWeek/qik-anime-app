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

@Entity('watch_rooms')
@Index(['code'], { unique: true })
export class WatchRoom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', unique: true })
  code: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  owner: User;

  @Column({ type: 'integer', default: 1 })
  stateVersion: number;

  @Column({ type: 'integer', default: 1 })
  membersVersion: number;

  @Column({ type: 'integer', default: 0 })
  lastMessageId: number;

  @Column({ nullable: true, type: 'integer' })
  animeId: number | null;

  @Column({ nullable: true, type: 'text' })
  animeUrl: string | null;

  @Column({ nullable: true, type: 'text' })
  animeTitle: string | null;

  @Column({ nullable: true, type: 'text' })
  animePoster: string | null;

  @Column({ nullable: true, type: 'text' })
  videoId: string | null;

  @Column({ nullable: true, type: 'text' })
  episodeNumber: string | null;

  @Column({ nullable: true, type: 'text' })
  dubbing: string | null;

  @Column({ nullable: true, type: 'text' })
  iframeUrl: string | null;

  @Column({ type: 'float', default: 0 })
  currentTime: number;

  @Column({ type: 'boolean', default: true })
  isPaused: boolean;

  @Column({ nullable: true, type: 'integer' })
  lastActorId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
