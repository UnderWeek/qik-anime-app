import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Post('claim')
  @UseGuards(JwtAuthGuard)
  claim(@CurrentUser('id') userId: number, @Body() body: { secret?: string }) {
    return this.service.claimAdmin(userId, body.secret || '');
  }

  @Get('stats')
  @UseGuards(AdminGuard)
  stats() {
    return this.service.getStats();
  }

  @Get('users')
  @UseGuards(AdminGuard)
  users(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listUsers(
      q,
      page ? +page : 1,
      limit ? +limit : 100,
    );
  }

  @Delete('users/:id')
  @UseGuards(AdminGuard)
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteUser(id);
  }
}
