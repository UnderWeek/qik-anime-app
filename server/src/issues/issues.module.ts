import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Issue } from './issue.entity';
import { IssueAttachment } from './issue-attachment.entity';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Issue, IssueAttachment])],
  providers: [IssuesService],
  controllers: [IssuesController],
})
export class IssuesModule {}
