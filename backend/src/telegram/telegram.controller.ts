import { Controller, Post, Body, Headers, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(
    @InjectQueue('telegram-queue') private readonly telegramQueue: Queue,
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
  ) {}

  @Post('setup-webhook')
  async setupWebhook(@Body() body: { url: string }) {
    const webhookUrl = `${body.url.replace(/\/$/, '')}/telegram/webhook`;
    const secret = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');
    return this.telegramService.setWebhook(webhookUrl, secret);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ) {
    // Validate secret token from Telegram (Optional security check)
    const expectedSecret = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (expectedSecret && secretToken !== expectedSecret) {
      throw new ForbiddenException('Invalid webhook secret token');
    }

    // Immediately push payload to BullMQ queue for async processing
    await this.telegramQueue.add('handle-webhook-update', {
      update,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    // Return 200 OK instantly to Telegram
    return { status: 'queued' };
  }
}
