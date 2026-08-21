import { Controller, Get, Post, Patch, Delete, Body, Param, Res } from '@nestjs/common';
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

  // Wildcard route handles all screenshot file IDs (including those with special chars like - _ .)
  @Get('screenshot/*')
  async getScreenshotWildcard(@Res() res: Response, @Param('0') rawParam: string) {
    const cleanId = rawParam.replace(/^\//, '');

    // Strip extension to get pure Telegram file_id
    const ext = path.extname(cleanId);
    const fileId = ext ? cleanId.slice(0, -ext.length) : cleanId;

    // 1. Check local disk first (fast)
    for (const candidate of [cleanId, fileId]) {
      const diskPath = path.join(process.cwd(), 'uploads', 'screenshots', candidate);
      if (fs.existsSync(diskPath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(diskPath);
      }
    }

    // 2. Proxy image directly from Telegram CDN (avoids browser CORS/referer blocks)
    const telegramFileUrl = await this.telegramService.getTelegramFileUrl(fileId)
      || await this.telegramService.getTelegramFileUrl(cleanId);

    if (telegramFileUrl) {
      try {
        const response = await fetch(telegramFileUrl);
        if (response.ok) {
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          const buffer = Buffer.from(await response.arrayBuffer());

          // Save to disk for future requests (cache)
          try {
            const screenshotsDir = path.join(process.cwd(), 'uploads', 'screenshots');
            if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
            const fileExt = ext || '.jpg';
            fs.writeFileSync(path.join(screenshotsDir, `${fileId}${fileExt}`), buffer);
          } catch (_) {}

          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(buffer);
        }
      } catch (_) {}
    }

    // 3. Final fallback: serve example screenshot
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
  async updateStatus(@Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED'; reason?: string }) {
    return this.claimsService.updateStatus(id, body.status, body.reason);
  }

  @Delete(':id')
  async deleteClaim(@Param('id') id: string) {
    return this.claimsService.deleteClaim(id);
  }
}
