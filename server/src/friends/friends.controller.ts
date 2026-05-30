import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly service: FriendsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.listFriends(user.id);
  }

  @Get('pending')
  pending(@CurrentUser() user: AuthUser) {
    return this.service.pending(user.id);
  }

  @Post('request/:targetId')
  request(
    @CurrentUser() user: AuthUser,
    @Param('targetId', ParseIntPipe) targetId: number,
  ) {
    return this.service.request(user.id, targetId);
  }

  @Post('accept/:requestId')
  accept(
    @CurrentUser() user: AuthUser,
    @Param('requestId', ParseIntPipe) requestId: number,
  ) {
    return this.service.accept(user.id, requestId);
  }

  @Delete(':otherId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('otherId', ParseIntPipe) otherId: number,
  ) {
    return this.service.remove(user.id, otherId);
  }
}
