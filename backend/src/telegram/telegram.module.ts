import { Module, forwardRef } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { BullModule } from '@nestjs/bullmq';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'telegram-queue',
    }),
    forwardRef(() => JobsModule),
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
