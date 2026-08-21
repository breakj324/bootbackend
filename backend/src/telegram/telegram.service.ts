import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TelegramProcessor } from '../jobs/telegram.processor';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private isPolling = false;
  private offset = 0;

  constructor(
    private readonly config: ConfigService,
    @InjectQueue('telegram-queue') private readonly telegramQueue: Queue,
    @Inject(forwardRef(() => TelegramProcessor)) private readonly telegramProcessor: TelegramProcessor,
  ) {}

  private get botToken(): string {
    return this.config.get<string>('TELEGRAM_BOT_TOKEN') || '';
  }

  private get apiUrl(): string {
    return `https://api.telegram.org/bot${this.botToken}`;
  }

  async onModuleInit() {
    if (!this.botToken || this.botToken.includes('123456789')) {
      this.logger.warn('No valid TELEGRAM_BOT_TOKEN configured.');
      return;
    }
    this.logger.log('Starting automatic Telegram Long Polling...');
    this.startPolling();
  }

  async startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;

    // Delete webhook to ensure Telegram enables getUpdates long polling
    try {
      await fetch(`${this.apiUrl}/deleteWebhook`);
      this.logger.log('Cleared existing webhook for long polling mode.');
    } catch (e) {
      this.logger.error(`Error deleting webhook: ${e.message}`);
    }

    while (this.isPolling) {
      try {
        const response = await fetch(`${this.apiUrl}/getUpdates?offset=${this.offset}&timeout=5`);
        const data = await response.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.offset = update.update_id + 1;
            this.logger.log(`Processing Telegram update ${update.update_id}...`);

            // Try adding to BullMQ asynchronously without blocking direct processing
            if (this.telegramQueue) {
              Promise.race([
                this.telegramQueue.add('handle-webhook-update', { update }, { attempts: 3 }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 500)),
              ]).catch(() => {
                // Ignore Redis queue errors in long polling mode
              });
            }

            try {
              await this.telegramProcessor.handleTelegramUpdate(update);
            } catch (e) {
              this.logger.error(`Error processing Telegram update: ${e.message}`);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Telegram polling error: ${error.message}`);
        await new Promise(res => setTimeout(res, 3000));
      }
    }
  }

  /**
   * Send text message to a specific Chat ID
   */
  async sendMessage(chatId: string | number, text: string, replyMarkup?: any): Promise<any> {
    try {
      const body: any = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      };
      if (replyMarkup) {
        body.reply_markup = replyMarkup;
      }
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!data.ok) {
        this.logger.error(`Telegram API Error: ${JSON.stringify(data)}`);
        throw new Error(data.description || 'Failed to send telegram message');
      }
      this.logger.log(`Successfully sent message to Telegram chatId ${chatId}`);
      return data;
    } catch (error) {
      this.logger.error(`Error sending message to ${chatId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send photo to a specific Chat ID
   */
  async sendPhoto(chatId: string | number, photoUrlOrFilePath: string, caption?: string, replyMarkup?: any): Promise<any> {
    try {
      let response: Response;

      if (fs.existsSync(photoUrlOrFilePath)) {
        const fileBuffer = fs.readFileSync(photoUrlOrFilePath);
        const fileName = path.basename(photoUrlOrFilePath);
        const formData = new FormData();
        formData.append('chat_id', String(chatId));
        formData.append('photo', new Blob([fileBuffer]), fileName);
        if (caption) formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
        if (replyMarkup) formData.append('reply_markup', JSON.stringify(replyMarkup));

        response = await fetch(`${this.apiUrl}/sendPhoto`, {
          method: 'POST',
          body: formData,
        });
      } else {
        const body: any = {
          chat_id: chatId,
          photo: photoUrlOrFilePath,
          caption,
          parse_mode: 'HTML',
        };
        if (replyMarkup) body.reply_markup = replyMarkup;

        response = await fetch(`${this.apiUrl}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const data = await response.json();
      if (!data.ok) {
        this.logger.error(`Telegram API Error (sendPhoto): ${JSON.stringify(data)}`);
        throw new Error(data.description || 'Failed to send telegram photo');
      }
      this.logger.log(`Successfully sent photo to Telegram chatId ${chatId}`);
      return data;
    } catch (error) {
      this.logger.error(`Error sending photo to ${chatId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Acknowledge Telegram inline button click
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<any> {
    try {
      await fetch(`${this.apiUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
        }),
      });
    } catch (e) {
      // ignore
    }
  }

  /**
   * Set webhook URL on Telegram API
   */
  async setWebhook(url: string, secretToken?: string): Promise<any> {
    try {
      this.isPolling = false; // stop polling if webhook is manually set
      const response = await fetch(`${this.apiUrl}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          secret_token: secretToken,
        }),
      });
      return await response.json();
    } catch (error) {
      this.logger.error(`Error setting webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Download a Telegram file (photo) by file_id and save it to /uploads/screenshots/
   * Returns the relative URL path (e.g. /uploads/screenshots/filename.jpg) or null on failure
   */
  async downloadTelegramFile(fileId: string): Promise<string | null> {
    try {
      // Step 1: Get file path from Telegram
      const res = await fetch(`${this.apiUrl}/getFile?file_id=${fileId}`);
      const data = await res.json();

      if (!data.ok || !data.result?.file_path) {
        this.logger.error(`Telegram getFile failed: ${JSON.stringify(data)}`);
        return null;
      }

      const filePath = data.result.file_path; // e.g. "photos/file_123.jpg"
      const downloadUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;

      // Step 2: Download the file bytes
      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) {
        this.logger.error(`Failed to download Telegram file: ${fileRes.statusText}`);
        return null;
      }

      const buffer = Buffer.from(await fileRes.arrayBuffer());

      // Step 3: Save to /uploads/screenshots/ using full fileId so it can be resolved anytime from Telegram CDN
      const ext = path.extname(filePath) || '.jpg';
      const fileName = `${fileId}${ext}`;
      const screenshotsDir = path.join(process.cwd(), 'uploads', 'screenshots');

      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }

      const fullPath = path.join(screenshotsDir, fileName);
      fs.writeFileSync(fullPath, buffer);

      this.logger.log(`Screenshot saved: ${fullPath}`);
      return `/claims/screenshot/${fileId}`;
    } catch (err) {
      this.logger.error(`downloadTelegramFile error: ${err.message}`);
      return `/claims/screenshot/${fileId}`;
    }
  }

  /**
   * Get direct Telegram file CDN URL for a file_id
   */
  async getTelegramFileUrl(fileId: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.apiUrl}/getFile?file_id=${fileId}`);
      const data = await res.json();
      if (data.ok && data.result?.file_path) {
        return `https://api.telegram.org/file/bot${this.botToken}/${data.result.file_path}`;
      }
    } catch (err) {
      this.logger.error(`getTelegramFileUrl error: ${err.message}`);
    }
    return null;
  }
}
