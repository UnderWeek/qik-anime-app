import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { FriendsService } from '../friends/friends.service';
import { UsersService } from '../users/users.service';

class SuggestDto {
  @IsInt()
  toUserId: number;

  @IsInt()
  animeId: number;

  @IsOptional()
  @IsString()
  animeUrl?: string;

  @IsOptional()
  @IsString()
  animeTitle?: string;

  @IsOptional()
  @IsString()
  animePoster?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

@Controller('suggestions')
@UseGuards(JwtAuthGuard)
export class SuggestionsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly friends: FriendsService,
    private readonly users: UsersService,
  ) {}

  // Suggest an anime to a friend → creates a notification for them
  @Post()
  async suggest(@CurrentUser() user: AuthUser, @Body() dto: SuggestDto) {
    if (dto.toUserId === user.id)
      throw new BadRequestException('Нельзя предложить самому себе');

    // only friends can receive suggestions
    const status = await this.friends.statusToward(user.id, dto.toUserId);
    if (status !== 'friends')
      throw new BadRequestException('Можно предлагать только друзьям');

    const me = await this.users.findById(user.id);
    const note = (dto.note || '').trim();
    const message = note
      ? `${me.username} советует «${dto.animeTitle || 'аниме'}»: ${note}`
      : `${me.username} советует посмотреть «${dto.animeTitle || 'аниме'}»`;

    await this.notifications.create({
      recipientId: dto.toUserId,
      actorId: user.id,
      type: 'anime_suggestion',
      message,
      animeId: dto.animeId,
      animeUrl: dto.animeUrl,
      animeTitle: dto.animeTitle,
      animePoster: dto.animePoster,
    });

    return { ok: true };
  }
}
