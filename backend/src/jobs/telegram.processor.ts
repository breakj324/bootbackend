import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { TelegramService } from '../telegram/telegram.service';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

@Processor('telegram-queue')
export class TelegramProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramProcessor.name);

  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    const log = await this.prisma.jobLog.create({
      data: {
        queueName: 'telegram-queue',
        jobName: job.name,
        status: 'PENDING',
        payload: job.data,
      },
    });

    try {
      if (job.name === 'handle-webhook-update') {
        const { update } = job.data;
        await this.handleTelegramUpdate(update);
      }

      await this.prisma.jobLog.update({
        where: { id: log.id },
        data: { status: 'SUCCESS' },
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Job execution failed: ${error.message}`);
      await this.prisma.jobLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', error: error.message },
      });
      throw error;
    }
  }

  public async handleTelegramUpdate(update: any) {
    this.logger.log(`handleTelegramUpdate called: ${JSON.stringify(update)}`);

    // Handle Inline Keyboard Button Clicks (callback_query)
    if (update?.callback_query) {
      const callbackQuery = update.callback_query;
      const callbackId = callbackQuery.id;
      const callbackData = callbackQuery.data;
      const chatId = String(callbackQuery.message.chat.id);
      const user = callbackQuery.from || {};
      const firstName = user.first_name || '';
      const lastName = user.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || 'Joueur';

      await this.telegramService.answerCallbackQuery(callbackId);

      if (callbackData === 'my_claims') {
        await this.sendMyClaims(chatId, fullName);
        return;
      }

      if (callbackData === 'show_offers') {
        await this.sendOffersMenu(chatId, fullName);
        return;
      }

      if (callbackData?.startsWith('select_order_')) {
        const orderId = callbackData.replace('select_order_', '');
        await this.handleOrderSelection(chatId, fullName, orderId);
        return;
      }

      return;
    }

    // Handle Standard Text/Photo Messages
    if (!update?.message || !update?.message?.chat) return;

    const chatId = String(update.message.chat.id);
    const text = update.message.text ? update.message.text.trim() : (update.message.caption ? update.message.caption.trim() : '');
    const username = update.message.chat.username || null;
    const firstName = update.message.chat.first_name || '';
    const lastName = update.message.chat.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Joueur';

    const hasPhoto = !!(update.message.photo && update.message.photo.length > 0) || !!update.message.document;
    let screenshotFileId = null;

    if (update.message.photo && update.message.photo.length > 0) {
      screenshotFileId = update.message.photo[update.message.photo.length - 1].file_id;
    } else if (update.message.document) {
      screenshotFileId = update.message.document.file_id;
    }

    // Command /start, /offers, /menu or /myclaims
    const lowerText = text.toLowerCase();
    if (lowerText === '/start' || lowerText === '/offers' || lowerText === 'offres' || lowerText === 'menu') {
      await this.prisma.telegramConversationState.upsert({
        where: { telegramChatId: chatId },
        create: { telegramChatId: chatId, step: 'IDLE' },
        update: { step: 'IDLE', currentOrderId: null, metadata: null },
      });
      await this.sendOffersMenu(chatId, fullName);
      return;
    }

    if (lowerText === '/myclaims' || lowerText.includes('demandes') || lowerText.includes('طلباتي')) {
      await this.sendMyClaims(chatId, fullName);
      return;
    }

    // Fetch conversation state
    let convState = await this.prisma.telegramConversationState.findUnique({
      where: { telegramChatId: chatId },
    });

    if (!convState) {
      convState = await this.prisma.telegramConversationState.create({
        data: { telegramChatId: chatId, step: 'IDLE' },
      });
    }

    if (convState.step === 'IDLE') {
      await this.sendOffersMenu(chatId, fullName);
      return;
    }

    // Step 1: Player enters Bookmaker 10-Digit Account ID
    if (convState.step === 'AWAITING_BOOKMAKER_ID' && !hasPhoto) {
      const bookmakerAccountId = text;

      // Validate exactly 10 digits
      const isTenDigits = /^\d{10}$/.test(bookmakerAccountId);
      if (!isTenDigits) {
        await this.telegramService.sendMessage(
          chatId,
          `⚠️ <b>الأيدي غير صحيح !</b>\n\nالأيدي (ID) خاصو يكون كيتكون من 10 ديال الأرقام بالضبط (مثال: 1770795503). عاود صيفط الرقم الصحيح من فضلك.`,
        );
        return;
      }

      // Check global uniqueness of Bookmaker Account ID
      const existingIdClaim = await this.prisma.playerClaim.findFirst({
        where: { playerBookmakerId: bookmakerAccountId },
      });

      if (existingIdClaim) {
        await this.telegramService.sendMessage(
          chatId,
          `❌ <b>الأيدي مستعمل ديجا !</b>\n\nهاد الأيدي (ID) <code>${bookmakerAccountId}</code> ديجا تسجل فالعرض من طرف مستخدم آخر. مايمكنش ليك تعاود تستعمل نفس الأيدي.`,
        );
        return;
      }

      // Fetch active order context
      let currentOrder: any = null;
      if (convState.currentOrderId) {
        currentOrder = await this.prisma.order.findUnique({
          where: { id: convState.currentOrderId },
          include: { promoCode: true },
        });
      }

      if (!currentOrder) {
        currentOrder = await this.prisma.order.findFirst({
          where: { status: 'ACTIVE', promoCode: { isActive: true } },
          orderBy: { createdAt: 'desc' },
          include: { promoCode: true },
        });
      }

      if (!currentOrder) {
        await this.sendOffersMenu(chatId, fullName);
        return;
      }

      // ✅ Create claim immediately in DB (without screenshot yet) so it appears in dashboard
      const newClaim = await this.prisma.playerClaim.create({
        data: {
          telegramChatId: chatId,
          telegramUsername: username,
          telegramName: fullName,
          promoCodeId: currentOrder.promoCodeId,
          orderId: currentOrder.id,
          playerBookmakerId: bookmakerAccountId,
          screenshotUrl: null, // Will be updated when player sends screenshot
          status: 'PENDING',
        },
      });

      // Increment claimed count on campaign order
      await this.prisma.order.update({
        where: { id: currentOrder.id },
        data: { claimedCount: { increment: 1 } },
      });

      // Check target accounts limit
      if (currentOrder.claimedCount + 1 >= currentOrder.targetAccounts) {
        await this.prisma.order.update({
          where: { id: currentOrder.id },
          data: { status: 'COMPLETED' },
        });
      }

      // Save claimId + context in conversation metadata for screenshot update step
      await this.prisma.telegramConversationState.update({
        where: { telegramChatId: chatId },
        data: {
          step: 'AWAITING_SCREENSHOT',
          metadata: JSON.stringify({
            claimId: newClaim.id,
            playerBookmakerId: bookmakerAccountId,
            orderId: currentOrder.id,
            promoCodeId: currentOrder.promoCodeId,
          }),
        },
      });

      const promoCodeName = currentOrder.promoCode.code;
      const bookmakerName = currentOrder.promoCode.bookmaker;

      const caption = `💬 <b>خطوة أخيرة ومهمة!</b>\n\nشكراً، الأيدي ديالك فـ <b>${bookmakerName}</b> هو <code>${bookmakerAccountId}</code>.\n\nدابا، <b>صيفط ليا سكرين شوت (صورة الشاشة)</b> ديال الحساب ديالك اللي تسجلتي بيه (يكون كايظهر بحال هاد النموذج التوضيحي، فين كايظهر الأيدي والكود برومو <code>${promoCodeName}</code>) باش نأكدو التسجيل ديالك ونفعلوا ليك البونص. 📸`;

      try {
        let photoToSend = path.join(process.cwd(), 'src', 'claims', 'example-screenshot.png');

        if (currentOrder.promoCode?.exampleImageUrl) {
          const custom = currentOrder.promoCode.exampleImageUrl.trim();
          if (custom.startsWith('/uploads/') || custom.startsWith('uploads/')) {
            const rel = custom.replace(/^\//, '');
            const diskPath = path.join(process.cwd(), rel);
            if (fs.existsSync(diskPath)) {
              photoToSend = diskPath;
            }
          } else if (fs.existsSync(custom)) {
            photoToSend = custom;
          } else {
            photoToSend = custom;
          }
        }

        await this.telegramService.sendPhoto(chatId, photoToSend, caption);
      } catch (err) {
        this.logger.warn(`Could not send photo directly, falling back to text: ${err.message}`);
        await this.telegramService.sendMessage(chatId, caption);
      }
    } else if (convState.step === 'AWAITING_SCREENSHOT') {
      let meta: any = {};
      try {
        if (convState.metadata) {
          meta = JSON.parse(convState.metadata);
        }
      } catch (e) {
        this.logger.error(`Error parsing metadata: ${e.message}`);
      }

      const orderId = meta.orderId || convState.currentOrderId;
      let order: any = null;

      if (orderId) {
        order = await this.prisma.order.findUnique({
          where: { id: orderId },
          include: { promoCode: true },
        });
      }

      if (!order) {
        order = await this.prisma.order.findFirst({
          where: { status: 'ACTIVE', promoCode: { isActive: true } },
          orderBy: { createdAt: 'desc' },
          include: { promoCode: true },
        });
      }

      if (!order) {
        await this.sendOffersMenu(chatId, fullName);
        return;
      }

      if (!hasPhoto) {
        // Player sent text instead of screenshot — remind them but claim already exists in DB
        await this.telegramService.sendMessage(
          chatId,
          `⚠️ <b>عافاك صيفط صورة (Screenshot) !</b>\n\nهاد الخطوة ضرورية بزاف باش نقدرو نتحققوا من الحساب ديالك ونرسلو ليك البونص. صيفط ليا سكرين شوت ديال التسجيل دابا من فضلك.`,
        );
        return;
      }

      // ✅ Download screenshot from Telegram and save locally, then update claim
      if (meta.claimId) {
        try {
          let savedScreenshotUrl: string | null = null;

          // Download the photo from Telegram and save to /uploads/screenshots/
          if (screenshotFileId) {
            savedScreenshotUrl = await this.telegramService.downloadTelegramFile(screenshotFileId);
          }

          await this.prisma.playerClaim.update({
            where: { id: meta.claimId },
            data: { screenshotUrl: savedScreenshotUrl || 'telegram_file_uploaded' },
          });
          this.logger.log(`Updated claim ${meta.claimId} with screenshot: ${savedScreenshotUrl}`);
        } catch (err) {
          this.logger.error(`Could not update claim screenshot: ${err.message}`);
        }
      }

      // Reset step to IDLE
      await this.prisma.telegramConversationState.update({
        where: { telegramChatId: chatId },
        data: { step: 'IDLE', currentOrderId: null, metadata: null },
      });

      const inline_keyboard = [
        [
          { text: '🎁 Voir d\'autres offres / عرض عروض أخرى', callback_data: 'show_offers' },
          { text: '📋 Mes demandes / طلباتي', callback_data: 'my_claims' },
        ],
      ];

      await this.telegramService.sendMessage(
        chatId,
        `✅ <b>تم تسجيل الطلب بنجاح!</b>\n\nشكراً ليك! صيفطنا المعلومات ديالك للفريق المكلّف. غادي نراجعو الأيدي والسكرين شوت ديالك وغادي نجاوبوك هنا ف أقرب وقت فاش يتفعل البونص ديالك فـ <b>${order.promoCode.bookmaker}</b>. 🚀`,
        { inline_keyboard },
      );
    }
  }

  /**
   * Helper: Send Active Offers Menu with Interactive Telegram Buttons
   */
  private async sendOffersMenu(chatId: string, fullName: string) {
    const activeOrders = await this.prisma.order.findMany({
      where: {
        status: 'ACTIVE',
        promoCode: { isActive: true },
      },
      include: { promoCode: true },
      orderBy: { createdAt: 'desc' },
    });

    const userClaims = await this.prisma.playerClaim.findMany({
      where: { telegramChatId: chatId },
      select: { promoCodeId: true },
    });
    const claimedPromoCodeIds = new Set(userClaims.map(c => c.promoCodeId));

    // Only include active orders that have remaining quota AND haven't been claimed by this player
    const availableOrders = activeOrders.filter(
      o => o.claimedCount < o.targetAccounts && !claimedPromoCodeIds.has(o.promoCodeId),
    );

    if (availableOrders.length === 0) {
      const hasAnyClaims = userClaims.length > 0;
      const text = hasAnyClaims
        ? `🎉 <b>تبارك الله عليك ${fullName}!</b>\n\nراك ديجا تستافدتي من كاع العروض المتوفرة حالياً. خليك متبع الشات باش يوصلك الجديد فاش نطلقو عروض جديدة!`
        : `ℹ️ <b>مرحباً بك ${fullName}!</b>\n\nحالياً ماكاين حتى شي عرض ديال البونص أو الديبو فابور. خليك متبع الشات باش يوصلك الجديد فاش نطلقو العرض الجاي!`;

      const inline_keyboard = [
        [{ text: '📋 حالة طلباتي / Mes Demandes', callback_data: 'my_claims' }],
      ];
      await this.telegramService.sendMessage(chatId, text, { inline_keyboard });
      return;
    }

    const inline_keyboard: any[] = availableOrders.map(order => [
      {
        text: `🎁 ${order.promoCode.bookmaker.toUpperCase()} — (Code: ${order.promoCode.code})`,
        callback_data: `select_order_${order.id}`,
      },
    ]);

    inline_keyboard.push([
      { text: '📋 حالة طلباتي / Mes Demandes', callback_data: 'my_claims' },
    ]);

    const text = `🎁 <b>عروض البونص والديبو فابور المتوفرة :</b>\n\nأهلاً بك <b>${fullName}</b>!\nاختر العرض اللي بغيتي تستافد منو بالضغط على الزر أسفله :`;

    await this.telegramService.sendMessage(chatId, text, { inline_keyboard });
  }

  /**
   * Helper: Send Player's Claims Status List
   */
  private async sendMyClaims(chatId: string, fullName: string) {
    const claims = await this.prisma.playerClaim.findMany({
      where: { telegramChatId: chatId },
      include: { promoCode: true, order: true },
      orderBy: { createdAt: 'desc' },
    });

    if (claims.length === 0) {
      const text = `📋 <b>ما عندك حتى شي طلب ديجا تسجل!</b>\n\nأهلاً ${fullName}، مزال ما شاركتي ف حتى شي عرض. اضغط على الزر أسفله باش تشوف العروض المتوفرة.`;
      const inline_keyboard = [
        [{ text: '🎁 عرض العروض المتوفرة / Voir les offres', callback_data: 'show_offers' }],
      ];
      await this.telegramService.sendMessage(chatId, text, { inline_keyboard });
      return;
    }

    const statusMap = {
      PENDING: 'قيد المراجعة ⏳',
      APPROVED: 'مقبول ✅',
      REJECTED: 'مرفوض ❌',
    };

    let message = `📋 <b>حالة الطلبات ديالك (${claims.length}) :</b>\n\n`;
    claims.forEach((claim, idx) => {
      const statusAr = statusMap[claim.status] || claim.status;
      message += `${idx + 1}️⃣ <b>${claim.promoCode.bookmaker}</b> (Code: <code>${claim.promoCode.code}</code>)\n`;
      message += `   • ID: <code>${claim.playerBookmakerId || 'N/A'}</code>\n`;
      message += `   • الحالة: <b>${statusAr}</b>\n\n`;
    });

    const inline_keyboard = [
      [{ text: '🎁 Voir d\'autres offres / عرض عروض أخرى', callback_data: 'show_offers' }],
    ];

    await this.telegramService.sendMessage(chatId, message, { inline_keyboard });
  }

  /**
   * Helper: Handle order selection from inline button click
   */
  private async handleOrderSelection(chatId: string, fullName: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { promoCode: true },
    });

    if (!order || order.status !== 'ACTIVE' || !order.promoCode.isActive) {
      await this.telegramService.sendMessage(
        chatId,
        `⚠️ <b>هاد العرض سالا أو غير متوفر حالياً!</b>`,
      );
      await this.sendOffersMenu(chatId, fullName);
      return;
    }

    // Check if player has already claimed this specific promo code
    const existingClaim = await this.prisma.playerClaim.findUnique({
      where: {
        telegramChatId_promoCodeId: {
          telegramChatId: chatId,
          promoCodeId: order.promoCodeId,
        },
      },
    });

    if (existingClaim) {
      const statusMap = {
        PENDING: 'قيد المراجعة ⏳',
        APPROVED: 'مقبول ✅',
        REJECTED: 'مرفوض ❌',
      };
      const statusAr = statusMap[existingClaim.status] || existingClaim.status;
      const inline_keyboard = [
        [
          { text: '🎁 Voir d\'autres offres / عروض أخرى', callback_data: 'show_offers' },
          { text: '📋 Mes demandes / طلباتي', callback_data: 'my_claims' },
        ],
      ];
      await this.telegramService.sendMessage(
        chatId,
        `⚠️ <b>هاد العرض مستعمل ديجا!</b>\n\nأهلاً ${fullName}، راك ديجا شاركتي فهاد العرض ديال الكود برومو <code>${order.promoCode.code}</code> (${order.promoCode.bookmaker}).\n\n<i>حالة الطلب ديالك دابا هي:</i> <b>${statusAr}</b>.`,
        { inline_keyboard },
      );
      return;
    }

    // Set conversation step for this order
    await this.prisma.telegramConversationState.upsert({
      where: { telegramChatId: chatId },
      create: {
        telegramChatId: chatId,
        step: 'AWAITING_BOOKMAKER_ID',
        currentOrderId: order.id,
        metadata: JSON.stringify({ orderId: order.id, promoCodeId: order.promoCodeId }),
      },
      update: {
        step: 'AWAITING_BOOKMAKER_ID',
        currentOrderId: order.id,
        metadata: JSON.stringify({ orderId: order.id, promoCodeId: order.promoCodeId }),
      },
    });

    const messageContent = `🎁 <b>عرض البونص والتسجيل - ${order.promoCode.bookmaker.toUpperCase()}</b>\n\n` +
      `مرحباً بك <b>${fullName}</b>!\n` +
      `باش تستافد من البونص والديبو فابور ديال <b>${order.promoCode.bookmaker}</b>، تبع هاد الخطوات البسيطة :\n\n` +
      `1️⃣ تسجل فـ <b>${order.promoCode.bookmaker}</b>\n` +
      `2️⃣ دير الكود برومو الضروري: <code>${order.promoCode.code}</code>\n` +
      `3️⃣ <b>الشروط المطلوبة :</b> ${order.freeDepositConditions}\n\n` +
      `👉 <b>صيفط ليا دابا الأيدي (ID)</b> ديال الحساب ديالك اللي تسجلتي بيه فـ ${order.promoCode.bookmaker} باش نتحققوا منو (يتكون من 10 أرقام).`;

    await this.telegramService.sendMessage(chatId, messageContent);
  }
}
