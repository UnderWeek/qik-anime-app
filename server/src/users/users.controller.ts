import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';
import { UsersService } from './users.service';
import { FriendsService } from '../friends/friends.service';
import { BookmarksService } from '../bookmarks/bookmarks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(280, { message: 'Описание максимум 280 символов' })
  bio?: string;

  @IsOptional()
  @IsHexColor({ message: 'Цвет должен быть HEX' })
  avatarColor?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  bannerUrl?: string | null;

  @IsOptional()
  @IsString()
  avatarFrame?: string;
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly friends: FriendsService,
    private readonly bookmarks: BookmarksService,
  ) {}

  // search users by username
  @UseGuards(OptionalJwtAuthGuard)
  @Get('search')
  search(@Query('q') q: string, @CurrentUser() viewer: AuthUser | null) {
    return this.users.search(q, viewer?.id);
  }

  // update own profile
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  // public profile with stats, level, achievements
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/profile')
  async profile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() viewer: AuthUser | null,
  ) {
    const data = await this.users.profile(id, viewer?.id);
    const friendStatus = viewer
      ? await this.friends.statusToward(viewer.id, id)
      : 'none';
    return { ...data, friendStatus };
  }

  // another user's bookmarks (for viewing friends' lists)
  @Get(':id/bookmarks')
  bookmarks_(
    @Param('id', ParseIntPipe) id: number,
    @Query('status') status?: string,
  ) {
    return this.bookmarks.list(id, status);
  }

  // another user's friends
  @Get(':id/friends')
  friendsOf(@Param('id', ParseIntPipe) id: number) {
    return this.friends.listFriends(id);
  }
}
