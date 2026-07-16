import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rating } from './rating.entity';
import { OpeningRating } from './opening-rating.entity';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Rating, OpeningRating])],
  providers: [RatingsService],
  controllers: [RatingsController],
})
export class RatingsModule {}
