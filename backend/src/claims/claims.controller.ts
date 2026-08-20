import { Controller, Get, Post, Patch, Body, Param, Res } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { Response } from 'express';
import * as path from 'path';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

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

  @Get()
  async getAll() {
    return this.claimsService.findAll();
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED' }) {
    return this.claimsService.updateStatus(id, body.status);
  }
}
