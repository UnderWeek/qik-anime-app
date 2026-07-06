import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IssuesService } from './issues.service';
import { CreateIssueDto, UpdateIssueDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MasterOrAdminGuard } from '../auth/master-admin.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@Controller('issues')
@UseGuards(JwtAuthGuard, MasterOrAdminGuard)
export class IssuesController {
  constructor(private readonly service: IssuesService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.service.list(status as any);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateIssueDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIssueDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/assign')
  assign(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.assign(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
