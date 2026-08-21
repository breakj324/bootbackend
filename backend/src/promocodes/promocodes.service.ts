import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { orders: true, claims: true },
        },
      },
    });
  }

  async create(data: { code: string; bookmaker: string; exampleImageUrl?: string }) {
    const existing = await this.prisma.promoCode.findUnique({
      where: { code: data.code.trim().toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(`Promo code "${data.code}" already exists.`);
    }

    return this.prisma.promoCode.create({
      data: {
        code: data.code.trim().toUpperCase(),
        bookmaker: data.bookmaker.trim(),
        exampleImageUrl: data.exampleImageUrl?.trim() || null,
      },
    });
  }

  async updateExampleImage(id: string, exampleImageUrl: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promo code not found');

    return this.prisma.promoCode.update({
      where: { id },
      data: { exampleImageUrl: exampleImageUrl?.trim() || null },
    });
  }

  async toggleActive(id: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promo code not found');

    return this.prisma.promoCode.update({
      where: { id },
      data: { isActive: !promo.isActive },
    });
  }

  async delete(id: string) {
    return this.prisma.promoCode.delete({ where: { id } });
  }
}
