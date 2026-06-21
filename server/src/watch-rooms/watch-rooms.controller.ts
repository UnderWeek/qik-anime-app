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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import {
  CreateWatchRoomDto,
  InviteToRoomDto,
  JoinWatchRoomDto,
  SendWatchRoomMessageDto,
  SetWatchRoomVideoDto,
  UpdateWatchRoomStateDto,
} from './dto';
import { WatchRoomsGateway } from './watch-rooms.gateway';
import { WatchRoomsService } from './watch-rooms.service';

@Controller('watch-rooms')
@UseGuards(JwtAuthGuard)
export class WatchRoomsController {
  constructor(
    private readonly service: WatchRoomsService,
    private readonly gateway: WatchRoomsGateway,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWatchRoomDto) {
    return this.service.create(user.id, dto);
  }

  @Post('join')
  async join(@CurrentUser() user: AuthUser, @Body() dto: JoinWatchRoomDto) {
    const snap = await this.service.join(user.id, dto);
    if (snap?.room?.id) {
      this.gateway.emitSnapshot(snap.room.id, snap);
    }
    return snap;
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
  ) {
    return this.service.get(roomId, user.id);
  }

  @Patch(':id/state')
  async updateState(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
    @Body() dto: UpdateWatchRoomStateDto,
  ) {
    const state = await this.service.updateState(roomId, user.id, dto);
    this.gateway.emitState(roomId, state);
    return state;
  }

  @Post(':id/video')
  async setVideo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
    @Body() dto: SetWatchRoomVideoDto,
  ) {
    const state = await this.service.setVideo(roomId, user.id, dto);
    this.gateway.emitSnapshot(roomId, await this.service.snapshotForRoom(roomId));
    return state;
  }

  @Post(':id/messages')
  async sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
    @Body() dto: SendWatchRoomMessageDto,
  ) {
    const msg = await this.service.sendMessage(roomId, user.id, dto);
    this.gateway.emitMessage(roomId, msg);
    return msg;
  }

  @Post(':id/leave')
  async leave(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
  ) {
    const res = await this.service.leave(roomId, user.id);
    if (res?.roomClosed) {
      this.gateway.emitClosed(roomId);
      return res;
    }
    const snap = await this.service.snapshotForRoom(roomId);
    this.gateway.emitSnapshot(roomId, snap);
    return res;
  }

  @Post(':id/join')
  async joinById(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
  ) {
    const snap = await this.service.joinById(roomId, user.id);
    this.gateway.emitSnapshot(roomId, snap);
    return snap;
  }

  @Post(':id/invite')
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
    @Body() dto: InviteToRoomDto,
  ) {
    return this.service.invite(roomId, user.id, dto);
  }

  @Delete(':id')
  async close(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) roomId: number,
  ) {
    const res = await this.service.close(roomId, user.id);
    this.gateway.emitClosed(roomId);
    return res;
  }
}
