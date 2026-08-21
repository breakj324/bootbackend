import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { TelegramService } from './telegram/telegram.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

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

  @Get('uploads/screenshots/*')
  async getUploadsScreenshot(@Param('0') rest: string, @Res() res: Response) {
    const cleanId = rest.replace(/^\//, '');
    const diskPath = path.join(process.cwd(), 'uploads', 'screenshots', cleanId);
    if (fs.existsSync(diskPath)) {
      return res.sendFile(diskPath);
    }

    const ext = path.extname(cleanId);
    const idWithoutExt = ext ? cleanId.slice(0, -ext.length) : cleanId;

    const telegramFileUrl = (await this.telegramService.getTelegramFileUrl(cleanId))
      || (await this.telegramService.getTelegramFileUrl(idWithoutExt));

    if (telegramFileUrl) {
      return res.redirect(302, telegramFileUrl);
    }

    const fallbackPath = path.join(process.cwd(), 'src', 'claims', 'example-screenshot.png');
    return res.sendFile(fallbackPath);
  }

  @Get('AgA*')
  async handleTelegramFileId(@Param('0') rest: string, @Res() res: Response) {
    const fullId = `AgA${rest}`;
    const telegramFileUrl = await this.telegramService.getTelegramFileUrl(fullId);
    if (telegramFileUrl) {
      return res.redirect(302, telegramFileUrl);
    }
    const fallbackPath = path.join(process.cwd(), 'src', 'claims', 'example-screenshot.png');
    return res.sendFile(fallbackPath);
  }
}
