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
import { RatingsService } from './ratings.service';
import { RateDto, RateOpeningDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly service: RatingsService) {}

  // Public aggregate; includes userScore if a valid token is sent
  @UseGuards(OptionalJwtAuthGuard)
  @Get('anime/:animeId')
  summary(
    @Param('animeId', ParseIntPipe) animeId: number,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.service.summary(animeId, user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  rate(@CurrentUser() user: AuthUser, @Body() dto: RateDto) {
    return this.service.rate(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('anime/:animeId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('animeId', ParseIntPipe) animeId: number,
  ) {
    return this.service.remove(user.id, animeId);
  }

  // ---- OP/ED ratings ----

  @UseGuards(JwtAuthGuard)
  @Put('opening')
  rateOpening(@CurrentUser() user: AuthUser, @Body() dto: RateOpeningDto) {
    return this.service.rateOpening(user.id, dto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('opening/:animeId')
  getOpeningRatings(
    @Param('animeId', ParseIntPipe) animeId: number,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.service.getOpeningRatings(animeId, user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('opening/:animeId/:type')
  removeOpeningRating(
    @CurrentUser() user: AuthUser,
    @Param('animeId', ParseIntPipe) animeId: number,
    @Param('type') type: string,
  ) {
    return this.service.removeOpeningRating(user.id, animeId, type);
  }

  // ---- leaderboards ----

  @Get('top/anime')
  topAnime(@Query('limit') limit?: number) {
    return this.service.topAnime(limit || 20);
  }

  @Get('top/openings')
  topOpenings(@Query('limit') limit?: number) {
    return this.service.topOpenings(limit || 20);
  }

  @Get('top/endings')
  topEndings(@Query('limit') limit?: number) {
    return this.service.topEndings(limit || 20);
  }

  @Get('top/users')
  topUsers(@Query('limit') limit?: number) {
    return this.service.topUsers(limit || 20);
  }
}
