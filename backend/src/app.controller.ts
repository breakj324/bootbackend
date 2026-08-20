import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { TelegramService } from './telegram/telegram.service';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get(':fileId')
  async handleFileOrRoot(@Param('fileId') fileId: string, @Res() res: Response) {
    // If it looks like a Telegram file ID (starts with AgAC, AgA, etc.)
    if (fileId.startsWith('AgA') || fileId.length > 25) {
      const telegramFileUrl = await this.telegramService.getTelegramFileUrl(fileId);
      if (telegramFileUrl) {
        return res.redirect(302, telegramFileUrl);
      }
    }
    return res.status(404).json({ message: `Cannot GET /${fileId}`, error: 'Not Found', statusCode: 404 });
  }
}
