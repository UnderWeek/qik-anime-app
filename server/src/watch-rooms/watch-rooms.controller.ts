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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import {
  CreateWatchRoomDto,
  JoinWatchRoomDto,
  SendWatchRoomMessageDto,
  UpdateWatchRoomStateDto,
  WatchRoomSyncQueryDto,
} from './dto';
import { WatchRoomsService } from './watch-rooms.service';

@Controller('watch-rooms')
@UseGuards(JwtAuthGuard)
export class WatchRoomsController {
  constructor(private readonly service: WatchRoomsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWatchRoomDto) {
    return this.service.create(user.id, dto);
  }

  @Post('join')
  join(@CurrentUser() user: AuthUser, @Body() dto: JoinWatchRoomDto) {
    return this.service.join(user.id, dto);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
  ) {
    return this.service.get(roomId, user.id);
  }

  @Get(':id/sync')
  sync(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
    @Query() query: WatchRoomSyncQueryDto,
  ) {
    return this.service.sync(roomId, user.id, query);
  }

  @Patch(':id/state')
  updateState(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
    @Body() dto: UpdateWatchRoomStateDto,
  ) {
    return this.service.updateState(roomId, user.id, dto);
  }

  @Post(':id/messages')
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
    @Body() dto: SendWatchRoomMessageDto,
  ) {
    return this.service.sendMessage(roomId, user.id, dto);
  }

  @Post(':id/leave')
  leave(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
  ) {
    return this.service.leave(roomId, user.id);
  }

  @Delete(':id')
  close(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
  ) {
    return this.service.close(roomId, user.id);
  }
}
