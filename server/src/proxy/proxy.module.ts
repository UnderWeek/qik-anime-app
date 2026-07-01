import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { AnilibriaService } from '../watch-rooms/anilibria.service';

@Module({
  controllers: [ProxyController],
  providers: [AnilibriaService],
})
export class ProxyModule {}
