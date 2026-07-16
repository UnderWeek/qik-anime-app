import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Issue, IssueStatus } from './issue.entity';
import { IssueAttachment } from './issue-attachment.entity';
import { CreateIssueDto, UpdateIssueDto } from './dto';

@Injectable()
export class IssuesService {
  constructor(
    @InjectRepository(Issue)
    private readonly repo: Repository<Issue>,
    @InjectRepository(IssueAttachment)
    private readonly attachRepo: Repository<IssueAttachment>,
  ) {}

  async list(status?: IssueStatus) {
    const where: any = {};
    if (status) where.status = status;
    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['reporter', 'assignee', 'attachments'],
    });
  }

  async create(userId: number, dto: CreateIssueDto) {
    const issue = this.repo.create({
      title: dto.title,
      status: 'open',
      reporter: { id: userId } as any,
    });
    return this.repo.save(issue);
  }

  async update(id: number, dto: UpdateIssueDto) {
    const issue = await this.repo.findOne({ where: { id } });
    if (!issue) throw new NotFoundException('Задача не найдена');
    issue.status = dto.status as IssueStatus;
    return this.repo.save(issue);
  }

  async assign(id: number, userId: number) {
    const issue = await this.repo.findOne({ where: { id } });
    if (!issue) throw new NotFoundException('Задача не найдена');
    issue.assignee = { id: userId } as any;
    issue.status = 'in_progress';
    return this.repo.save(issue);
  }

  async remove(id: number) {
    const issue = await this.repo.findOne({ where: { id } });
    if (!issue) throw new NotFoundException('Задача не найдена');
    await this.repo.remove(issue);
    return { ok: true };
  }

  async addAttachment(issueId: number, file: Express.Multer.File) {
    const issue = await this.repo.findOne({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('Задача не найдена');
    const mime = file.mimetype || 'application/octet-stream';
    const type = mime.startsWith('image/') ? 'image'
      : mime.startsWith('video/') ? 'video'
      : 'file';
    const attachment = this.attachRepo.create({
      issue: { id: issueId } as any,
      url: `/uploads/${file.filename}`,
      filename: file.originalname || file.filename,
      mimeType: type,
    });
    return this.attachRepo.save(attachment);
  }

  async removeAttachment(attachmentId: number) {
    await this.attachRepo.delete(attachmentId);
    return { ok: true };
  }
}
