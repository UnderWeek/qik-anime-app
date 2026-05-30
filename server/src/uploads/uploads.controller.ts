import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

export const UPLOAD_DIR = 'uploads';

const ALLOWED = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

@Controller('uploads')
export class UploadsController {
  @UseGuards(JwtAuthGuard)
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const name = randomBytes(12).toString('hex') + ext;
          cb(null, name);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB (covers gifs)
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED.includes(ext)) {
          return cb(
            new BadRequestException('Только изображения и GIF'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не загружен');
    // URL path served statically by the app
    return { url: `/uploads/${file.filename}` };
  }
}
