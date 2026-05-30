import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCommentDto {
  // anime comments pass animeId; profile comments pass targetUserId
  @IsOptional()
  @IsInt()
  animeId?: number;

  @IsOptional()
  @IsInt()
  targetUserId?: number;

  // body is optional when an image is attached; validated in service
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Максимум 5000 символов' })
  body?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  parentId?: number;
}

export class UpdateCommentDto {
  @IsString()
  @MaxLength(5000)
  body: string;
}
