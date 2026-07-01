import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../users/user.entity';
import { SearchHistoryService } from './search-history.service';

@Controller('search-history')
@UseGuards(JwtAuthGuard)
export class SearchHistoryController {
  constructor(private readonly svc: SearchHistoryService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.svc.list(user.id);
  }

  @Post()
  save(@CurrentUser() user: User, @Body('query') query: string) {
    return this.svc.save(user.id, query);
  }

  @Delete('clear')
  clear(@CurrentUser() user: User) {
    return this.svc.clear(user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.svc.remove(user.id, +id);
  }
}
