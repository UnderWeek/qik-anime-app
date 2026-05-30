import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { User } from './users/user.entity';
import { Bookmark } from './bookmarks/bookmark.entity';
import { Rating } from './ratings/rating.entity';
import { Comment } from './comments/comment.entity';
import { CommentLike } from './comments/comment-like.entity';
import { WatchProgress } from './progress/watch-progress.entity';
import { Friendship } from './friends/friendship.entity';
import { Notification } from './notifications/notification.entity';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { RatingsModule } from './ratings/ratings.module';
import { CommentsModule } from './comments/comments.module';
import { ProgressModule } from './progress/progress.module';
import { FriendsModule } from './friends/friends.module';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { UPLOAD_DIR } from './uploads/uploads.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Serve uploaded images/gifs at /uploads/*
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), UPLOAD_DIR),
      serveRoot: '/uploads',
    }),
    TypeOrmModule.forRoot({
      // sql.js = SQLite compiled to WebAssembly (pure JS, no native build / no
      // Visual Studio required). Data is persisted to a file via autoSave.
      type: 'sqljs',
      location: process.env.DB_PATH || join(process.cwd(), 'qik-anime.db'),
      autoSave: true,
      entities: [
        User,
        Bookmark,
        Rating,
        Comment,
        CommentLike,
        WatchProgress,
        Friendship,
        Notification,
      ],
      synchronize: true, // dev convenience; auto-creates tables
    }),
    AuthModule,
    UsersModule,
    BookmarksModule,
    RatingsModule,
    CommentsModule,
    ProgressModule,
    FriendsModule,
    UploadsModule,
    NotificationsModule,
    SuggestionsModule,
  ],
})
export class AppModule {}
