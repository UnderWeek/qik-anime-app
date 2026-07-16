import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Issue } from './issue.entity';

@Entity('issue_attachments')
export class IssueAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Issue, { onDelete: 'CASCADE' })
  issue: Issue;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text' })
  filename: string;

  @Column({ default: 'image', type: 'text' })
  mimeType: string;

  @CreateDateColumn()
  createdAt: Date;
}
