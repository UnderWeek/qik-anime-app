import { IsInt, Max, Min } from 'class-validator';

export class RateDto {
  @IsInt()
  animeId: number;

  @IsInt()
  @Min(1, { message: 'Минимальная оценка 1' })
  @Max(10, { message: 'Максимальная оценка 10' })
  score: number;
}
