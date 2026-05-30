import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './comment.entity';
import { CommentLike } from './comment-like.entity';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, CommentLike])],
  providers: [CommentsService],
  controllers: [CommentsController],
})
export class CommentsModule {}
