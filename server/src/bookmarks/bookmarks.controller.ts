import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { ImportAnixartDto, UpsertBookmarkDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@Controller('bookmarks')
@UseGuards(JwtAuthGuard)
export class BookmarksController {
  constructor(private readonly service: BookmarksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.service.list(user.id, status);
  }

  @Get('anime/:animeId')
  getForAnime(
    @CurrentUser() user: AuthUser,
    @Param('animeId', ParseIntPipe) animeId: number,
  ) {
    return this.service.getForAnime(user.id, animeId);
  }

  @Put()
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertBookmarkDto) {
    return this.service.upsert(user.id, dto);
  }

  @Delete('anime/:animeId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('animeId', ParseIntPipe) animeId: number,
  ) {
    return this.service.remove(user.id, animeId);
  }

  @Post('import/anixart')
  importAnixart(
    @CurrentUser() user: AuthUser,
    @Body() dto: ImportAnixartDto,
  ) {
    return this.service.importAnixart(user.id, dto);
  }
}
