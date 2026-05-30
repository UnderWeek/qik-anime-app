import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { BookmarkStatus } from './bookmark.entity';

export const STATUSES: BookmarkStatus[] = [
  'watching',
  'planned',
  'completed',
  'on_hold',
  'dropped',
  'favorite',
];

export class UpsertBookmarkDto {
  @IsInt()
  animeId: number;

  @IsOptional()
  @IsString()
  animeUrl?: string;

  @IsOptional()
  @IsString()
  animeTitle?: string;

  @IsOptional()
  @IsString()
  animePoster?: string;

  @IsIn(STATUSES)
  status: BookmarkStatus;
}
