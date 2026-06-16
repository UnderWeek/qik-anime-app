import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { ChatsService } from './chats.service';
import { ChatsGateway } from './chats.gateway';
import { SendMessageDto, StartChatDto } from './dto';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(
    private readonly service: ChatsService,
    private readonly gateway: ChatsGateway,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.id);
  }

  @Post('start')
  start(@CurrentUser() user: AuthUser, @Body() dto: StartChatDto) {
    return this.service.getOrCreate(user.id, dto.friendId);
  }

  @Get(':id/messages')
  getMessages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) chatId: number,
  ) {
    return this.service.getMessages(chatId, user.id);
  }

  @Post(':id/messages')
  async sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) chatId: number,
    @Body() dto: SendMessageDto,
  ) {
    const msg = await this.service.sendMessage(chatId, user.id, dto);
    this.gateway.emitMessage(chatId, msg);
    return msg;
  }
}
