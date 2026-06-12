import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWatchRoomDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  animeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  animeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  animeTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  animePoster?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @IsString()
  @MaxLength(500)
  videoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  episodeNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  dubbing?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  iframeUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  currentTime?: number;

  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;
}

export class JoinWatchRoomDto {
  @IsString()
  @MaxLength(24)
  code: string;
}

export class UpdateWatchRoomStateDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  animeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  animeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  animeTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  animePoster?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @IsString()
  @MaxLength(500)
  videoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  episodeNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  dubbing?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  iframeUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  currentTime?: number;

  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;
}

export class SendWatchRoomMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;
}

export class InviteToRoomDto {
  @Type(() => Number)
  @IsInt()
  targetId: number;
}

export class WatchRoomSyncQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stateVersion?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  membersVersion?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  messageId?: number;
}
