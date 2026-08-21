import { Controller, Get, Post, Patch, Body, Param, Res, NotFoundException } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { TelegramService } from '../telegram/telegram.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller('claims')
export class ClaimsController {
  constructor(
    private readonly claimsService: ClaimsService,
    private readonly telegramService: TelegramService,
  ) {}

  @Post()
  async create(@Body() body: {
    telegramChatId: string;
    telegramUsername?: string;
    telegramName?: string;
    promoCodeId: string;
    orderId: string;
    playerBookmakerId: string;
    screenshotUrl?: string;
  }) {
    return this.claimsService.create(body);
  }

  @Get('example-screenshot')
  getExampleScreenshot(@Res() res: Response) {
    const filePath = path.join(process.cwd(), 'src', 'claims', 'example-screenshot.png');
    return res.sendFile(filePath);
  }

  @Get('screenshot/*')
  async getScreenshotWildcard(@Res() res: Response, @Param('0') rawParam: string) {
    let cleanId = rawParam.replace(/^\//, '');

    // 1. Check local file in uploads/screenshots/
    const diskPath = path.join(process.cwd(), 'uploads', 'screenshots', cleanId);
    if (fs.existsSync(diskPath)) {
      return res.sendFile(diskPath);
    }

    // Also check with extension stripped or added
    const ext = path.extname(cleanId);
    const idWithoutExt = ext ? cleanId.slice(0, -ext.length) : cleanId;

    if (ext) {
      const altDiskPath = path.join(process.cwd(), 'uploads', 'screenshots', idWithoutExt);
      if (fs.existsSync(altDiskPath)) {
        return res.sendFile(altDiskPath);
      }
    }

    // 2. Fetch direct file URL from Telegram API using full ID or idWithoutExt
    const telegramFileUrl = (await this.telegramService.getTelegramFileUrl(cleanId))
      || (await this.telegramService.getTelegramFileUrl(idWithoutExt));

    if (telegramFileUrl) {
      return res.redirect(302, telegramFileUrl);
    }

    // Fallback: Send default example screenshot if Telegram CDN resolution fails
    const fallbackPath = path.join(process.cwd(), 'src', 'claims', 'example-screenshot.png');
    return res.sendFile(fallbackPath);
  }

  @Get('screenshot/:fileId')
  async getScreenshot(@Param('fileId') fileId: string, @Res() res: Response) {
    return this.getScreenshotWildcard(res, fileId);
  }

  @Get()
  async getAll() {
    return this.claimsService.findAll();
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED' }) {
    return this.claimsService.updateStatus(id, body.status);
  }
}
