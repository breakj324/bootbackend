import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  async create(data: {
    telegramChatId: string;
    telegramUsername?: string;
    telegramName?: string;
    promoCodeId: string;
    orderId: string;
    playerBookmakerId: string;
    screenshotUrl?: string;
  }) {
    // Validate uniqueness globally
    const existing = await this.prisma.playerClaim.findFirst({
      where: { playerBookmakerId: data.playerBookmakerId },
    });
    if (existing) {
      throw new BadRequestException('ID bookmaker déjà utilisé par un autre joueur.');
    }

    const claim = await this.prisma.playerClaim.create({
      data: {
        telegramChatId: data.telegramChatId,
        telegramUsername: data.telegramUsername,
        telegramName: data.telegramName,
        promoCodeId: data.promoCodeId,
        orderId: data.orderId,
        playerBookmakerId: data.playerBookmakerId,
        screenshotUrl: data.screenshotUrl || 'simulated_screenshot',
        status: 'PENDING',
      },
      include: {
        promoCode: true,
        order: true,
      },
    });

    // Increment order claimedCount
    await this.prisma.order.update({
      where: { id: data.orderId },
      data: { claimedCount: { increment: 1 } },
    });

    return claim;
  }

  async findAll() {
    return this.prisma.playerClaim.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        promoCode: true,
        order: true,
      },
    });
  }

  async updateStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    const claim = await this.prisma.playerClaim.findUnique({
      where: { id },
      include: { promoCode: true, order: true },
    });

    if (!claim) throw new NotFoundException('Player claim record not found');

    const updatedClaim = await this.prisma.playerClaim.update({
      where: { id },
      data: { status },
      include: { promoCode: true, order: true },
    });

    // Notify the player via Telegram in Moroccan Darija
    try {
      if (status === 'APPROVED') {
        await this.telegramService.sendMessage(
          claim.telegramChatId,
          `🎉 <b>مبروك عليك! تم تفعيل الحساب ديالك بنجاح!</b> 🎁\n\n` +
          `الطلب ديالك ديال الديبو فابور فـ <b>${claim.promoCode.bookmaker}</b> (الكود برومو: <code>${claim.promoCode.code}</code>) تم <b>الموافقة عليه</b> وتفعل البونص فـ الحساب ديالك بنجاح! 💰🔥\n\n` +
          `📌 <b>شرط سحب الأرباح (Condition de Retrait) :</b>\n` +
          `خاصك تبدأ تلعب وتراهن بالحساب ديالك وتطلع الرصيد (Solde) لـ <b>5,000 درهم (5000 DH)</b> أو أكثر من بعد الرهان! 🎯\n\n` +
          `⏳ <b>تنبيه عاجل ومهم بزاف (فرصة 24 ساعة فقط!):</b>\n` +
          `خاصك تبدأ تلعب فـ <u>أقرب وقت قبل ما تفوت 24 ساعة</u>! ⚠️\n` +
          `سحب الأرباح (Le Retrait) غادي يتحل <b>غداً رسمياً</b>، واللاعبين اللي لعبوا وطلعوا الرصيد ديالهم لـ 5,000 DH هما لغادي يقدروا يسحبوا فلوسهم كاش فـ البلاصة! 💸🚀\n\n` +
          `⚡️ <b>لا تضيع هاد الفرصة الذهبية! ادخل دابا للحساب ديالك، ابدأ اللعب فـ البلاصة، طلع الرصيد لـ 5000 DH وحضر راسك للسحب ديال غداً!</b> 🔥`,
        );
      } else {
        // Decrement claimedCount on campaign order to free up quota
        if (claim.order && claim.order.claimedCount > 0) {
          await this.prisma.order.update({
            where: { id: claim.orderId },
            data: { claimedCount: { decrement: 1 } },
          });
        }

        const inline_keyboard = [
          [
            { text: '🔄 إعادة محاولة التسجيل / Réessayer', callback_data: `select_order_${claim.orderId}` },
          ],
          [
            { text: '🎁 Voir d\'autres offres / عرض عروض أخرى', callback_data: 'show_offers' },
          ],
        ];

        await this.telegramService.sendMessage(
          claim.telegramChatId,
          `❌ <b>تم رفض الطلب ديالك / Demande non validée</b>\n\n` +
          `للأسف، التحقق من الحساب ديالك فـ <b>${claim.promoCode.bookmaker}</b> (الكود برومو: <code>${claim.promoCode.code}</code>) ما تقبلش بسبب معلومات أو سكرين شوت غير صحيحة. ⚠️\n\n` +
          `🔄 <b>تقدر تعاود تصاوب طلب جديد دابا !</b>\n` +
          `تأكد بلي تسجلتي بالكود برومو الصحيح و صيفط لينا الأيدي و السكرين شوت الواضحة بالضغط على الزر أسفله :`,
          { inline_keyboard },
        );
      }
    } catch (err) {
      console.error(`Could not notify Telegram player ${claim.telegramChatId}:`, err);
    }

    return updatedClaim;
  }
}
