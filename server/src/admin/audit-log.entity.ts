import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  adminId: number;

  @Column()
  adminName: string;

  @Column()
  action: string;

  @Column({ nullable: true, type: 'text' })
  target: string;

  @Column({ nullable: true, type: 'text' })
  details: string;

  @CreateDateColumn()
  createdAt: Date;
}
