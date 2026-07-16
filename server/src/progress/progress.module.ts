import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchProgress } from './watch-progress.entity';
import { User } from '../users/user.entity';
import { Bookmark } from '../bookmarks/bookmark.entity';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WatchProgress, User, Bookmark])],
  providers: [ProgressService],
  controllers: [ProgressController],
})
export class ProgressModule {}
