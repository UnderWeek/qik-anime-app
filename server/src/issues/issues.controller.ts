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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { IssuesService } from './issues.service';
import { CreateIssueDto, UpdateIssueDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MasterOrAdminGuard } from '../auth/master-admin.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { UPLOAD_DIR_ABSOLUTE } from '../common/runtime-paths';

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

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: UPLOAD_DIR_ABSOLUTE,
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + extname(file.originalname || ''));
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  }))
  uploadAttachment(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.addAttachment(id, file);
  }

  @Delete(':id/attachments/:aid')
  removeAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Param('aid', ParseIntPipe) aid: number,
  ) {
    return this.service.removeAttachment(aid);
  }
}
