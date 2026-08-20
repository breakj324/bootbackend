import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async getAll() {
    return this.ordersService.findAll();
  }

  @Post()
  async create(@Body() body: { promoCodeId: string; targetAccounts: number; freeDepositConditions: string }) {
    return this.ordersService.create(body);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' }) {
    return this.ordersService.updateStatus(id, body.status);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.ordersService.delete(id);
  }
}
