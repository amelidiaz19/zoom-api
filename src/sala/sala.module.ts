import { Module } from '@nestjs/common';
import { SalaService } from './sala.service';
import { SalaController } from './sala.controller';

@Module({
  providers: [SalaService],
  controllers: [SalaController],
})
export class SalaModule {}