import { Module } from '@nestjs/common';
import { SuggestionsController } from './suggestions.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { FriendsModule } from '../friends/friends.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [NotificationsModule, FriendsModule, UsersModule],
  controllers: [SuggestionsController],
})
export class SuggestionsModule {}
