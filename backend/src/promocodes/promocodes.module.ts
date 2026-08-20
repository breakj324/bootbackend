import { Module } from '@nestjs/common';
import { PromoCodesController } from './promocodes.controller';
import { PromoCodesService } from './promocodes.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PromoCodesController],
  providers: [PromoCodesService, PrismaService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}
