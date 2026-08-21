import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { TelegramService } from './telegram/telegram.service';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('file/:fileId')
  async getTelegramFile(@Param('fileId') fileId: string, @Res() res: Response) {
    const telegramFileUrl = await this.telegramService.getTelegramFileUrl(fileId);
    if (telegramFileUrl) {
      return res.redirect(302, telegramFileUrl);
    }
    throw new NotFoundException('File not found');
  }

  @Get('AgA*')
  async handleTelegramFileId(@Param('0') rest: string, @Res() res: Response) {
    const fullId = `AgA${rest}`;
    const telegramFileUrl = await this.telegramService.getTelegramFileUrl(fullId);
    if (telegramFileUrl) {
      return res.redirect(302, telegramFileUrl);
    }
    throw new NotFoundException('Screenshot Telegram non disponible');
  }
}
