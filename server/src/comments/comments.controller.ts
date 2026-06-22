import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@Controller('comments')
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  // comments for an anime (likedByMe included when authed)
  @UseGuards(OptionalJwtAuthGuard)
  @Get('anime/:animeId')
  list(
    @Param('animeId', ParseIntPipe) animeId: number,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.service.listForAnime(animeId, user?.id);
  }

  // QIK-native comment count for an anime
  @Get('anime/:animeId/count')
  count(@Param('animeId', ParseIntPipe) animeId: number) {
    return this.service.countForAnime(animeId);
  }

  // comments on a user's profile wall
  @UseGuards(OptionalJwtAuthGuard)
  @Get('profile/:userId')
  profileComments(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.service.listForProfile(userId, user?.id);
  }

  // recent anime comments authored by a user
  @UseGuards(OptionalJwtAuthGuard)
  @Get('user/:userId')
  userComments(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.service.listByUser(userId, user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCommentDto) {
    return this.service.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  like(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.toggleLike(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
