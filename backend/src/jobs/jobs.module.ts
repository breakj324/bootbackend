import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TelegramProcessor } from './telegram.processor';
import { TelegramModule } from '../telegram/telegram.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    forwardRef(() => TelegramModule),
    BullModule.registerQueue({
      name: 'telegram-queue',
    }),
  ],
  providers: [TelegramProcessor, PrismaService],
  exports: [TelegramProcessor],
})
export class JobsModule {}
