import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

// Marking an episode as watched. Time tracking was removed — visiting an
// episode marks it watched immediately.
export class SaveProgressDto {
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

  // genre titles for the profile genre breakdown
  @IsOptional()
  @IsArray()
  genres?: string[];

  @IsString()
  episodeNumber: string;

  @IsOptional()
  @IsInt()
  episodeIndex?: number;

  @IsOptional()
  @IsInt()
  videoId?: number;

  @IsOptional()
  @IsString()
  dubbing?: string;

  @IsOptional()
  @IsString()
  player?: string;

  // average episode length (seconds) for the "time watched" stat
  @IsOptional()
  @IsInt()
  duration?: number;
}
