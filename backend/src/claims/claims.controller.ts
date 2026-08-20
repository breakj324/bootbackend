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

  @Get('screenshot/:fileId')
  async getScreenshot(@Param('fileId') fileId: string, @Res() res: Response) {
    // 1. Check local file in uploads/screenshots/
    const diskPath = path.join(process.cwd(), 'uploads', 'screenshots', fileId);
    if (fs.existsSync(diskPath)) {
      return res.sendFile(diskPath);
    }

    // 2. Fetch direct file URL from Telegram API
    const telegramFileUrl = await this.telegramService.getTelegramFileUrl(fileId);
    if (telegramFileUrl) {
      return res.redirect(telegramFileUrl);
    }

    return res.status(404).json({ message: 'Screenshot non disponible' });
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

