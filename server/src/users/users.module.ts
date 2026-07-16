import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Bookmark } from '../bookmarks/bookmark.entity';
import { Rating } from '../ratings/rating.entity';
import { Comment } from '../comments/comment.entity';
import { Friendship } from '../friends/friendship.entity';
import { WatchProgress } from '../progress/watch-progress.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FriendsModule } from '../friends/friends.module';
import { BookmarksModule } from '../bookmarks/bookmarks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Bookmark, Rating, Comment, Friendship, WatchProgress]),
    FriendsModule,
    BookmarksModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
