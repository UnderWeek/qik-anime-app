import { IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BookmarkStatus } from './bookmark.entity';

export const STATUSES: BookmarkStatus[] = [
  'watching',
  'planned',
  'completed',
  'on_hold',
  'dropped',
  'rewatching',
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

export class ImportAnixartEntryDto {
  @IsString()
  titleRu: string;

  @IsOptional()
  @IsString()
  titleOrig?: string;

  @IsString()
  status: string;
}

export class ImportAnixartDto {
  @ValidateNested({ each: true })
  @Type(() => ImportAnixartEntryDto)
  entries: ImportAnixartEntryDto[];
}
