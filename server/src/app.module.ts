import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';

import { User } from './users/user.entity';
import { Bookmark } from './bookmarks/bookmark.entity';
import { Rating } from './ratings/rating.entity';
import { OpeningRating } from './ratings/opening-rating.entity';
import { Comment } from './comments/comment.entity';
import { CommentLike } from './comments/comment-like.entity';
import { WatchProgress } from './progress/watch-progress.entity';
import { Friendship } from './friends/friendship.entity';
import { Notification } from './notifications/notification.entity';
import { WatchRoom } from './watch-rooms/watch-room.entity';
import { WatchRoomParticipant } from './watch-rooms/watch-room-participant.entity';
import { WatchRoomMessage } from './watch-rooms/watch-room-message.entity';
import { Chat } from './chats/chat.entity';
import { ChatMessage } from './chats/chat-message.entity';
import { PushSubscriptionEntity } from './push/push-subscription.entity';
import { SearchHistory } from './search-history/search-history.entity';

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
import { WatchRoomsModule } from './watch-rooms/watch-rooms.module';
import { ChatsModule } from './chats/chats.module';
import { AdminModule } from './admin/admin.module';
import { QuizModule } from './quiz/quiz.module';
import { PushModule } from './push/push.module';
import { SearchHistoryModule } from './search-history/search-history.module';
import { DB_PATH, UPLOAD_DIR_ABSOLUTE } from './common/runtime-paths';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Serve uploaded images/gifs at /uploads/*
    ServeStaticModule.forRoot({
      rootPath: UPLOAD_DIR_ABSOLUTE,
      serveRoot: '/uploads',
    }),
    TypeOrmModule.forRoot({
      // sql.js = SQLite compiled to WebAssembly (pure JS, no native build / no
      // Visual Studio required). Data is persisted to a file via autoSave.
      type: 'sqljs',
      location: DB_PATH,
      autoSave: true,
      entities: [
        User,
        Bookmark,
        Rating,
        OpeningRating,
        Comment,
        CommentLike,
        WatchProgress,
        Friendship,
        Notification,
        WatchRoom,
        WatchRoomParticipant,
        WatchRoomMessage,
        Chat,
        ChatMessage,
        PushSubscriptionEntity,
        SearchHistory,
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
    WatchRoomsModule,
    ChatsModule,
    AdminModule,
    QuizModule,
    PushModule,
    SearchHistoryModule,
  ],
})
export class AppModule {}
