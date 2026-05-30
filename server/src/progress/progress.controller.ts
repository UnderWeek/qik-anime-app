import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProgressService } from './progress.service';
import { SaveProgressDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@Controller('progress')
export class ProgressController {
  constructor(private readonly service: ProgressService) {}

  @UseGuards(JwtAuthGuard)
  @Put()
  save(@CurrentUser() user: AuthUser, @Body() dto: SaveProgressDto) {
    return this.service.save(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('anime/:animeId')
  forAnime(
    @CurrentUser() user: AuthUser,
    @Param('animeId', ParseIntPipe) animeId: number,
  ) {
    return this.service.forAnime(user.id, animeId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('anime/:animeId/:episodeNumber')
  removeEpisode(
    @CurrentUser() user: AuthUser,
    @Param('animeId', ParseIntPipe) animeId: number,
    @Param('episodeNumber') episodeNumber: string,
  ) {
    return this.service.removeEpisode(user.id, animeId, episodeNumber);
  }

  @UseGuards(JwtAuthGuard)
  @Get('continue')
  continue(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.service.continueWatching(user.id, limit ? +limit : 12);
  }

  // public so friends/visitors can view someone's history & genre stats
  @UseGuards(OptionalJwtAuthGuard)
  @Get('user/:userId/history')
  history(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('limit') limit?: string,
  ) {
    return this.service.history(userId, limit ? +limit : 100);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('user/:userId/genres')
  genres(@Param('userId', ParseIntPipe) userId: number) {
    return this.service.genreBreakdown(userId);
  }
}
