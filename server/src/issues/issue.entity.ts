import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { IssueAttachment } from './issue-attachment.entity';

export type IssueStatus = 'open' | 'in_progress' | 'fixed';

@Entity('issues')
export class Issue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ default: 'open', type: 'text' })
  status: IssueStatus;

  @ManyToOne(() => User, { onDelete: 'SET NULL', eager: true, nullable: true })
  reporter: User | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', eager: true, nullable: true })
  assignee: User | null;

  @OneToMany(() => IssueAttachment, (a) => a.issue, { eager: true, cascade: true })
  attachments: IssueAttachment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
