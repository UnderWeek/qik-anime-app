import { Injectable, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class MasterOrAdminGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) throw err || new ForbiddenException('Требуется авторизация');
    if (!user.isAdmin && !user.isMaster)
      throw new ForbiddenException('Доступ только для мастеров и администраторов');
    return user;
  }
}
