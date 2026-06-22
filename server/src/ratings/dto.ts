import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';

export class RateDto {
  @IsInt()
  animeId: number;

  @IsInt()
  @Min(1, { message: 'Минимальная оценка 1' })
  @Max(10, { message: 'Максимальная оценка 10' })
  score: number;
}

export class RateOpeningDto {
  @IsInt()
  animeId: number;

  @IsString()
  @IsIn(['opening', 'ending'])
  type: string;

  @IsInt()
  @Min(1)
  @Max(10)
  score: number;
}
