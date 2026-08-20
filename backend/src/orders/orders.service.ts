import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        promoCode: true,
        claims: {
          select: { id: true, status: true, telegramChatId: true }
        }
      },
    });
  }

  async create(data: {
    promoCodeId: string;
    targetAccounts: number;
    freeDepositConditions: string;
  }) {
    // Verify promo code exists
    const promo = await this.prisma.promoCode.findUnique({
      where: { id: data.promoCodeId },
    });

    if (!promo) throw new NotFoundException('Promo code not found');

    return this.prisma.order.create({
      data: {
        promoCodeId: data.promoCodeId,
        targetAccounts: Number(data.targetAccounts),
        freeDepositConditions: data.freeDepositConditions,
        status: 'ACTIVE',
      },
      include: { promoCode: true },
    });
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'COMPLETED') {
    return this.prisma.order.update({
      where: { id },
      data: { status },
      include: { promoCode: true },
    });
  }

  async delete(id: string) {
    return this.prisma.order.delete({ where: { id } });
  }

  async getActiveOrderForBot() {
    // Fetch the most recent active order that still needs target accounts
    return this.prisma.order.findFirst({
      where: {
        status: 'ACTIVE',
        promoCode: { isActive: true },
      },
      orderBy: { createdAt: 'desc' },
      include: { promoCode: true },
    });
  }
}
