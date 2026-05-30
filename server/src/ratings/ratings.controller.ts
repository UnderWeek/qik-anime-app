import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { RateDto } from './dto';
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
}
